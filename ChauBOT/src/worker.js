import {
  deleteOwnerJournal,
  hydrateEventRows,
  maintainJournal,
  serveArchivedMedia,
  serveContactAvatar,
  storeBusinessEvent,
} from "./journal.js";

const MAX_INIT_DATA_AGE_SECONDS = 60 * 60 * 24;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = url.pathname;

    if (route === "/health" && request.method === "GET") {
      return json({ status: "ok", service: "spychau-api", version: "0.8.116" });
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
        if (route === "/api/me" && request.method === "GET") {
          return json(await getUserBootstrap(env, user));
        }

        if (route === "/api/home/events" && request.method === "GET") {
          const subscription = await getSubscription(env.DB, String(user.id));
          if (!subscription.active) return json({ events: [] });
          const rows = await env.DB.prepare(
            "SELECT * FROM events WHERE owner_id = ? AND created_at >= datetime('now', '-7 days') ORDER BY id DESC LIMIT 25",
          ).bind(String(user.id)).all();
          const events = (await hydrateEventRows(rows.results, env)).filter((event) =>
            event.event_type === "edited" || event.event_type === "deleted" || isOneTimeMessage(event.message)
          );
          return json({ events });
        }

        if (route === "/api/owner/statistics" && request.method === "GET") {
          const ownerId = String(user.id);
          if (!env.SUBSCRIPTION_TEST_OWNER_ID || ownerId !== String(env.SUBSCRIPTION_TEST_OWNER_ID)) return json({ error: "not found" }, 404);
          await env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_visitors (telegram_id TEXT PRIMARY KEY, first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
          await env.DB.prepare("INSERT OR IGNORE INTO app_visitors(telegram_id) SELECT telegram_id FROM users").run();
          const result = await env.DB.prepare("SELECT COUNT(*) AS total FROM app_visitors").first();
          return json({ unique_visitors: Number(result?.total || 0) });
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
          const subscription = await getSubscription(env.DB, String(user.id));
          if (!subscription.active) return json({ error: "subscription_required" }, 403);
          const rows = await env.DB.prepare(
            "SELECT * FROM events WHERE owner_id = ? AND created_at >= datetime('now', '-7 days') ORDER BY id DESC LIMIT 5000",
          ).bind(String(user.id)).all();
          const hydrated = await hydrateEventRows(rows.results, env);
          const events = hydrated.filter((event) =>
            event.event_type === "edited" || event.event_type === "deleted" || isOneTimeMessage(event.message)
          );
          return json({ events });
        }

        if (route === "/api/me/data" && request.method === "DELETE") {
          await deleteOwnerJournal(env, String(user.id));
          await env.DB.prepare("DELETE FROM users WHERE telegram_id = ?").bind(String(user.id)).run();
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
      return json({ error: "payments are not configured" }, 501);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    if (route === "/" || route === "/index.html" || route === "/app.js" || route === "/src/styles.css") {
      const headers = new Headers(assetResponse.headers);
      headers.set("Cache-Control", route === "/" || route === "/index.html"
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
      await maintainJournal(env);
      await env.DB.prepare("DELETE FROM notification_deliveries WHERE sent_at < datetime('now', '-7 days')").run();
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
    if (incomingMessage?.chat?.id && /^\/start(?:@SpyChau_bot)?(?:\s|$)/i.test(commandText)) {
      if (!env.TELEGRAM_BOT_TOKEN) return json({ error: "bot token is not configured" }, 500);
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: incomingMessage.chat.id,
          text: "Привет! Я SpyChau.\n\nЧтобы подключить меня, открой в Telegram:\nПрофиль → Изм. → Автоматизация чатов.\n\nВыбери SpyChau и нужные чаты. После подключения новые события начнут появляться в приложении.",
          reply_markup: {
            inline_keyboard: [[{ text: "Открыть SpyChau", web_app: { url: "https://spychau-bot.senba11.workers.dev/" } }]],
          },
        }),
      });
      if (!response.ok) return json({ error: "Telegram could not send the start message" }, 502);
      return json({ ok: true, handled: "start" });
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

      // In Telegram's reply-before-open flow the original disappearing media can
      // be included as reply_to_message. Save it as a separate archive event.
      // Telegram may omit reply_to_message for ephemeral media, so this is best effort.
      const repliedMedia = eventType === "new"
        && message.from?.id != null
        && String(message.from.id) === String(connectionRow.owner_id)
        && message.chat?.type === "private"
        ? message.reply_to_message
        : null;
      if (repliedMedia && oneTimeMedia(repliedMedia)) {
        const originalId = repliedMedia.message_id == null ? "unknown" : String(repliedMedia.message_id);
        const replyMediaEventId = await storeBusinessEvent(env, {
          updateId,
          ownerId: connectionRow.owner_id,
          connectionId,
          chatId,
          messageId: `reply-media:${chatId}:${originalId}:${messageId}`,
          eventType: "new",
          message: { ...repliedMedia, __spychau_one_time_saved: true },
        });
        savedEvents.push({ eventId: replyMediaEventId, messageId: `reply-media:${chatId}:${originalId}:${messageId}`, eventType: "new" });
      }
    }

    if (savedEvents.length && updateId !== null && env.TELEGRAM_BOT_TOKEN) {
      const subscription = await getSubscription(env.DB, connectionRow.owner_id);
      if (subscription.active) {
        const preferences = await getNotificationPreferences(env.DB, connectionRow.owner_id);
        for (const savedEvent of savedEvents) {
          const eventRow = await env.DB.prepare("SELECT * FROM events WHERE id = ? AND owner_id = ?")
            .bind(savedEvent.eventId, connectionRow.owner_id).first();
          if (!eventRow) continue;
          const [event] = await hydrateEventRows([eventRow], env);
          const chatType = event?.message?.chat?.type || event?.previous_message?.chat?.type || "private";
          const isGroup = chatType === "group" || chatType === "supergroup";
          const eventMessage = event?.message || {};
          const messageAuthorId = eventMessage.from?.id == null ? "" : String(eventMessage.from.id);
          const isOwnerAuthoredEdit = savedEvent.eventType === "edited" && messageAuthorId === String(connectionRow.owner_id);
          const shouldNotify = savedEvent.eventType === "deleted"
            ? preferences.preferences.deleted_messages || preferences.preferences.deleted_by_owner
            : savedEvent.eventType === "edited"
              ? preferences.preferences.edited_messages || (isOwnerAuthoredEdit && preferences.preferences.edited_by_owner)
              : isOneTimeMessage(eventMessage) && preferences.preferences.one_time_messages;
          if (!shouldNotify || (isGroup && !preferences.preferences.group_messages)) continue;
          await sendEventNotification(env, {
            ownerId: connectionRow.owner_id,
            updateId,
            messageId: savedEvent.messageId,
            event,
          });
        }
      }
    }

    return json({ ok: true });
  } catch {
    return json({ error: "webhook processing failed" }, 500);
  }
}

