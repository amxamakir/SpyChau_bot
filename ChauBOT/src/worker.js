import {
  confirmPendingReplyEvents,
  deleteOwnerJournal,
  expirePendingReplyEvents,
  getGroupMessageSnapshot,
  hydrateEventRows,
  maintainJournal,
  readArchivedMedia,
  serveArchivedMedia,
  serveContactAvatar,
  storeBusinessEvent,
  storeGroupMessageSnapshot,
} from "./journal.js";

const MAX_INIT_DATA_AGE_SECONDS = 60 * 60 * 24;
const ARCHIVE_PAGE_SIZE = 100;
const PERSONAL_SUBSCRIPTION_PLANS = Object.freeze({
  month: { months: 1, rubles: 249 },
  "half-year": { months: 6, rubles: 1190 },
  year: { months: 12, rubles: 1790 },
});
const PERSONAL_PACKAGE_PLANS = Object.freeze({
  pack100: { events: 100, rubles: 189 },
  pack300: { events: 300, rubles: 499 },
  pack500: { events: 500, rubles: 699 },
});

function tributePaymentsConfigured(env) {
  return env.TRIBUTE_PAYMENTS_ENABLED === "true"
    && typeof env.TRIBUTE_API_KEY === "string" && env.TRIBUTE_API_KEY.trim()
    && typeof env.PAYMENTS_TERMS_VERSION === "string" && env.PAYMENTS_TERMS_VERSION.trim()
    && typeof env.PAYMENTS_TERMS_TEXT === "string" && env.PAYMENTS_TERMS_TEXT.trim()
    && typeof env.PAYMENTS_SUPPORT_URL === "string"
    && (/^https:\/\/\S+$/i.test(env.PAYMENTS_SUPPORT_URL) || /^mailto:[^\s@]+@[^\s@]+$/i.test(env.PAYMENTS_SUPPORT_URL));
}

function tributePaymentsReady(env, serviceKey = null, planId = null) {
  if (!tributePaymentsConfigured(env)) return false;
  if (serviceKey === "personal_unlimited") {
    return /^https:\/\/(?:t\.me|telegram\.me)\/(?:tribute|tribute_bot)\/app\?startapp=s[\w-]+$/i
      .test(String(env.TRIBUTE_CHECKOUT_URL || "").trim());
  }
  if (serviceKey === "personal_package") {
    if (planId) return Boolean(tributeProduct(env, serviceKey, planId));
    return Object.keys(PERSONAL_PACKAGE_PLANS).some((id) => Boolean(tributeProduct(env, serviceKey, id)));
  }
  return serviceKey === null;
}

