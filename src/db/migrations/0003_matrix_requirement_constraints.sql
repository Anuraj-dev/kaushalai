-- Repair databases created by the early prototype, which accepted zero-valued
-- matrix requirements. The rebuilt table keeps the same shape and data while
-- enforcing the published 1..5 level and 1..3 importance contract.
CREATE TABLE matrix_competencies_rebuild (
  id TEXT PRIMARY KEY,
  matrix_version_id TEXT NOT NULL REFERENCES matrix_versions(id),
  competency_id TEXT NOT NULL REFERENCES competencies(id),
  required_level REAL NOT NULL CHECK(required_level BETWEEN 1 AND 5),
  importance REAL NOT NULL CHECK(importance BETWEEN 1 AND 3),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(matrix_version_id, competency_id)
);
INSERT INTO matrix_competencies_rebuild(id,matrix_version_id,competency_id,required_level,importance,created_at,updated_at)
  SELECT id,matrix_version_id,competency_id,required_level,importance,created_at,updated_at FROM matrix_competencies;
DROP TABLE matrix_competencies;
ALTER TABLE matrix_competencies_rebuild RENAME TO matrix_competencies;

CREATE TRIGGER published_matrix_competency_immutable_update BEFORE UPDATE ON matrix_competencies WHEN EXISTS (SELECT 1 FROM matrix_versions WHERE id = OLD.matrix_version_id AND status = 'published') BEGIN SELECT RAISE(ABORT, 'published matrix versions are immutable'); END;
CREATE TRIGGER published_matrix_competency_immutable_delete BEFORE DELETE ON matrix_competencies WHEN EXISTS (SELECT 1 FROM matrix_versions WHERE id = OLD.matrix_version_id AND status = 'published') BEGIN SELECT RAISE(ABORT, 'published matrix versions are immutable'); END;
CREATE TRIGGER published_matrix_competency_immutable_insert BEFORE INSERT ON matrix_competencies WHEN EXISTS (SELECT 1 FROM matrix_versions WHERE id = NEW.matrix_version_id AND status = 'published') BEGIN SELECT RAISE(ABORT, 'published matrix versions are immutable'); END;
