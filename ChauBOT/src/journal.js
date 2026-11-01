const textEncoder = new TextEncoder();
const JOURNAL_CHUNK_SIZE = 100;
const MESSAGE_LIMIT = 5000;
const RETENTION_DAYS = 7;
const MAX_TELEGRAM_FILE_BYTES = 20 * 1024 * 1024;

export async function storeBusinessEvent(env, input) {
  const ownerId = String(input.ownerId);
  const messageId = String(input.messageId || "");
  if (!/^\d+$/.test(ownerId) || !messageId) throw new Error("invalid journal record identity");
  if (!env.JOURNAL || !env.JOURNAL_ENCRYPTION_KEY) throw new Error("encrypted event journal is not configured");

  return persistRecord(env, { ...input, ownerId, messageId, message: input.message || {} });
}

export async function hydrateEventRows(rows, env) {
  if (!rows.length) return [];
  const snapshotIds = [...new Set(rows.map((row) => Number(row.snapshot_event_id)).filter(Number.isInteger))];
  const snapshots = new Map();
  if (snapshotIds.length) {
    for (let offset = 0; offset < snapshotIds.length; offset += 80) {
      const ids = snapshotIds.slice(offset, offset + 80);
      const placeholders = ids.map(() => "?").join(",");
      const result = await env.DB.prepare(`SELECT * FROM events WHERE id IN (${placeholders})`).bind(...ids).all();
      for (const row of result.results) snapshots.set(Number(row.id), row);
    }
  }

  const chunkCache = new Map();
  const resolved = await Promise.all(rows.map(async (row) => {
    const record = await readJournalRecord(row, env, chunkCache);
    const sourceRow = snapshots.get(Number(row.snapshot_event_id)) || (row.event_type === "deleted" ? null : row);
    const sourceRecord = sourceRow ? await readJournalRecord(sourceRow, env, chunkCache) : null;
    const ownMessage = record?.message || {};
    const sourceMessage = sourceRecord?.message || {};
    const message = row.event_type === "deleted" && sourceRow ? sourceMessage : ownMessage;
    const priorMessage = row.event_type === "edited" ? sourceMessage : null;
    const media = row.event_type === "deleted" ? (sourceRecord?.media || []) : (record?.media || []);
    const mediaSourceRow = row.event_type === "deleted" && sourceRow ? sourceRow : row;
    const hydratedMedia = await Promise.all(media.map(async (asset, index) => ({
      ...asset,
      url: await signedMediaUrl(mediaSourceRow, index, env),
    })));
    const legacyPhoto = !row.stored_at && !hydratedMedia.length && Array.isArray(message.photo) && message.photo.some((photo) => photo.file_id);
    const mediaUrl = hydratedMedia.find((asset) => asset.kind === "photo")?.url
      || (legacyPhoto ? await signedMediaUrl(mediaSourceRow, 0, env) : null);
    const avatarUrl = (message.chat?.photo?.small_file_id || message.chat?.photo?.big_file_id)
      ? await signedAvatarUrl(mediaSourceRow, env)
      : null;
    const { message_json: _messageJson, ...event } = row;
    return {
      ...event,
      message,
      previous_message: priorMessage,
      media: hydratedMedia,
      media_url: mediaUrl,
      avatar_url: avatarUrl,
    };
  }));
  return resolved;
}

