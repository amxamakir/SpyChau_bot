-- expires_at is an ISO 8601 UTC timestamp, for example 2026-12-01T00:00:00Z.
CREATE TABLE IF NOT EXISTS subscriptions (
  owner_id TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);
