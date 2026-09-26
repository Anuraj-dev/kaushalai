import { randomUUID } from "node:crypto";

import { AiContractError, QUIZ_MAX_QUESTIONS, QUIZ_MIN_QUESTIONS, type QuizQuestion } from "@/ai";
import { getDatabase, type KaushalDatabase } from "@/db/client";
import { EVIDENCE_RELIABILITY, FOCUSED_CHECK_QUESTIONS, quizDemonstratedLevel } from "@/domain/assessment";
import {
  fallbackQuestions,
  publicQuestions,
  requirements,
  rubrics,
  toStored,
  type PublicQuestion,
  type StoredQuestion,
} from "@/services/assessment-prefill";
import { assessmentAi, evaluateAdaptiveAnswers, rescoreAssessment } from "@/services/assessment-evidence";
import { fallbackQuizQuestions, materialExcerpt } from "@/services/quiz-material";

type Row = Record<string, unknown>;

/** Errors whose message is safe to show to the person who caused them. */
export class QuizError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export type QuizStatus = "draft" | "published";
export type QuizSummary = {
  id: string; title: string; status: QuizStatus; competencyId: string; competencyName: string;
  courseId: string | null; courseTitle: string | null; sourceName: string; generatedBy: string;
  questionCount: number; attemptCount: number; averageScore: number | null; createdAt: string; publishedAt: string | null;
};
export type QuizQuestionRecord = { id: string; position: number; prompt: string; options: string[]; correctIndex: number; explanation: string; sourceQuote: string };
export type QuizDetail = QuizSummary & { questions: QuizQuestionRecord[] };
export type AnswerFeedback = { questionId: string; selectedIndex: number; correct: boolean; correctIndex: number; explanation: string; sourceQuote: string };
export type CompetencySnapshot = { assessedLevel: number; requiredLevel: number; gap: number; confidence: number; supported: boolean };
export type ResultChange = { competencyName: string; before: CompetencySnapshot | null; after: CompetencySnapshot | null };
export type LearnerQuizSummary = {
  id: string; title: string; competencyId: string; competencyName: string; courseId: string | null; questionCount: number;
  lastAttempt: { correct: number; total: number; level: number; completedAt: string } | null;
};

const parseOptions = (value: unknown): string[] => {
  try { const parsed = JSON.parse(String(value)); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; }
};

const questionRecord = (row: Row): QuizQuestionRecord => ({
  id: String(row.id), position: Number(row.position), prompt: String(row.prompt), options: parseOptions(row.options_json),
  correctIndex: Number(row.correct_index), explanation: String(row.explanation), sourceQuote: String(row.source_quote),
});

export class QuizService {
  constructor(private readonly db: KaushalDatabase = getDatabase(), private readonly id: () => string = randomUUID) {}

  // --- Trainer (administrator) side ---

  competencyOptions() {
    const competencies = this.db.prepare("SELECT id,name,domain FROM competencies ORDER BY name").all() as Row[];
    const links = this.db.prepare(`SELECT cc.competency_id,c.id,c.title FROM course_competencies cc JOIN courses c ON c.id=cc.course_id
      ORDER BY cc.competency_id,c.title`).all() as Row[];
    const courses = new Map<string, Array<{ id: string; title: string }>>();
    for (const row of links) {
      const bucket = courses.get(String(row.competency_id)) ?? [];
      bucket.push({ id: String(row.id), title: String(row.title) });
      courses.set(String(row.competency_id), bucket);
    }
    return competencies.map((row) => ({ id: String(row.id), name: String(row.name), domain: String(row.domain), courses: courses.get(String(row.id)) ?? [] }));
  }

