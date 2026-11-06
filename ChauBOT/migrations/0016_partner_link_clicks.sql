CREATE TABLE IF NOT EXISTS partner_link_clicks (
  partner_id TEXT NOT NULL,
  click_day TEXT NOT NULL,
  click_count INTEGER NOT NULL DEFAULT 0 CHECK (click_count >= 0),
  PRIMARY KEY (partner_id, click_day),
  FOREIGN KEY (partner_id) REFERENCES users(telegram_id) ON DELETE CASCADE
);
