CREATE TABLE IF NOT EXISTS partner_accounts (
  owner_id TEXT PRIMARY KEY,
  referral_code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS partner_referrals (
  referred_id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  attributed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (partner_id <> referred_id),
  FOREIGN KEY (referred_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS partner_referrals_partner_attributed
  ON partner_referrals(partner_id, attributed_at DESC);

CREATE TABLE IF NOT EXISTS partner_commissions (
  event_key TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL,
  partner_id TEXT NOT NULL,
  referred_id TEXT NOT NULL,
  rate_basis_points INTEGER NOT NULL CHECK (rate_basis_points IN (1000, 2000)),
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'RUB' CHECK (currency = 'RUB'),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES payment_purchases(purchase_id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
  FOREIGN KEY (referred_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS partner_commissions_partner_created
  ON partner_commissions(partner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS partner_withdrawals (
  request_id TEXT PRIMARY KEY,
  partner_id TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 500000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  processed_by TEXT,
  FOREIGN KEY (partner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_withdrawals_one_pending
  ON partner_withdrawals(partner_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS partner_withdrawals_status_requested
  ON partner_withdrawals(status, requested_at DESC);
