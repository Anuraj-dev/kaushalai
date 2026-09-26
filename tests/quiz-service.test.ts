import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { quoteIsGrounded, validateQuizQuestions } from "@/ai";
import { importCatalog } from "@/data/catalog-import";
import { seedFoundation } from "@/data/seeds";
import { openDatabase, type KaushalDatabase } from "@/db/client";
import { migrate } from "@/db/migrate";
import { extractMaterialText, fallbackQuizQuestions } from "@/services/quiz-material";
import { QuizService } from "@/services/quiz-service";

const SAMPLE_PDF = "public/samples/sampling-methods-note.pdf";
type Row = Record<string, unknown>;

describe("quiz material", () => {
  it("extracts the sample PDF and builds grounded offline questions", async () => {
    const text = await extractMaterialText({ name: "note.pdf", bytes: new Uint8Array(readFileSync(SAMPLE_PDF)) });
    expect(text).toContain("sampling frame");
    const questions = fallbackQuizQuestions(text, 6);
    expect(questions.length).toBeGreaterThanOrEqual(3);
    for (const question of questions) {
      expect(new Set(question.options).size).toBe(4);
      expect(question.prompt).toContain("_____");
      expect(quoteIsGrounded(question.sourceQuote, text)).toBe(true);
    }
  });

  it("rejects unsupported files and near-empty text", async () => {
    await expect(extractMaterialText({ name: "slides.pptx", bytes: new Uint8Array([1, 2, 3]) })).rejects.toThrow(/PDF, TXT or MD/);
    await expect(extractMaterialText({ name: "note.txt", bytes: new TextEncoder().encode("too short") })).rejects.toThrow(/Too little/);
  });

  it("drops model questions whose quote is not in the material", () => {
    const source = "Stratified sampling divides the population into non-overlapping groups called strata and selects a separate sample from each stratum.";
    const grounded = { prompt: "What are strata?", options: ["Groups", "Weights", "Frames", "Errors"], correctIndex: 0, explanation: "They are groups.", sourceQuote: "divides the population into non-overlapping groups called strata" };
    const invented = { ...grounded, prompt: "Invented?", sourceQuote: "Strata must always contain exactly one hundred households each." };
    const result = validateQuizQuestions({ schemaVersion: "1.0", questions: [grounded, invented, { ...grounded, prompt: "Again?" }, { ...grounded, prompt: "Third?" }] }, { requestedCount: 3, sourceText: source });
    expect(result.questions.map((question) => question.prompt)).toEqual(["What are strata?", "Again?", "Third?"]);
    expect(() => validateQuizQuestions({ schemaVersion: "1.0", questions: [invented, invented, invented] }, { requestedCount: 3, sourceText: source })).toThrow(/grounded/);
  });
});