  async createDraft(input: { title: string; competencyId: string; courseId?: string | null; sourceName: string; text: string; questionCount: number; createdBy?: string }) {
    const competency = this.db.prepare("SELECT id,name FROM competencies WHERE id=?").get(input.competencyId) as Row | undefined;
    if (!competency) throw new QuizError("Choose a competency from the list.");
    if (input.courseId && !this.db.prepare("SELECT 1 FROM courses WHERE id=?").get(input.courseId)) throw new QuizError("The linked course was not found.");
    const count = Math.min(QUIZ_MAX_QUESTIONS, Math.max(QUIZ_MIN_QUESTIONS, Math.round(input.questionCount)));
    const quizId = this.id();
    const excerpt = materialExcerpt(input.text);
    let generated;
    try {
      generated = await assessmentAi().generateQuizQuestions({
        quizDraftId: quizId, competencyName: String(competency.name), requestedCount: count, sourceText: excerpt,
        fallbackQuestions: fallbackQuizQuestions(excerpt, count),
      });
    } catch (error) {
      if (error instanceof AiContractError) throw new QuizError("Could not write enough questions from this material. Try a longer or text-rich document.", 422);
      throw error;
    }
    this.db.transaction(() => {
      this.db.prepare(`INSERT INTO quizzes(id,title,competency_id,course_id,source_name,source_text,status,generated_by,created_by)
        VALUES (?,?,?,?,?,?,'draft',?,?)`).run(quizId, input.title, input.competencyId, input.courseId || null, input.sourceName, input.text, generated.provider, input.createdBy ?? "admin-001");
      this.insertQuestions(quizId, generated.data.questions);
    })();
    return { id: quizId, provider: generated.provider, questionCount: generated.data.questions.length };
  }

  private insertQuestions(quizId: string, questions: QuizQuestion[]) {
    const insert = this.db.prepare(`INSERT INTO quiz_questions(id,quiz_id,position,prompt,options_json,correct_index,explanation,source_quote)
      VALUES (?,?,?,?,?,?,?,?)`);
    questions.forEach((question, index) => insert.run(this.id(), quizId, index + 1, question.prompt, JSON.stringify(question.options), question.correctIndex, question.explanation, question.sourceQuote));
  }

  list(): QuizSummary[] {
    const rows = this.db.prepare(`SELECT q.*,c.name competency_name,co.title course_title,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id=q.id) question_count,
        (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id=q.id AND a.status='completed') attempt_count,
        (SELECT AVG(CAST(a.correct_count AS REAL)/a.question_count) FROM quiz_attempts a WHERE a.quiz_id=q.id AND a.status='completed') average_score
      FROM quizzes q JOIN competencies c ON c.id=q.competency_id LEFT JOIN courses co ON co.id=q.course_id
      ORDER BY q.created_at DESC,q.rowid DESC`).all() as Row[];
    return rows.map((row) => this.summary(row));
  }

  private summary(row: Row): QuizSummary {
    return {
      id: String(row.id), title: String(row.title), status: String(row.status) as QuizStatus, competencyId: String(row.competency_id),
      competencyName: String(row.competency_name), courseId: row.course_id ? String(row.course_id) : null, courseTitle: row.course_title ? String(row.course_title) : null,
      sourceName: String(row.source_name), generatedBy: String(row.generated_by), questionCount: Number(row.question_count ?? 0),
      attemptCount: Number(row.attempt_count ?? 0), averageScore: row.average_score === null || row.average_score === undefined ? null : Number(row.average_score),
      createdAt: String(row.created_at), publishedAt: row.published_at ? String(row.published_at) : null,
    };
  }

  get(quizId: string): QuizDetail | null {
    const row = this.db.prepare(`SELECT q.*,c.name competency_name,co.title course_title,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id=q.id) question_count,
        (SELECT COUNT(*) FROM quiz_attempts a WHERE a.quiz_id=q.id AND a.status='completed') attempt_count,
        (SELECT AVG(CAST(a.correct_count AS REAL)/a.question_count) FROM quiz_attempts a WHERE a.quiz_id=q.id AND a.status='completed') average_score
      FROM quizzes q JOIN competencies c ON c.id=q.competency_id LEFT JOIN courses co ON co.id=q.course_id WHERE q.id=?`).get(quizId) as Row | undefined;
    if (!row) return null;
    const questions = (this.db.prepare("SELECT * FROM quiz_questions WHERE quiz_id=? ORDER BY position,id").all(quizId) as Row[]).map(questionRecord);
    return { ...this.summary(row), questions };
  }

