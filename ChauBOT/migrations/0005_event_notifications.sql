CREATE TABLE IF NOT EXISTS notification_preferences (
  owner_id TEXT PRIMARY KEY,
  deleted_messages INTEGER NOT NULL DEFAULT 1 CHECK (deleted_messages IN (0, 1)),
  edited_messages INTEGER NOT NULL DEFAULT 1 CHECK (edited_messages IN (0, 1)),
  one_time_messages INTEGER NOT NULL DEFAULT 1 CHECK (one_time_messages IN (0, 1)),
  group_messages INTEGER NOT NULL DEFAULT 0 CHECK (group_messages IN (0, 1)),
  deleted_by_owner INTEGER NOT NULL DEFAULT 0 CHECK (deleted_by_owner IN (0, 1)),
  edited_by_owner INTEGER NOT NULL DEFAULT 0 CHECK (edited_by_owner IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  owner_id TEXT NOT NULL,
  update_id INTEGER NOT NULL,
  message_id TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_id, update_id, message_id),
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);