describe("quiz lifecycle and evidence", () => {
  let database: KaushalDatabase;
  let service: QuizService;
  let material: string;
  const previousMode = process.env.AI_PROVIDER_MODE;

  beforeAll(async () => {
    process.env.AI_PROVIDER_MODE = "seeded";
    material = await extractMaterialText({ name: "note.pdf", bytes: new Uint8Array(readFileSync(SAMPLE_PDF)) });
  });
  afterAll(() => { process.env.AI_PROVIDER_MODE = previousMode; });
  beforeEach(() => {
    database = openDatabase(":memory:");
    migrate(database);
    seedFoundation(database);
    importCatalog(database);
    service = new QuizService(database);
  });
  afterEach(() => database.close());

  function completedAssessment(officialId: string) {
    const official = database.prepare(`SELECT v.id version_id FROM officials o JOIN competency_matrices m ON m.job_role_id=o.job_role_id
      JOIN matrix_versions v ON v.matrix_id=m.id AND v.status='published' WHERE o.id=?`).get(officialId) as Row;
    const competencies = database.prepare("SELECT competency_id,required_level,importance FROM matrix_competencies WHERE matrix_version_id=? ORDER BY competency_id").all(official.version_id) as Row[];
    database.prepare("INSERT INTO assessments(id,official_id,matrix_version_id,status) VALUES ('a1',?,?,'completed')").run(officialId, official.version_id);
    const evidence = database.prepare("INSERT INTO evidence(id,assessment_id,competency_id,source_type,level,reliability,rationale) VALUES (?,?,?,?,?,?,?)");
    for (const item of competencies) for (const n of [1, 2, 3]) evidence.run(`e-${n}:r1:${String(item.competency_id)}`, "a1", item.competency_id, "fixed-assessment", 2, 1, "Baseline");
    const result = database.prepare("INSERT INTO assessment_results(id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported) VALUES (?,?,?,?,?,?,?,?,1)");
    for (const item of competencies) result.run(`r-${String(item.competency_id)}`, "a1", item.competency_id, 2, item.required_level, Number(item.required_level) - 2, (Number(item.required_level) - 2) * Number(item.importance), 1);
    return String(competencies[0]!.competency_id);
  }

  async function publishedQuiz(competencyId: string) {
    const created = await service.createDraft({ title: "Sampling basics", competencyId, sourceName: "note.pdf", text: material, questionCount: 5 });
    expect(created.provider).toBe("seeded-fallback");
    service.publish(created.id);
    return service.get(created.id)!;
  }

  it("keeps drafts editable and locks questions once published", async () => {
    const competencyId = completedAssessment("official-01");
    const created = await service.createDraft({ title: "Sampling basics", competencyId, sourceName: "note.pdf", text: material, questionCount: 5 });
    const draft = service.get(created.id)!;
    expect(draft.status).toBe("draft");
    const first = draft.questions[0]!;
    service.updateQuestion(created.id, first.id, { prompt: "Edited prompt", options: ["a", "b", "c", "d"], correctIndex: 2, explanation: "Because c." });
    expect(service.get(created.id)!.questions[0]).toMatchObject({ prompt: "Edited prompt", correctIndex: 2 });
    service.publish(created.id);
    expect(() => service.updateQuestion(created.id, first.id, { prompt: "Again", options: ["a", "b", "c", "d"], correctIndex: 1, explanation: "x" })).toThrow(/locked/);
    expect(() => database.prepare("DELETE FROM quiz_questions WHERE quiz_id=?").run(created.id)).toThrow(/immutable/);
  });

  it("scores an attempt, stores quiz history at 0.5 reliability and re-scores the result", async () => {
    const competencyId = completedAssessment("official-01");
    const quiz = await publishedQuiz(competencyId);
    expect(service.availableForOfficial("official-01", String((database.prepare("SELECT matrix_version_id FROM assessments WHERE id='a1'").get() as Row).matrix_version_id)).map((item) => item.id)).toContain(quiz.id);
    const attemptId = service.start(quiz.id, "official-01");
    for (const question of quiz.questions) service.answer(attemptId, "official-01", question.id, question.correctIndex);
    // The first answer is final.
    const first = quiz.questions[0]!;
    expect(service.answer(attemptId, "official-01", first.id, (first.correctIndex + 1) % 4).correct).toBe(true);
    const finished = service.finish(attemptId, "official-01");
    expect(finished).toMatchObject({ correct: quiz.questions.length, total: quiz.questions.length, level: 5 });
    expect(finished.change.after!.assessedLevel).toBeGreaterThan(finished.change.before!.assessedLevel);
    const history = database.prepare("SELECT * FROM learning_history WHERE official_id='official-01'").all() as Row[];
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ source_type: "verified-course-assessment", reliability: 0.5, level: 5, source_id: quiz.id });

    // A retake replaces the earlier quiz history instead of stacking it.
    const retake = service.start(quiz.id, "official-01");
    for (const question of quiz.questions) service.answer(retake, "official-01", question.id, (question.correctIndex + 1) % 4);
    expect(service.finish(retake, "official-01").level).toBe(1);
    expect(database.prepare("SELECT level FROM learning_history WHERE official_id='official-01'").all()).toEqual([{ level: 1 }]);
  });

  it("refuses to finish until every question is answered and hides answer keys until answered", async () => {
    const competencyId = completedAssessment("official-01");
    const quiz = await publishedQuiz(competencyId);
    const attemptId = service.start(quiz.id, "official-01");
    const view = service.learnerView(quiz.id, "official-01");
    expect(JSON.stringify(view.quiz.questions)).not.toContain("correctIndex");
    expect(view.attempt?.answers).toEqual([]);
    expect(() => service.finish(attemptId, "official-01")).toThrow(/every question/);
    expect(() => service.answer(attemptId, "official-02", quiz.questions[0]!.id, 0)).toThrow(/not found/);
  });

  it("unlocks a focused check that adds current evidence and re-scores", async () => {
    const competencyId = completedAssessment("official-01");
    const quiz = await publishedQuiz(competencyId);
    const attemptId = service.start(quiz.id, "official-01");
    for (const question of quiz.questions) service.answer(attemptId, "official-01", question.id, question.correctIndex);
    await expect(service.startCheck(service.start(quiz.id, "official-02"), "official-02")).rejects.toThrow(/Finish the quiz/);
    service.finish(attemptId, "official-01");
    const check = await service.startCheck(attemptId, "official-01");
    expect(check.questions).toHaveLength(3);
    expect((await service.startCheck(attemptId, "official-01")).id).toBe(check.id);
    const submitted = await service.submitCheck(check.id, "official-01", check.questions.map((question) => ({ questionId: question.id, value: "I would stratify the frame, apply PPS selection and weight by inverse probability." })));
    expect(submitted.change.after).not.toBeNull();
    const evidence = database.prepare("SELECT id,source_type FROM evidence WHERE assessment_id='a1' AND id LIKE '%:check:%'").all() as Row[];
    expect(evidence).toHaveLength(3);
    expect(evidence.every((row) => row.source_type === "ai-written")).toBe(true);
    await expect(service.submitCheck(check.id, "official-01", [])).rejects.toThrow(/already complete/);
  });
});
