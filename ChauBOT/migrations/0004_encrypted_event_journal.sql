ALTER TABLE events ADD COLUMN journal_key TEXT;
ALTER TABLE events ADD COLUMN journal_index INTEGER;
ALTER TABLE events ADD COLUMN stored_at TEXT;
ALTER TABLE events ADD COLUMN snapshot_event_id INTEGER;

CREATE INDEX IF NOT EXISTS events_owner_stored_created
  ON events(owner_id, stored_at, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS events_owner_message_latest
  ON events(owner_id, chat_id, message_id, id DESC);

CREATE TABLE IF NOT EXISTS journal_chunks (
  owner_id TEXT NOT NULL,
  chunk_number INTEGER NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  record_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(owner_id, chunk_number),
  FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS journal_locks (
  owner_id TEXT PRIMARY KEY,
  lock_token TEXT NOT NULL,
  lease_until_ms INTEGER NOT NULL,
  FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);
