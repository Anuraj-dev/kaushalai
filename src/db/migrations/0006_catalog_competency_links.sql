-- Backfill canonical catalog search-term links for databases imported before
-- the catalog importer populated course_competencies.
INSERT OR IGNORE INTO course_competencies(course_id, competency_id, evidence_type, relevance)
SELECT c.id, tags.competency_id, 'search_term', 1
FROM courses c
JOIN json_each(c.search_terms_json) AS terms
JOIN competency_course_tags AS tags ON tags.tag = lower(trim(CAST(terms.value AS TEXT)));
