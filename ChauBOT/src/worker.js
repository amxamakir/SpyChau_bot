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
  month: { months: 1, rubles: 249, stars: 156 },
  "half-year": { months: 6, rubles: 1190, stars: 745 },
  year: { months: 12, rubles: 1790, stars: 1119 },
});
const PERSONAL_PACKAGE_PLANS = Object.freeze({
  pack100: { events: 100, rubles: 189, stars: 118 },
  pack300: { events: 300, rubles: 499, stars: 312 },
  pack500: { events: 500, rubles: 699, stars: 437 },
});
const GROUP_ACCESS_PLANS = Object.freeze({
  groups3: { groups: 3, months: 1, rubles: 349, stars: 218 },
  groups10: { groups: 10, months: 1, rubles: 790, stars: 494 },
  groups20: { groups: 20, months: 1, rubles: 1090, stars: 681 },
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
  if (serviceKey === "personal_package") return planId
    ? Boolean(tributeProduct(env, serviceKey, planId))
    : Object.keys(PERSONAL_PACKAGE_PLANS).some((id) => Boolean(tributeProduct(env, serviceKey, id)));
  if (["personal_unlimited", "groups"].includes(serviceKey)) return planId
    ? Boolean(tributeSubscription(env, serviceKey, planId))
    : Object.keys(serviceKey === "personal_unlimited" ? PERSONAL_SUBSCRIPTION_PLANS : GROUP_ACCESS_PLANS)
      .some((id) => Boolean(tributeSubscription(env, serviceKey, id)));
  return serviceKey === null && (
    Object.keys(PERSONAL_PACKAGE_PLANS).some((id) => Boolean(tributeProduct(env, "personal_package", id)))
    || Object.keys(PERSONAL_SUBSCRIPTION_PLANS).some((id) => Boolean(tributeSubscription(env, "personal_unlimited", id)))
    || Object.keys(GROUP_ACCESS_PLANS).some((id) => Boolean(tributeSubscription(env, "groups", id)))
  );
}

async function cancelTributeShopOrder(env, orderUuid) {
  try {
    const response = await fetch(`https://tribute.tg/api/v1/shop/orders/${encodeURIComponent(orderUuid)}/cancel`, {
      method: "POST",
      headers: { "Api-Key": String(env.TRIBUTE_API_KEY || ""), Accept: "application/json" },
    });
    return response.ok;
  } catch { return false; }
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
  const plan = serviceKey === "personal_package" ? PERSONAL_PACKAGE_PLANS[planId]
    : serviceKey === "personal_unlimited" ? PERSONAL_SUBSCRIPTION_PLANS[planId]
      : serviceKey === "groups" ? GROUP_ACCESS_PLANS[planId] : null;
  const expected = plan?.rubles;
  const rawLink = String(spec?.telegram_link || spec?.link || "").trim();
  const rawWebLink = String(spec?.web_link || "").trim();
  const webMatch = rawWebLink.match(/^https:\/\/web\.tribute\.tg\/p\/([\w-]+)$/i);
  const telegramMatch = rawLink.match(/^https:\/\/(?:t\.me|telegram\.me)\/(?:tribute|tribute_bot)\/app\?startapp=p[\w-]+$/i);
  if (!plan || !Number.isFinite(expected) || Number(spec?.amount_rub) !== expected
    || !webMatch || !telegramMatch) return null;
  return { key, link: rawLink, web_link: rawWebLink, checkout_url: rawWebLink, amount_rub: expected, ...plan };
}

function tributeSubscriptionMap(env) {
  try {
    const value = JSON.parse(String(env.TRIBUTE_SUBSCRIPTIONS || "{}"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

function tributeSubscription(env, serviceKey, planId) {
  const subscriptions = tributeSubscriptionMap(env);
  const spec = subscriptions?.[`${serviceKey}:${planId}`];
  const plan = serviceKey === "personal_unlimited" ? PERSONAL_SUBSCRIPTION_PLANS[planId]
    : serviceKey === "groups" ? GROUP_ACCESS_PLANS[planId] : null;
  const expected = plan?.rubles;
  const telegramLink = String(spec?.telegram_link || spec?.link || "").trim();
  const webLink = String(spec?.web_link || "").trim();
  const isTributeLink = (value) => {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      if (url.protocol !== "https:") return false;
      if (["t.me", "telegram.me", "www.telegram.me"].includes(host)) {
        const startParameter = url.searchParams.get("startapp") || url.searchParams.get("start") || "";
        return /^\/(?:tribute|tribute_bot)(?:\/app)?\/?$/i.test(url.pathname)
          && Boolean(startParameter)
          && !/^p[\w-]+$/i.test(startParameter);
      }
      return host === "web.tribute.tg" && url.pathname !== "/"
        && !/^\/p\/[\w-]+\/?$/i.test(url.pathname);
    } catch { return false; }
  };
  const subscriptionId = String(spec?.subscription_id || "").trim();
  if (!plan || Number(spec?.amount_rub) !== expected
    || ![telegramLink, webLink].some(isTributeLink)
    || (subscriptionId && !/^[\w-]{1,100}$/.test(subscriptionId))) return null;
  return {
    key: `${serviceKey}:${planId}`,
    service_key: serviceKey,
    plan_id: planId,
    subscription_id: subscriptionId,
    telegram_link: isTributeLink(telegramLink) ? telegramLink : "",
    web_link: isTributeLink(webLink) ? webLink : "",
    checkout_url: isTributeLink(telegramLink) ? telegramLink : webLink,
    amount_rub: expected,
    ...plan,
  };
}

async function getTributeProduct(productId, env) {
  const response = await fetch(`https://tribute.tg/api/v1/products/${encodeURIComponent(productId)}`, {
    headers: { "Api-Key": String(env.TRIBUTE_API_KEY || ""), Accept: "application/json" },
  });
  if (!response.ok) return null;
  try { return await response.json(); } catch { return null; }
}

async function getTributeProductByWebLink(webLink, env) {
  const productSlug = (value) => {
    try {
      const url = new URL(String(value || ""));
      const webPath = url.pathname.match(/\/p\/([^/]+)\/?$/i)?.[1];
      if (webPath) return decodeURIComponent(webPath).toLowerCase();
      const startApp = url.searchParams.get("startapp") || "";
      return startApp.match(/^p([\w-]+)$/i)?.[1]?.toLowerCase() || "";
    } catch { return ""; }
  };
  const target = productSlug(webLink);
  if (!target) return { product: null, issue: "invalid_link" };

  for (let page = 1; page <= 10; page += 1) {
    const query = new URLSearchParams({ page: String(page), size: "100", type: "digital", desc: "true" });
    let response;
    try {
      response = await fetch(`https://tribute.tg/api/v1/products?${query}`, {
        headers: { "Api-Key": String(env.TRIBUTE_API_KEY || ""), Accept: "application/json" },
      });
    } catch {
      return { product: null, issue: "api_unavailable" };
    }
    if (!response.ok) return { product: null, issue: "api_unavailable" };

    let result;
    try { result = await response.json(); } catch { return { product: null, issue: "invalid_response" }; }
    const rows = Array.isArray(result?.rows) ? result.rows
      : Array.isArray(result?.data?.rows) ? result.data.rows
        : Array.isArray(result) ? result : [];
    const product = rows.find((row) => productSlug(row?.webLink || row?.web_link || row?.link) === target);
    if (product) return { product, issue: null };
    if (rows.length < 100) break;
  }
  return { product: null, issue: "product_not_found" };
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
      return json({ status: "ok", service: "spychau-api", version: "0.11.26" });
    }

    const avatarMatch = route.match(/^\/api\/avatar\/(\d+)$/);
    if (avatarMatch && request.method === "GET") {
      const event = await env.DB.prepare("SELECT owner_id FROM events WHERE id = ?")
        .bind(avatarMatch[1]).first();
      if (!event || !(await hasPersonalDataAccess(env.DB, String(event.owner_id)))) {
        return new Response("Not found", { status: 404 });
      }
      return serveContactAvatar(request, env, avatarMatch[1]);
    }

    const mediaMatch = route.match(/^\/api\/media\/(\d+)$/);
    if (mediaMatch && request.method === "GET") {
      const event = await env.DB.prepare("SELECT owner_id FROM events WHERE id = ?")
        .bind(mediaMatch[1]).first();
      if (!event || !(await hasPersonalDataAccess(env.DB, String(event.owner_id)))) {
        return new Response("Not found", { status: 404 });
      }
      return serveArchivedMedia(request, env, mediaMatch[1]);
    }

    if (route === "/api/auth/telegram" && request.method === "POST") {
      try {
        const body = await readJson(request);
        const user = await validateInitData(body.init_data, env);
        await saveUser(env.DB, user);
        await trackAppVisitor(env.DB, user);
        await initializeNotificationPreferences(env.DB, String(user.id), body.notification_preferences);
        await upgradeNotificationControlMessage(env, String(user.id));
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
          if (!(["personal_unlimited", "personal_package", "groups"].includes(serviceKey))) return json({ error: "plan_unavailable" }, 400);
          const plan = serviceKey === "personal_package" ? PERSONAL_PACKAGE_PLANS[planId]
            : serviceKey === "personal_unlimited" ? PERSONAL_SUBSCRIPTION_PLANS[planId] : GROUP_ACCESS_PLANS[planId];
          const ownerId = String(user.id);
          if (!plan) return json({ error: "plan_unavailable" }, 400);
          if (!tributePaymentsReady(env, serviceKey, planId)) return json({ error: "plan_unavailable" }, 503);
          const isPackage = serviceKey === "personal_package";
          const purchaseMode = isPackage ? "one_time" : "recurring";
          if (!isPackage && body.autorenew_accepted !== true) return json({ error: "autorenew_consent_required" }, 400);

          if (!isPackage) {
            const existing = serviceKey === "personal_unlimited"
              ? await env.DB.prepare(`SELECT 1 AS active FROM subscriptions
                  WHERE owner_id = ? AND auto_renew = 1 AND expires_at > CURRENT_TIMESTAMP LIMIT 1`)
                .bind(ownerId).first()
              : (await getGroupEntitlement(env.DB, ownerId)).auto_renew
                ? { active: 1 } : null;
            if (existing) return json({ error: "active_subscription_exists" }, 409);
          }

          let checkoutUrl = "";
          if (isPackage) {
            const product = tributeProduct(env, serviceKey, planId);
            if (!product) return json({ error: "tribute_product_not_configured" }, 503);
            const lookup = await getTributeProductByWebLink(product.web_link, env);
            const actualProduct = lookup.product;
            if (!actualProduct || actualProduct.type !== "digital" || actualProduct.status !== "approved"
              || String(actualProduct.currency || "").toUpperCase() !== "RUB"
              || Number(actualProduct.amount) !== product.amount_rub * 100) {
              return json({ error: `tribute_product_${lookup.issue || "not_approved"}` }, 503);
            }
            if (actualProduct.acceptCards !== true) return json({ error: "tribute_product_cards_not_enabled" }, 503);
            if (actualProduct.starsAmountEnabled === true) return json({ error: "tribute_product_stars_must_be_disabled" }, 503);
            checkoutUrl = product.web_link;
          } else {
            const subscription = tributeSubscription(env, serviceKey, planId);
            if (!subscription) return json({ error: "tribute_subscription_not_configured" }, 503);
            checkoutUrl = subscription.checkout_url;
          }

          if (serviceKey === "groups") {
            await env.DB.prepare(`INSERT INTO service_payment_consents(consent_id, owner_id, service_key, plan_id, terms_version)
              VALUES(?, ?, 'groups', ?, ?)`)
              .bind(crypto.randomUUID(), ownerId, planId, env.PAYMENTS_TERMS_VERSION).run();
          } else {
            await env.DB.prepare(`INSERT INTO tribute_product_consents(consent_id, owner_id, plan_id, terms_version, service_key)
              VALUES(?, ?, ?, ?, ?)`)
              .bind(crypto.randomUUID(), ownerId, planId, env.PAYMENTS_TERMS_VERSION, serviceKey).run();
          }
          return json({ checkout_url: checkoutUrl, amount: plan.rubles, stars: 0, currency: "RUB", service_key: serviceKey, plan_id: planId, purchase_mode: purchaseMode });
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
          await refreshNotificationControlMessage(env, String(user.id));
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
          const ownerId = String(user.id);
          const entitlement = await getGroupEntitlement(env.DB, ownerId, env);
          if (!entitlement.active) return json({ error: "group_entitlement_required" }, 403);
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
      const pendingControlMessage = await env.DB.prepare(
        "SELECT 1 AS pending FROM notification_control_messages WHERE keyboard_version < 2 LIMIT 1",
      ).first();
      if (pendingControlMessage) {
        const callbackUpdatesReady = await ensureTelegramCallbackUpdates(env);
        if (callbackUpdatesReady) await upgradePendingNotificationControlMessages(env);
      }
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
      await notifyEntitlementReminders(env);
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
    if (update.callback_query) {
      if (update.callback_query.data === "toggle_one_time_messages") {
        return await handleNotificationToggleCallback(update.callback_query, env);
      }
      await callTelegramJson(env, "answerCallbackQuery", { callback_query_id: update.callback_query.id });
      return json({ ok: true, ignored: "unknown_callback" });
    }

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
      const ownerId = String(incomingMessage.from?.id || incomingMessage.chat.id);
      let hasEnabledConnection = false;
      let oneTimeMessagesEnabled = true;
      let callbackUpdatesReady = false;
      if (!isHelp) {
        await saveUser(env.DB, incomingMessage.from || { id: incomingMessage.chat.id });
        hasEnabledConnection = Boolean(await env.DB.prepare(
          "SELECT 1 AS connected FROM connections WHERE owner_id = ? AND enabled = 1 LIMIT 1",
        ).bind(ownerId).first());
        const notificationSettings = await getNotificationPreferences(env.DB, ownerId);
        oneTimeMessagesEnabled = notificationSettings.preferences.one_time_messages;
        if (hasEnabledConnection) callbackUpdatesReady = await ensureTelegramCallbackUpdates(env);
      }
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: incomingMessage.chat.id,
          text: isHelp
            ? "Я SpySkaut — архив изменений в подключённых чатах Telegram.\n\n/start — открыть приложение и начать\n/connect — получить инструкцию по подключению личных чатов\n/terms — условия оплаты\n/paysupport — помощь по платежам\n/help — показать эту справку\n\nЯ сохраняю только новые события, которые Telegram присылает после подключения выбранного чата. Историю сообщений до подключения восстановить нельзя."
            : "Привет! Я Скаут, помощник SpySkaut 🕵️\n\n✏️ Показывает изменения сообщений и сохранённый исходный текст.\n🗑️ Фиксирует удаления, о которых Telegram сообщил боту.\n🔔 Присылает уведомления о событиях — одноразовые сообщения можно включать кнопкой ниже.\n📎 Сохраняет доступные фото, видео, голосовые и документы.\n🗂️ Хранит архив до 7 дней.\n\n<b>Как начать:</b>\n1. Подключи SpySkaut через настройки Telegram.\n2. В «Автоматизации чатов» добавь @SpySkaut_bot и выбери нужные чаты.\n3. Открой приложение и смотри историю событий.\n\nСохраняются события, которые Telegram присылает после подключения выбранных чатов. Исчезающие медиа могут быть недоступны.",
          parse_mode: isHelp ? undefined : "HTML",
          reply_markup: {
            inline_keyboard: isHelp
              ? [[{ text: "Открыть SpySkaut", web_app: { url: "https://spychau-bot.senba11.workers.dev/" } }]]
              : [
                  [notificationControlButton(hasEnabledConnection, oneTimeMessagesEnabled, callbackUpdatesReady)],
                  [{ text: "Открыть приложение", web_app: { url: "https://spychau-bot.senba11.workers.dev/" } }],
                ],
          },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) return json({ error: "Telegram could not send the start message" }, 502);
      if (startMatch && Number.isInteger(result.result?.message_id)) {
        await saveNotificationControlMessage(
          env.DB,
          ownerId,
          incomingMessage.chat.id,
          result.result.message_id,
          callbackUpdatesReady ? 2 : 1,
        );
      }
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
      const activeConnection = await env.DB.prepare(
        "SELECT 1 AS connected FROM connections WHERE owner_id = ? AND enabled = 1 LIMIT 1",
      ).bind(ownerId).first();
      const controlMessage = await env.DB.prepare(
        "SELECT 1 AS exists_flag FROM notification_control_messages WHERE owner_id = ?",
      ).bind(ownerId).first();
      if (activeConnection && !controlMessage) {
        await sendNotificationControlMessage(env, ownerId);
      } else if (controlMessage) {
        await refreshNotificationControlMessage(env, ownerId);
      }
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

    const [subscription, packageBalance] = await Promise.all([
      getSubscription(env.DB, String(connectionRow.owner_id)),
      getNotificationPackageBalance(env.DB, String(connectionRow.owner_id)),
    ]);
    if (!subscription.active && !packageBalance.remaining) {
      return json({ ok: true, ignored: "personal_access_expired" });
    }

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
  if (eventName.startsWith("shop_order")) {
    return handleTributeShopWebhook(eventName, event, payload, rawBody, env);
  }
  if (eventName === "new_digital_product") {
    return handleTributeDigitalProduct(payload, rawBody, env);
  }
  if (eventName === "digital_product_refunded") {
    return handleTributeDigitalProductRefund(payload, rawBody, env);
  }
  if (!["new_subscription", "renewed_subscription", "cancelled_subscription"].includes(eventName)) {
    return json({ ok: true, ignored: true });
  }
  return handleTributeSubscriptionWebhook(eventName, event, payload, env);
}

async function handleTributeSubscriptionWebhook(eventName, event, payload, env) {
  const ownerId = String(payload.telegram_user_id || "");
  const subscriptionId = String(payload.subscription_id || payload.subscriptionId || "");
  if (!/^\d{1,20}$/.test(ownerId) || !subscriptionId) return json({ ok: true, ignored: true });

  if (eventName === "cancelled_subscription") {
    const [personal, groups] = await Promise.all([
      env.DB.prepare(`SELECT plan_id FROM subscriptions
        WHERE owner_id = ? AND tribute_subscription_id = ? LIMIT 1`).bind(ownerId, subscriptionId).first(),
      env.DB.prepare(`SELECT plan_id FROM group_entitlements
        WHERE owner_id = ? AND provider_subscription_id = ? LIMIT 1`).bind(ownerId, subscriptionId).first(),
    ]);
    const serviceKey = personal ? "personal_unlimited" : groups ? "groups" : null;
    const planId = personal?.plan_id || groups?.plan_id || "";
    if (!serviceKey) return json({ ok: true, ignored: true, reason: "subscription_not_linked" });
    const eventKey = await tributeSubscriptionEventKey(eventName, event, payload, ownerId, subscriptionId);
    try {
      const update = serviceKey === "personal_unlimited"
        ? env.DB.prepare(`UPDATE subscriptions SET auto_renew = 0, updated_at = CURRENT_TIMESTAMP
            WHERE owner_id = ? AND tribute_subscription_id = ? AND changes() = 1`).bind(ownerId, subscriptionId)
        : env.DB.prepare(`UPDATE group_entitlements SET auto_renew = 0, updated_at = CURRENT_TIMESTAMP
            WHERE owner_id = ? AND provider_subscription_id = ? AND changes() = 1`).bind(ownerId, subscriptionId);
      const results = await env.DB.batch([
        env.DB.prepare(`INSERT OR IGNORE INTO tribute_subscription_events(
          event_key, owner_id, event_name, subscription_id, service_key, plan_id, amount_minor, currency
        ) VALUES(?, ?, 'cancelled_subscription', ?, ?, ?, 0, 'RUB')`)
          .bind(eventKey, ownerId, subscriptionId, serviceKey, planId),
        update,
      ]);
      return json({ ok: true, handled: Number(results?.[0]?.meta?.changes || 0) === 1 ? "cancellation" : "duplicate" });
    } catch {
      return json({ error: "Tribute subscription cancellation could not be recorded" }, 500);
    }
  }

  if (payload.type && payload.type !== "regular") return json({ ok: true, ignored: true });
  const planEntry = tributeSubscriptionPlan(payload, env);
  if (!planEntry) return json({ ok: true, ignored: true, reason: "subscription_not_mapped" });
  const { service_key: serviceKey, plan_id: planId, plan } = planEntry;
  const rawAmount = Number(payload.amount);
  const amountRub = rawAmount > 3000 ? rawAmount / 100 : rawAmount;
  const amountMinor = Math.round(amountRub * 100);
  if (String(payload.currency || "").toUpperCase() !== "RUB" || Math.round(amountRub * 100) !== plan.rubles * 100) {
    console.warn("Tribute subscription amount does not match configured tariff", { serviceKey, planId, subscriptionId });
    return json({ ok: true, ignored: true, reason: "subscription_amount_mismatch" });
  }

  if (eventName === "new_subscription") {
    const consent = serviceKey === "groups"
      ? await env.DB.prepare(`SELECT 1 AS accepted FROM service_payment_consents
          WHERE owner_id = ? AND service_key = 'groups' AND plan_id = ?
            AND accepted_at >= datetime('now', '-24 hours') LIMIT 1`).bind(ownerId, planId).first()
      : await env.DB.prepare(`SELECT 1 AS accepted FROM tribute_product_consents
          WHERE owner_id = ? AND service_key = 'personal_unlimited' AND plan_id = ?
            AND accepted_at >= datetime('now', '-24 hours') LIMIT 1`).bind(ownerId, planId).first();
    if (!consent) return json({ ok: true, ignored: true, reason: "autorenew_consent_not_found" });
  } else {
    const linked = serviceKey === "groups"
      ? await env.DB.prepare(`SELECT 1 AS linked FROM group_entitlements
          WHERE owner_id = ? AND provider_subscription_id = ? LIMIT 1`).bind(ownerId, subscriptionId).first()
      : await env.DB.prepare(`SELECT 1 AS linked FROM subscriptions
          WHERE owner_id = ? AND tribute_subscription_id = ? LIMIT 1`).bind(ownerId, subscriptionId).first();
    if (!linked) return json({ ok: true, ignored: true, reason: "subscription_not_linked" });
  }

  const eventKey = await tributeSubscriptionEventKey(eventName, event, payload, ownerId, subscriptionId);
  const purchaseId = `tribute:subscription:${subscriptionId}:${eventKey}`;
  const statements = [env.DB.prepare(`INSERT OR IGNORE INTO tribute_subscription_events(
      event_key, owner_id, event_name, subscription_id, service_key, plan_id, amount_minor, currency
    ) VALUES(?, ?, ?, ?, ?, ?, ?, 'RUB')`)
    .bind(eventKey, ownerId, eventName, subscriptionId, serviceKey, planId, amountMinor)];

  if (serviceKey === "personal_unlimited") {
    statements.push(env.DB.prepare(`INSERT OR IGNORE INTO payment_purchases(
        purchase_id, provider, provider_event_id, owner_id, service_key, plan_id, amount_minor, currency, expires_at
      ) SELECT ?, 'tribute_subscription', ?, ?, 'personal_unlimited', ?, ?, 'RUB', datetime(
        CASE WHEN julianday((SELECT expires_at FROM subscriptions WHERE owner_id = ?)) > julianday('now')
          THEN (SELECT expires_at FROM subscriptions WHERE owner_id = ?) ELSE 'now' END,
        printf('+%d months', ?)
      ) WHERE changes() = 1`)
      .bind(purchaseId, eventKey, ownerId, planId, amountMinor, ownerId, ownerId, plan.months));
    statements.push(env.DB.prepare(`INSERT INTO subscriptions(
        owner_id, expires_at, plan_id, auto_renew, tribute_subscription_id
      ) SELECT ?, datetime('now', printf('+%d months', ?)), ?, 1, ? WHERE changes() = 1
      ON CONFLICT(owner_id) DO UPDATE SET expires_at = datetime(
        CASE WHEN julianday(subscriptions.expires_at) > julianday('now')
          THEN subscriptions.expires_at ELSE 'now' END,
        printf('+%d months', ?)
      ), plan_id = excluded.plan_id, auto_renew = 1,
      tribute_subscription_id = excluded.tribute_subscription_id,
      updated_at = CURRENT_TIMESTAMP`)
      .bind(ownerId, plan.months, planId, subscriptionId, plan.months));
  } else {
    statements.push(env.DB.prepare(`INSERT INTO group_entitlements(
        owner_id, plan_id, groups_limit, starts_at, expires_at, provider_subscription_id, auto_renew, updated_at
      ) SELECT ?, ?, ?, CURRENT_TIMESTAMP,
        datetime(CASE WHEN julianday((SELECT expires_at FROM group_entitlements WHERE owner_id = ?)) > julianday('now')
          THEN (SELECT expires_at FROM group_entitlements WHERE owner_id = ?) ELSE 'now' END,
          printf('+%d months', ?)), ?, 1, CURRENT_TIMESTAMP WHERE changes() = 1
      ON CONFLICT(owner_id) DO UPDATE SET plan_id = excluded.plan_id,
        groups_limit = excluded.groups_limit,
        starts_at = CASE WHEN julianday(group_entitlements.expires_at) > julianday('now')
          THEN group_entitlements.starts_at ELSE excluded.starts_at END,
        expires_at = datetime(CASE WHEN julianday(group_entitlements.expires_at) > julianday('now')
          THEN group_entitlements.expires_at ELSE 'now' END, printf('+%d months', ?)),
        provider_subscription_id = excluded.provider_subscription_id,
        auto_renew = 1, updated_at = CURRENT_TIMESTAMP`)
      .bind(ownerId, planId, plan.groups, ownerId, ownerId, plan.months, subscriptionId, plan.months));
  }

  try {
    const results = await env.DB.batch(statements);
    const eventRecorded = Number(results?.[0]?.meta?.changes || 0) === 1;
    if (eventRecorded) await notifyPurchaseConfirmed(env, ownerId, serviceKey, planId, eventName);
    return json({ ok: true, handled: eventName, service_key: serviceKey, plan_id: planId, duplicate: !eventRecorded });
  } catch (error) {
    console.error("Tribute subscription event processing failed", { serviceKey, planId, error: String(error?.message || error) });
    return json({ error: "Tribute subscription event processing failed" }, 500);
  }
}

async function handleTributeShopWebhook(eventName, event, payload, rawBody, env) {
  const orderUuid = String(payload.uuid || payload.orderUuid || "");
  if (!/^[0-9a-f-]{36}$/i.test(orderUuid)) return json({ error: "invalid Tribute Shop order UUID" }, 400);
  const order = await env.DB.prepare(`SELECT * FROM tribute_shop_orders WHERE order_uuid = ?`).bind(orderUuid).first();
  if (!order) return json({ ok: true, ignored: true, reason: "shop_order_not_mapped" });

  const transactionId = payload.transactionId == null ? "" : String(payload.transactionId);
  const createdAt = String(event?.created_at || "");
  const eventIdentity = `${eventName}:${orderUuid}:${transactionId}:${createdAt}`;
  const eventKey = await sha256Hex(eventIdentity || rawBody);
  const recordEvent = () => env.DB.prepare(`INSERT OR IGNORE INTO tribute_shop_order_events(
    event_key, order_uuid, event_name, transaction_id
  ) VALUES(?, ?, ?, ?)`)
    .bind(eventKey, orderUuid, eventName, transactionId || null);

  if (eventName === "shop_order_cancelled") {
    try {
      await env.DB.batch([
        recordEvent(),
        env.DB.prepare(`UPDATE tribute_shop_orders SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, CURRENT_TIMESTAMP),
          updated_at = CURRENT_TIMESTAMP WHERE order_uuid = ? AND changes() = 1`).bind(orderUuid),
        env.DB.prepare(`UPDATE subscriptions SET auto_renew = 0, updated_at = CURRENT_TIMESTAMP
          WHERE provider_order_uuid = ?`).bind(orderUuid),
      ]);
    } catch { return json({ error: "Tribute Shop cancellation could not be recorded" }, 500); }
    return json({ ok: true, handled: eventName });
  }

  if (eventName === "shop_order_payment_failed" || eventName === "shop_order_charge_failed") {
    try {
      await env.DB.batch([
        recordEvent(),
        env.DB.prepare(`UPDATE tribute_shop_orders SET status = 'payment_failed', updated_at = CURRENT_TIMESTAMP
          WHERE order_uuid = ? AND changes() = 1`).bind(orderUuid),
      ]);
    } catch { return json({ error: "Tribute Shop failure could not be recorded" }, 500); }
    return json({ ok: true, handled: eventName });
  }

  if (eventName === "shop_order_refunded") {
    try {
      if (order.purchase_mode === "recurring" && order.status !== "cancelled") {
        if (!await cancelTributeShopOrder(env, orderUuid)) return json({ error: "Tribute Shop subscription cancellation failed after refund" }, 500);
      }
      const inserted = await recordEvent().run();
      if (Number(inserted.meta?.changes || 0) !== 1) return json({ ok: true, ignored: true, reason: "duplicate_event" });
      await env.DB.prepare(`UPDATE payment_purchases SET refunded_at = CURRENT_TIMESTAMP
        WHERE provider_order_uuid = ? AND refunded_at IS NULL`).bind(orderUuid).run();
      await env.DB.prepare(`UPDATE notification_packages SET credits_remaining = 0
        WHERE purchase_id = (SELECT purchase_id FROM payment_purchases WHERE provider_order_uuid = ? LIMIT 1)`)
        .bind(orderUuid).run();
      await env.DB.prepare(`UPDATE subscriptions SET
        expires_at = COALESCE((SELECT MAX(expires_at) FROM payment_purchases
          WHERE owner_id = subscriptions.owner_id AND service_key = 'personal_unlimited'
            AND refunded_at IS NULL AND expires_at > CURRENT_TIMESTAMP), CURRENT_TIMESTAMP),
        auto_renew = CASE WHEN provider_order_uuid = ? THEN 0 ELSE auto_renew END,
        provider_order_uuid = CASE WHEN provider_order_uuid = ? THEN NULL ELSE provider_order_uuid END,
        updated_at = CURRENT_TIMESTAMP WHERE owner_id = ?`)
        .bind(orderUuid, orderUuid, order.owner_id).run();
      await env.DB.prepare(`UPDATE tribute_shop_orders SET status = 'refunded', updated_at = CURRENT_TIMESTAMP
        WHERE order_uuid = ?`).bind(orderUuid).run();
    } catch { return json({ error: "Tribute Shop refund could not be recorded" }, 500); }
    return json({ ok: true, handled: eventName });
  }

  const isInitialPayment = eventName === "shop_order" || eventName === "shop_order_payment_received";
  const isRenewal = eventName === "shop_order_charge_success";
  if (!isInitialPayment && !isRenewal) return json({ ok: true, ignored: true });
  if (isInitialPayment && String(payload.status || "paid").toLowerCase() !== "paid") return json({ ok: true, ignored: true, reason: "order_not_paid" });
  if (String(payload.currency || "").toLowerCase() !== "rub"
    || Number(payload.amount) !== Number(order.amount_minor)) {
    console.warn("Tribute Shop payment does not match order", JSON.stringify({ order_uuid: orderUuid, event: eventName }));
    return json({ error: "Tribute Shop payment amount mismatch" }, 400);
  }

  const serviceKey = String(order.service_key);
  const planId = String(order.plan_id);
  const plan = serviceKey === "personal_package" ? PERSONAL_PACKAGE_PLANS[planId]
    : serviceKey === "personal_unlimited" ? PERSONAL_SUBSCRIPTION_PLANS[planId] : GROUP_ACCESS_PLANS[planId];
  if (!plan) return json({ error: "unknown Tribute Shop plan" }, 400);
  const purchaseId = `shop-order:${orderUuid}`;
  const eventTimestamp = Number.isFinite(Date.parse(createdAt)) ? new Date(createdAt).toISOString() : new Date().toISOString();
  try {
    if (isRenewal && order.purchase_mode === "recurring") {
      const results = await env.DB.batch([
        recordEvent(),
        env.DB.prepare(`UPDATE payment_purchases SET
          expires_at = datetime(CASE WHEN julianday(expires_at) > julianday('now') THEN expires_at ELSE 'now' END,
            printf('+%d months', ?)), purchased_at = ?
          WHERE purchase_id = ? AND refunded_at IS NULL AND changes() = 1`)
          .bind(plan.months, eventTimestamp, purchaseId),
        env.DB.prepare(`UPDATE subscriptions SET expires_at = datetime(
            CASE WHEN julianday(expires_at) > julianday('now') THEN expires_at ELSE 'now' END,
            printf('+%d months', ?)), auto_renew = 1, provider_order_uuid = ?, updated_at = CURRENT_TIMESTAMP
          WHERE owner_id = ? AND provider_order_uuid = ? AND changes() = 1`)
          .bind(plan.months, orderUuid, String(order.owner_id), orderUuid),
        env.DB.prepare(`UPDATE tribute_shop_orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP
          WHERE order_uuid = ? AND changes() = 1`).bind(orderUuid),
      ]);
      if (Number(results?.[0]?.meta?.changes || 0) === 1) {
        await notifyPurchaseConfirmed(env, String(order.owner_id), serviceKey, planId, eventName, purchaseId);
      }
      return json({ ok: true, handled: eventName, plan_id: planId });
    }

    const statements = [
      recordEvent(),
      env.DB.prepare(`INSERT OR IGNORE INTO payment_purchases(
        purchase_id, provider, provider_event_id, owner_id, service_key, plan_id, amount_minor, currency,
        expires_at, credits_granted, groups_limit, provider_order_uuid, purchased_at
      ) SELECT ?, 'tribute_shop', ?, ?, ?, ?, ?, 'RUB',
        CASE WHEN ? IS NULL THEN NULL ELSE datetime('now', printf('+%d months', ?)) END,
        ?, ?, ?, ? WHERE changes() = 1`)
        .bind(purchaseId, `shop-order:${orderUuid}`, String(order.owner_id), serviceKey, planId,
          Number(order.amount_minor), serviceKey === "personal_package" ? null : plan.months,
          serviceKey === "personal_package" ? 0 : plan.months,
          serviceKey === "personal_package" ? plan.events : 0,
          serviceKey === "groups" ? plan.groups : 0,
          orderUuid, eventTimestamp),
    ];
    if (serviceKey === "personal_package") {
      statements.push(env.DB.prepare(`INSERT OR IGNORE INTO notification_packages(
        package_id, owner_id, purchase_id, plan_id, credits_total, credits_remaining, activated_after_event_id
      ) SELECT ?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(id) FROM events WHERE owner_id = ?), 0)
        WHERE changes() = 1`)
        .bind(crypto.randomUUID(), String(order.owner_id), purchaseId, planId, plan.events, plan.events, String(order.owner_id)));
    } else if (serviceKey === "personal_unlimited") {
      statements.push(env.DB.prepare(`INSERT INTO subscriptions(owner_id, expires_at, plan_id, auto_renew, provider_order_uuid)
        SELECT ?, datetime('now', printf('+%d months', ?)), ?, ?, ? WHERE changes() = 1
        ON CONFLICT(owner_id) DO UPDATE SET expires_at = datetime(
          CASE WHEN julianday(subscriptions.expires_at) > julianday('now') THEN subscriptions.expires_at ELSE 'now' END,
          printf('+%d months', ?)
        ), plan_id = excluded.plan_id,
        auto_renew = CASE WHEN excluded.auto_renew = 1 THEN 1
          WHEN julianday(subscriptions.expires_at) > julianday('now') THEN subscriptions.auto_renew ELSE 0 END,
        provider_order_uuid = CASE WHEN excluded.auto_renew = 1 THEN excluded.provider_order_uuid
          ELSE subscriptions.provider_order_uuid END,
        updated_at = CURRENT_TIMESTAMP`)
        .bind(String(order.owner_id), plan.months, planId, order.purchase_mode === "recurring" ? 1 : 0,
          order.purchase_mode === "recurring" ? orderUuid : null, plan.months));
    }
    statements.push(env.DB.prepare(`UPDATE tribute_shop_orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP
      WHERE order_uuid = ? AND changes() = 1`).bind(orderUuid));
    const results = await env.DB.batch(statements);
    if (Number(results?.[1]?.meta?.changes || 0) === 1) {
      await notifyPurchaseConfirmed(env, String(order.owner_id), serviceKey, planId, eventName, purchaseId);
    }
  } catch (error) {
    console.error("Tribute Shop payment could not be recorded", { orderUuid, eventName, error: String(error?.message || error) });
    return json({ error: "Tribute Shop payment could not be recorded" }, 500);
  }
  return json({ ok: true, handled: eventName, service_key: serviceKey, plan_id: planId });
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
    || String(actualProduct.currency || "").toUpperCase() !== "RUB") {
    return json({ error: "Tribute digital product is missing, not approved, or not in RUB" }, 503);
  }
  let serviceKey = null;
  let planId = null;
  let expectedProduct = null;
  for (const key of [
    ...Object.keys(PERSONAL_PACKAGE_PLANS).map((id) => `personal_package:${id}`),
    ...Object.keys(PERSONAL_SUBSCRIPTION_PLANS).map((id) => `personal_unlimited:${id}`),
    ...Object.keys(GROUP_ACCESS_PLANS).map((id) => `groups:${id}`),
  ]) {
    const [candidateService, candidatePlan] = key.split(":");
    const candidate = tributeProduct(env, candidateService, candidatePlan);
    const productLinks = [actualProduct.link, actualProduct.webLink, actualProduct.web_link]
      .map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
    if (candidate && [candidate.link, candidate.web_link]
      .some((value) => productLinks.includes(String(value || "").trim().toLowerCase()))) {
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
  const consent = serviceKey === "groups"
    ? await env.DB.prepare(`SELECT 1 AS accepted FROM service_payment_consents
        WHERE owner_id = ? AND plan_id = ? AND service_key = 'groups'
          AND accepted_at >= datetime('now', '-24 hours') LIMIT 1`).bind(ownerId, planId).first()
    : await env.DB.prepare(`SELECT 1 AS accepted FROM tribute_product_consents
        WHERE owner_id = ? AND plan_id = ? AND service_key = ?
          AND accepted_at >= datetime('now', '-24 hours') LIMIT 1`).bind(ownerId, planId, serviceKey).first();
  if (!consent) return json({ ok: true, ignored: true });
  const refunded = await env.DB.prepare("SELECT 1 FROM tribute_digital_product_refunds WHERE purchase_id = ?")
    .bind(purchaseId).first();
  if (refunded) return json({ ok: true, ignored: true, reason: "purchase_already_refunded" });

  try {
    if (serviceKey === "groups") {
      const plan = GROUP_ACCESS_PLANS[planId];
      if (!plan) return json({ error: "unknown group plan" }, 400);
      const eventKey = `tribute:product:${purchaseId}`;
      const inserted = await env.DB.prepare(`INSERT OR IGNORE INTO payment_purchases(
        purchase_id, provider, provider_event_id, owner_id, service_key, plan_id, amount_minor, currency, expires_at, groups_limit
      ) VALUES(?, 'tribute', ?, ?, 'groups', ?, ?, 'RUB', datetime('now', printf('+%d months', ?)), ?)`)
        .bind(eventKey, `product:${purchaseId}`, ownerId, planId, amount, plan.months, plan.groups).run();
      if (Number(inserted.meta?.changes || 0) === 1) {
        await notifyPurchaseConfirmed(env, ownerId, serviceKey, planId, "new_digital_product", purchaseId);
      }
      return json({ ok: true, handled: "new_digital_product", service: serviceKey, plan_id: planId });
    }

    if (serviceKey === "personal_package") {
      const plan = PERSONAL_PACKAGE_PLANS[planId];
      if (!plan) return json({ error: "unknown package plan" }, 400);
      const results = await env.DB.batch([
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
      if (Number(results?.[0]?.meta?.changes || 0) === 1) {
        await notifyPurchaseConfirmed(env, ownerId, serviceKey, planId, "new_digital_product", purchaseId);
      }
      return json({ ok: true, handled: "new_digital_product", service: serviceKey });
    }

    const plan = PERSONAL_SUBSCRIPTION_PLANS[planId];
    if (!plan) return json({ error: "unknown subscription plan" }, 400);
    const eventKey = `tribute:product:${purchaseId}`;
    const results = await env.DB.batch([
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
          CASE WHEN julianday(subscriptions.expires_at) > julianday('now')
            THEN subscriptions.expires_at ELSE 'now' END,
          printf('+%d months', ?)
        ), plan_id = excluded.plan_id, auto_renew = CASE
          WHEN julianday(subscriptions.expires_at) > julianday('now') THEN subscriptions.auto_renew ELSE 0 END`)
        .bind(ownerId, plan.months, planId, plan.months),
    ]);
    if (Number(results?.[0]?.meta?.changes || 0) === 1) {
      await notifyPurchaseConfirmed(env, ownerId, serviceKey, planId, "new_digital_product", purchaseId);
    }
    return json({ ok: true, handled: "new_digital_product", service: serviceKey, plan_id: planId });

    return json({ ok: true, ignored: true });
  } catch {
    return json({ error: "Tribute digital product could not be recorded" }, 500);
  }
}

async function notifyPurchaseConfirmed(env, ownerId, serviceKey, planId, eventName, purchaseId = null) {
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  try {
    let text = "";
    if (serviceKey === "personal_package") {
      const plan = PERSONAL_PACKAGE_PLANS[planId];
      if (!plan) return false;
      const balance = await getNotificationPackageBalance(env.DB, ownerId);
      let packageRemaining = plan.events;
      if (purchaseId) {
        const storedPurchaseId = String(purchaseId).startsWith("shop-order:") ? String(purchaseId) : `tribute:product:${purchaseId}`;
        const purchasedPackage = await env.DB.prepare(`SELECT credits_remaining FROM notification_packages
          WHERE purchase_id = ? AND owner_id = ? LIMIT 1`).bind(storedPurchaseId, ownerId).first();
        packageRemaining = Number(purchasedPackage?.credits_remaining ?? plan.events);
      }
      text = `✅ Оплата получена!\n\nПакет на ${plan.events} уведомлений активирован.\n\nВ купленном пакете осталось ${packageRemaining} из ${plan.events}.\nВсего доступно: ${Number(balance.remaining || 0)} уведомлений. Пакет не сгорает.\n\nОстаток можно посмотреть в приложении SpySkaut, в разделе «Профиль».`;
    } else if (serviceKey === "personal_unlimited") {
      const plan = PERSONAL_SUBSCRIPTION_PLANS[planId];
      if (!plan) return false;
      const subscription = await getSubscription(env.DB, ownerId);
      const expiry = subscription.expires_at ? formatPurchaseExpiry(subscription.expires_at) : "не указана";
      const action = ["renewed_subscription", "shop_order_charge_success"].includes(eventName) ? "продлена" : "активирована";
      text = `✅ Оплата получена!\n\nПодписка «Личные чаты — Безлимит на ${plan.months} ${russianMonthWord(plan.months)}» ${action}.\nДоступ действует до ${expiry}.\n\nСтатус подписки можно посмотреть в приложении SpySkaut, в разделе «Профиль».`;
    } else if (serviceKey === "groups") {
      const plan = GROUP_ACCESS_PLANS[planId];
      if (!plan) return false;
      const entitlement = await getGroupEntitlement(env.DB, ownerId);
      const expiry = entitlement.expires_at ? formatPurchaseExpiryDateTime(entitlement.expires_at) : "не указана";
      const action = ["shop_order_charge_success", "renewed_subscription"].includes(eventName) ? "продлён" : "активирован";
      text = `✅ Оплата получена!\n\nПодписка на ${plan.groups} групповых чатов ${action}.\nБлижайший срок окончания: ${expiry}. Автопродление можно отменить в Tribute.\n\nСтатус и свободные места можно посмотреть в приложении SpySkaut, в разделе «Профиль».`;
    } else {
      return false;
    }
    const sent = await callTelegramJson(env, "sendMessage", { chat_id: ownerId, text });
    if (!sent) console.error("Purchase confirmation message could not be delivered", { serviceKey, planId, eventName });
    return sent;
  } catch {
    console.error("Purchase confirmation could not be prepared", { serviceKey, planId, eventName });
    return false;
  }
}

function russianMonthWord(months) {
  return months === 1 ? "месяц" : months === 2 || months === 3 || months === 4 ? "месяца" : "месяцев";
}

function formatPurchaseExpiry(value) {
  const normalized = isoUtcTimestamp(value);
  if (!normalized) return "не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow",
  }).format(new Date(normalized));
}

function russianGroupWord(groups) {
  const value = Math.abs(Number(groups)) % 100;
  const lastDigit = value % 10;
  if (value > 10 && value < 20) return "групп";
  if (lastDigit > 1 && lastDigit < 5) return "группы";
  return lastDigit === 1 ? "группу" : "групп";
}

async function getGroupEntitlement(db, ownerId, env = null) {
  const row = await db.prepare(`WITH active_entitlements AS (
      SELECT groups_limit, expires_at, plan_id, 0 AS auto_renew
      FROM payment_purchases
      WHERE owner_id = ? AND service_key = 'groups' AND refunded_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      UNION ALL
      SELECT groups_limit, expires_at, plan_id, auto_renew
      FROM group_entitlements
      WHERE owner_id = ? AND expires_at > CURRENT_TIMESTAMP
    )
    SELECT COALESCE(SUM(groups_limit), 0) AS groups_limit,
      MIN(expires_at) AS expires_at,
      COUNT(*) AS purchase_count,
      (SELECT plan_id FROM active_entitlements ORDER BY expires_at ASC LIMIT 1) AS plan_id,
      COALESCE(SUM(auto_renew), 0) AS auto_renew,
      (SELECT COUNT(*) FROM group_chats g WHERE g.owner_id = ? AND g.active = 1) AS active_groups
    FROM active_entitlements`)
    .bind(String(ownerId), String(ownerId), String(ownerId)).first();
  let groupsLimit = Number(row?.groups_limit || 0);
  let testAccess = false;
  if (!groupsLimit && env?.SUBSCRIPTION_TEST_OWNER_ID && String(ownerId) === String(env.SUBSCRIPTION_TEST_OWNER_ID)) {
    groupsLimit = 20;
    testAccess = true;
  }
  const activeGroups = Number(row?.active_groups || 0);
  const planId = row?.plan_id || null;
  const plan = GROUP_ACCESS_PLANS[planId];
  return {
    active: groupsLimit > 0,
    plan_id: planId,
    plan_name: testAccess ? "Тестовый доступ" : plan ? `${plan.groups} ${russianGroupWord(plan.groups)} · 1 месяц` : "Группы",
    groups_limit: groupsLimit,
    active_groups: activeGroups,
    groups_available: Math.max(0, groupsLimit - activeGroups),
    expires_at: row?.expires_at ? isoUtcTimestamp(row.expires_at) : null,
    purchase_count: Number(row?.purchase_count || 0),
    auto_renew: Number(row?.auto_renew || 0) > 0,
    test_access: testAccess,
    capabilities: { group_features: groupsLimit > 0 },
  };
}

async function notifyEntitlementReminders(env) {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  try {
    const subscriptions = await env.DB.prepare(`SELECT owner_id, plan_id, expires_at, auto_renew
      FROM subscriptions
      WHERE plan_id IN ('month', 'half-year', 'year')
        AND julianday(expires_at) > julianday('now')
        AND ((julianday(expires_at) > julianday('now', '+71 hours')
          AND julianday(expires_at) <= julianday('now', '+72 hours'))
          OR EXISTS (SELECT 1 FROM entitlement_reminders reminder
            WHERE reminder.owner_id = subscriptions.owner_id
              AND reminder.reminder_type = 'subscription_ending'
              AND reminder.entitlement_key = subscriptions.expires_at
              AND reminder.sent_at IS NULL AND reminder.attempts < 3
              AND (reminder.last_attempt_at IS NULL OR reminder.last_attempt_at <= datetime('now', '-5 minutes'))))
        AND NOT EXISTS (SELECT 1 FROM entitlement_reminders reminder
          WHERE reminder.owner_id = subscriptions.owner_id
            AND reminder.reminder_type = 'subscription_ending'
            AND reminder.entitlement_key = subscriptions.expires_at
            AND (reminder.sent_at IS NOT NULL OR reminder.attempts >= 3
              OR (reminder.last_attempt_at IS NOT NULL AND reminder.last_attempt_at > datetime('now', '-5 minutes'))))
      ORDER BY expires_at ASC LIMIT 100`).all();
    for (const subscription of subscriptions.results || []) {
      const plan = PERSONAL_SUBSCRIPTION_PLANS[subscription.plan_id];
      if (!plan) continue;
      const expiry = formatPurchaseExpiryDateTime(subscription.expires_at);
      const renewalNote = Number(subscription.auto_renew) === 1
        ? "Автопродление включено. Его статус можно проверить в Tribute."
        : "Продли подписку до этой даты в SpySkaut, чтобы сохранить доступ к личным чатам.";
      const text = `🔔 Напоминание о подписке\n\nБезлимит на ${plan.months} ${russianMonthWord(plan.months)} закончится через 3 дня — ${expiry} (МСК).\n${renewalNote}\n\nСтатус подписки можно посмотреть в разделе «Профиль» приложения SpySkaut.`;
      await sendEntitlementReminder(env, String(subscription.owner_id), "subscription_ending", String(subscription.expires_at), text);
    }

    const packages = await env.DB.prepare(`SELECT p.owner_id, p.package_id, p.credits_total, p.credits_remaining
      FROM notification_packages p
      JOIN payment_purchases purchase ON purchase.purchase_id = p.purchase_id AND purchase.refunded_at IS NULL
      WHERE p.credits_remaining > 0
        AND p.credits_remaining * 10 <= p.credits_total
        AND p.rowid = (
          SELECT MAX(latest.rowid) FROM notification_packages latest
          JOIN payment_purchases latest_purchase
            ON latest_purchase.purchase_id = latest.purchase_id AND latest_purchase.refunded_at IS NULL
          WHERE latest.owner_id = p.owner_id
        )
        AND NOT EXISTS (SELECT 1 FROM entitlement_reminders reminder
          WHERE reminder.owner_id = p.owner_id AND reminder.reminder_type = 'package_low'
            AND reminder.entitlement_key = p.package_id
            AND (reminder.sent_at IS NOT NULL OR reminder.attempts >= 3
              OR (reminder.last_attempt_at IS NOT NULL AND reminder.last_attempt_at > datetime('now', '-5 minutes'))))
      ORDER BY p.owner_id LIMIT 100`).all();
    for (const pack of packages.results || []) {
      const total = Number(pack.credits_total || 0);
      const remaining = Number(pack.credits_remaining || 0);
      if (!total || !remaining) continue;
      const percent = Math.round(remaining / total * 100);
      const text = `🔔 Скаут напоминает: в пакете на ${total} уведомлений осталось ${remaining} — это ${percent}%. История событий продолжит сохраняться, пока пакет не закончится.`;
      await sendEntitlementReminder(env, String(pack.owner_id), "package_low", String(pack.package_id), text);
    }
  } catch {
    console.error("Entitlement reminder scan failed");
  }
}

async function sendEntitlementReminder(env, ownerId, reminderType, entitlementKey, text) {
  try {
    await env.DB.prepare(`INSERT OR IGNORE INTO entitlement_reminders(owner_id, reminder_type, entitlement_key)
      VALUES(?, ?, ?)`).bind(ownerId, reminderType, entitlementKey).run();
    const claim = await env.DB.prepare(`UPDATE entitlement_reminders SET
        attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP
      WHERE owner_id = ? AND reminder_type = ? AND entitlement_key = ?
        AND sent_at IS NULL AND attempts < 3
        AND (last_attempt_at IS NULL OR last_attempt_at <= datetime('now', '-5 minutes'))`)
      .bind(ownerId, reminderType, entitlementKey).run();
    if (Number(claim.meta?.changes || 0) !== 1) return false;
    const sent = await callTelegramJson(env, "sendMessage", { chat_id: ownerId, text });
    if (sent) {
      await env.DB.prepare(`UPDATE entitlement_reminders SET sent_at = CURRENT_TIMESTAMP
        WHERE owner_id = ? AND reminder_type = ? AND entitlement_key = ?`)
        .bind(ownerId, reminderType, entitlementKey).run();
      return true;
    }
    console.error("Entitlement reminder could not be delivered", { reminderType });
    return false;
  } catch {
    console.error("Entitlement reminder delivery failed", { reminderType });
    return false;
  }
}

function formatPurchaseExpiryDateTime(value) {
  const normalized = isoUtcTimestamp(value);
  if (!normalized) return "не указана";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
  }).format(new Date(normalized));
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
        WHERE purchase_id = ? AND provider = 'tribute' AND service_key IN ('personal_package', 'personal_unlimited', 'groups')`)
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

function tributeSubscriptionPlan(payload, env) {
  if (String(payload.currency || "").toUpperCase() !== "RUB") return null;
  const amount = Number(payload.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const rubles = amount > 3000 ? amount / 100 : amount;
  const subscriptionId = String(payload.subscription_id || payload.subscriptionId || "");
  const subscriptions = tributeSubscriptionMap(env) || {};
  const configured = [
    ...Object.keys(PERSONAL_SUBSCRIPTION_PLANS).map((planId) => tributeSubscription(env, "personal_unlimited", planId)),
    ...Object.keys(GROUP_ACCESS_PLANS).map((planId) => tributeSubscription(env, "groups", planId)),
  ].filter(Boolean);
  for (const spec of configured) {
    const rawSpec = subscriptions[spec.key];
    if (rawSpec?.subscription_id && String(rawSpec.subscription_id) === subscriptionId
      && Math.round(rubles * 100) === spec.rubles * 100) {
      return { service_key: spec.service_key, plan_id: spec.plan_id, plan: spec };
    }
  }

  const matches = configured.filter((spec) => Math.round(rubles * 100) === spec.rubles * 100);
  if (matches.length === 1) {
    const plan = matches[0];
    return { service_key: plan.service_key, plan_id: plan.plan_id, plan };
  }
  return null;
}

async function tributeSubscriptionEventKey(eventName, event, payload, ownerId, subscriptionId) {
  const identity = {
    event_name: eventName,
    created_at: String(event?.created_at || payload.purchase_created_at || payload.created_at || ""),
    owner_id: ownerId,
    subscription_id: subscriptionId,
    amount: payload.amount == null ? "" : String(payload.amount),
    currency: String(payload.currency || "").toUpperCase(),
    period_id: String(payload.period_id || payload.periodId || ""),
    transaction_id: String(payload.transaction_id || payload.transactionId || payload.payment_id || ""),
  };
  return sha256Hex(JSON.stringify(identity));
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
  await saveUser(env.DB, addedBy);
  const entitlement = await getGroupEntitlement(env.DB, ownerId, env);
  const alreadyConnected = await env.DB.prepare(`SELECT 1 FROM group_chats
    WHERE owner_id = ? AND chat_id = ? AND active = 1 LIMIT 1`).bind(ownerId, chatId).first();
  if (!entitlement.active || (!alreadyConnected && entitlement.groups_available <= 0)) {
    const reason = entitlement.active
      ? `Достигнут лимит подключённых групп (${entitlement.groups_limit}). Освободи место или выбери больший пакет в приложении SpySkaut.`
      : `Чтобы подключить группу, сначала купи групповой тариф в приложении SpySkaut.`;
    await callTelegramJson(env, "sendMessage", { chat_id: ownerId, text: reason });
    await callTelegramJson(env, "leaveChat", { chat_id: chatId });
    return json({ ok: true, ignored: true, reason: entitlement.active ? "group_limit_reached" : "group_entitlement_required" });
  }
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
  if (!(await getGroupEntitlement(env.DB, group.owner_id, env)).active) {
    return json({ ok: true, ignored: true, reason: "group_entitlement_expired" });
  }

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
    row = await db.prepare(`SELECT expires_at, plan_id, auto_renew,
      CASE WHEN expires_at IS NOT NULL AND julianday(expires_at) > julianday('now') THEN 1 ELSE 0 END AS paid_active
      FROM subscriptions WHERE owner_id = ?`).bind(ownerId).first();
  } catch (error) {
    if (!/no such table: subscriptions/i.test(String(error?.message || error))) throw error;
  }
  const expiresAt = isoUtcTimestamp(row?.expires_at);
  const paidActive = Number(row?.paid_active) === 1;
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

function isoUtcTimestamp(value) {
  if (!value) return null;
  const raw = String(value);
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw.replace(" ", "T")}Z`;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

async function hasPersonalDataAccess(db, ownerId) {
  if ((await getSubscription(db, ownerId)).active) return true;
  return Number((await getNotificationPackageBalance(db, ownerId)).remaining || 0) > 0;
}

async function getNotificationPackageBalance(db, ownerId) {
  try {
    const result = await db.prepare(`SELECT p.package_id, p.plan_id, p.credits_total, p.credits_remaining,
      p.purchased_at, COALESCE((SELECT COUNT(*) FROM package_event_usage u WHERE u.package_id = p.package_id), 0) AS consumed,
      CASE WHEN purchase.refunded_at IS NULL THEN 0 ELSE 1 END AS is_refunded
      FROM notification_packages p
      LEFT JOIN payment_purchases purchase ON purchase.purchase_id = p.purchase_id
      WHERE p.owner_id = ? ORDER BY p.rowid ASC`).bind(String(ownerId)).all();
    const packageItems = (result.results || []).map((item) => {
      const total = Number(item.credits_total || 0);
      const remaining = Number(item.credits_remaining || 0);
      const consumed = Number(item.consumed || 0);
      return {
        plan_id: String(item.plan_id || ""),
        purchased: total,
        remaining,
        consumed,
        refunded: Math.max(0, total - remaining - consumed),
        is_refunded: Number(item.is_refunded || 0) === 1,
        purchased_at: item.purchased_at || null,
      };
    });
    const purchased = packageItems.reduce((sum, item) => sum + item.purchased, 0);
    const remaining = packageItems.reduce((sum, item) => sum + item.remaining, 0);
    const consumed = packageItems.reduce((sum, item) => sum + item.consumed, 0);
    const refunded = packageItems.reduce((sum, item) => sum + item.refunded, 0);
    return { has_purchases: purchased > 0, purchased, remaining, consumed, refunded, packages: packageItems.length, package_items: packageItems };
  } catch (error) {
    if (/no such table: notification_packages|no such table: package_event_usage/i.test(String(error?.message || error))) return { has_purchases: false, purchased: 0, remaining: 0, consumed: 0, refunded: 0, packages: 0, package_items: [] };
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
      ORDER BY p.rowid ASC LIMIT 20`)
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

function notificationControlButton(hasEnabledConnection, oneTimeMessagesEnabled, callbackUpdatesReady = true) {
  if (!hasEnabledConnection) {
    return { text: "Подключить личные чаты", url: "https://t.me/SpySkaut_bot?start=connect" };
  }
  return {
    text: `${oneTimeMessagesEnabled ? "🔔" : "🔕"} Одноразовые: ${oneTimeMessagesEnabled ? "Вкл" : "Выкл"}`,
    ...(callbackUpdatesReady
      ? { callback_data: "toggle_one_time_messages" }
      : { web_app: { url: "https://spychau-bot.senba11.workers.dev/?open=notifications" } }),
  };
}

function notificationControlReplyMarkup(hasEnabledConnection, oneTimeMessagesEnabled, callbackUpdatesReady = true) {
  return {
    inline_keyboard: [
      [notificationControlButton(hasEnabledConnection, oneTimeMessagesEnabled, callbackUpdatesReady)],
      [{ text: "Открыть приложение", web_app: { url: "https://spychau-bot.senba11.workers.dev/" } }],
    ],
  };
}

async function ensureTelegramCallbackUpdates(env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) return false;
  try {
    const infoResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const infoPayload = await infoResponse.json().catch(() => ({}));
    const webhookInfo = infoPayload.result;
    if (!infoResponse.ok || infoPayload.ok !== true || typeof webhookInfo?.url !== "string") return false;

    const webhookUrl = new URL(webhookInfo.url);
    if (webhookUrl.protocol !== "https:" || webhookUrl.pathname !== "/webhooks/telegram") return false;
    if (webhookInfo.has_custom_certificate === true) return false;

    const allowedUpdates = webhookInfo.allowed_updates;
    if (!Array.isArray(allowedUpdates) || allowedUpdates.length === 0 || allowedUpdates.includes("callback_query")) return true;

    const setWebhookPayload = {
      url: webhookInfo.url,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: [...new Set([...allowedUpdates, "callback_query"])],
      drop_pending_updates: false,
    };
    if (typeof webhookInfo.ip_address === "string") setWebhookPayload.ip_address = webhookInfo.ip_address;
    if (Number.isInteger(webhookInfo.max_connections)) setWebhookPayload.max_connections = webhookInfo.max_connections;
    const setResponse = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(setWebhookPayload),
    });
    const setPayload = await setResponse.json().catch(() => ({}));
    return setResponse.ok && setPayload.ok === true;
  } catch {
    return false;
  }
}

async function saveNotificationControlMessage(db, ownerId, chatId, messageId, keyboardVersion = 2) {
  await db.prepare(`
    INSERT INTO notification_control_messages(owner_id, chat_id, message_id, keyboard_version, updated_at)
    VALUES(?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(owner_id) DO UPDATE SET
      chat_id = excluded.chat_id,
      message_id = excluded.message_id,
      keyboard_version = excluded.keyboard_version,
      updated_at = CURRENT_TIMESTAMP
  `).bind(String(ownerId), String(chatId), Number(messageId), Number(keyboardVersion)).run();
}

async function refreshNotificationControlMessage(env, ownerId, callbackUpdatesReady = null) {
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  const callbacksReady = callbackUpdatesReady == null
    ? await ensureTelegramCallbackUpdates(env)
    : callbackUpdatesReady;
  const savedMessage = await env.DB.prepare(
    "SELECT chat_id, message_id FROM notification_control_messages WHERE owner_id = ?",
  ).bind(String(ownerId)).first();
  if (!savedMessage) return false;

  const [activeConnection, notificationSettings] = await Promise.all([
    env.DB.prepare("SELECT 1 AS connected FROM connections WHERE owner_id = ? AND enabled = 1 LIMIT 1")
      .bind(String(ownerId)).first(),
    getNotificationPreferences(env.DB, ownerId),
  ]);
  const updated = await editNotificationControlMarkup(env, {
    chat_id: savedMessage.chat_id,
    message_id: savedMessage.message_id,
    reply_markup: notificationControlReplyMarkup(
      Boolean(activeConnection),
      notificationSettings.preferences.one_time_messages,
      callbacksReady,
    ),
  });
  if (updated) {
    await env.DB.prepare("UPDATE notification_control_messages SET keyboard_version = ?, updated_at = CURRENT_TIMESTAMP WHERE owner_id = ?")
      .bind(callbacksReady ? 2 : 1, String(ownerId)).run();
  }
  return updated;
}

async function upgradeNotificationControlMessage(env, ownerId) {
  const savedMessage = await env.DB.prepare(
    "SELECT keyboard_version FROM notification_control_messages WHERE owner_id = ?",
  ).bind(String(ownerId)).first();
  if (!savedMessage || Number(savedMessage.keyboard_version) >= 2) return false;
  return refreshNotificationControlMessage(env, ownerId);
}

async function upgradePendingNotificationControlMessages(env) {
  const pending = await env.DB.prepare(
    "SELECT owner_id FROM notification_control_messages WHERE keyboard_version < 2 ORDER BY updated_at LIMIT 25",
  ).all();
  for (const row of pending.results || []) {
    const updated = await refreshNotificationControlMessage(env, String(row.owner_id), true);
    if (!updated) {
      await env.DB.prepare("UPDATE notification_control_messages SET updated_at = CURRENT_TIMESTAMP WHERE owner_id = ?")
        .bind(String(row.owner_id)).run();
    }
  }
}

async function editNotificationControlMarkup(env, payload) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    return (response.ok && result.ok === true)
      || (Number(result.error_code) === 400 && /message is not modified/i.test(String(result.description || "")));
  } catch {
    return false;
  }
}

async function handleNotificationToggleCallback(callbackQuery, env) {
  const ownerId = callbackQuery.from?.id == null ? "" : String(callbackQuery.from.id);
  const message = callbackQuery.message;
  const chat = message?.chat;
  const messageId = Number(message?.message_id);
  const answer = (payload) => callTelegramJson(env, "answerCallbackQuery", {
    callback_query_id: callbackQuery.id,
    ...payload,
  });

  if (!ownerId || chat?.type !== "private" || String(chat.id) !== ownerId || !Number.isInteger(messageId)) {
    await answer({ text: "Открой кнопку в личном чате со SpySkaut.", show_alert: true });
    return json({ ok: true, ignored: "invalid_notification_control_context" });
  }

  const savedMessage = await env.DB.prepare(
    "SELECT 1 AS saved FROM notification_control_messages WHERE owner_id = ? AND chat_id = ? AND message_id = ?",
  ).bind(ownerId, String(chat.id), messageId).first();
  if (!savedMessage) {
    await answer({ text: "Отправь /start, чтобы получить актуальное управление уведомлениями.", show_alert: true });
    return json({ ok: true, ignored: "stale_notification_control" });
  }

  const activeConnection = await env.DB.prepare(
    "SELECT 1 AS connected FROM connections WHERE owner_id = ? AND enabled = 1 LIMIT 1",
  ).bind(ownerId).first();
  if (!activeConnection) {
    await answer({ text: "Сначала подключи SpySkaut к личным чатам.", show_alert: true });
    await refreshNotificationControlMessage(env, ownerId, true);
    return json({ ok: true, ignored: "connection_disabled" });
  }

  await initializeNotificationPreferences(env.DB, ownerId, null);
  await env.DB.prepare(`
    UPDATE notification_preferences
    SET one_time_messages = 1 - one_time_messages, updated_at = CURRENT_TIMESTAMP
    WHERE owner_id = ?
  `).bind(ownerId).run();
  let enabled = null;
  try {
    const notificationSettings = await getNotificationPreferences(env.DB, ownerId);
    enabled = notificationSettings.preferences.one_time_messages;
  } catch {}
  await answer({
    text: enabled == null
      ? "Настройка одноразовых уведомлений обновлена."
      : `Уведомления об одноразовых сообщениях ${enabled ? "включены" : "выключены"}.`,
  });
  try {
    await refreshNotificationControlMessage(env, ownerId, true);
  } catch {}
  return json({ ok: true, handled: "notification_toggle", enabled });
}

async function sendNotificationControlMessage(env, ownerId) {
  if (!env.TELEGRAM_BOT_TOKEN) return false;
  const callbacksReady = await ensureTelegramCallbackUpdates(env);
  const notificationSettings = await getNotificationPreferences(env.DB, ownerId);
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ownerId,
      text: "✅ SpySkaut подключён к личным чатам. Управляй уведомлениями об одноразовых сообщениях здесь:",
      reply_markup: notificationControlReplyMarkup(true, notificationSettings.preferences.one_time_messages, callbacksReady),
    }),
  }).catch(() => null);
  if (!response?.ok) return false;
  const result = await response.json().catch(() => ({}));
  if (result.ok !== true || !Number.isInteger(result.result?.message_id)) return false;
  await saveNotificationControlMessage(env.DB, ownerId, ownerId, result.result.message_id, callbacksReady ? 2 : 1);
  return true;
}

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
  const [profile, connections, subscription, packageBalance, groupEntitlement, notificationSettings] = await Promise.all([
    env.DB.prepare("SELECT receipt_email FROM users WHERE telegram_id = ?").bind(ownerId).first(),
    env.DB.prepare("SELECT connection_id, enabled, updated_at FROM connections WHERE owner_id = ? ORDER BY updated_at DESC")
      .bind(ownerId).all(),
    getSubscription(env.DB, ownerId),
    getNotificationPackageBalance(env.DB, ownerId),
    getGroupEntitlement(env.DB, ownerId, env),
    getNotificationPreferences(env.DB, ownerId),
  ]);
  return {
    user: { ...user, receipt_email: profile?.receipt_email || null },
    connections: connections.results,
    subscription,
    package_balance: packageBalance,
    group_entitlement: groupEntitlement,
    notification_preferences: notificationSettings.preferences,
    can_test_override: Boolean(env.SUBSCRIPTION_TEST_OWNER_ID && ownerId === String(env.SUBSCRIPTION_TEST_OWNER_ID)),
    payments_available: Boolean(tributePaymentsReady(env, "personal_unlimited")),
    package_payments_available: Boolean(tributePaymentsReady(env, "personal_package")),
    tribute_plan_availability: {
      personal_unlimited: Object.fromEntries(Object.keys(PERSONAL_SUBSCRIPTION_PLANS).map((planId) => [planId, Boolean(tributePaymentsReady(env, "personal_unlimited", planId))])),
      personal_package: Object.fromEntries(Object.keys(PERSONAL_PACKAGE_PLANS).map((planId) => [planId, Boolean(tributePaymentsReady(env, "personal_package", planId))])),
      groups: Object.fromEntries(Object.keys(GROUP_ACCESS_PLANS).map((planId) => [planId, Boolean(tributePaymentsReady(env, "groups", planId))])),
    },
    group_payments_available: Boolean(tributePaymentsReady(env, "groups")),
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
    const notification = formatEventNotification(event, String(ownerId));
    const notificationText = notification.text;
    const archiveButton = {
      inline_keyboard: [[{ text: "Открыть архив", web_app: { url: "https://spychau-bot.senba11.workers.dev/?open=archive" } }]],
    };
    const payload = media
      ? {
          chat_id: ownerId,
          [media.field]: media.fileId,
          reply_markup: archiveButton,
          ...(media.caption ? {
            caption: notificationText.slice(0, 1000),
            caption_entities: notification.entities.filter((entity) => entity.offset + entity.length <= 1000),
          } : {}),
        }
      : {
          chat_id: ownerId,
          text: notificationText,
          entities: notification.entities,
          reply_markup: archiveButton,
        };
    let delivered = await callTelegramJson(env, method, payload);
    if (!delivered && media) {
      const archived = await readArchivedMedia(env, ownerId, event?.id, 0);
      if (archived?.bytes?.length) {
        delivered = await callTelegramUpload(env, media, archived, notification, archiveButton, ownerId);
      }
      if (!delivered) {
        delivered = await callTelegramJson(env, "sendMessage", {
          chat_id: ownerId,
          text: `${notificationText}\n\nНе получилось отправить вложение в этот чат. Проверь событие в архиве — если файл успел сохраниться, он будет доступен там.`,
          entities: notification.entities,
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
  const groupEntitlement = await getGroupEntitlement(env.DB, ownerId, env);
  const packageBalance = subscription.active ? null : await getNotificationPackageBalance(env.DB, ownerId);
  if (!subscription.active && !packageBalance?.remaining && !groupEntitlement.active) return;
  const preferences = await getNotificationPreferences(env.DB, ownerId);
  for (const savedEvent of resolved) {
    const eventRow = await env.DB.prepare("SELECT * FROM events WHERE id = ? AND owner_id = ?")
      .bind(savedEvent.eventId, String(ownerId)).first();
    if (!eventRow) continue;
    const [event] = await hydrateEventRows([eventRow], env);
    const chatType = event?.message?.chat?.type || event?.previous_message?.chat?.type || "private";
    const isGroup = chatType === "group" || chatType === "supergroup";
    if (isGroup && !groupEntitlement.active) continue;
    if (!isGroup && !subscription.active && !packageBalance?.remaining) continue;
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

async function callTelegramUpload(env, media, archived, notification, replyMarkup, ownerId) {
  try {
    const form = new FormData();
    form.set("chat_id", String(ownerId));
    const safeFileName = String(archived.file_name || `${media.kind}.${media.extension}`).split(/[\\/]/).pop().replace(/[\r\n]/g, "");
    form.set(media.field, new Blob([archived.bytes], { type: archived.mime_type }), safeFileName);
    form.set("reply_markup", JSON.stringify(replyMarkup));
    if (media.caption) {
      form.set("caption", notification.text.slice(0, 1000));
      form.set("caption_entities", JSON.stringify(notification.entities.filter((entity) => entity.offset + entity.length <= 1000)));
    }
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${media.method}`, { method: "POST", body: form });
    const result = await response.json().catch(() => ({}));
    return response.ok && result.ok === true;
  } catch {
    return false;
  }
}

function formatEventNotification(event, ownerId = "") {
  const current = event?.message || {};
  const previous = event?.previous_message || {};
  const chat = current.chat || previous.chat || {};
  const chatName = chat.title
    || (chat.username ? `@${chat.username}` : "")
    || [chat.first_name, chat.last_name].filter(Boolean).join(" ")
    || `чат ${chat.id || ""}`.trim();
  const contact = eventContact(current, previous, ownerId);
  const lines = [];
  const entities = [];
  const addLine = (line) => lines.push(line);
  const addLinkedLine = (label, value, url) => {
    const prefix = `${label}: `;
    const offset = lines.join("\n").length + (lines.length ? 1 : 0) + prefix.length;
    lines.push(`${prefix}${value}`);
    entities.push({ type: "text_link", offset, length: value.length, url });
  };

  addLine(event?.event_type === "deleted"
    ? "🗑 Сообщение удалено"
    : event?.event_type === "edited"
      ? "✏️ Сообщение изменено"
      : "👁 Сохранено одноразовое сообщение");
  if (chat.type === "private") {
    if (contact.url) addLinkedLine("Контакт", contact.label, contact.url);
    else addLine(`Контакт: ${contact.label}`);
  } else {
    addLine(`Чат: ${chatName}`);
    if (contact.url) addLinkedLine("Автор", contact.label, contact.url);
    else addLine(`Автор: ${contact.label}`);
  }
  if (event?.event_type === "deleted") {
    addLine(`Сообщение: ${messagePreview(current)}`);
  } else if (event?.event_type === "edited") {
    addLine(`Было: ${messagePreview(previous)}`);
    addLine(`Стало: ${messagePreview(current)}`);
  } else {
    addLine(`Сообщение: ${messagePreview(current)}`);
  }
  return { text: lines.join("\n").slice(0, 3500), entities: entities.filter((entity) => entity.offset + entity.length <= 3500) };
}

function eventContact(current, previous, ownerId) {
  const chat = current.chat || previous.chat || {};
  let sender = current.sender_chat || current.from || previous.sender_chat || previous.from || null;
  if (chat.type === "private") {
    // In private Business chats, the chat object describes the contact. A
    // message authored by the account owner should not make the owner appear
    // as the contact in the notification.
    if (!sender || (ownerId && String(sender.id) === String(ownerId)) || (!sender.username && chat.username)) sender = chat;
  }
  const username = String(sender?.username || "").trim().replace(/^@/, "");
  if (/^[A-Za-z0-9_]{1,64}$/.test(username)) {
    return { label: `@${username}`, url: `https://t.me/${username}` };
  }
  const senderId = String(sender?.id ?? "");
  const canLinkUser = sender?.type !== "channel" && /^\d+$/.test(senderId) && !senderId.startsWith("-");
  const displayName = [sender?.first_name, sender?.last_name].filter(Boolean).join(" ")
    || sender?.title
    || (senderId ? `Контакт ${senderId}` : "контакт без юзернейма");
  return canLinkUser
    ? { label: "Открыть профиль контакта", url: `tg://user?id=${senderId}` }
    : { label: `${displayName} (без юзернейма)`, url: "" };
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