  private draft(quizId: string) {
    const quiz = this.db.prepare("SELECT status FROM quizzes WHERE id=?").get(quizId) as Row | undefined;
    if (!quiz) throw new QuizError("Quiz not found.", 404);
    if (quiz.status !== "draft") throw new QuizError("Published quizzes are locked. Create a new quiz to change questions.", 409);
  }

  updateQuestion(quizId: string, questionId: string, input: { prompt: string; options: string[]; correctIndex: number; explanation: string }) {
    this.draft(quizId);
    const options = input.options.map((option) => option.trim());
    if (options.length !== 4 || options.some((option) => !option)) throw new QuizError("Every question needs four filled options.");
    if (new Set(options.map((option) => option.toLowerCase())).size !== 4) throw new QuizError("Options must be different from each other.");
    if (!Number.isInteger(input.correctIndex) || input.correctIndex < 0 || input.correctIndex > 3) throw new QuizError("Mark one option as correct.");
    if (!input.prompt.trim() || !input.explanation.trim()) throw new QuizError("Question and explanation cannot be empty.");
    const result = this.db.prepare(`UPDATE quiz_questions SET prompt=?,options_json=?,correct_index=?,explanation=?,updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND quiz_id=?`).run(input.prompt.trim(), JSON.stringify(options), input.correctIndex, input.explanation.trim(), questionId, quizId);
    if (result.changes === 0) throw new QuizError("Question not found.", 404);
  }

  deleteQuestion(quizId: string, questionId: string) {
    this.draft(quizId);
    if (this.db.prepare("DELETE FROM quiz_questions WHERE id=? AND quiz_id=?").run(questionId, quizId).changes === 0) throw new QuizError("Question not found.", 404);
  }

  publish(quizId: string) {
    this.draft(quizId);
    const count = (this.db.prepare("SELECT COUNT(*) count FROM quiz_questions WHERE quiz_id=?").get(quizId) as { count: number }).count;
    if (count < QUIZ_MIN_QUESTIONS) throw new QuizError(`Keep at least ${QUIZ_MIN_QUESTIONS} questions before publishing.`);
    this.db.prepare("UPDATE quizzes SET status='published',published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='draft'").run(quizId);
  }

  deleteDraft(quizId: string) {
    this.draft(quizId);
    this.db.prepare("DELETE FROM quizzes WHERE id=? AND status='draft'").run(quizId);
  }

  // --- Learner (official) side ---

  private latestResultAssessment(officialId: string) {
    return this.db.prepare(`SELECT id,matrix_version_id FROM assessments WHERE official_id=? AND status IN ('completed','provisional')
      ORDER BY started_at DESC,rowid DESC LIMIT 1`).get(officialId) as Row | undefined;
  }

  /** Published quizzes for competencies in the official's current matrix, with their latest score. */
  availableForOfficial(officialId: string, matrixVersionId: string): LearnerQuizSummary[] {
    const rows = this.db.prepare(`SELECT q.id,q.title,q.competency_id,q.course_id,c.name competency_name,
        (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id=q.id) question_count
      FROM quizzes q JOIN competencies c ON c.id=q.competency_id
      JOIN matrix_competencies mc ON mc.competency_id=q.competency_id AND mc.matrix_version_id=?
      WHERE q.status='published' ORDER BY q.published_at DESC,q.rowid DESC`).all(matrixVersionId) as Row[];
    const lastAttempt = this.db.prepare(`SELECT correct_count,question_count,demonstrated_level,completed_at FROM quiz_attempts
      WHERE quiz_id=? AND official_id=? AND status='completed' ORDER BY completed_at DESC,rowid DESC LIMIT 1`);
    return rows.map((row) => {
      const attempt = lastAttempt.get(row.id, officialId) as Row | undefined;
      return {
        id: String(row.id), title: String(row.title), competencyId: String(row.competency_id), competencyName: String(row.competency_name),
        courseId: row.course_id ? String(row.course_id) : null, questionCount: Number(row.question_count),
        lastAttempt: attempt ? { correct: Number(attempt.correct_count), total: Number(attempt.question_count), level: Number(attempt.demonstrated_level), completedAt: String(attempt.completed_at) } : null,
      };
    });
  }