function logBusinessMediaDiagnostic(update) {
  const mediaFields = ["photo", "voice", "video_note", "video", "audio", "document", "animation"];
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
      return {
        updateType,
        media: Object.fromEntries(mediaFields.map((field) => [field, message[field] != null])),
        hasReply: Boolean(reply),
        replyMedia: Object.fromEntries(mediaFields.map((field) => [field, Boolean(reply?.[field])])),
        hasTtlPeriod: Number(message.ttl_period) > 0,
        hasEphemeralMessageId: message.ephemeral_message_id != null,
        hasReceiverUser: message.receiver_user != null,
        hasProtectedContent: message.has_protected_content === true,
      };
    });

  if (!messages.length) return;
  // Temporary diagnostics intentionally record only update/media field presence.
  // Never log message text, account/chat IDs, file IDs, or media contents.
  console.log("[telegram-media-diagnostic]", JSON.stringify({ messages }));
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
}async function getSubscription(db, ownerId) {
  let row;
  try {
    row = await db.prepare("SELECT expires_at FROM subscriptions WHERE owner_id = ?").bind(ownerId).first();
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
  return { active: override === null ? paidActive : override, expires_at: expiresAt, test_override: override };
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
  const [profile, connections, subscription, notificationSettings] = await Promise.all([
    env.DB.prepare("SELECT receipt_email FROM users WHERE telegram_id = ?").bind(ownerId).first(),
    env.DB.prepare("SELECT connection_id, enabled, updated_at FROM connections WHERE owner_id = ? ORDER BY updated_at DESC")
      .bind(ownerId).all(),
    getSubscription(env.DB, ownerId),
    getNotificationPreferences(env.DB, ownerId),
  ]);
  return {
    user: { ...user, receipt_email: profile?.receipt_email || null },
    connections: connections.results,
    subscription,
    notification_preferences: notificationSettings.preferences,
    can_test_override: Boolean(env.SUBSCRIPTION_TEST_OWNER_ID && ownerId === String(env.SUBSCRIPTION_TEST_OWNER_ID)),
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
    const payload = media
      ? {
          chat_id: ownerId,
          [media.field]: media.fileId,
          reply_markup: {
            inline_keyboard: [[{ text: "Открыть архив", web_app: { url: "https://spychau-bot.senba11.workers.dev/?open=archive" } }]],
          },
          ...(media.caption ? { caption: notificationText.slice(0, 1000) } : {}),
        }
      : {
          chat_id: ownerId,
          text: notificationText,
          reply_markup: {
            inline_keyboard: [[{ text: "Открыть архив", web_app: { url: "https://spychau-bot.senba11.workers.dev/?open=archive" } }]],
          },
        };
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error("Telegram notification could not be delivered");
  } catch (error) {
    await env.DB.prepare("DELETE FROM notification_deliveries WHERE owner_id = ? AND update_id = ? AND message_id = ?")
      .bind(String(ownerId), updateId, String(messageId)).run();
    throw error;
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

function isOneTimeMessage(message) {
  return message?.__spychau_one_time_saved === true
    || message?.ephemeral_message_id != null
    || message?.receiver_user?.id != null
    || Number(message?.ttl_period) > 0;
}

function oneTimeMedia(message) {
  if (Array.isArray(message?.photo) && message.photo.length) {
    const photo = [...message.photo].sort((left, right) => Number(right.file_size || 0) - Number(left.file_size || 0))[0];
    return photo?.file_id ? { method: "sendPhoto", field: "photo", fileId: photo.file_id, caption: true } : null;
  }
  for (const [source, method, field, caption] of [
    ["video", "sendVideo", "video", true],
    ["video_note", "sendVideoNote", "video_note", false],
    ["voice", "sendVoice", "voice", true],
    ["audio", "sendAudio", "audio", true],
    ["document", "sendDocument", "document", true],
    ["animation", "sendAnimation", "animation", true],
  ]) {
    const fileId = message?.[source]?.file_id;
    if (fileId) return { method, field, fileId, caption };
  }
  return null;
}

function publicError(error) {
  return error instanceof Error ? error.message : "request failed";
}
