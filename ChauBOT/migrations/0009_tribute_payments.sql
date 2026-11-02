CREATE TABLE IF NOT EXISTS payment_consents (
  consent_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('month', 'half-year', 'year')),
  terms_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS payment_consents_owner_created
  ON payment_consents(owner_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS tribute_payment_events (
  event_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  event_name TEXT NOT NULL CHECK (event_name IN ('new_subscription', 'renewed_subscription')),
  subscription_id TEXT,
  months INTEGER NOT NULL CHECK (months IN (1, 6, 12)),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tribute_payment_events_owner_received
  ON tribute_payment_events(owner_id, received_at DESC);
