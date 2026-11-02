ALTER TABLE subscriptions ADD COLUMN plan_id TEXT;
ALTER TABLE subscriptions ADD COLUMN auto_renew INTEGER NOT NULL DEFAULT 0 CHECK (auto_renew IN (0, 1));

CREATE TABLE IF NOT EXISTS service_payment_consents (
  consent_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  service_key TEXT NOT NULL CHECK (service_key IN ('personal_package', 'groups')),
  plan_id TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tribute_product_consents (
  consent_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  service_key TEXT NOT NULL CHECK (service_key IN ('personal_unlimited', 'personal_package')),
  plan_id TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  accepted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tribute_product_consents_lookup
  ON tribute_product_consents(owner_id, service_key, plan_id, accepted_at DESC);

CREATE INDEX IF NOT EXISTS service_payment_consents_owner_service
  ON service_payment_consents(owner_id, service_key, plan_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS payment_purchases (
  purchase_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  service_key TEXT NOT NULL CHECK (service_key IN ('personal_unlimited', 'personal_package', 'groups')),
  plan_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT,
  credits_granted INTEGER NOT NULL DEFAULT 0 CHECK (credits_granted >= 0),
  groups_limit INTEGER NOT NULL DEFAULT 0 CHECK (groups_limit >= 0),
  refunded_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS payment_purchases_owner_service
  ON payment_purchases(owner_id, service_key, purchased_at DESC);

CREATE TABLE IF NOT EXISTS notification_packages (
  package_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  purchase_id TEXT NOT NULL UNIQUE,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('pack100', 'pack300', 'pack500')),
  credits_total INTEGER NOT NULL CHECK (credits_total > 0),
  credits_remaining INTEGER NOT NULL CHECK (credits_remaining >= 0),
  activated_after_event_id INTEGER NOT NULL DEFAULT 0,
  purchased_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (purchase_id) REFERENCES payment_purchases(purchase_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tribute_digital_product_events (
  provider_event_id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  service_key TEXT NOT NULL CHECK (service_key IN ('personal_unlimited', 'personal_package')),
  plan_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tribute_digital_product_refunds (
  purchase_id TEXT PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS notification_packages_owner_balance
  ON notification_packages(owner_id, credits_remaining, purchased_at);

CREATE TABLE IF NOT EXISTS package_event_usage (
  event_id INTEGER PRIMARY KEY,
  owner_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES notification_packages(package_id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS group_entitlements (
  owner_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL CHECK (plan_id IN ('groups3', 'groups10', 'groups20')),
  groups_limit INTEGER NOT NULL CHECK (groups_limit IN (3, 10, 20)),
  starts_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  provider_subscription_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