function tributeProductMap(env) {
  try {
    const value = JSON.parse(String(env.TRIBUTE_PRODUCTS || "{}"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

function tributeProduct(env, serviceKey, planId) {
  const products = tributeProductMap(env);
  const key = `${serviceKey}:${planId}`;
  const spec = products?.[key];
  const expected = serviceKey === "personal_package"
    ? PERSONAL_PACKAGE_PLANS[planId]?.rubles
    : serviceKey === "personal_unlimited" ? PERSONAL_SUBSCRIPTION_PLANS[planId]?.rubles : null;
  const rawLink = String(spec?.link || spec?.web_link || "").trim();
  const webMatch = rawLink.match(/^https:\/\/web\.tribute\.tg\/p\/([\w-]+)$/i);
  const link = webMatch
    ? `https://t.me/tribute/app?startapp=p${webMatch[1]}`
    : rawLink;
  const webLink = String(spec?.web_link || (webMatch ? rawLink : "")).trim();
  if (!expected || Number(spec?.amount_rub) !== expected
    || !/^https:\/\/(?:t\.me|telegram\.me)\/(?:tribute|tribute_bot)\/app\?startapp=p[\w-]+$/i.test(link)) return null;
  const plan = serviceKey === "personal_package" ? PERSONAL_PACKAGE_PLANS[planId] : PERSONAL_SUBSCRIPTION_PLANS[planId];
  return { key, link, web_link: webLink, amount_rub: expected, ...plan };
}

async function getTributeProduct(productId, env) {
  const response = await fetch(`https://tribute.tg/api/v1/products/${encodeURIComponent(productId)}`, {
    headers: { "Api-Key": String(env.TRIBUTE_API_KEY || ""), Accept: "application/json" },
  });
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
}

function archiveCursor(url) {
  const value = url.searchParams.get("before_id");
  if (value === null) return { value: null, error: false };
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    return { value: null, error: true };
  }
  return { value, error: false };
}

function archivePage(rows) {
  const hasMore = rows.length > ARCHIVE_PAGE_SIZE;
  const events = rows.slice(0, ARCHIVE_PAGE_SIZE);
  return {
    rows: events,
    has_more: hasMore,
    next_cursor: hasMore && events.length ? String(events[events.length - 1].id) : null,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = url.pathname;

    if (route === "/health" && request.method === "GET") {
      return json({ status: "ok", service: "spychau-api", version: "0.9.53" });
    }

    const avatarMatch = route.match(/^\/api\/avatar\/(\d+)$/);
    if (avatarMatch && request.method === "GET") {
      return serveContactAvatar(request, env, avatarMatch[1]);
    }

    const mediaMatch = route.match(/^\/api\/media\/(\d+)$/);
    if (mediaMatch && request.method === "GET") {
      return serveArchivedMedia(request, env, mediaMatch[1]);
    }

    if (route === "/api/auth/telegram" && request.method === "POST") {
      try {
        const body = await readJson(request);
        const user = await validateInitData(body.init_data, env);
        await saveUser(env.DB, user);
        await trackAppVisitor(env.DB, user);
        await initializeNotificationPreferences(env.DB, String(user.id), body.notification_preferences);
        return json({ ...(await getUserBootstrap(env, user)), authenticated: true });
      } catch (error) {
        return json({ error: publicError(error) }, 401);
      }
    }

    if (route.startsWith("/api/")) {
      let user;
      try {
        user = await userFromRequest(request, env);
      } catch (error) {
        return json({ error: publicError(error) }, 401);
      }

      try {
        await saveUser(env.DB, user);
        if (route === "/api/telegram/connect-instructions" && request.method === "POST") {
          const sent = await sendConnectInstructions(env, String(user.id));
          return json({ sent });
        }

        if (route === "/api/me" && request.method === "GET") {
          return json(await getUserBootstrap(env, user));
        }

        if (route === "/api/payments/checkout" && request.method === "POST") {
          if (!tributePaymentsReady(env)) return json({ error: "payments_not_ready" }, 503);
          const body = await readJson(request);
          if (body.terms_accepted !== true || body.terms_version !== env.PAYMENTS_TERMS_VERSION) {
            return json({ error: "terms_acceptance_required" }, 400);
          }
          const serviceKey = String(body.service_key || "personal_unlimited");
          const planId = String(body.plan_id || "");
          if (!(["personal_unlimited", "personal_package"].includes(serviceKey))) return json({ error: "plan_unavailable" }, 400);
          const plan = serviceKey === "personal_package" ? PERSONAL_PACKAGE_PLANS[planId] : PERSONAL_SUBSCRIPTION_PLANS[planId];
          const ownerId = String(user.id);
          if (!plan) return json({ error: "plan_unavailable" }, 400);
          if (!tributePaymentsReady(env, serviceKey, planId)) return json({ error: "plan_unavailable" }, 503);
          if (serviceKey === "personal_unlimited") {
            await env.DB.batch(Object.keys(PERSONAL_SUBSCRIPTION_PLANS).map((subscriptionPlanId) =>
              env.DB.prepare(`INSERT INTO payment_consents(consent_id, owner_id, plan_id, terms_version)
                VALUES(?, ?, ?, ?)`)
                .bind(crypto.randomUUID(), ownerId, subscriptionPlanId, env.PAYMENTS_TERMS_VERSION)
            ));
            return json({ checkout_url: env.TRIBUTE_CHECKOUT_URL.trim(), amount: plan.rubles, currency: "RUB", service_key: serviceKey, plan_id: planId });
          }
          const product = tributeProduct(env, serviceKey, planId);
          if (!product) return json({ error: "plan_unavailable" }, 400);
          await env.DB.prepare(`INSERT INTO tribute_product_consents(consent_id, owner_id, plan_id, terms_version, service_key)
            VALUES(?, ?, ?, ?, ?)`)
            .bind(crypto.randomUUID(), ownerId, planId, env.PAYMENTS_TERMS_VERSION, serviceKey).run();
          return json({ checkout_url: product.link, amount: plan.rubles, currency: "RUB", service_key: serviceKey, plan_id: planId });
        }

        if (route === "/api/home/events" && request.method === "GET") {
          const subscription = await getSubscription(env.DB, String(user.id));
          const packageBalance = await getNotificationPackageBalance(env.DB, String(user.id));
          if (!subscription.active && !packageBalance.remaining) return json({ events: [], package_balance: packageBalance });
          const preferences = await getNotificationPreferences(env.DB, String(user.id));
          const rows = await env.DB.prepare(subscription.active
            ? "SELECT * FROM events WHERE owner_id = ? AND created_at >= datetime('now', '-7 days') ORDER BY id DESC LIMIT 25"
            : `SELECT * FROM events WHERE owner_id = ? AND created_at >= datetime('now', '-7 days')
              AND id > COALESCE((SELECT MIN(activated_after_event_id) FROM notification_packages
                WHERE owner_id = ? AND credits_remaining > 0), 0) ORDER BY id DESC LIMIT 25`)
            .bind(...(subscription.active ? [String(user.id)] : [String(user.id), String(user.id)])).all();
          const events = (await hydrateEventRows(rows.results, env)).filter((event) =>
            isEventEnabledForOwner(event, user.id, preferences.preferences)
          );
          return json({ events, package_balance: packageBalance });
        }

        if (route === "/api/owner/statistics" && request.method === "GET") {
          const ownerId = String(user.id);
          if (!env.SUBSCRIPTION_TEST_OWNER_ID || ownerId !== String(env.SUBSCRIPTION_TEST_OWNER_ID)) return json({ error: "not found" }, 404);
          await env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_visitors (telegram_id TEXT PRIMARY KEY, first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
          await env.DB.prepare("INSERT OR IGNORE INTO app_visitors(telegram_id) SELECT telegram_id FROM users").run();
          const result = await env.DB.prepare("SELECT COUNT(*) AS total FROM app_visitors").first();
          return json({ unique_visitors: Number(result?.total || 0) });
        }

        if (route === "/api/owner/test-group" && ["GET", "POST"].includes(request.method)) {
          const ownerId = String(user.id);
          if (!env.SUBSCRIPTION_TEST_OWNER_ID || ownerId !== String(env.SUBSCRIPTION_TEST_OWNER_ID)) return json({ error: "not found" }, 404);
          await ensureTestGroup(env.DB, ownerId);
          if (request.method === "GET") {
            const members = await env.DB.prepare("SELECT telegram_id, added_at FROM test_group_members ORDER BY added_at DESC, telegram_id ASC").all();
            return json({ members: members.results.map(({ telegram_id, added_at }) => ({ telegram_id, added_at })) });
          }
          const body = await readJson(request);
          const telegramId = String(body.telegram_id || "").trim();
          if (!/^\d{1,20}$/.test(telegramId)) return json({ error: "Укажи корректный Telegram ID." }, 400);
          await env.DB.prepare("INSERT OR IGNORE INTO test_group_members(telegram_id, added_by) VALUES(?, ?)").bind(telegramId, ownerId).run();
          return json({ added: true, members: (await env.DB.prepare("SELECT telegram_id, added_at FROM test_group_members ORDER BY added_at DESC, telegram_id ASC").all()).results });
        }

        const testGroupMemberMatch = route.match(/^\/api\/owner\/test-group\/(\d+)$/);
        if (testGroupMemberMatch && request.method === "DELETE") {
          const ownerId = String(user.id);
          if (!env.SUBSCRIPTION_TEST_OWNER_ID || ownerId !== String(env.SUBSCRIPTION_TEST_OWNER_ID)) return json({ error: "not found" }, 404);
          await ensureTestGroup(env.DB, ownerId);
          await env.DB.prepare("DELETE FROM test_group_members WHERE telegram_id = ?").bind(testGroupMemberMatch[1]).run();
          return json({ removed: true });
        }

        if (route === "/api/subscription/test-override" && request.method === "POST") {
          const ownerId = String(user.id);
          if (!env.SUBSCRIPTION_TEST_OWNER_ID || ownerId !== String(env.SUBSCRIPTION_TEST_OWNER_ID)) return json({ error: "not found" }, 404);
          const body = await readJson(request);
          if (typeof body.active !== "boolean") return json({ error: "active must be a boolean" }, 400);
          await env.DB.prepare(`CREATE TABLE IF NOT EXISTS subscription_test_overrides (owner_id TEXT PRIMARY KEY, active INTEGER NOT NULL CHECK(active IN (0, 1)), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
          await env.DB.prepare(`INSERT INTO subscription_test_overrides(owner_id, active) VALUES(?, ?) ON CONFLICT(owner_id) DO UPDATE SET active = excluded.active, updated_at = CURRENT_TIMESTAMP`).bind(ownerId, Number(body.active)).run();
          return json({ subscription: await getSubscription(env.DB, ownerId) });
        }

        if (route === "/api/me/receipt-email" && request.method === "PUT") {
          const body = await readJson(request);
          const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
          if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return json({ error: "invalid_email" }, 400);
          }
          await env.DB.prepare("UPDATE users SET receipt_email = ? WHERE telegram_id = ?").bind(email, String(user.id)).run();
          return json({ receipt_email: email });
        }

        if (route === "/api/me/notification-preferences" && request.method === "GET") {
          return json(await getNotificationPreferences(env.DB, String(user.id)));
        }

        if (route === "/api/me/notification-preferences" && request.method === "PUT") {
          const body = await readJson(request);
          const preferences = body.preferences;
          const keys = ["deleted_messages", "edited_messages", "one_time_messages", "group_messages", "deleted_by_owner", "edited_by_owner"];
          if (!preferences || typeof preferences !== "object" || keys.some((key) => typeof preferences[key] !== "boolean")) {
            return json({ error: "invalid_notification_preferences" }, 400);
          }
          await env.DB.prepare(`
            INSERT INTO notification_preferences(owner_id, deleted_messages, edited_messages, one_time_messages, group_messages, deleted_by_owner, edited_by_owner)
            VALUES(?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(owner_id) DO UPDATE SET
              deleted_messages = excluded.deleted_messages,
              edited_messages = excluded.edited_messages,
              one_time_messages = excluded.one_time_messages,
              group_messages = excluded.group_messages,
              deleted_by_owner = excluded.deleted_by_owner,
              edited_by_owner = excluded.edited_by_owner,
              updated_at = CURRENT_TIMESTAMP
          `).bind(String(user.id), ...keys.map((key) => Number(preferences[key]))).run();
          return json({ configured: true, preferences });
        }

        if (route === "/api/archive" && request.method === "GET") {
          const cursor = archiveCursor(url);
          if (cursor.error) return json({ error: "invalid_cursor" }, 400);
          const subscription = await getSubscription(env.DB, String(user.id));
          if (!subscription.active || !subscription.capabilities?.personal_archive) return json({ error: "subscription_required" }, 403);
          const preferences = await getNotificationPreferences(env.DB, String(user.id));
          const query = cursor.value
            ? env.DB.prepare("SELECT * FROM events WHERE owner_id = ? AND created_at >= datetime('now', '-7 days') AND id < ? ORDER BY id DESC LIMIT ?").bind(String(user.id), cursor.value, ARCHIVE_PAGE_SIZE + 1)
            : env.DB.prepare("SELECT * FROM events WHERE owner_id = ? AND created_at >= datetime('now', '-7 days') ORDER BY id DESC LIMIT ?").bind(String(user.id), ARCHIVE_PAGE_SIZE + 1);
          const page = archivePage((await query.all()).results || []);
          const hydrated = await hydrateEventRows(page.rows, env);
          const events = hydrated.filter((event) =>
            isEventEnabledForOwner(event, user.id, preferences.preferences)
          );
          return json({ events, has_more: page.has_more, next_cursor: page.next_cursor });
        }

        if (route === "/api/archive/groups" && request.method === "GET") {
          const cursor = archiveCursor(url);
          if (cursor.error) return json({ error: "invalid_cursor" }, 400);
          const subscription = await getSubscription(env.DB, String(user.id));
          if (!subscription.active) return json({ error: "subscription_required" }, 403);
          const ownerId = String(user.id);
          if (!env.SUBSCRIPTION_TEST_OWNER_ID || ownerId !== String(env.SUBSCRIPTION_TEST_OWNER_ID)) {
            return json({ available: false, groups: [], topics: [], events: [] });
          }
          const groups = await env.DB.prepare(`
            SELECT chat_id, chat_type, title, username, bot_status, connected_at, updated_at
            FROM group_chats WHERE owner_id = ? AND active = 1 ORDER BY updated_at DESC
          `).bind(ownerId).all();
          const topics = await env.DB.prepare(`
            SELECT t.chat_id, t.thread_id, t.name, t.updated_at
            FROM group_topics t JOIN group_chats g ON g.owner_id = t.owner_id AND g.chat_id = t.chat_id
            WHERE t.owner_id = ? AND g.active = 1 ORDER BY t.updated_at DESC
          `).bind(ownerId).all();
          const query = cursor.value
            ? env.DB.prepare(`SELECT * FROM events WHERE owner_id = ? AND event_type = 'edited' AND created_at >= datetime('now', '-7 days') AND chat_id IN (SELECT chat_id FROM group_chats WHERE owner_id = ? AND active = 1) AND id < ? ORDER BY id DESC LIMIT ?`).bind(ownerId, ownerId, cursor.value, ARCHIVE_PAGE_SIZE + 1)
            : env.DB.prepare(`SELECT * FROM events WHERE owner_id = ? AND event_type = 'edited' AND created_at >= datetime('now', '-7 days') AND chat_id IN (SELECT chat_id FROM group_chats WHERE owner_id = ? AND active = 1) ORDER BY id DESC LIMIT ?`).bind(ownerId, ownerId, ARCHIVE_PAGE_SIZE + 1);
          const page = archivePage((await query.all()).results || []);
          const events = await hydrateEventRows(page.rows, env);
          const [eventCounts, topicEventCounts] = cursor.value
            ? [{ results: [] }, { results: [] }]
            : await Promise.all([
              env.DB.prepare(`SELECT chat_id, COUNT(*) AS count FROM events WHERE owner_id = ? AND event_type = 'edited' AND created_at >= datetime('now', '-7 days') AND chat_id IN (SELECT chat_id FROM group_chats WHERE owner_id = ? AND active = 1) GROUP BY chat_id`).bind(ownerId, ownerId).all(),
              env.DB.prepare(`SELECT chat_id, message_thread_id, COUNT(*) AS count FROM events WHERE owner_id = ? AND event_type = 'edited' AND created_at >= datetime('now', '-7 days') AND chat_id IN (SELECT chat_id FROM group_chats WHERE owner_id = ? AND active = 1) GROUP BY chat_id, message_thread_id`).bind(ownerId, ownerId).all(),
            ]);
          return json({ available: true, groups: groups.results, topics: topics.results, events, has_more: page.has_more, next_cursor: page.next_cursor, event_counts: eventCounts.results || [], topic_event_counts: topicEventCounts.results || [] });
        }

        if (route === "/api/me/data" && request.method === "DELETE") {
          const ownerId = String(user.id);
          if (!env.JOURNAL) return json({ error: "Хранилище архива временно недоступно. Данные не удалены." }, 503);
          const tables = await env.DB.prepare(`
            SELECT name FROM sqlite_master WHERE type = 'table'
          `).all();
          const existingTables = new Set((tables.results || []).map((row) => row.name));
          await deleteOwnerJournal(env, ownerId);
          const deletions = [];
          if (existingTables.has("test_group_members")) {
            deletions.push(env.DB.prepare("UPDATE test_group_members SET added_by = 'deleted-account' WHERE added_by = ?").bind(ownerId));
          }
          const ownerTables = [
            ["notification_deliveries", "owner_id"],
            ["notification_preferences", "owner_id"],
            ["events", "owner_id"],
            ["group_topics", "owner_id"],
            ["group_message_snapshots", "owner_id"],
            ["group_chats", "owner_id"],
            ["connections", "owner_id"],
            ["payments", "owner_id"],
            ["subscriptions", "owner_id"],
            ["journal_chunks", "owner_id"],
            ["journal_locks", "owner_id"],
            ["subscription_test_overrides", "owner_id"],
            ["app_visitors", "telegram_id"],
            ["test_group_members", "telegram_id"],
          ];
          for (const [table, column] of ownerTables) {
            if (existingTables.has(table)) {
              deletions.push(env.DB.prepare(`DELETE FROM ${table} WHERE ${column} = ?`).bind(ownerId));
            }
          }
          deletions.push(env.DB.prepare("DELETE FROM users WHERE telegram_id = ?").bind(ownerId));
          await env.DB.batch(deletions);
          return json({ deleted: true });
        }

        return json({ error: "not found" }, 404);
      } catch {
        return json({ error: "request failed" }, 500);
      }
    }

    if (route === "/webhooks/telegram" && request.method === "POST") {
      return handleTelegramWebhook(request, env);
    }

    if (route === "/webhooks/telegram/payments" && request.method === "POST") {
      return json({ error: "Telegram invoice payments are not enabled" }, 501);
    }

    if (route === "/webhooks/tribute" && request.method === "POST") {
      return handleTributeWebhook(request, env);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (route === "/" || route === "/index.html" || route === "/app.js" || route === "/src/styles.css") {
      const headers = new Headers(assetResponse.headers);
      headers.set("Cache-Control", ["/", "/index.html", "/app.js", "/src/styles.css"].includes(route)
        ? "no-cache"
        : "public, max-age=31536000, immutable");
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers,
      });
    }
    return assetResponse;
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil((async () => {
      const promotedReplies = await expirePendingReplyEvents(env);
      const repliesByOwner = new Map();
      for (const reply of promotedReplies) {
        const items = repliesByOwner.get(reply.ownerId) || [];
        items.push(reply);
        repliesByOwner.set(reply.ownerId, items);
      }
      for (const [ownerId, replies] of repliesByOwner) {
        await notifySavedEvents(env, ownerId, replies);
      }
      const scheduledMinute = Math.floor(Number(_controller.scheduledTime || Date.now()) / 60_000);
      if (scheduledMinute % 30 === 0) {
        await maintainJournal(env);
        await env.DB.prepare("DELETE FROM notification_deliveries WHERE sent_at < datetime('now', '-7 days')").run();
      }
    })());
  },
};

async function handleTelegramWebhook(request, env) {
  const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
  if (!env.TELEGRAM_WEBHOOK_SECRET || !constantTimeEqual(supplied, env.TELEGRAM_WEBHOOK_SECRET)) {
    return json({ error: "invalid webhook secret" }, 401);
  }

  let update;
  try {
    update = await readJson(request);
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  logBusinessMediaDiagnostic(update);

  try {
    const incomingMessage = update.message;
    const commandText = typeof incomingMessage?.text === "string" ? incomingMessage.text.trim() : "";
    const startMatch = commandText.match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?$/i);
    const helpMatch = commandText.match(/^\/(?:help)(?:@\w+)?$/i);
    const connectMatch = commandText.match(/^\/connect(?:@\w+)?$/i);
    const termsMatch = commandText.match(/^\/terms(?:@\w+)?$/i) || startMatch?.[1] === "terms";
    const paymentSupportMatch = commandText.match(/^\/(?:paysupport|support)(?:@\w+)?$/i) || startMatch?.[1] === "paysupport";
    if (incomingMessage?.chat?.id && incomingMessage.chat.type === "private" && (termsMatch || paymentSupportMatch)) {
      const isTerms = Boolean(termsMatch);
      const message = isTerms
        ? (tributePaymentsReady(env) ? env.PAYMENTS_TERMS_TEXT.trim().slice(0, 4000) : "Условия оплаты пока готовятся. Покупки временно отключены.")
        : (tributePaymentsReady(env) ? `По вопросам оплаты напиши в поддержку: ${env.PAYMENTS_SUPPORT_URL}` : "Поддержка по оплате будет доступна после запуска покупок. Списаний сейчас нет.");
      const sent = await callTelegramJson(env, "sendMessage", { chat_id: incomingMessage.chat.id, text: message });
      return sent ? json({ ok: true, handled: isTerms ? "terms" : "payment_support" }) : json({ error: "Telegram could not send the message" }, 502);
    }
    if (incomingMessage?.chat?.id && incomingMessage.chat.type === "private" && (startMatch || helpMatch || connectMatch)) {
      if (!env.TELEGRAM_BOT_TOKEN) return json({ error: "bot token is not configured" }, 500);
      if (startMatch?.[1] === "connect" || connectMatch) {
        const sent = await sendConnectInstructions(env, incomingMessage.chat.id);
        if (!sent) return json({ error: "Telegram could not send the connection instructions" }, 502);
        return json({ ok: true, handled: "connect_start" });
      }

      const isHelp = Boolean(helpMatch);
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: incomingMessage.chat.id,
          text: isHelp
            ? "Я SpySkaut — архив изменений в подключённых чатах Telegram.\n\n/start — открыть приложение и начать\n/connect — получить инструкцию по подключению личных чатов\n/terms — условия оплаты\n/paysupport — помощь по платежам\n/help — показать эту справку\n\nЯ сохраняю только новые события, которые Telegram присылает после подключения выбранного чата. Историю сообщений до подключения восстановить нельзя."
            : "Привет! Я Скаут, помощник SpySkaut 🕵️\n\n✏️ Показывает изменения сообщений и сохранённый исходный текст.\n🗑️ Фиксирует удаления, о которых Telegram сообщил боту.\n🔔 Присылает уведомления о событиях — их можно настроить в приложении.\n📎 Сохраняет доступные фото, видео, голосовые и документы.\n🗂️ Хранит архив до 7 дней.\n\n<b>Как начать:</b>\n1. Подключи SpySkaut через настройки Telegram.\n2. В «Автоматизации чатов» добавь @SpySkaut_bot и выбери нужные чаты.\n3. Открой приложение и смотри историю событий.\n\nСохраняются события, которые Telegram присылает после подключения выбранных чатов. Исчезающие медиа могут быть недоступны.",
          parse_mode: isHelp ? undefined : "HTML",
          reply_markup: {
            inline_keyboard: isHelp
              ? [[{ text: "Открыть SpySkaut", web_app: { url: "https://spychau-bot.senba11.workers.dev/" } }]]
              : [
                  [{ text: "Подключить личные чаты", url: "https://t.me/SpySkaut_bot?start=connect" }],
                  [{ text: "Открыть приложение", web_app: { url: "https://spychau-bot.senba11.workers.dev/" } }],
                ],
          },
        }),
      });
      if (!response.ok) return json({ error: "Telegram could not send the start message" }, 502);
      return json({ ok: true, handled: isHelp ? "help" : "start" });
    }

    if (update.my_chat_member?.chat && ["group", "supergroup"].includes(update.my_chat_member.chat.type)) {
      return await handleGroupMembershipUpdate(update.my_chat_member, env);
    }

    const groupMessage = update.message || update.edited_message;
    if (groupMessage?.chat && ["group", "supergroup"].includes(groupMessage.chat.type)) {
      return await handleGroupMessageUpdate(update, groupMessage, Boolean(update.edited_message), env);
    }

    const connection = update.business_connection;
    if (connection?.id && connection.user?.id) {
      const ownerId = String(connection.user.id);
      await saveUser(env.DB, connection.user);
      await env.DB.prepare(`
        INSERT INTO connections(connection_id, owner_id, enabled, payload_json, updated_at)
        VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(connection_id) DO UPDATE SET
          owner_id = excluded.owner_id,
          enabled = excluded.enabled,
          payload_json = excluded.payload_json,
          updated_at = CURRENT_TIMESTAMP
      `).bind(connection.id, ownerId, Number(Boolean(connection.is_enabled)), JSON.stringify(connection)).run();
      return json({ ok: true });
    }

    const message = update.business_message || update.edited_business_message;
    const deleted = update.deleted_business_messages;
    const event = message || deleted;
    const connectionId = event?.business_connection_id;
    if (!connectionId) return json({ ok: true, ignored: true });

    const connectionRow = await env.DB.prepare(
      "SELECT owner_id FROM connections WHERE connection_id = ? AND enabled = 1",
    ).bind(connectionId).first();
    if (!connectionRow) return json({ ok: true, ignored: true });

    const updateId = Number.isInteger(update.update_id) ? update.update_id : null;
    const savedEvents = [];
    if (deleted) {
      const chatId = deleted.chat?.id == null ? "" : String(deleted.chat.id);
      for (const messageId of deleted.message_ids || []) {
        const promotedReplies = await confirmPendingReplyEvents(env, {
          ownerId: connectionRow.owner_id,
          connectionId,
          chatId,
          targetMessageId: String(messageId),
        });
        savedEvents.push(...promotedReplies.map((candidate) => ({
          eventId: candidate.eventId,
          messageId: candidate.messageId,
          eventType: "new",
          updateId: candidate.updateId,
        })));
        const eventId = await storeBusinessEvent(env, {
          updateId,
          ownerId: connectionRow.owner_id,
          connectionId,
          chatId,
          messageId,
          eventType: "deleted",
          message: deleted,
        });
        savedEvents.push({ eventId, messageId: String(messageId), eventType: "deleted" });
      }
    } else if (message) {
      const eventType = update.edited_business_message ? "edited" : "new";
      const chatId = message.chat?.id == null ? "" : String(message.chat.id);
      const messageId = message.message_id == null ? "" : String(message.message_id);
      // In Telegram's reply-before-open flow, the original disappearing media
      // may be attached to either reply_to_message or external_reply. Collect
      // every supported attachment from both shapes instead of stopping at the
      // first one found. Capture it before writing the owner's reply so a
      // one-time file has the best chance of still being downloadable.
      const repliedMedia = eventType === "new"
        && message.from?.id != null
        && String(message.from.id) === String(connectionRow.owner_id)
        && message.chat?.type === "private"
        ? collectRepliedMedia(message)
        : [];
      for (const [mediaIndex, replied] of repliedMedia.entries()) {
        const { source, media, kind } = replied;
        if (source.from?.id != null && String(source.from.id) === String(connectionRow.owner_id)) continue;
        const originalId = source.message_id == null ? "unknown" : String(source.message_id);
        const syntheticMessageId = `reply-media:${chatId}:${originalId}:${messageId}:${kind}:${mediaIndex}`;
        const syntheticMessage = {
          ...source,
          chat: source.chat || message.chat,
          from: source.from || message.reply_to_message?.from || message.external_reply?.from || {},
          __spychau_one_time_saved: true,
        };
        for (const field of ONE_TIME_MEDIA_FIELDS) delete syntheticMessage[field];
        syntheticMessage[media.field] = media.value;
        const replyMediaEventId = await storeBusinessEvent(env, {
          updateId,
          ownerId: connectionRow.owner_id,
          connectionId,
          chatId,
          messageId: syntheticMessageId,
          eventType: "new",
          message: syntheticMessage,
        });
        savedEvents.push({ eventId: replyMediaEventId, messageId: syntheticMessageId, eventType: "new" });
      }

      const eventId = await storeBusinessEvent(env, {
        updateId,
        ownerId: connectionRow.owner_id,
        connectionId,
        chatId,
        messageId,
        eventType,
        message: { ...message },
      });
      savedEvents.push({ eventId, messageId, eventType });
    }

    await notifySavedEvents(env, connectionRow.owner_id, savedEvents, updateId);

    return json({ ok: true });
  } catch {
    return json({ error: "webhook processing failed" }, 500);
  }
}

async function hasNotificationPackageCredits(db, ownerId) {
  try {
    const row = await db.prepare("SELECT 1 FROM notification_packages WHERE owner_id = ? AND credits_remaining > 0 LIMIT 1")
      .bind(String(ownerId)).first();
    return Boolean(row);
  } catch (error) {
    if (/no such table: notification_packages/i.test(String(error?.message || error))) return false;
    throw error;
  }
}

async function handleTributeWebhook(request, env) {
  if (!env.TRIBUTE_API_KEY) return json({ error: "Tribute webhook is not configured" }, 503);
  const rawBody = await request.text();
  if (rawBody.length > 128_000) return json({ error: "payload too large" }, 413);
  const supplied = request.headers.get("trbt-signature") || "";
  if (!await validTributeSignature(rawBody, supplied, env.TRIBUTE_API_KEY)) {
    return json({ error: "invalid Tribute signature" }, 401);
  }

  let event;
  try { event = JSON.parse(rawBody); } catch { return json({ error: "invalid JSON" }, 400); }
  const eventName = String(event?.name || "");
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  if (eventName === "new_digital_product") {
    return handleTributeDigitalProduct(payload, rawBody, env);
  }
  if (eventName === "digital_product_refunded") {
    return handleTributeDigitalProductRefund(payload, rawBody, env);
  }
  if (!["new_subscription", "renewed_subscription", "cancelled_subscription"].includes(eventName)) {
    return json({ ok: true, ignored: true });
  }

  const ownerId = String(payload.telegram_user_id || "");
  if (!/^\d{1,20}$/.test(ownerId)) return json({ ok: true, ignored: true });
  const subscriptionId = String(payload.subscription_id || payload.subscriptionId || "");
  if (env.TRIBUTE_SUBSCRIPTION_ID && subscriptionId !== String(env.TRIBUTE_SUBSCRIPTION_ID)) return json({ ok: true, ignored: true });
  if (eventName === "cancelled_subscription") {
    await env.DB.prepare("UPDATE subscriptions SET auto_renew = 0, updated_at = CURRENT_TIMESTAMP WHERE owner_id = ?")
      .bind(ownerId).run();
    return json({ ok: true, handled: "cancellation" });
  }
  if (payload.type && payload.type !== "regular") return json({ ok: true, ignored: true });
  const planEntry = tributeSubscriptionPlan(payload);
  if (!planEntry) return json({ error: "subscription amount is not a configured tariff" }, 400);
  const [planId, plan] = planEntry;
  if (eventName === "new_subscription") {
    const consent = await env.DB.prepare(`SELECT 1 AS accepted FROM payment_consents
      WHERE owner_id = ? AND plan_id = ? AND accepted_at >= datetime('now', '-24 hours') LIMIT 1`)
      .bind(ownerId, planId).first();
    if (!consent) return json({ ok: true, ignored: true });
  }
  const eventKey = await sha256Hex(rawBody);
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO tribute_payment_events(event_key, owner_id, event_name, subscription_id, months)
        VALUES(?, ?, ?, ?, ?)`)
        .bind(eventKey, ownerId, eventName, subscriptionId, plan.months),
      env.DB.prepare(`INSERT OR IGNORE INTO payment_purchases(
        purchase_id, provider, provider_event_id, owner_id, service_key, plan_id, amount_minor, currency, expires_at
      ) SELECT ?, 'tribute', ?, ?, 'personal_unlimited', ?, ?, 'RUB', datetime('now', printf('+%d months', ?))
        WHERE changes() = 1`)
        .bind(`subscription:${eventKey}`, eventKey, ownerId, planId, Number(payload.amount), plan.months),
      env.DB.prepare(`INSERT INTO subscriptions(owner_id, expires_at, plan_id, auto_renew)
        SELECT ?, datetime('now', printf('+%d months', ?)), ?, 1 WHERE changes() = 1
        ON CONFLICT(owner_id) DO UPDATE SET expires_at = datetime(
          CASE WHEN strftime('%s', subscriptions.expires_at) > unixepoch('now')
            THEN subscriptions.expires_at ELSE 'now' END,
          printf('+%d months', ?)
        ), plan_id = excluded.plan_id, auto_renew = 1`)
        .bind(ownerId, plan.months, planId, plan.months),
    ]);
  } catch { return json({ error: "Tribute subscription event processing failed" }, 500); }
  return json({ ok: true, handled: eventName, plan_id: planId });
}

async function handleTributeDigitalProduct(payload, rawBody, env) {
  const ownerId = String(payload.telegram_user_id || "");
  const productId = String(payload.product_id || "");
  const purchaseId = String(payload.purchase_id || "");
  if (!/^\d{1,20}$/.test(ownerId) || !/^\d+$/.test(productId) || !/^\d+$/.test(purchaseId)) {
    return json({ error: "invalid Tribute digital product payload" }, 400);
  }
  const actualProduct = await getTributeProduct(productId, env);
  if (!actualProduct || actualProduct.type !== "digital" || actualProduct.status !== "approved"
    || String(actualProduct.currency || "").toUpperCase() !== "RUB"
    || actualProduct.starsAmountEnabled !== true) {
    return json({ error: "Tribute product is missing or not configured for Stars" }, 503);
  }
  let serviceKey = null;
  let planId = null;
  let expectedProduct = null;
  for (const key of [
    ...Object.keys(PERSONAL_PACKAGE_PLANS).map((id) => `personal_package:${id}`),
    ...Object.keys(PERSONAL_SUBSCRIPTION_PLANS).map((id) => `personal_unlimited:${id}`),
  ]) {
    const [candidateService, candidatePlan] = key.split(":");
    const candidate = tributeProduct(env, candidateService, candidatePlan);
    if (candidate && (candidate.link === String(actualProduct.link || "").trim()
      || (candidate.web_link && candidate.web_link === String(actualProduct.webLink || "").trim()))) {
      serviceKey = candidateService;
      planId = candidatePlan;
      expectedProduct = candidate;
      break;
    }
  }
  if (!expectedProduct || String(actualProduct.id) !== productId
    || Number(actualProduct.amount) !== expectedProduct.amount_rub * 100) {
    return json({ ok: true, ignored: true, reason: "product_not_mapped" });
  }
  const amount = expectedProduct.amount_rub * 100;
  const consent = await env.DB.prepare(`SELECT 1 AS accepted FROM tribute_product_consents
    WHERE owner_id = ? AND plan_id = ? AND service_key = ?
      AND accepted_at >= datetime('now', '-24 hours') LIMIT 1`)
    .bind(ownerId, planId, serviceKey).first();
  if (!consent) return json({ ok: true, ignored: true });
  const refunded = await env.DB.prepare("SELECT 1 FROM tribute_digital_product_refunds WHERE purchase_id = ?")
    .bind(purchaseId).first();
  if (refunded) return json({ ok: true, ignored: true, reason: "purchase_already_refunded" });

  try {
    if (serviceKey === "personal_package") {
      const plan = PERSONAL_PACKAGE_PLANS[planId];
      if (!plan) return json({ error: "unknown package plan" }, 400);
      await env.DB.batch([
        env.DB.prepare(`INSERT OR IGNORE INTO tribute_digital_product_events(
          provider_event_id, purchase_id, owner_id, product_id, service_key, plan_id, amount_minor, currency
        ) VALUES(?, ?, ?, ?, 'personal_package', ?, ?, 'RUB')`)
          .bind(`tribute:product:${purchaseId}`, purchaseId, ownerId, productId, planId, amount),
        env.DB.prepare(`INSERT OR IGNORE INTO payment_purchases(
          purchase_id, provider, provider_event_id, owner_id, service_key, plan_id, amount_minor, currency, credits_granted
        ) SELECT ?, 'tribute', ?, ?, 'personal_package', ?, ?, 'RUB', ?
        WHERE changes() = 1`)
          .bind(`tribute:product:${purchaseId}`, `product:${purchaseId}`, ownerId, planId, amount, plan.events),
        env.DB.prepare(`INSERT OR IGNORE INTO notification_packages(
          package_id, owner_id, purchase_id, plan_id, credits_total, credits_remaining, activated_after_event_id
        ) SELECT ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(id) FROM events WHERE owner_id = ?), 0)
        WHERE changes() = 1`)
          .bind(crypto.randomUUID(), ownerId, `tribute:product:${purchaseId}`, planId, plan.events, plan.events, ownerId),
      ]);
      return json({ ok: true, handled: "new_digital_product", service: serviceKey });
    }

    const plan = PERSONAL_SUBSCRIPTION_PLANS[planId];
    if (!plan) return json({ error: "unknown subscription plan" }, 400);
    const eventKey = `tribute:product:${purchaseId}`;
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO tribute_digital_product_events(
        provider_event_id, purchase_id, owner_id, product_id, service_key, plan_id, amount_minor, currency
      ) VALUES(?, ?, ?, ?, 'personal_unlimited', ?, ?, 'RUB')`)
        .bind(eventKey, purchaseId, ownerId, productId, planId, amount),
      env.DB.prepare(`INSERT OR IGNORE INTO payment_purchases(
        purchase_id, provider, provider_event_id, owner_id, service_key, plan_id, amount_minor, currency, expires_at
      ) SELECT ?, 'tribute', ?, ?, 'personal_unlimited', ?, ?, 'RUB', datetime('now', printf('+%d months', ?))
        WHERE changes() = 1`)
        .bind(eventKey, `product:${purchaseId}`, ownerId, planId, amount, plan.months),
      env.DB.prepare(`INSERT INTO subscriptions(owner_id, expires_at, plan_id, auto_renew)
        SELECT ?, datetime('now', printf('+%d months', ?)), ?, 0 WHERE changes() = 1
        ON CONFLICT(owner_id) DO UPDATE SET expires_at = datetime(
          CASE WHEN strftime('%s', subscriptions.expires_at) > unixepoch('now')
            THEN subscriptions.expires_at ELSE 'now' END,
          printf('+%d months', ?)
        ), plan_id = excluded.plan_id, auto_renew = CASE
          WHEN strftime('%s', subscriptions.expires_at) > unixepoch('now') THEN subscriptions.auto_renew ELSE 0 END`)
        .bind(ownerId, plan.months, planId, plan.months),
    ]);
    return json({ ok: true, handled: "new_digital_product", service: serviceKey, plan_id: planId });

    return json({ ok: true, ignored: true });
  } catch {
    return json({ error: "Tribute digital product could not be recorded" }, 500);
  }
}

async function handleTributeDigitalProductRefund(payload, rawBody, env) {
  const purchaseId = String(payload.purchase_id || "");
  if (!/^\d+$/.test(purchaseId)) return json({ error: "invalid Tribute refund payload" }, 400);
  const eventKey = await sha256Hex(rawBody);
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO tribute_digital_product_refunds(purchase_id, provider_event_id)
        VALUES(?, ?)`)
        .bind(purchaseId, eventKey),
      env.DB.prepare(`UPDATE payment_purchases SET refunded_at = CURRENT_TIMESTAMP
        WHERE purchase_id = ? AND provider = 'tribute' AND service_key IN ('personal_package', 'personal_unlimited')`)
        .bind(`tribute:product:${purchaseId}`),
      env.DB.prepare(`UPDATE notification_packages SET credits_remaining = 0
        WHERE purchase_id = ?`)
        .bind(`tribute:product:${purchaseId}`),
      env.DB.prepare(`UPDATE subscriptions SET
          expires_at = COALESCE((SELECT MAX(expires_at) FROM payment_purchases
            WHERE owner_id = subscriptions.owner_id AND service_key = 'personal_unlimited'
              AND refunded_at IS NULL AND expires_at > CURRENT_TIMESTAMP), CURRENT_TIMESTAMP),
          plan_id = (SELECT plan_id FROM payment_purchases
            WHERE owner_id = subscriptions.owner_id AND service_key = 'personal_unlimited'
              AND refunded_at IS NULL AND expires_at > CURRENT_TIMESTAMP
            ORDER BY expires_at DESC LIMIT 1),
          updated_at = CURRENT_TIMESTAMP
        WHERE owner_id = (SELECT owner_id FROM payment_purchases WHERE purchase_id = ?)`)
        .bind(`tribute:product:${purchaseId}`),
    ]);
  } catch { return json({ error: "Tribute refund could not be recorded" }, 500); }
  return json({ ok: true, handled: "digital_product_refunded" });
}

function tributeSubscriptionPlan(payload) {
  if (String(payload.currency || "").toUpperCase() !== "RUB") return null;
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rubles = amount > 3000 ? amount / 100 : amount;
  const prices = { month: [249, 199.2], "half-year": [1190, 952], year: [1790, 1611] };
  for (const [planId, plan] of Object.entries(PERSONAL_SUBSCRIPTION_PLANS)) {
    if (prices[planId].some((price) => Math.round(rubles * 100) === Math.round(price * 100))) return [planId, plan];
  }
  return null;
}

async function validTributeSignature(rawBody, signature, apiKey) {
  const normalized = signature.trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(apiKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expected = [...new Uint8Array(signed)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return constantTimeEqual(expected, normalized);
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function handleGroupMembershipUpdate(change, env) {
  const chat = change.chat;
  const chatId = String(chat.id);
  const botMember = change.new_chat_member || {};
  const active = ["member", "administrator"].includes(botMember.status)
    || (botMember.status === "restricted" && Boolean(botMember.is_member));
  if (!active) {
    await env.DB.prepare("UPDATE group_chats SET active = 0, bot_status = ?, updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?")
      .bind(String(botMember.status || "left"), chatId).run();
    await env.DB.prepare("DELETE FROM group_message_snapshots WHERE chat_id = ?").bind(chatId).run();
    return json({ ok: true, handled: "group_disconnected" });
  }

  const addedBy = change.from;
  if (!addedBy?.id || addedBy.is_bot) return json({ ok: true, ignored: true });
  const ownerId = String(addedBy.id);
  if (!env.SUBSCRIPTION_TEST_OWNER_ID || ownerId !== String(env.SUBSCRIPTION_TEST_OWNER_ID)) {
    return json({ ok: true, ignored: true });
  }
  await saveUser(env.DB, addedBy);
  await env.DB.prepare("UPDATE group_chats SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE chat_id = ?").bind(chatId).run();
  await env.DB.prepare("DELETE FROM group_message_snapshots WHERE chat_id = ?").bind(chatId).run();
  await env.DB.prepare(`
    INSERT INTO group_chats(owner_id, chat_id, chat_type, title, username, bot_status, active, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id, chat_id) DO UPDATE SET
      chat_type = excluded.chat_type,
      title = excluded.title,
      username = excluded.username,
      bot_status = excluded.bot_status,
      active = 1,
      updated_at = CURRENT_TIMESTAMP
  `).bind(ownerId, chatId, chat.type, String(chat.title || "Беседа"), chat.username || null, String(botMember.status || "member")).run();
  return json({ ok: true, handled: "group_connected" });
}

async function handleGroupMessageUpdate(update, telegramMessage, edited, env) {
  const chat = telegramMessage.chat;
  const chatId = String(chat.id);
  const group = await env.DB.prepare(`
    SELECT owner_id FROM group_chats WHERE chat_id = ? AND active = 1 LIMIT 1
  `).bind(chatId).first();
  if (!group) return json({ ok: true, ignored: true });

  const latestTitle = String(chat.title || "").trim();
  if (latestTitle) {
    await env.DB.prepare(`
      UPDATE group_chats
      SET title = ?, updated_at = CURRENT_TIMESTAMP
      WHERE chat_id = ? AND title <> ?
    `).bind(latestTitle, chatId, latestTitle).run();
  }

  await rememberGroupTopic(env.DB, group.owner_id, chatId, telegramMessage);
  if (telegramMessage.forum_topic_created || telegramMessage.forum_topic_edited) {
    return json({ ok: true, handled: "group_topic" });
  }

  const messageId = String(telegramMessage.message_id || "");
  if (!/^\d+$/.test(messageId) || (!telegramMessage.from && !telegramMessage.sender_chat)) {
    return json({ ok: true, ignored: true });
  }
  if (telegramMessage.from?.is_bot && !edited) return json({ ok: true, ignored: true });

  const threadId = String(telegramMessage.message_thread_id || "");
  const currentSnapshot = groupMessageSnapshot(telegramMessage);
  const updateId = Number.isInteger(update.update_id) ? update.update_id : null;
  if (!edited) {
    await storeGroupMessageSnapshot(env, {
      ownerId: group.owner_id,
      chatId,
      messageId,
      threadId,
      message: currentSnapshot,
    });
    return json({ ok: true, handled: "group_message_snapshot" });
  }

  const prior = await getGroupMessageSnapshot(env, group.owner_id, chatId, messageId);
  const eventId = await storeBusinessEvent(env, {
    updateId,
    ownerId: group.owner_id,
    chatId,
    messageId,
    messageThreadId: threadId,
    eventType: "edited",
    message: currentSnapshot,
    previousMessage: prior?.message || null,
    cacheMedia: false,
  });
  await storeGroupMessageSnapshot(env, {
    ownerId: group.owner_id,
    chatId,
    messageId,
    threadId,
    message: currentSnapshot,
  });
  await notifySavedEvents(env, group.owner_id, [{ eventId, messageId, eventType: "edited" }], updateId);
  return json({ ok: true, handled: "group_message_edited" });
}

async function rememberGroupTopic(db, ownerId, chatId, message) {
  const topic = message.forum_topic_created || message.forum_topic_edited;
  const threadId = String(message.message_thread_id || (topic ? message.message_id : ""));
  if (!threadId && !message.is_topic_message && message.chat?.type !== "supergroup") return;
  const actualName = typeof topic?.name === "string" ? topic.name.trim() : "";
  const fallbackName = threadId ? `Тема ${threadId}` : "Общие";

  if (actualName) {
    await db.prepare(`
      INSERT INTO group_topics(owner_id, chat_id, thread_id, name, updated_at) VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_id, chat_id, thread_id) DO UPDATE SET name = excluded.name, updated_at = CURRENT_TIMESTAMP
    `).bind(String(ownerId), String(chatId), threadId, actualName).run();
  } else {
    await db.prepare("INSERT OR IGNORE INTO group_topics(owner_id, chat_id, thread_id, name) VALUES(?, ?, ?, ?)")
      .bind(String(ownerId), String(chatId), threadId, fallbackName).run();
  }
}

function groupMessageSnapshot(message) {
  const chat = message.chat || {};
  const snapshot = {
    message_id: message.message_id,
    date: message.date,
    chat: { id: chat.id, type: chat.type, title: chat.title, username: chat.username },
    ...(message.from ? { from: {
      id: message.from.id,
      is_bot: Boolean(message.from.is_bot),
      first_name: message.from.first_name,
      last_name: message.from.last_name,
      username: message.from.username,
    } } : {}),
    ...(message.sender_chat ? { sender_chat: {
      id: message.sender_chat.id,
      title: message.sender_chat.title,
      username: message.sender_chat.username,
    } } : {}),
    ...(message.message_thread_id != null ? { message_thread_id: message.message_thread_id, is_topic_message: true } : {}),
    ...(typeof message.text === "string" ? { text: message.text } : {}),
    ...(typeof message.caption === "string" ? { caption: message.caption } : {}),
  };
  for (const field of ["photo", "video", "voice", "video_note", "document", "audio", "animation", "sticker"]) {
    if (message[field] != null) snapshot[field] = true;
  }
  return snapshot;
}

function logBusinessMediaDiagnostic(update) {
  const mediaFields = ["photo", "voice", "video_note", "video", "audio", "document", "animation", "live_photo"];
  const candidates = [
    ["business_message", update?.business_message],
    ["edited_business_message", update?.edited_business_message],
    ["message", update?.message],
  ];
  const messages = candidates
    .filter(([updateType, message]) => message && (
      updateType !== "message"
      || mediaFields.some((field) => message[field] != null)
      || message.reply_to_message
      || Number(message.ttl_period) > 0
    ))
    .map(([updateType, message]) => {
      const reply = message.reply_to_message;
      const externalReply = message.external_reply;
      const repliedMedia = collectRepliedMedia(message);
      return {
        updateType,
        media: Object.fromEntries(mediaFields.map((field) => [field, message[field] != null])),
        hasReply: Boolean(reply),
        replyMessageIdIsZero: Number(reply?.message_id) === 0,
        replyMedia: Object.fromEntries(mediaFields.map((field) => [field, Boolean(reply?.[field])])),
        hasExternalReply: Boolean(externalReply),
        externalReplyMedia: Object.fromEntries(mediaFields.map((field) => [field, Boolean(externalReply?.[field])])),
        repliedMediaCount: repliedMedia.length,
        repliedMediaKinds: repliedMedia.map((item) => item.kind),
        replyHasEphemeralMessageId: Number(reply?.ephemeral_message_id) > 0,
        replyHasTtlPeriod: Number(reply?.ttl_period) > 0,
        externalReplyHasEphemeralMessageId: Number(externalReply?.ephemeral_message_id) > 0,
        externalReplyHasTtlPeriod: Number(externalReply?.ttl_period) > 0,
        hasTtlPeriod: Number(message.ttl_period) > 0,
        hasEphemeralMessageId: Number(message.ephemeral_message_id) > 0,
        hasReceiverUser: Number(message.receiver_user?.id) > 0,
        hasProtectedContent: message.has_protected_content === true,
      };
    });

  const deleted = update?.deleted_business_messages;
  if (!messages.length && !deleted) return;
  // Temporary diagnostics intentionally record only update/media field presence.
  // Never log message text, account/chat IDs, file IDs, or media contents.
  console.log("[telegram-media-diagnostic]", JSON.stringify({
    messages,
    deletedBusinessMessages: deleted ? {
      present: true,
      hasChat: Boolean(deleted.chat),
      messageCount: Array.isArray(deleted.message_ids) ? deleted.message_ids.length : 0,
    } : null,
  }));
}

async function validateInitData(raw, env) {
  if (!env.TELEGRAM_BOT_TOKEN || typeof raw !== "string" || !raw) {
    throw new Error("Telegram authentication is not configured");
  }

  const params = new URLSearchParams(raw);
  const receivedHash = params.get("hash");
  params.delete("hash");
  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!receivedHash || !Number.isInteger(authDate) || authDate > now + 60 || now - authDate > MAX_INIT_DATA_AGE_SECONDS) {
    throw new Error("Missing, expired, or invalid initData");
  }

  const checkString = [...params.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  // Telegram derives the signing key with WebAppData as the HMAC key.
  const secret = await hmacSha256("WebAppData", env.TELEGRAM_BOT_TOKEN);
  const expectedHash = bytesToHex(await hmacSha256(secret, checkString));
  if (!constantTimeEqual(expectedHash, receivedHash)) throw new Error("Invalid initData signature");

  let user;
  try {
    user = JSON.parse(params.get("user") || "{}");
  } catch {
    throw new Error("Invalid Telegram user data");
  }
  if (!user.id) throw new Error("Telegram user is missing");
  return user;
}

async function hmacSha256(key, message) {
  const keyBytes = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message)));
}

async function userFromRequest(request, env) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("tma ")) throw new Error("Telegram initData required");
  return validateInitData(authorization.slice(4), env);
}

async function ensureTestGroup(db, ownerId) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS test_group_members (
    telegram_id TEXT PRIMARY KEY,
    added_by TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS test_group_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL
  )`).run();
  const seeded = await db.prepare("SELECT setting_value FROM test_group_settings WHERE setting_key = 'initial_tester_seeded'").first();
  if (!seeded) {
    await db.prepare("INSERT OR IGNORE INTO test_group_members(telegram_id, added_by) VALUES(?, ?)").bind("809418877", String(ownerId)).run();
    await db.prepare("INSERT OR IGNORE INTO test_group_settings(setting_key, setting_value) VALUES('initial_tester_seeded', '1')").run();
  }
}

async function getSubscription(db, ownerId) {
  let row;
  try {
    row = await db.prepare("SELECT expires_at, plan_id, auto_renew FROM subscriptions WHERE owner_id = ?").bind(ownerId).first();
  } catch (error) {
    if (!/no such table: subscriptions/i.test(String(error?.message || error))) throw error;
  }
  const expiresAt = row?.expires_at || null;
  const expiresTime = expiresAt ? Date.parse(expiresAt) : NaN;
  const paidActive = Number.isFinite(expiresTime) && expiresTime > Date.now();
  let override = null;
  try {
    const test = await db.prepare("SELECT active FROM subscription_test_overrides WHERE owner_id = ?").bind(ownerId).first();
    if (test) override = Boolean(test.active);
  } catch (error) {
    if (!/no such table: subscription_test_overrides/i.test(String(error?.message || error))) throw error;
  }
  let testGroupMember = false;
  try {
    const member = await db.prepare("SELECT 1 AS active FROM test_group_members WHERE telegram_id = ? LIMIT 1").bind(String(ownerId)).first();
    testGroupMember = Boolean(member?.active);
  } catch (error) {
    if (!/no such table: test_group_members/i.test(String(error?.message || error))) throw error;
  }
  const personalUnlimited = testGroupMember || (override === null ? paidActive : override);
  return {
    active: personalUnlimited,
    expires_at: expiresAt,
    plan_id: row?.plan_id || null,
    auto_renew: Number(row?.auto_renew) === 1,
    plan_name: row?.plan_id === "month" ? "Безлимит · 1 месяц"
      : row?.plan_id === "half-year" ? "Безлимит · 6 месяцев"
        : row?.plan_id === "year" ? "Безлимит · 12 месяцев" : null,
    capabilities: { personal_unlimited: personalUnlimited, personal_archive: personalUnlimited, group_features: false },
    test_override: override,
    test_group_member: testGroupMember,
  };
}

async function getNotificationPackageBalance(db, ownerId) {
  try {
    const row = await db.prepare(`SELECT COALESCE(SUM(p.credits_total), 0) AS purchased,
      COALESCE(SUM(p.credits_remaining), 0) AS remaining, COUNT(*) AS packages,
      COALESCE(SUM((SELECT COUNT(*) FROM package_event_usage u WHERE u.package_id = p.package_id)), 0) AS consumed
      FROM notification_packages p WHERE p.owner_id = ?`).bind(String(ownerId)).first();
    const purchased = Number(row?.purchased || 0);
    const remaining = Number(row?.remaining || 0);
    const consumed = Number(row?.consumed || 0);
    const refunded = Math.max(0, purchased - remaining - consumed);
    return { has_purchases: purchased > 0, purchased, remaining, consumed, refunded, packages: Number(row?.packages || 0) };
  } catch (error) {
    if (/no such table: notification_packages/i.test(String(error?.message || error))) return { has_purchases: false, purchased: 0, remaining: 0, consumed: 0, refunded: 0, packages: 0 };
    throw error;
  }
}

async function consumeNotificationPackageEvent(db, ownerId, eventId) {
  try {
    const existing = await db.prepare("SELECT 1 FROM package_event_usage WHERE event_id = ? AND owner_id = ?")
      .bind(Number(eventId), String(ownerId)).first();
    if (existing) return true;
    const candidates = await db.prepare(`SELECT p.package_id FROM events e
      JOIN notification_packages p ON p.owner_id = e.owner_id
      WHERE e.id = ? AND e.owner_id = ? AND e.id > p.activated_after_event_id AND p.credits_remaining > 0
      ORDER BY p.purchased_at, p.package_id LIMIT 20`)
      .bind(Number(eventId), String(ownerId)).all();
    for (const { package_id: packageId } of candidates.results || []) {
      const updated = await db.prepare(`UPDATE notification_packages SET credits_remaining = credits_remaining - 1
        WHERE package_id = ? AND credits_remaining > 0
          AND NOT EXISTS(SELECT 1 FROM package_event_usage WHERE event_id = ?)`)
        .bind(packageId, Number(eventId)).run();
      if (Number(updated.meta?.changes || 0) !== 1) continue;
      const inserted = await db.prepare("INSERT OR IGNORE INTO package_event_usage(event_id, owner_id, package_id) VALUES(?, ?, ?)")
        .bind(Number(eventId), String(ownerId), packageId).run();
      if (Number(inserted.meta?.changes || 0) === 1) return true;
      await db.prepare("UPDATE notification_packages SET credits_remaining = credits_remaining + 1 WHERE package_id = ?")
        .bind(packageId).run();
      if (await db.prepare("SELECT 1 FROM package_event_usage WHERE event_id = ? AND owner_id = ?")
        .bind(Number(eventId), String(ownerId)).first()) return true;
    }
    return false;
  } catch (error) {
    if (/no such table: package_event_usage|no such table: notification_packages/i.test(String(error?.message || error))) return false;
    throw error;
  }
}

const defaultNotificationPreferences = Object.freeze({
  deleted_messages: true,
  edited_messages: true,
  one_time_messages: true,
  group_messages: false,
  deleted_by_owner: false,
  edited_by_owner: false,
});

async function getNotificationPreferences(db, ownerId) {
  const row = await db.prepare("SELECT * FROM notification_preferences WHERE owner_id = ?").bind(String(ownerId)).first();
  if (!row) return { configured: false, preferences: { ...defaultNotificationPreferences } };
  return {
    configured: true,
    preferences: Object.fromEntries(Object.keys(defaultNotificationPreferences).map((key) => [key, Boolean(row[key])])),
  };
}

async function initializeNotificationPreferences(db, ownerId, requestedPreferences) {
  const keys = Object.keys(defaultNotificationPreferences);
  const hasValidPreferences = requestedPreferences
    && typeof requestedPreferences === "object"
    && keys.every((key) => typeof requestedPreferences[key] === "boolean");
  const preferences = hasValidPreferences ? requestedPreferences : defaultNotificationPreferences;
  await db.prepare(`
    INSERT OR IGNORE INTO notification_preferences(owner_id, deleted_messages, edited_messages, one_time_messages, group_messages, deleted_by_owner, edited_by_owner)
    VALUES(?, ?, ?, ?, ?, ?, ?)
  `).bind(String(ownerId), ...keys.map((key) => Number(preferences[key]))).run();
}

async function getUserBootstrap(env, user) {
  const ownerId = String(user.id);
  const [profile, connections, subscription, packageBalance, notificationSettings] = await Promise.all([
    env.DB.prepare("SELECT receipt_email FROM users WHERE telegram_id = ?").bind(ownerId).first(),
    env.DB.prepare("SELECT connection_id, enabled, updated_at FROM connections WHERE owner_id = ? ORDER BY updated_at DESC")
      .bind(ownerId).all(),
    getSubscription(env.DB, ownerId),
    getNotificationPackageBalance(env.DB, ownerId),
    getNotificationPreferences(env.DB, ownerId),
  ]);
  return {
    user: { ...user, receipt_email: profile?.receipt_email || null },
    connections: connections.results,
    subscription,
    package_balance: packageBalance,
    notification_preferences: notificationSettings.preferences,
    can_test_override: Boolean(env.SUBSCRIPTION_TEST_OWNER_ID && ownerId === String(env.SUBSCRIPTION_TEST_OWNER_ID)),
    payments_available: Boolean(tributePaymentsReady(env, "personal_unlimited")),
    package_payments_available: Boolean(tributePaymentsReady(env, "personal_package")),
    tribute_plan_availability: {
      personal_unlimited: Object.fromEntries(Object.keys(PERSONAL_SUBSCRIPTION_PLANS).map((planId) => [planId, Boolean(tributePaymentsReady(env, "personal_unlimited", planId))])),
      personal_package: Object.fromEntries(Object.keys(PERSONAL_PACKAGE_PLANS).map((planId) => [planId, Boolean(tributePaymentsReady(env, "personal_package", planId))])),
    },
    group_payments_available: false,
  };
}

async function sendEventNotification(env, { ownerId, updateId, messageId, event }) {
  const claim = await env.DB.prepare(`
    INSERT OR IGNORE INTO notification_deliveries(owner_id, update_id, message_id)
    VALUES(?, ?, ?)
  `).bind(String(ownerId), updateId, String(messageId)).run();
  if (Number(claim.meta?.changes || 0) !== 1) return;

  try {
    const current = event?.message || {};
    const media = isOneTimeMessage(current) ? oneTimeMedia(current) : null;
    const method = media?.method || "sendMessage";
    const notificationText = formatEventNotification(event);
    const archiveButton = {
      inline_keyboard: [[{ text: "Открыть архив", web_app: { url: "https://spychau-bot.senba11.workers.dev/?open=archive" } }]],
    };
    const payload = media
      ? {
          chat_id: ownerId,
          [media.field]: media.fileId,
          reply_markup: archiveButton,
          ...(media.caption ? { caption: notificationText.slice(0, 1000) } : {}),
        }
      : {
          chat_id: ownerId,
          text: notificationText,
          reply_markup: archiveButton,
        };
    let delivered = await callTelegramJson(env, method, payload);
    if (!delivered && media) {
      const archived = await readArchivedMedia(env, ownerId, event?.id, 0);
      if (archived?.bytes?.length) {
        delivered = await callTelegramUpload(env, media, archived, notificationText, archiveButton, ownerId);
      }
      if (!delivered) {
        delivered = await callTelegramJson(env, "sendMessage", {
          chat_id: ownerId,
          text: `${notificationText}\n\nНе получилось отправить вложение в этот чат. Проверь событие в архиве — если файл успел сохраниться, он будет доступен там.`,
          reply_markup: archiveButton,
        });
      }
    }
    if (!delivered) throw new Error("Telegram notification could not be delivered");
  } catch (error) {
    await env.DB.prepare("DELETE FROM notification_deliveries WHERE owner_id = ? AND update_id = ? AND message_id = ?")
      .bind(String(ownerId), updateId, String(messageId)).run();
    throw error;
  }
}

async function notifySavedEvents(env, ownerId, savedEvents, fallbackUpdateId = null) {
  if (!savedEvents.length || !env.TELEGRAM_BOT_TOKEN) return;
  const resolved = savedEvents
    .map((savedEvent) => ({
      ...savedEvent,
      updateId: savedEvent.updateId ?? fallbackUpdateId,
    }))
    .filter((savedEvent) => savedEvent.updateId != null && Number.isInteger(Number(savedEvent.updateId)));
  if (!resolved.length) return;

  const subscription = await getSubscription(env.DB, ownerId);
  const packageBalance = subscription.active ? null : await getNotificationPackageBalance(env.DB, ownerId);
  if (!subscription.active && !packageBalance?.remaining) return;
  const preferences = await getNotificationPreferences(env.DB, ownerId);
  for (const savedEvent of resolved) {
    const eventRow = await env.DB.prepare("SELECT * FROM events WHERE id = ? AND owner_id = ?")
      .bind(savedEvent.eventId, String(ownerId)).first();
    if (!eventRow) continue;
    const [event] = await hydrateEventRows([eventRow], env);
    const chatType = event?.message?.chat?.type || event?.previous_message?.chat?.type || "private";
    const isGroup = chatType === "group" || chatType === "supergroup";
    const shouldNotify = isEventEnabledForOwner(event, ownerId, preferences.preferences);
    if (!shouldNotify || (isGroup && !preferences.preferences.group_messages)) continue;
    if (!isGroup && !subscription.active && !await consumeNotificationPackageEvent(env.DB, ownerId, savedEvent.eventId)) continue;
    await sendEventNotification(env, {
      ownerId: String(ownerId),
      updateId: Number(savedEvent.updateId),
      messageId: savedEvent.messageId,
      event,
    });
  }
}

async function callTelegramJson(env, method, payload) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    return response.ok && result.ok === true;
  } catch {
    return false;
  }
}

async function sendConnectInstructions(env, chatId) {
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  return callTelegramJson(env, "sendMessage", {
    chat_id: chatId,
    text: "⚙️ Жми — откроются настройки. Дальше: <b>Аккаунт</b> → <b>Изм.</b> → <b>Автоматизация чатов</b> → вставь имя и нажми «Добавить».\n\n<code>@SpySkaut_bot</code> — 👈🏻 нажми, чтобы скопировать.",
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [[{ text: "⚙️ Открыть настройки", url: "tg://settings/edit" }]],
    },
  });
}

async function callTelegramUpload(env, media, archived, notificationText, replyMarkup, ownerId) {
  try {
    const form = new FormData();
    form.set("chat_id", String(ownerId));
    const safeFileName = String(archived.file_name || `${media.kind}.${media.extension}`).split(/[\\/]/).pop().replace(/[\r\n]/g, "");
    form.set(media.field, new Blob([archived.bytes], { type: archived.mime_type }), safeFileName);
    form.set("reply_markup", JSON.stringify(replyMarkup));
    if (media.caption) form.set("caption", notificationText.slice(0, 1000));
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${media.method}`, { method: "POST", body: form });
    const result = await response.json().catch(() => ({}));
    return response.ok && result.ok === true;
  } catch {
    return false;
  }
}