export async function serveArchivedMedia(request, env, eventId) {
  const url = new URL(request.url);
  const assetIndex = Number(url.searchParams.get("asset") || 0);
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature") || "";
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(assetIndex) || assetIndex < 0 || !env.TELEGRAM_BOT_TOKEN || !Number.isInteger(expires) || expires < now || expires > now + 15 * 60 + 30) {
    return new Response("Not found", { status: 404 });
  }
  const row = await env.DB.prepare("SELECT * FROM events WHERE id = ? AND stored_at IS NOT NULL").bind(eventId).first();
  const legacyRow = row || await env.DB.prepare("SELECT * FROM events WHERE id = ? AND stored_at IS NULL").bind(eventId).first();
  if (!legacyRow) return new Response("Not found", { status: 404 });
  const expected = bytesToBase64Url(await hmacSha256(env.TELEGRAM_BOT_TOKEN, `media:${legacyRow.owner_id}:${legacyRow.id}:${assetIndex}:${expires}`));
  if (!constantTimeEqual(signature, expected)) return new Response("Not found", { status: 404 });

  const record = await readJournalRecord(legacyRow, env, new Map());
  const asset = record?.media?.[assetIndex];
  if (asset?.object_key) {
    const object = await env.JOURNAL.get(asset.object_key);
    if (!object || !object.customMetadata?.nonce) return new Response("Not found", { status: 404 });
    try {
      const cipher = new Uint8Array(await object.arrayBuffer());
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: fromBase64Url(object.customMetadata.nonce), additionalData: aad(legacyRow.owner_id, `media:${legacyRow.id}:${asset.object_key}`) },
        await userKey(env, legacyRow.owner_id),
        cipher,
      );
      return archivedMediaResponse(request, new Uint8Array(plain), safeMime(asset.mime_type));
    } catch {
      return new Response("Not found", { status: 404 });
    }
  }

  // Temporary compatibility for old photo records while they are migrated into R2.
  let message = {};
  try { message = JSON.parse(legacyRow.message_json || "{}"); } catch { /* unavailable legacy payload */ }
  const photo = Array.isArray(message.photo) ? [...message.photo].sort((left, right) => (left.file_size || 0) - (right.file_size || 0)).at(-1) : null;
  if (!photo?.file_id || assetIndex !== 0) return new Response("Not found", { status: 404 });
  return fetchTelegramFile(photo.file_id, env, "image/jpeg");
}

export async function readArchivedMedia(env, ownerId, eventId, assetIndex = 0) {
  if (!env.JOURNAL || !Number.isInteger(assetIndex) || assetIndex < 0) return null;
  const row = await env.DB.prepare("SELECT * FROM events WHERE id = ? AND owner_id = ? AND stored_at IS NOT NULL")
    .bind(Number(eventId), String(ownerId)).first();
  if (!row) return null;
  const record = await readJournalRecord(row, env, new Map());
  const asset = record?.media?.[assetIndex];
  if (!asset?.object_key) return null;
  const object = await env.JOURNAL.get(asset.object_key);
  if (!object || !object.customMetadata?.nonce) return null;
  try {
    const cipher = new Uint8Array(await object.arrayBuffer());
    const bytes = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(object.customMetadata.nonce), additionalData: aad(String(ownerId), `media:${row.id}:${asset.object_key}`) },
      await userKey(env, String(ownerId)),
      cipher,
    );
    return {
      bytes: new Uint8Array(bytes),
      kind: asset.kind,
      mime_type: safeMime(asset.mime_type),
      file_name: asset.file_name || null,
    };
  } catch {
    return null;
  }
}

export async function serveContactAvatar(request, env, eventId) {
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("signature") || "";
  const now = Math.floor(Date.now() / 1000);
  if (!env.TELEGRAM_BOT_TOKEN || !Number.isInteger(expires) || expires < now || expires > now + 15 * 60 + 30) return new Response("Not found", { status: 404 });
  const row = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(eventId).first();
  if (!row) return new Response("Not found", { status: 404 });
  const expected = bytesToBase64Url(await hmacSha256(env.TELEGRAM_BOT_TOKEN, `avatar:${row.owner_id}:${row.id}:${expires}`));
  if (!constantTimeEqual(signature, expected)) return new Response("Not found", { status: 404 });
  const record = await readJournalRecord(row, env, new Map());
  let message = record?.message || {};
  if (!row.stored_at) {
    try { message = JSON.parse(row.message_json || "{}"); } catch { /* no avatar available */ }
  }
  const fileId = message.chat?.photo?.small_file_id || message.chat?.photo?.big_file_id;
  if (!fileId) return new Response("Not found", { status: 404 });
  return fetchTelegramFile(fileId, env, "image/jpeg");
}

export async function maintainJournal(env) {
  if (!env.JOURNAL || !env.JOURNAL_ENCRYPTION_KEY) throw new Error("encrypted event journal is not configured");
  await migrateLegacyRows(env, 250);
  const owners = await env.DB.prepare("SELECT DISTINCT owner_id FROM events ORDER BY owner_id").all();
  for (const { owner_id: ownerId } of owners.results) await enforceRetentionAndLimit(env, String(ownerId));
}

