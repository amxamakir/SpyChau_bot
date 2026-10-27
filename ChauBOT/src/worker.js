const MAX_INIT_DATA_AGE_SECONDS = 60 * 60 * 24;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const route = url.pathname;

    if (route === "/health" && request.method === "GET") {
      return json({ status: "ok", service: "spychau-api", version: "0.8.61" });
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
        return json({ user, authenticated: true });
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
          const ownerId = String(user.id);
          const subscription = await getSubscription(env.DB, ownerId);
          const [profile, connections, events] = await Promise.all([
            env.DB.prepare("SELECT receipt_email FROM users WHERE telegram_id = ?").bind(ownerId).first(),
            env.DB.prepare("SELECT connection_id, enabled, updated_at FROM connections WHERE owner_id = ? ORDER BY updated_at DESC")
              .bind(ownerId).all(),
            subscription.active
              ? env.DB.prepare("SELECT id, owner_id, chat_id, message_id, event_type, message_json, created_at FROM events WHERE owner_id = ? ORDER BY id DESC LIMIT 25").bind(ownerId).all()
              : Promise.resolve({ results: [] }),
          ]);
          return json({
            user: { ...user, receipt_email: profile?.receipt_email || null },
            connections: connections.results,
            events: await Promise.all(events.results.map((row) => eventRow(row, env))),
            subscription,
            can_test_override: Boolean(env.SUBSCRIPTION_TEST_OWNER_ID && ownerId === String(env.SUBSCRIPTION_TEST_OWNER_ID)),
          });
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

        if (route === "/api/archive" && request.method === "GET") {
          const subscription = await getSubscription(env.DB, String(user.id));
          if (!subscription.active) return json({ error: "subscription_required" }, 403);
          const events = await env.DB.prepare(
            `WITH archive_events AS (
              SELECT id, owner_id, chat_id, message_id, event_type
              FROM events
              WHERE owner_id = ? AND (
                event_type IN ('edited', 'deleted')
                OR json_extract(message_json, '$.ephemeral_message_id') IS NOT NULL
                OR json_extract(message_json, '$.receiver_user.id') IS NOT NULL
                OR COALESCE(CAST(json_extract(message_json, '$.ttl_period') AS INTEGER), 0) > 0
              )
            ),
            snapshot_ids AS (
              SELECT (
                SELECT previous.id FROM events previous
                WHERE previous.owner_id = archive_events.owner_id
                  AND previous.chat_id = archive_events.chat_id
                  AND previous.message_id = archive_events.message_id
                  AND previous.id < archive_events.id
                  AND previous.event_type != 'deleted'
                ORDER BY previous.id DESC LIMIT 1
              ) AS id
              FROM archive_events
              WHERE event_type IN ('edited', 'deleted')
            ),
            selected_ids AS (
              SELECT id FROM archive_events
              UNION
              SELECT id FROM snapshot_ids WHERE id IS NOT NULL
            )
            SELECT events.id, events.owner_id, events.chat_id, events.message_id,
                   events.event_type, events.message_json, events.created_at
            FROM events JOIN selected_ids ON selected_ids.id = events.id
            ORDER BY events.id DESC`,
          ).bind(String(user.id)).all();
          return json({ events: await Promise.all(events.results.map((row) => eventRow(row, env))) });
        }

        if (route === "/api/me/data" && request.method === "DELETE") {
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
      headers.set("Cache-Control", "no-cache");
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        statusText: assetResponse.statusText,
        headers,
      });
    }
    return assetResponse;
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

  try {
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
    if (deleted) {
      const chatId = deleted.chat?.id == null ? "" : String(deleted.chat.id);
      const statements = [];
      for (const messageId of deleted.message_ids || []) {
        const previous = await env.DB.prepare(`
          SELECT message_json FROM events
          WHERE owner_id = ? AND chat_id = ? AND message_id = ? AND event_type != 'deleted'
          ORDER BY id DESC LIMIT 1
        `).bind(connectionRow.owner_id, chatId, String(messageId)).first();
        let original = {};
        try { original = previous ? JSON.parse(previous.message_json) : {}; } catch { /* Preserve the deletion event if the old snapshot is malformed. */ }
        const deletedSnapshot = {
          ...deleted,
          ...(original.photo ? { photo: original.photo } : {}),
          ...(original.caption ? { caption: original.caption } : {}),
          ...(original.text ? { text: original.text } : {}),
        };
        statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO events(update_id, owner_id, connection_id, chat_id, message_id, event_type, message_json)
        VALUES(?, ?, ?, ?, ?, 'deleted', ?)
      `).bind(updateId, connectionRow.owner_id, connectionId, chatId, String(messageId), JSON.stringify(deletedSnapshot)));
      }
      if (statements.length) await env.DB.batch(statements);
    } else if (message) {
      const eventType = update.edited_business_message ? "edited" : "new";
      const snapshot = { ...message };
      await env.DB.prepare(`
        INSERT OR IGNORE INTO events(update_id, owner_id, connection_id, chat_id, message_id, event_type, message_json)
        VALUES(?, ?, ?, ?, ?, ?, ?)
      `).bind(
        updateId,
        connectionRow.owner_id,
        connectionId,
        message.chat?.id == null ? "" : String(message.chat.id),
        message.message_id == null ? "" : String(message.message_id),
        eventType,
        JSON.stringify(snapshot),
      ).run();
    }

    return json({ ok: true });
  } catch {
    return json({ error: "webhook processing failed" }, 500);
  }
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

async function eventRow(row, env) {
  let message = {};
  try { message = JSON.parse(row.message_json); } catch { /* Keep malformed legacy data unreadable, not fatal. */ }
  const { message_json: _messageJson, ...event } = row;
  const hasPhoto = Boolean(Array.isArray(message.photo) && message.photo.some((photo) => photo.file_id));
  const mediaUrl = hasPhoto ? await signedMediaUrl(event, env) : null;
  const chatPhoto = message.chat?.photo;
  const avatarUrl = chatPhoto?.small_file_id || chatPhoto?.big_file_id ? await signedAvatarUrl(event, env) : null;
  return { ...event, message, media_url: mediaUrl, avatar_url: avatarUrl };
}

async function signedMediaUrl(event, env) {
  const expires = Math.floor(Date.now() / 1000) + 15 * 60;
  const payload = `${event.owner_id}:${event.id}:${expires}`;
  const signature = bytesToBase64Url(await hmacSha256(env.TELEGRAM_BOT_TOKEN, payload));
  return `/api/media/${event.id}?expires=${expires}&signature=${signature}`;
}

async function signedAvatarUrl(event, env) {
  const expires = Math.floor(Date.now() / 1000) + 15 * 60;
  const payload = `avatar:${event.owner_id}:${event.id}:${expires}`;
  const signature = bytesToBase64Url(await hmacSha256(env.TELEGRAM_BOT_TOKEN, payload));
  return `/api/avatar/${event.id}?expires=${expires}&signature=${signature}`;
}

async function serveContactAvatar(request, env, eventId) {
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature") || "";
  const now = Math.floor(Date.now() / 1000);
  if (!env.TELEGRAM_BOT_TOKEN || !Number.isInteger(expires) || expires < now || expires > now + 15 * 60 + 30) {
    return new Response("Not found", { status: 404 });
  }
  const row = await env.DB.prepare("SELECT id, owner_id, message_json FROM events WHERE id = ?").bind(eventId).first();
  if (!row) return new Response("Not found", { status: 404 });
  const expected = bytesToBase64Url(await hmacSha256(env.TELEGRAM_BOT_TOKEN, `avatar:${row.owner_id}:${row.id}:${expires}`));
  if (!constantTimeEqual(signature, expected)) return new Response("Not found", { status: 404 });
  let message = {};
  try { message = JSON.parse(row.message_json); } catch { /* Missing chat photo; fall back to contact initials. */ }
  const fileId = message.chat?.photo?.small_file_id || message.chat?.photo?.big_file_id;
  if (!fileId) return new Response("Not found", { status: 404 });
  const token = env.TELEGRAM_BOT_TOKEN;
  const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const fileResult = await fileResponse.json();
  if (!fileResponse.ok || !fileResult.ok || !fileResult.result?.file_path) return new Response("Not found", { status: 404 });
  const downloadResponse = await fetch(`https://api.telegram.org/file/bot${token}/${fileResult.result.file_path}`);
  if (!downloadResponse.ok) return new Response("Not found", { status: 404 });
  const headers = new Headers({ "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" });
  return new Response(downloadResponse.body, { headers });
}

async function serveArchivedMedia(request, env, eventId) {
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature") || "";
  const now = Math.floor(Date.now() / 1000);
  if (!env.TELEGRAM_BOT_TOKEN || !Number.isInteger(expires) || expires < now || expires > now + 15 * 60 + 30) {
    return new Response("Not found", { status: 404 });
  }
  const row = await env.DB.prepare("SELECT id, owner_id, message_json FROM events WHERE id = ?").bind(eventId).first();
  if (!row) return new Response("Not found", { status: 404 });
  const expected = bytesToBase64Url(await hmacSha256(env.TELEGRAM_BOT_TOKEN, `${row.owner_id}:${row.id}:${expires}`));
  if (!constantTimeEqual(signature, expected)) return new Response("Not found", { status: 404 });

  let message = {};
  try { message = JSON.parse(row.message_json); } catch { /* Treat invalid message JSON as unavailable. */ }
  // Telegram file IDs are retained in the message snapshot, including after deletion.
  const photo = Array.isArray(message.photo) ? [...message.photo].sort((left, right) => (left.file_size || 0) - (right.file_size || 0)).at(-1) : null;
  if (!photo?.file_id) return new Response("Not found", { status: 404 });
  const token = env.TELEGRAM_BOT_TOKEN;
  const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(photo.file_id)}`);
  const fileResult = await fileResponse.json();
  if (!fileResponse.ok || !fileResult.ok || !fileResult.result?.file_path) return new Response("Not found", { status: 404 });
  const downloadResponse = await fetch(`https://api.telegram.org/file/bot${token}/${fileResult.result.file_path}`);
  if (!downloadResponse.ok) return new Response("Not found", { status: 404 });
  const headers = new Headers({ "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" });
  return new Response(downloadResponse.body, { headers });
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

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left));
  const b = new TextEncoder().encode(String(right));
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}

function publicError(error) {
  return error instanceof Error ? error.message : "request failed";
}