function formatEventNotification(event) {
  const current = event?.message || {};
  const previous = event?.previous_message || {};
  const chat = current.chat || previous.chat || {};
  const chatName = chat.title
    || [chat.first_name, chat.last_name].filter(Boolean).join(" ")
    || (chat.username ? `@${chat.username}` : `чат ${chat.id || ""}`.trim());
  const lines = event?.event_type === "deleted"
    ? ["🗑 Сообщение удалено", `Чат: ${chatName}`, `Сообщение: ${messagePreview(current)}`]
    : event?.event_type === "edited"
      ? ["✏️ Сообщение изменено", `Чат: ${chatName}`, `Было: ${messagePreview(previous)}`, `Стало: ${messagePreview(current)}`]
      : ["👁 Сохранено одноразовое сообщение", `Чат: ${chatName}`, `Сообщение: ${messagePreview(current)}`];
  return lines.join("\n").slice(0, 3500);
}

function messagePreview(message) {
  const text = typeof message?.text === "string" ? message.text : typeof message?.caption === "string" ? message.caption : "";
  if (text.trim()) return text.trim().slice(0, 700);
  if (message?.photo) return "Фотография";
  if (message?.video_note) return "Видеосообщение";
  if (message?.voice) return "Голосовое сообщение";
  if (message?.video) return "Видео";
  if (message?.audio) return "Аудио";
  if (message?.document) return "Документ";
  if (message?.animation) return "Анимация";
  if (message?.sticker) return "Стикер";
  return "Медиа или сообщение без текста";
}

