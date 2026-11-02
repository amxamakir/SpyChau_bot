CREATE INDEX IF NOT EXISTS events_created_owner
  ON events(created_at, owner_id, id);

CREATE INDEX IF NOT EXISTS events_owner_created_id
  ON events(owner_id, created_at, id DESC);
