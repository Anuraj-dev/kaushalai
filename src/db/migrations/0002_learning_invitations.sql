CREATE TABLE reassessment_invitations (
  id TEXT PRIMARY KEY,
  official_id TEXT NOT NULL REFERENCES officials(id),
  reason TEXT NOT NULL,
  source_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT
);
CREATE UNIQUE INDEX reassessment_invitation_source ON reassessment_invitations(official_id, reason, source_id);
