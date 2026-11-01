ALTER TABLE events ADD COLUMN pending_target_message_id TEXT;
ALTER TABLE events ADD COLUMN pending_expires_at_ms INTEGER;

CREATE INDEX IF NOT EXISTS events_pending_expiration
  ON events(pending_expires_at_ms)
  WHERE pending_expires_at_ms IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_pending_target
  ON events(owner_id, connection_id, chat_id, pending_target_message_id, pending_expires_at_ms)
  WHERE pending_expires_at_ms IS NOT NULL;
