CREATE TABLE competency_rubrics (
  id TEXT PRIMARY KEY,
  competency_id TEXT NOT NULL REFERENCES competencies(id),
  level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 5),
  descriptor TEXT NOT NULL,
  UNIQUE(competency_id, level)
);
CREATE TABLE competency_course_tags (
  competency_id TEXT NOT NULL REFERENCES competencies(id),
  tag TEXT NOT NULL CHECK(tag = lower(trim(tag))),
  UNIQUE(competency_id, tag)
);
CREATE INDEX competency_tag_lookup ON competency_course_tags(tag);