async function saveUser(db, user) {
  await db.prepare(`
    INSERT INTO users(telegram_id, username, first_name, language_code)
    VALUES(?, ?, ?, ?)
    ON CONFLICT(telegram_id) DO UPDATE SET
      username = excluded.username,
      first_name = excluded.first_name,
      language_code = excluded.language_code
  `).bind(String(user.id), user.username || null, user.first_name || null, user.language_code || null).run();
}

async function trackAppVisitor(db, user) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS app_visitors (telegram_id TEXT PRIMARY KEY, first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare("INSERT OR IGNORE INTO app_visitors(telegram_id) VALUES(?)").bind(String(user.id)).run();
}

async function readJson(request) {
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("invalid JSON");
  return body;
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}

function isEventEnabledForOwner(event, ownerId, preferences) {
  if (event?.pending_expires_at_ms != null) return false;
  const message = event?.message || {};
  const chat = message.chat || event?.previous_message?.chat || {};
  if ((chat.type === "group" || chat.type === "supergroup") && !preferences.group_messages) return false;

  if (event?.event_type === "deleted" || event?.event_type === "edited") {
    const senderId = message.from?.id;
    if (senderId == null) return false;
    const isOwnerAuthored = String(senderId) === String(ownerId);
    const preferenceKey = event.event_type === "deleted"
      ? (isOwnerAuthored ? "deleted_by_owner" : "deleted_messages")
      : (isOwnerAuthored ? "edited_by_owner" : "edited_messages");
    return Boolean(preferences[preferenceKey]);
  }

  return event?.event_type === "new"
    && isIncomingOneTimeMessage(message, ownerId)
    && Boolean(preferences.one_time_messages);
}

