CREATE TABLE IF NOT EXISTS entitlement_reminders (
  owner_id TEXT NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('subscription_ending', 'package_low')),
  entitlement_key TEXT NOT NULL,
  sent_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at TEXT,
  PRIMARY KEY (owner_id, reminder_type, entitlement_key),
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);