export async function expirePendingReplyEvents(env, now = Date.now()) {
  const currentTime = Number(now);
  const candidates = await env.DB.prepare(`
    SELECT * FROM events
    WHERE pending_target_message_id IS NOT NULL AND pending_expires_at_ms <= ?
    ORDER BY pending_expires_at_ms, id LIMIT 50
  `).bind(currentTime).all();
  const expiredCounts = await env.DB.prepare(`
    SELECT owner_id, COUNT(*) AS count FROM events
    WHERE pending_target_message_id IS NOT NULL AND pending_expires_at_ms <= ?
    GROUP BY owner_id
  `).bind(currentTime).all();

  for (const row of candidates.results) {
    let message = {};
    try {
      const record = await readJournalRecord(row, env, new Map());
      if (!record && row.stored_at) {
        if (withinPendingRetryWindow(row, currentTime)) await deferPendingReplyEvent(env, row, currentTime);
        continue;
      }
      message = record?.message || {};
      if (!row.stored_at && row.message_json) message = JSON.parse(row.message_json);
    } catch {
      if (withinPendingRetryWindow(row, currentTime)) await deferPendingReplyEvent(env, row, currentTime);
      continue;
    }

    const candidate = mediaCandidate(message);
    const availability = candidate?.file_id
      ? await telegramFileAvailability(candidate.file_id, env)
      : "unavailable";

    if (availability === "retry") {
      if (withinPendingRetryWindow(row, currentTime)) await deferPendingReplyEvent(env, row, currentTime);
      continue;
    }

    if (availability === "unavailable") {
      const result = await env.DB.prepare(`
        UPDATE events SET pending_target_message_id = NULL, pending_expires_at_ms = NULL
        WHERE id = ? AND pending_target_message_id = ? AND pending_expires_at_ms <= ?
      `).bind(Number(row.id), String(row.pending_target_message_id), currentTime).run();
      if (Number(result.meta?.changes || 0) === 1) {
        row.pending_target_message_id = null;
        row.pending_expires_at_ms = null;
      }
    }
  }

  for (const owner of expiredCounts.results) {
    const selectedIds = candidates.results
      .filter((row) => String(row.owner_id) === String(owner.owner_id))
      .map((row) => Number(row.id));
    if (Number(owner.count) <= selectedIds.length || !selectedIds.length) continue;
    const placeholders = selectedIds.map(() => "?").join(",");
    await env.DB.prepare(`
      UPDATE events SET pending_expires_at_ms = ?
      WHERE owner_id = ? AND pending_target_message_id IS NOT NULL
        AND pending_expires_at_ms <= ? AND id NOT IN (${placeholders})
    `).bind(Number(currentTime) + 60_000, String(owner.owner_id), currentTime, ...selectedIds).run();
  }

  const owners = await env.DB.prepare(`
    SELECT DISTINCT owner_id FROM events
    WHERE pending_expires_at_ms IS NOT NULL AND pending_expires_at_ms <= ?
    ORDER BY owner_id LIMIT 100
  `).bind(currentTime).all();
  for (const { owner_id: ownerId } of owners.results) await enforceRetentionAndLimit(env, String(ownerId));

  return candidates.results
    .filter((row) => row.pending_expires_at_ms === null && row.update_id != null)
    .map((row) => ({
      ownerId: String(row.owner_id),
      eventId: Number(row.id),
      messageId: String(row.message_id),
      updateId: Number(row.update_id),
    }));
}

async function deferPendingReplyEvent(env, row, now) {
  await env.DB.prepare(`
    UPDATE events SET pending_expires_at_ms = ?
    WHERE id = ? AND pending_target_message_id = ? AND pending_expires_at_ms <= ?
  `).bind(Number(now) + 60_000, Number(row.id), String(row.pending_target_message_id), Number(now)).run();
}

function withinPendingRetryWindow(row, now) {
  const createdAt = Date.parse(`${String(row.created_at || "").replace(" ", "T")}Z`);
  return Number.isFinite(createdAt) && Number(now) - createdAt < 10 * 60_000;
}

async function telegramFileAvailability(fileId, env) {
  if (!env.TELEGRAM_BOT_TOKEN) return "retry";
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const result = await response.json().catch(() => ({}));
    if (response.ok && result.ok === true && result.result?.file_path) return "available";
    if (response.status === 400 || response.status === 404 || Number(result.error_code) === 400) return "unavailable";
    return "retry";
  } catch {
    return "retry";
  }
}