  private publishedQuiz(quizId: string) {
    const quiz = this.db.prepare(`SELECT q.*,c.name competency_name,co.title course_title FROM quizzes q JOIN competencies c ON c.id=q.competency_id
      LEFT JOIN courses co ON co.id=q.course_id WHERE q.id=? AND q.status='published'`).get(quizId) as Row | undefined;
    if (!quiz) throw new QuizError("This quiz is not available.", 404);
    return quiz;
  }

  private attemptFor(attemptId: string, officialId: string) {
    const attempt = this.db.prepare("SELECT * FROM quiz_attempts WHERE id=? AND official_id=?").get(attemptId, officialId) as Row | undefined;
    if (!attempt) throw new QuizError("Quiz attempt not found.", 404);
    return attempt;
  }

  private feedbackFor(attemptId: string): AnswerFeedback[] {
    return (this.db.prepare(`SELECT a.question_id,a.selected_index,a.correct,q.correct_index,q.explanation,q.source_quote
      FROM quiz_answers a JOIN quiz_questions q ON q.id=a.question_id WHERE a.attempt_id=? ORDER BY q.position`).all(attemptId) as Row[]).map((row) => ({
      questionId: String(row.question_id), selectedIndex: Number(row.selected_index), correct: row.correct === 1,
      correctIndex: Number(row.correct_index), explanation: String(row.explanation), sourceQuote: String(row.source_quote),
    }));
  }

  private competencySnapshot(assessmentId: string, competencyId: string): CompetencySnapshot | null {
    const row = this.db.prepare("SELECT * FROM assessment_results WHERE assessment_id=? AND competency_id=?").get(assessmentId, competencyId) as Row | undefined;
    return row ? { assessedLevel: Number(row.assessed_level), requiredLevel: Number(row.required_level), gap: Number(row.gap), confidence: Number(row.confidence), supported: row.supported === 1 } : null;
  }

  /** Everything the quiz page needs. Answer keys only appear for questions the official has already answered. */
  learnerView(quizId: string, officialId: string) {
    const quiz = this.publishedQuiz(quizId);
    const questions = (this.db.prepare("SELECT id,position,prompt,options_json FROM quiz_questions WHERE quiz_id=? ORDER BY position,id").all(quizId) as Row[])
      .map((row) => ({ id: String(row.id), position: Number(row.position), prompt: String(row.prompt), options: parseOptions(row.options_json) }));
    const attempt = this.db.prepare(`SELECT * FROM quiz_attempts WHERE quiz_id=? AND official_id=? ORDER BY started_at DESC,rowid DESC LIMIT 1`).get(quizId, officialId) as Row | undefined;
    const assessment = this.latestResultAssessment(officialId);
    const inMatrix = assessment ? requirements(this.db, String(assessment.matrix_version_id)).some((item) => item.competencyId === quiz.competency_id) : false;
    const check = attempt ? this.db.prepare("SELECT id,status,payload_json FROM focused_checks WHERE attempt_id=?").get(attempt.id) as Row | undefined : undefined;
    return {
      quiz: {
        id: String(quiz.id), title: String(quiz.title), competencyId: String(quiz.competency_id), competencyName: String(quiz.competency_name),
        courseTitle: quiz.course_title ? String(quiz.course_title) : null, sourceName: String(quiz.source_name), questions,
      },
      attempt: attempt ? {
        id: String(attempt.id), status: String(attempt.status) as "in_progress" | "completed",
        correct: attempt.correct_count === null ? null : Number(attempt.correct_count), total: Number(attempt.question_count),
        level: attempt.demonstrated_level === null ? null : Number(attempt.demonstrated_level), answers: this.feedbackFor(String(attempt.id)),
      } : null,
      competency: assessment ? this.competencySnapshot(String(assessment.id), String(quiz.competency_id)) : null,
      inMatrix,
      check: check ? { id: String(check.id), status: String(check.status), questions: check.status === "pending" ? publicQuestions(JSON.parse(String(check.payload_json)) as StoredQuestion[]) : [] } : null,
    };
  }