function isOneTimeMessage(message) {
  return message?.__spychau_one_time_saved === true
    || Number(message?.ephemeral_message_id) > 0
    || Number(message?.receiver_user?.id) > 0
    || Number(message?.ttl_period) > 0;
}

function isIncomingOneTimeMessage(message, ownerId) {
  const senderId = message?.from?.id;
  return isOneTimeMessage(message) && senderId != null && String(senderId) !== String(ownerId);
}

function oneTimeMedia(message) {
  if (Array.isArray(message?.photo) && message.photo.length) {
    const photo = [...message.photo].sort((left, right) => Number(right.file_size || 0) - Number(left.file_size || 0))[0];
    return photo?.file_id ? { method: "sendPhoto", field: "photo", fileId: photo.file_id, caption: true, extension: "jpg" } : null;
  }
  for (const [source, method, field, caption, extension] of [
    ["video", "sendVideo", "video", true, "mp4"],
    ["video_note", "sendVideoNote", "video_note", false, "mp4"],
    ["voice", "sendVoice", "voice", true, "ogg"],
    ["audio", "sendAudio", "audio", true, "mp3"],
    ["document", "sendDocument", "document", true, "bin"],
    ["animation", "sendAnimation", "animation", true, "mp4"],
  ]) {
    const item = message?.[source];
    if (item?.file_id) return { method, field, fileId: item.file_id, caption, extension: source === "document" && item.file_name?.includes(".") ? item.file_name.split(".").at(-1) : extension };
  }
  return null;
}