export async function confirmPendingReplyEvents(env, { ownerId, connectionId, chatId, targetMessageId, now = Date.now() }) {
  const rows = await env.DB.prepare(`
    SELECT id, update_id, message_id FROM events
    WHERE owner_id = ? AND connection_id = ? AND chat_id = ?
      AND pending_target_message_id = ? AND pending_expires_at_ms > ?
    ORDER BY id LIMIT 20
  `).bind(String(ownerId), String(connectionId), String(chatId), String(targetMessageId), Number(now)).all();
  const promoted = [];
  for (const row of rows.results) {
    const result = await env.DB.prepare(`
      UPDATE events SET pending_target_message_id = NULL, pending_expires_at_ms = NULL
      WHERE id = ? AND owner_id = ? AND pending_target_message_id = ? AND pending_expires_at_ms > ?
    `).bind(Number(row.id), String(ownerId), String(targetMessageId), Number(now)).run();
    if (Number(result.meta?.changes || 0) === 1) {
      promoted.push({ eventId: Number(row.id), updateId: row.update_id == null ? null : Number(row.update_id), messageId: String(row.message_id) });
    }
  }
  return promoted;
}

export async function deleteOwnerJournal(env, ownerId) {
  if (!env.JOURNAL) return;
  const prefix = `journal/${String(ownerId)}/`;
  let cursor;
  do {
    const page = await env.JOURNAL.list({ prefix, cursor, limit: 1000 });
    if (page.objects.length) await env.JOURNAL.delete(page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

async function persistRecord(env, input) {
  const { ownerId, messageId, updateId, connectionId, chatId, eventType } = input;
  const lock = await acquireLock(env.DB, ownerId);
  const mediaKeys = [];
  let wroteChunk = false;
  let createdRow = false;
  let chunkKey = "";
  let rowId = 0;
  try {
    let row = input.existingRowId
      ? await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(Number(input.existingRowId)).first()
      : updateId == null ? null : await env.DB.prepare(
        "SELECT * FROM events WHERE owner_id = ? AND update_id = ? AND message_id = ? LIMIT 1",
      ).bind(ownerId, updateId, messageId).first();
    if (row?.stored_at) return Number(row.id);
    if (!row) {
      const inserted = await env.DB.prepare(`
        INSERT OR IGNORE INTO events(
          update_id, owner_id, connection_id, chat_id, message_id, event_type, message_json, snapshot_event_id,
          pending_target_message_id, pending_expires_at_ms
        ) VALUES(?, ?, ?, ?, ?, ?, '{}', ?, ?, ?)
      `).bind(
        updateId,
        ownerId,
        connectionId || null,
        String(chatId || ""),
        messageId,
        eventType,
        input.snapshotEventId || null,
        input.pending?.targetMessageId == null ? null : String(input.pending.targetMessageId),
        input.pending?.expiresAtMs == null ? null : Number(input.pending.expiresAtMs),
      ).run();
      rowId = Number(inserted.meta?.last_row_id || 0);
      row = updateId == null
        ? await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(rowId).first()
        : await env.DB.prepare("SELECT * FROM events WHERE owner_id = ? AND update_id = ? AND message_id = ? LIMIT 1").bind(ownerId, updateId, messageId).first();
      createdRow = Number(inserted.meta?.changes || 0) === 1;
    }
    if (!row) throw new Error("journal event row could not be created");
    rowId = Number(row.id);
    let snapshotEventId = input.snapshotEventId || row.snapshot_event_id || null;
    if (!snapshotEventId && eventType !== "new") {
      const previous = await env.DB.prepare(`
        SELECT id FROM events
        WHERE owner_id = ? AND chat_id = ? AND message_id = ? AND event_type != 'deleted' AND id < ?
        ORDER BY id DESC LIMIT 1
      `).bind(ownerId, String(chatId || ""), messageId, rowId).first();
      snapshotEventId = previous ? Number(previous.id) : null;
    }
    if (snapshotEventId && Number(row.snapshot_event_id || 0) !== Number(snapshotEventId)) {
      await env.DB.prepare("UPDATE events SET snapshot_event_id = ? WHERE id = ?").bind(Number(snapshotEventId), rowId).run();
    }

    const existingChunk = row.journal_key
      ? await env.DB.prepare("SELECT * FROM journal_chunks WHERE object_key = ?").bind(row.journal_key).first()
      : await env.DB.prepare("SELECT * FROM journal_chunks WHERE owner_id = ? ORDER BY chunk_number DESC LIMIT 1").bind(ownerId).first();
    let chunk = existingChunk;
    let records = chunk ? await readChunk(env, ownerId, chunk.object_key) : [];
    if (records.length >= JOURNAL_CHUNK_SIZE && !records.some((record) => Number(record.id) === rowId)) {
      chunk = null;
      records = [];
    }
    if (!chunk) {
      const last = await env.DB.prepare("SELECT MAX(chunk_number) AS n FROM journal_chunks WHERE owner_id = ?").bind(ownerId).first();
      const chunkNumber = Number(last?.n || 0) + 1;
      chunkKey = `journal/${ownerId}/chunks/${chunkNumber}.bin`;
      await env.DB.prepare("INSERT INTO journal_chunks(owner_id, chunk_number, object_key, record_count) VALUES(?, ?, ?, 0)")
        .bind(ownerId, chunkNumber, chunkKey).run();
      chunk = { owner_id: ownerId, chunk_number: chunkNumber, object_key: chunkKey, record_count: 0 };
    } else {
      chunkKey = chunk.object_key;
    }

    let record = records.find((item) => Number(item.id) === rowId);
    if (!record) {
      if (row.journal_key && row.journal_key !== chunkKey) throw new Error("pending journal row points to an unavailable chunk");
      await env.DB.prepare("UPDATE events SET journal_key = ?, journal_index = ? WHERE id = ?")
        .bind(chunkKey, records.length, rowId).run();
      const media = eventType === "deleted" ? [] : await cacheMessageMedia(env, ownerId, rowId, input.message || {});
      mediaKeys.push(...media.map((asset) => asset.object_key));
      record = {
        id: rowId,
        event_type: eventType,
        message: input.message || {},
        media,
      };
      records.push(record);
    } else {
      const index = records.indexOf(record);
      await env.DB.prepare("UPDATE events SET journal_key = ?, journal_index = ? WHERE id = ?")
        .bind(chunkKey, index, rowId).run();
    }

    const encrypted = await encryptRecords(env, ownerId, records);
    await env.JOURNAL.put(chunkKey, encrypted, { customMetadata: { version: "2" } });
    wroteChunk = true;
    await env.DB.prepare(`UPDATE journal_chunks SET record_count = ?, updated_at = CURRENT_TIMESTAMP WHERE object_key = ?`)
      .bind(records.length, chunkKey).run();
    const index = records.findIndex((item) => Number(item.id) === rowId);
    await env.DB.prepare(`UPDATE events SET journal_key = ?, journal_index = ?, message_json = '{}', stored_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(chunkKey, index, rowId).run();
    await pruneOwnerUnderLock(env, ownerId, 500);
    return rowId;
  } catch (error) {
    if (!wroteChunk) {
      if (createdRow && rowId) await env.DB.prepare("DELETE FROM events WHERE id = ? AND stored_at IS NULL").bind(rowId).run();
      if (chunkKey) {
        const chunk = await env.DB.prepare("SELECT record_count FROM journal_chunks WHERE object_key = ?").bind(chunkKey).first();
        if (Number(chunk?.record_count || 0) === 0) {
          await env.DB.prepare("DELETE FROM journal_chunks WHERE object_key = ?").bind(chunkKey).run();
          await env.JOURNAL.delete(chunkKey);
        }
      }
      if (mediaKeys.length) await env.JOURNAL.delete(mediaKeys);
    }
    throw error;
  } finally {
    await releaseLock(env.DB, ownerId, lock);
  }
}

async function cacheMessageMedia(env, ownerId, eventId, message) {
  if (!env.TELEGRAM_BOT_TOKEN) return [];
  const candidate = mediaCandidate(message);
  if (!candidate) return [];
  try {
    const file = await resolveTelegramFile(candidate.file_id, env);
    if (!file) {
      logMediaCacheDiagnostic(candidate.kind, "get_file", "unavailable");
      return [];
    }
    if (file.size > MAX_TELEGRAM_FILE_BYTES) {
      logMediaCacheDiagnostic(candidate.kind, "get_file", "over_limit");
      return [];
    }
    const response = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.path}`);
    if (!response.ok) {
      logMediaCacheDiagnostic(candidate.kind, "download", `http_${response.status}`);
      return [];
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > MAX_TELEGRAM_FILE_BYTES) {
      logMediaCacheDiagnostic(candidate.kind, "download", "over_limit");
      return [];
    }
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const objectKey = `journal/${ownerId}/media/${crypto.randomUUID()}.bin`;
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aad(ownerId, `media:${eventId}:${objectKey}`) },
      await userKey(env, ownerId),
      bytes,
    );
    await env.JOURNAL.put(objectKey, cipher, { customMetadata: { nonce: bytesToBase64Url(nonce), version: "1" } });
    return [{
      object_key: objectKey,
      kind: candidate.kind,
      mime_type: safeMime(candidate.mime_type || file.mime_type || defaultMime(candidate.kind)),
      file_name: candidate.file_name || null,
      duration: candidate.duration || null,
      width: candidate.width || null,
      height: candidate.height || null,
    }];
  } catch (error) {
    const category = error instanceof Error ? error.name : "unknown";
    logMediaCacheDiagnostic(candidate.kind, "cache", category);
    return [];
  }
}

function logMediaCacheDiagnostic(kind, stage, result) {
  // Keep diagnostics limited to media type and failure stage; never log IDs,
  // message text, file paths, or file contents.
  console.warn("[telegram-media-cache]", JSON.stringify({ kind, stage, result }));
}

function mediaCandidate(message) {
  if (Array.isArray(message.photo) && message.photo.length) {
    const photo = [...message.photo].sort((a, b) => Number(b.file_size || 0) - Number(a.file_size || 0))[0];
    return { kind: "photo", file_id: photo.file_id, mime_type: "image/jpeg", width: photo.width, height: photo.height };
  }
  for (const [field, kind] of [["voice", "voice"], ["video_note", "video_note"], ["document", "document"], ["video", "video"], ["audio", "audio"], ["animation", "animation"]]) {
    const media = message[field];
    if (media?.file_id) return { kind, file_id: media.file_id, mime_type: media.mime_type, file_name: media.file_name, duration: media.duration, width: media.width, height: media.height };
  }
  return null;
}

async function resolveTelegramFile(fileId, env) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const result = await response.json();
  if (!response.ok || !result.ok || !result.result?.file_path) return null;
  return { path: result.result.file_path, size: Number(result.result.file_size || 0), mime_type: result.result.mime_type };
}

