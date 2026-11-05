ALTER TABLE subscriptions ADD COLUMN tribute_subscription_id TEXT;
ALTER TABLE group_entitlements ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 0 CHECK (auto_renew IN (0, 1));

CREATE INDEX IF NOT EXISTS subscriptions_tribute_subscription
  ON subscriptions(tribute_subscription_id, owner_id);

CREATE TABLE IF NOT EXISTS tribute_subscription_events (
  event_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  event_name TEXT NOT NULL CHECK (event_name IN ('new_subscription', 'renewed_subscription', 'cancelled_subscription')),
  subscription_id TEXT NOT NULL,
  service_key TEXT NOT NULL CHECK (service_key IN ('personal_unlimited', 'groups')),
  plan_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'RUB',
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tribute_subscription_events_owner_received
  ON tribute_subscription_events(owner_id, received_at DESC);