const ONE_TIME_MEDIA_FIELDS = ["photo", "video", "video_note", "voice", "audio", "document", "animation"];

function collectRepliedMedia(message) {
  const queue = [message.reply_to_message, message.external_reply].filter((candidate) => candidate && typeof candidate === "object");
  const sources = [];
  const visitedSources = new Set();
  while (queue.length && sources.length < 8) {
    const source = queue.shift();
    if (!source || typeof source !== "object" || visitedSources.has(source)) continue;
    visitedSources.add(source);
    sources.push(source);
    for (const nested of [source.reply_to_message, source.external_reply]) {
      if (nested && typeof nested === "object") queue.push(nested);
    }
  }
  const collected = [];
  const seen = new Set();
  for (const source of sources) {
    for (const field of ONE_TIME_MEDIA_FIELDS) {
      const value = source[field];
      const item = field === "photo" && Array.isArray(value)
        ? [...value].sort((left, right) => Number(right.file_size || 0) - Number(left.file_size || 0))[0]
        : value;
      if (!item?.file_id) continue;
      const kind = field;
      const identity = item.file_unique_id || item.file_id;
      if (seen.has(identity)) continue;
      seen.add(identity);
      collected.push({ source, kind, media: { field, value: field === "photo" ? value : item } });
    }
  }
  return collected;
}

function publicError(error) {
  return error instanceof Error ? error.message : "request failed";
}