async function fetchTelegramFile(fileId, env, mimeType) {
  try {
    const file = await resolveTelegramFile(fileId, env);
    if (!file || file.size > MAX_TELEGRAM_FILE_BYTES) return new Response("Not found", { status: 404 });
    const response = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.path}`);
    if (!response.ok) return new Response("Not found", { status: 404 });
    return new Response(response.body, { headers: { "Content-Type": mimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function readJournalRecord(row, env, chunkCache) {
  if (row.journal_key && env.JOURNAL) {
    let recordsPromise = chunkCache.get(row.journal_key);
    if (!recordsPromise) {
      recordsPromise = readChunk(env, row.owner_id, row.journal_key);
      chunkCache.set(row.journal_key, recordsPromise);
    }
    const records = await recordsPromise;
    const indexed = Number.isInteger(Number(row.journal_index)) ? records[Number(row.journal_index)] : null;
    return indexed && Number(indexed.id) === Number(row.id)
      ? indexed
      : records.find((record) => Number(record.id) === Number(row.id)) || null;
  }
  try {
    return { id: Number(row.id), message: JSON.parse(row.message_json || "{}"), media: [] };
  } catch {
    return { id: Number(row.id), message: {}, media: [] };
  }
}

async function readChunk(env, ownerId, objectKey) {
  const object = await env.JOURNAL.get(objectKey);
  if (!object) return [];
  const bytes = await object.arrayBuffer();
  if (object.customMetadata?.nonce) {
    // Read early development chunks written before records received individual encryption.
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(object.customMetadata.nonce), additionalData: aad(ownerId) },
      await userKey(env, ownerId),
      bytes,
    );
    const legacyRecords = JSON.parse(new TextDecoder().decode(plain));
    return Array.isArray(legacyRecords) ? legacyRecords : [];
  }

  const envelope = JSON.parse(new TextDecoder().decode(bytes));
  if (envelope?.version !== 2 || !Array.isArray(envelope.records)) throw new Error("journal chunk format is invalid");
  return Promise.all(envelope.records.map(async (item) => {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64Url(item.nonce), additionalData: aad(ownerId, `event:${item.id}`) },
      await userKey(env, ownerId),
      fromBase64Url(item.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }));
}

async function encryptRecords(env, ownerId, records) {
  const envelope = await Promise.all(records.map(async (record) => {
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aad(ownerId, `event:${record.id}`) },
      await userKey(env, ownerId),
      textEncoder.encode(JSON.stringify(record)),
    );
    return { id: Number(record.id), nonce: bytesToBase64Url(nonce), ciphertext: bytesToBase64Url(new Uint8Array(cipher)) };
  }));
  return textEncoder.encode(JSON.stringify({ version: 2, records: envelope }));
}

async function userKey(env, ownerId) {
  const secret = String(env.JOURNAL_ENCRYPTION_KEY || "");
  if (secret.length < 32) throw new Error("journal encryption key must contain at least 32 characters");
  const baseKey = await crypto.subtle.importKey("raw", textEncoder.encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: textEncoder.encode("SpyChau encrypted journal v1"), info: textEncoder.encode(`owner:${ownerId}`) },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

async function acquireLock(db, ownerId) {
  const token = crypto.randomUUID();
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const now = Date.now();
    const result = await db.prepare(`
      INSERT INTO journal_locks(owner_id, lock_token, lease_until_ms) VALUES(?, ?, ?)
      ON CONFLICT(owner_id) DO UPDATE SET lock_token = excluded.lock_token, lease_until_ms = excluded.lease_until_ms
      WHERE journal_locks.lease_until_ms < ?
    `).bind(ownerId, token, now + 60_000, now).run();
    if (Number(result.meta?.changes || 0) === 1) return token;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error("timed out waiting for the per-user journal lock");
}

async function releaseLock(db, ownerId, token) {
  await db.prepare("DELETE FROM journal_locks WHERE owner_id = ? AND lock_token = ?").bind(ownerId, token).run();
}

async function migrateLegacyRows(env, limit) {
  const rows = await env.DB.prepare(`
    SELECT * FROM events
    WHERE journal_key IS NULL AND stored_at IS NULL AND created_at >= datetime('now', '-7 days')
    ORDER BY owner_id, id LIMIT ?
  `).bind(limit).all();
  for (const row of rows.results) {
    let message = {};
    try { message = JSON.parse(row.message_json || "{}"); } catch { /* keep a readable empty record */ }
    let snapshotEventId = row.snapshot_event_id;
    if (!snapshotEventId && row.event_type !== "new") {
      const previous = await env.DB.prepare(`
        SELECT id FROM events
        WHERE owner_id = ? AND chat_id = ? AND message_id = ? AND event_type != 'deleted' AND id < ?
        ORDER BY id DESC LIMIT 1
      `).bind(row.owner_id, row.chat_id, row.message_id, Number(row.id)).first();
      if (previous) snapshotEventId = Number(previous.id);
    }
    await persistRecord(env, {
      ownerId: String(row.owner_id),
      messageId: String(row.message_id),
      updateId: row.update_id == null ? null : Number(row.update_id),
      connectionId: row.connection_id,
      chatId: String(row.chat_id),
      eventType: row.event_type,
      message,
      snapshotEventId,
      existingRowId: Number(row.id),
    });
  }
}

async function enforceRetentionAndLimit(env, ownerId) {
  const lock = await acquireLock(env.DB, ownerId);
  try {
    await pruneOwnerUnderLock(env, ownerId, 500);
  } finally {
    await releaseLock(env.DB, ownerId, lock);
  }
}

async function pruneOwnerUnderLock(env, ownerId) {
    const removeResult = await env.DB.prepare(`
      SELECT id, journal_key FROM events
      WHERE owner_id = ? AND (
        created_at < datetime('now', '-7 days')
        OR (pending_expires_at_ms IS NOT NULL AND pending_expires_at_ms <= ?)
        OR id NOT IN (SELECT id FROM events WHERE owner_id = ? AND created_at >= datetime('now', '-7 days') ORDER BY id DESC LIMIT ?)
      ) ORDER BY id LIMIT 500
    `).bind(ownerId, Date.now(), ownerId, MESSAGE_LIMIT).all();
    if (!removeResult.results.length) return;
    const removedIds = new Set(removeResult.results.map((row) => Number(row.id)));
    const chunkKeys = [...new Set(removeResult.results.map((row) => row.journal_key).filter(Boolean))];
    const indexUpdates = [];

    for (const objectKey of chunkKeys) {
      const metadata = await env.DB.prepare("SELECT owner_id FROM journal_chunks WHERE object_key = ?").bind(objectKey).first();
      if (!metadata) continue;
      const records = await readChunk(env, ownerId, objectKey);
      const retained = records.filter((record) => !removedIds.has(Number(record.id)));
      for (const record of records) {
        if (removedIds.has(Number(record.id)) && Array.isArray(record.media)) {
          const keys = record.media.map((asset) => asset.object_key).filter(Boolean);
          if (keys.length) await env.JOURNAL.delete(keys);
        }
      }
      if (retained.length) {
        const encrypted = await encryptRecords(env, ownerId, retained);
        await env.JOURNAL.put(objectKey, encrypted, { customMetadata: { version: "2" } });
        for (let index = 0; index < retained.length; index += 1) {
          indexUpdates.push(env.DB.prepare("UPDATE events SET journal_index = ? WHERE id = ?").bind(index, Number(retained[index].id)));
        }
        await env.DB.prepare("UPDATE journal_chunks SET record_count = ?, updated_at = CURRENT_TIMESTAMP WHERE object_key = ?").bind(retained.length, objectKey).run();
      } else {
        await env.JOURNAL.delete(objectKey);
        await env.DB.prepare("DELETE FROM journal_chunks WHERE object_key = ?").bind(objectKey).run();
      }
    }
    if (indexUpdates.length) {
      for (let offset = 0; offset < indexUpdates.length; offset += 100) await env.DB.batch(indexUpdates.slice(offset, offset + 100));
    }
    const ids = [...removedIds];
    for (let offset = 0; offset < ids.length; offset += 100) {
      const batch = ids.slice(offset, offset + 100);
      const placeholders = batch.map(() => "?").join(",");
      await env.DB.prepare(`DELETE FROM events WHERE owner_id = ? AND id IN (${placeholders})`).bind(ownerId, ...batch).run();
    }
}

function signedMediaUrl(row, assetIndex, env) {
  const expires = Math.floor(Date.now() / 1000) + 15 * 60;
  const payload = `media:${row.owner_id}:${row.id}:${assetIndex}:${expires}`;
  const signaturePromise = hmacSha256(env.TELEGRAM_BOT_TOKEN, payload).then(bytesToBase64Url);
  // URLs are assembled by hydrateEventRows, which can await these promises below.
  return signaturePromise.then((signature) => `/api/media/${row.id}?asset=${assetIndex}&expires=${expires}&signature=${signature}`);
}

function signedAvatarUrl(row, env) {
  const expires = Math.floor(Date.now() / 1000) + 15 * 60;
  return hmacSha256(env.TELEGRAM_BOT_TOKEN, `avatar:${row.owner_id}:${row.id}:${expires}`)
    .then((bytes) => `/api/avatar/${row.id}?expires=${expires}&signature=${bytesToBase64Url(bytes)}`);
}

async function hmacSha256(key, message) {
  const cryptoKey = await crypto.subtle.importKey("raw", textEncoder.encode(String(key)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, textEncoder.encode(message)));
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function aad(ownerId, context = "journal") {
  return textEncoder.encode(`SpyChau:user:${ownerId}:${context}:v1`);
}

function safeMime(value) {
  const mime = String(value || "application/octet-stream").split(";")[0].trim().toLowerCase();
  return /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime) ? mime : "application/octet-stream";
}

function archivedMediaResponse(request, bytes, mimeType) {
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "Content-Type": mimeType,
    "X-Content-Type-Options": "nosniff",
  });
  const range = request.headers.get("Range")?.trim() || "";
  const match = /^bytes=(\d*)-(\d*)$/i.exec(range);
  if (!match) {
    headers.set("Content-Length", String(bytes.byteLength));
    return new Response(bytes, { headers });
  }

  const [, first, last] = match;
  const length = bytes.byteLength;
  let start;
  let end;
  if (!first) {
    const suffixLength = Number(last);
    if (!suffixLength || !length) return unsatisfiableRange(length);
    start = Math.max(length - suffixLength, 0);
    end = length - 1;
  } else {
    start = Number(first);
    end = last ? Number(last) : length - 1;
    if (!length || start >= length || end < start) return unsatisfiableRange(length);
    end = Math.min(end, length - 1);
  }

  headers.set("Content-Length", String(end - start + 1));
  headers.set("Content-Range", `bytes ${start}-${end}/${length}`);
  return new Response(bytes.slice(start, end + 1), { status: 206, headers });
}

function unsatisfiableRange(length) {
  return new Response(null, {
    status: 416,
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "Content-Range": `bytes */${length}`,
    },
  });
}

function defaultMime(kind) {
  return ({ photo: "image/jpeg", voice: "audio/ogg", video_note: "video/mp4", video: "video/mp4", animation: "video/mp4", audio: "audio/mpeg" })[kind] || "application/octet-stream";
}

function constantTimeEqual(left, right) {
  const a = textEncoder.encode(String(left));
  const b = textEncoder.encode(String(right));
  let difference = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) difference |= (a[index] || 0) ^ (b[index] || 0);
  return difference === 0;
}
