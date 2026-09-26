-- Trainer quizzes generated from uploaded learning material. A published quiz
-- is immutable so every attempt scores against the questions the official saw.
CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  competency_id TEXT NOT NULL REFERENCES competencies(id),
  course_id TEXT REFERENCES courses(id),
  source_name TEXT NOT NULL,
  source_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  generated_by TEXT NOT NULL,
  created_by TEXT REFERENCES administrators(id),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_quizzes_competency ON quizzes(competency_id, status);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation TEXT NOT NULL,
  source_quote TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id, position);

CREATE TRIGGER IF NOT EXISTS quiz_questions_published_update
BEFORE UPDATE ON quiz_questions
WHEN (SELECT status FROM quizzes WHERE id = OLD.quiz_id) = 'published'
BEGIN SELECT RAISE(ABORT, 'published quiz questions are immutable'); END;

CREATE TRIGGER IF NOT EXISTS quiz_questions_published_delete
BEFORE DELETE ON quiz_questions
WHEN (SELECT status FROM quizzes WHERE id = OLD.quiz_id) = 'published'
BEGIN SELECT RAISE(ABORT, 'published quiz questions are immutable'); END;

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id),
  official_id TEXT NOT NULL REFERENCES officials(id),
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  correct_count INTEGER,
  question_count INTEGER NOT NULL,
  demonstrated_level INTEGER,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_official ON quiz_attempts(official_id, quiz_id);

CREATE TABLE IF NOT EXISTS quiz_answers (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES quiz_questions(id),
  selected_index INTEGER NOT NULL CHECK (selected_index BETWEEN 0 AND 3),
  correct INTEGER NOT NULL,
  answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS quiz_answer_unique ON quiz_answers(attempt_id, question_id);

-- A focused check is a short, single-competency reassessment unlocked by a
-- completed quiz attempt. Its answers become current assessment evidence.
CREATE TABLE IF NOT EXISTS focused_checks (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL UNIQUE REFERENCES quiz_attempts(id),
  assessment_id TEXT NOT NULL REFERENCES assessments(id),
  competency_id TEXT NOT NULL REFERENCES competencies(id),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