  start(quizId: string, officialId: string) {
    this.publishedQuiz(quizId);
    if (!this.db.prepare("SELECT 1 FROM officials WHERE id=?").get(officialId)) throw new QuizError("Official not found.", 404);
    const open = this.db.prepare("SELECT id FROM quiz_attempts WHERE quiz_id=? AND official_id=? AND status='in_progress'").get(quizId, officialId) as Row | undefined;
    if (open) return String(open.id);
    const total = (this.db.prepare("SELECT COUNT(*) count FROM quiz_questions WHERE quiz_id=?").get(quizId) as { count: number }).count;
    const attemptId = this.id();
    this.db.prepare("INSERT INTO quiz_attempts(id,quiz_id,official_id,status,question_count) VALUES (?,?,?,'in_progress',?)").run(attemptId, quizId, officialId, total);
    return attemptId;
  }

  /** Records one answer. The first answer to a question is final, so feedback cannot be farmed by resubmitting. */
  answer(attemptId: string, officialId: string, questionId: string, selectedIndex: number): AnswerFeedback {
    const attempt = this.attemptFor(attemptId, officialId);
    if (attempt.status !== "in_progress") throw new QuizError("This attempt is already finished.", 409);
    const question = this.db.prepare("SELECT * FROM quiz_questions WHERE id=? AND quiz_id=?").get(questionId, attempt.quiz_id) as Row | undefined;
    if (!question) throw new QuizError("Question not found.", 404);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) throw new QuizError("Choose one of the four options.");
    this.db.prepare("INSERT OR IGNORE INTO quiz_answers(id,attempt_id,question_id,selected_index,correct) VALUES (?,?,?,?,?)")
      .run(this.id(), attemptId, questionId, selectedIndex, selectedIndex === Number(question.correct_index) ? 1 : 0);
    return this.feedbackFor(attemptId).find((item) => item.questionId === questionId)!;
  }

  /**
   * Scores the attempt, stores it as verified course-assessment history
   * (replacing any earlier attempt at the same quiz), and re-scores the
   * official's latest finished assessment so the gap moves on screen.
   */
  finish(attemptId: string, officialId: string) {
    const attempt = this.attemptFor(attemptId, officialId);
    if (attempt.status !== "in_progress") throw new QuizError("This attempt is already finished.", 409);
    const quiz = this.publishedQuiz(String(attempt.quiz_id));
    const answers = this.feedbackFor(attemptId);
    const total = Number(attempt.question_count);
    if (answers.length !== total) throw new QuizError("Answer every question before finishing.");
    const correct = answers.filter((item) => item.correct).length;
    const level = quizDemonstratedLevel(correct, total);
    const assessment = this.latestResultAssessment(officialId);
    const before = assessment ? this.competencySnapshot(String(assessment.id), String(quiz.competency_id)) : null;
    this.db.transaction(() => {
      this.db.prepare("UPDATE quiz_attempts SET status='completed',correct_count=?,demonstrated_level=?,completed_at=CURRENT_TIMESTAMP WHERE id=?").run(correct, level, attemptId);
      this.db.prepare("DELETE FROM learning_history WHERE official_id=? AND source_type='verified-course-assessment' AND source_id=?").run(officialId, quiz.id);
      this.db.prepare("INSERT INTO learning_history(id,official_id,competency_id,source_type,source_id,level,reliability) VALUES (?,?,?,?,?,?,?)")
        .run(this.id(), officialId, quiz.competency_id, "verified-course-assessment", quiz.id, level, EVIDENCE_RELIABILITY["verified-course-assessment"]);
    })();
    if (assessment) rescoreAssessment(this.db, String(assessment.id));
    const after = assessment ? this.competencySnapshot(String(assessment.id), String(quiz.competency_id)) : null;
    return {
      correct, total, level, assessmentId: assessment ? String(assessment.id) : null,
      change: { competencyName: String(quiz.competency_name), before, after } satisfies ResultChange,
    };
  }

  /** Opens (or reopens) the short single-competency reassessment unlocked by a finished attempt. */
  async startCheck(attemptId: string, officialId: string): Promise<{ id: string; questions: PublicQuestion[] }> {
    const attempt = this.attemptFor(attemptId, officialId);
    if (attempt.status !== "completed") throw new QuizError("Finish the quiz to unlock the focused check.", 409);
    const existing = this.db.prepare("SELECT * FROM focused_checks WHERE attempt_id=?").get(attemptId) as Row | undefined;
    if (existing) {
      if (existing.status !== "pending") throw new QuizError("This focused check is already complete.", 409);
      return { id: String(existing.id), questions: publicQuestions(JSON.parse(String(existing.payload_json)) as StoredQuestion[]) };
    }
    const quiz = this.publishedQuiz(String(attempt.quiz_id));
    const assessment = this.latestResultAssessment(officialId);
    const requirement = assessment ? requirements(this.db, String(assessment.matrix_version_id)).find((item) => item.competencyId === quiz.competency_id) : undefined;
    if (!assessment || !requirement) throw new QuizError("This competency is not in your current role matrix, so there is no result to confirm.", 409);
    const matrix = [requirement];
    const rubricMap = rubrics(this.db, [requirement.competencyId]);
    const checkId = this.id();
    const generated = await assessmentAi().generateAdaptiveQuestions({
      assessmentSessionId: String(assessment.id), matrixVersionId: String(assessment.matrix_version_id), requestedCount: FOCUSED_CHECK_QUESTIONS,
      competencies: [{ id: requirement.competencyId, targetLevel: requirement.requiredLevel, rubric: rubricMap.get(requirement.competencyId) ?? [] }],
      priorEvidence: [{ competencyId: requirement.competencyId, summary: `Scored ${Number(attempt.correct_count)}/${Number(attempt.question_count)} on the quiz "${String(quiz.title)}".` }],
      fallbackQuestions: fallbackQuestions(this.db, matrix, FOCUSED_CHECK_QUESTIONS, 3).map((question, index) => ({ ...question, id: `check-${checkId}-${index + 1}` })),
    });
    const stored = toStored(generated.data.questions, matrix);
    this.db.prepare("INSERT INTO focused_checks(id,attempt_id,assessment_id,competency_id,payload_json) VALUES (?,?,?,?,?)")
      .run(checkId, attemptId, assessment.id, requirement.competencyId, JSON.stringify(stored));
    return { id: checkId, questions: publicQuestions(stored) };
  }

  /** Adds the check answers as current assessment evidence (not history), then re-scores. */
  async submitCheck(checkId: string, officialId: string, answers: Array<{ questionId: string; value: string }>) {
    const check = this.db.prepare(`SELECT f.*,a.official_id,c.name competency_name,s.matrix_version_id FROM focused_checks f
      JOIN quiz_attempts a ON a.id=f.attempt_id JOIN competencies c ON c.id=f.competency_id JOIN assessments s ON s.id=f.assessment_id
      WHERE f.id=? AND a.official_id=?`).get(checkId, officialId) as Row | undefined;
    if (!check) throw new QuizError("Focused check not found.", 404);
    if (check.status !== "pending") throw new QuizError("This focused check is already complete.", 409);
    const questions = JSON.parse(String(check.payload_json)) as StoredQuestion[];
    const answerMap = new Map(answers.map((item) => [item.questionId, item.value.trim()]));
    if (questions.some((question) => !answerMap.get(question.id))) throw new QuizError("Answer every question before submitting.");
    const assessmentId = String(check.assessment_id);
    const before = this.competencySnapshot(assessmentId, String(check.competency_id));
    const evaluated = await evaluateAdaptiveAnswers(questions, answerMap, { assessmentSessionId: assessmentId, matrixVersionId: String(check.matrix_version_id) });
    this.db.transaction(() => {
      const insert = this.db.prepare("INSERT INTO evidence(id,assessment_id,competency_id,source_type,level,reliability,rationale) VALUES (?,?,?,?,?,?,?)");
      for (const question of questions) {
        const item = evaluated.get(question.id);
        if (!item) throw new Error("A focused check answer was not evaluated");
        insert.run(`${this.id()}:check:${question.id}`, assessmentId, question.competencyId, "ai-written", item.level, item.reliability, `Focused check: ${item.reason}`);
      }
      this.db.prepare("UPDATE focused_checks SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=?").run(checkId);
    })();
    rescoreAssessment(this.db, assessmentId);
    return { assessmentId, change: { competencyName: String(check.competency_name), before, after: this.competencySnapshot(assessmentId, String(check.competency_id)) } satisfies ResultChange };
  }
}
