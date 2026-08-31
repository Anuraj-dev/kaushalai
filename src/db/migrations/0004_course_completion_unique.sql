-- Deduplicate legacy duplicates before enforcing uniqueness (Codex P1)
DELETE FROM course_completions WHERE id NOT IN (
  SELECT MIN(id) FROM course_completions GROUP BY official_id, course_id
);
CREATE UNIQUE INDEX IF NOT EXISTS course_completion_unique ON course_completions(official_id, course_id);
