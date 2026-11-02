ALTER TABLE events ADD COLUMN message_thread_id TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS events_owner_group_thread ON events(owner_id, chat_id, message_thread_id, id DESC);

CREATE TABLE IF NOT EXISTS group_chats (
  owner_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  chat_type TEXT NOT NULL CHECK(chat_type IN ('group', 'supergroup')),
  title TEXT NOT NULL DEFAULT '',
  username TEXT,
  bot_status TEXT NOT NULL DEFAULT 'member',
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(owner_id, chat_id),
  FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS group_chats_owner_active ON group_chats(owner_id, active, updated_at DESC);

CREATE TABLE IF NOT EXISTS group_topics (
  owner_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  thread_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(owner_id, chat_id, thread_id),
  FOREIGN KEY(owner_id, chat_id) REFERENCES group_chats(owner_id, chat_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS group_topics_owner_chat ON group_topics(owner_id, chat_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS group_message_snapshots (
  owner_id TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL DEFAULT '',
  nonce TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(owner_id, chat_id, message_id),
  FOREIGN KEY(owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS group_message_snapshots_retention ON group_message_snapshots(updated_at);
CREATE INDEX IF NOT EXISTS group_message_snapshots_chat ON group_message_snapshots(chat_id);
