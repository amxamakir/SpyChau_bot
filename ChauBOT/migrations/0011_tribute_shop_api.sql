CREATE TABLE IF NOT EXISTS tribute_shop_orders (
  order_uuid TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  service_key TEXT NOT NULL CHECK (service_key IN ('personal_unlimited', 'personal_package', 'groups')),
  plan_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  stars_amount INTEGER NOT NULL CHECK (stars_amount >= 0),
  currency TEXT NOT NULL CHECK (currency = 'rub'),
  billing_period TEXT NOT NULL CHECK (billing_period IN ('onetime', 'monthly', 'halfyearly', 'yearly')),
  purchase_mode TEXT NOT NULL CHECK (purchase_mode IN ('one_time', 'recurring')),
  autorenew_accepted_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS tribute_shop_orders_owner_status
  ON tribute_shop_orders(owner_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS tribute_shop_order_events (
  event_key TEXT PRIMARY KEY,
  order_uuid TEXT NOT NULL,
  event_name TEXT NOT NULL,
  transaction_id TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_uuid) REFERENCES tribute_shop_orders(order_uuid) ON DELETE CASCADE
);

ALTER TABLE payment_purchases ADD COLUMN provider_order_uuid TEXT;
CREATE INDEX IF NOT EXISTS payment_purchases_provider_order
  ON payment_purchases(provider_order_uuid, owner_id, service_key);

ALTER TABLE subscriptions ADD COLUMN provider_order_uuid TEXT;
