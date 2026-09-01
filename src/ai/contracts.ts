import { z } from "zod";

export const AI_SCHEMA_VERSION = "1.0" as const;
export const GEMINI_MODEL = "gemini-3.7-flash";
export const GROQ_MODEL = "qwen/qwen3.8-27b";

const rubricEntrySchema = z.object({
  level: z.number().int().min(1).max(5),
  criterion: z.string().trim().min(1),
}).strict();

const optionSchema = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1),
  demonstratedLevel: z.number().int().min(1).max(5),
}).strict();

export const generatedQuestionSchema = z.object({
  id: z.string().trim().min(1),
  competencyId: z.string().trim().min(1),
  format: z.enum(["single_choice", "short_text"]),
  prompt: z.string().trim().min(1),
  targetLevel: z.number().int().min(1).max(5),
  selectionReason: z.string().trim().min(1),
  options: z.array(optionSchema).max(5),
  rubric: z.array(rubricEntrySchema).min(1).max(5),
}).strict();

export const generatedQuestionsSchema = z.object({
  schemaVersion: z.literal(AI_SCHEMA_VERSION),
  questions: z.array(generatedQuestionSchema).min(1).max(10),
}).strict();

export const writtenEvaluationSchema = z.object({
  questionId: z.string().trim().min(1),
  competencyId: z.string().trim().min(1),
  demonstratedLevel: z.number().int().min(1).max(5),
  confidence: z.number().min(0).max(1),
  evidenceSummary: z.string().trim().min(1),
  rubricReason: z.string().trim().min(1),
  ambiguity: z.string(),
}).strict();

export const writtenEvaluationsSchema = z.object({
  schemaVersion: z.literal(AI_SCHEMA_VERSION),
  evaluations: z.array(writtenEvaluationSchema).min(1).max(10),
}).strict();

export type RubricEntry = z.infer<typeof rubricEntrySchema>;
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type GeneratedQuestions = z.infer<typeof generatedQuestionsSchema>;
export type WrittenEvaluation = z.infer<typeof writtenEvaluationSchema>;
export type WrittenEvaluations = z.infer<typeof writtenEvaluationsSchema>;

export type GenerateAdaptiveQuestionsRequest = {
  assessmentSessionId: string;
  matrixVersionId: string;
  requestedCount: number;
  competencies: Array<{ id: string; targetLevel: number; rubric: RubricEntry[] }>;
  priorEvidence: Array<{ competencyId: string; summary: string }>;
  fallbackQuestions: GeneratedQuestion[];
};

export type EvaluateWrittenAnswersRequest = {
  assessmentSessionId: string;
  matrixVersionId: string;
  answers: Array<{
    questionId: string;
    competencyId: string;
    answer: string;
    rubric: RubricEntry[];
    fallbackDemonstratedLevel: number;
  }>;
};

export type LearnerQuestion = {
  id: string;
  competencyId: string;
  format: "single_choice" | "short_text";
  prompt: string;
  options: Array<{ id: string; text: string }>;
};

export const CATALOG_GUIDE_EMPTY_PATH_COPY = "No verified course is available for the current gaps.";
export const CATALOG_GUIDE_OUTSIDE_PATH_COPY = "This guide only explains courses already on your learning path.";
export const CATALOG_GUIDE_IDENTITY_COPY = [
  "I'm Kaushal, the learning-path guide for this assessment.",
  "I explain courses already on your learning plan. Those courses come from skill gaps against the competency matrix for your job role.",
  "I can say why a course is first, which skill gap it addresses, and what catalog evidence sits on your plan.",
  "I cannot search the full iGOT catalog, change scores, or mark a course complete.",
].join("\n\n");

export function isCatalogGuideIdentityQuestion(question: string): boolean {
  const normalized = question.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return [
    /who are you/,
    /\bwho are u\b/,
    /\bwho r u\b/,
    /what are you/,
    /what can you do/,
    /what can u do/,
    /what do you do/,
    /how can you help/,
    /how do you help/,
    /tell me about yourself/,
    /\bwho is this\b/,
    /\bwhat is this\b/,
  ].some((pattern) => pattern.test(normalized));
}

export const catalogGuideCourseNoteSchema = z.object({
  courseId: z.string().trim().min(1),
  note: z.string().trim().min(1),
}).strict();

export const catalogGuideSchema = z.object({
  schemaVersion: z.literal(AI_SCHEMA_VERSION),
  gapSummary: z.string(),
  courseNotes: z.array(catalogGuideCourseNoteSchema),
  unavailable: z.string(),
}).strict();

export type CatalogGuideCourseNote = z.infer<typeof catalogGuideCourseNoteSchema>;
export type CatalogGuide = z.infer<typeof catalogGuideSchema>;

export type CatalogGuidePathCourse = {
  courseId: string;
  title: string;
  provider: string;
  duration: string;
  level: string;
  sourceUrl: string;
  evidence: "title" | "detailed";
  competencyId: string;
  competencyName: string;
  rank: number;
  rationale: string;
  description?: string;
  learningOutcomes?: string[];
  tags?: string[];
  highlighted?: boolean;
};

export type CatalogGuideAiRequest = {
  assessmentSessionId: string;
  matrixVersionId: string;
  question: string;
  results: Array<{
    competencyId: string;
    competencyName: string;
    assessedLevel: number;
    requiredLevel: number;
    gap: number;
    priority: number;
    confidence: number;
    supported: boolean;
  }>;
  pathCourses: CatalogGuidePathCourse[];
};

export const QUESTION_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: [AI_SCHEMA_VERSION] },
    questions: { type: "array", minItems: 1, maxItems: 10, items: {
      type: "object", additionalProperties: false,
      properties: {
        id: { type: "string", minLength: 1 }, competencyId: { type: "string", minLength: 1 },
        format: { type: "string", enum: ["single_choice", "short_text"] },
        prompt: { type: "string", minLength: 1 }, targetLevel: { type: "integer", minimum: 1, maximum: 5 },
        selectionReason: { type: "string", minLength: 1 },
        options: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false,
          properties: { id: { type: "string", minLength: 1 }, text: { type: "string", minLength: 1 }, demonstratedLevel: { type: "integer", minimum: 1, maximum: 5 } },
          required: ["id", "text", "demonstratedLevel"] } },
        rubric: { type: "array", minItems: 1, maxItems: 5, items: { type: "object", additionalProperties: false,
          properties: { level: { type: "integer", minimum: 1, maximum: 5 }, criterion: { type: "string", minLength: 1 } }, required: ["level", "criterion"] } },
      },
      required: ["id", "competencyId", "format", "prompt", "targetLevel", "selectionReason", "options", "rubric"],
    } },
  },
  required: ["schemaVersion", "questions"],
} as const;

export const EVALUATION_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: [AI_SCHEMA_VERSION] },
    evaluations: { type: "array", minItems: 1, maxItems: 10, items: {
      type: "object", additionalProperties: false,
      properties: {
        questionId: { type: "string", minLength: 1 }, competencyId: { type: "string", minLength: 1 },
        demonstratedLevel: { type: "integer", minimum: 1, maximum: 5 },
        confidence: { type: "number", minimum: 0, maximum: 1 }, evidenceSummary: { type: "string", minLength: 1 },
        rubricReason: { type: "string", minLength: 1 }, ambiguity: { type: "string" },
      },
      required: ["questionId", "competencyId", "demonstratedLevel", "confidence", "evidenceSummary", "rubricReason", "ambiguity"],
    } },
  },
  required: ["schemaVersion", "evaluations"],
} as const;

export const CATALOG_GUIDE_JSON_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: [AI_SCHEMA_VERSION] },
    gapSummary: { type: "string" },
    courseNotes: { type: "array", items: {
      type: "object", additionalProperties: false,
      properties: {
        courseId: { type: "string", minLength: 1 },
        note: { type: "string", minLength: 1 },
      },
      required: ["courseId", "note"],
    } },
    unavailable: { type: "string" },
  },
  required: ["schemaVersion", "gapSummary", "courseNotes", "unavailable"],
} as const;

export class AiContractError extends Error {
  constructor(readonly kind: "schema_error" | "semantic_error", message: string) {
    super(message);
    this.name = "AiContractError";
  }
}

export function validateGeneratedQuestions(value: unknown, request: GenerateAdaptiveQuestionsRequest): GeneratedQuestions {
  const parsed = generatedQuestionsSchema.safeParse(value);
  if (!parsed.success) throw new AiContractError("schema_error", "Question response does not match schema");
  const result = parsed.data;
  if (result.questions.length !== request.requestedCount) throw new AiContractError("semantic_error", "Question count does not match request");
  const competencyMap = new Map(request.competencies.map((item) => [item.id, item]));
  const ids = new Set<string>();
  for (const question of result.questions) {
    const competency = competencyMap.get(question.competencyId);
    if (!competency) throw new AiContractError("semantic_error", "Question references a competency outside the pinned matrix");
    if (ids.has(question.id)) throw new AiContractError("semantic_error", "Question ID is duplicated");
    ids.add(question.id);
    if (question.format === "single_choice" && question.options.length < 2) throw new AiContractError("semantic_error", "Single-choice question requires at least two options");
    if (question.format === "short_text" && question.options.length !== 0) throw new AiContractError("semantic_error", "Short-text question cannot contain options");
    const allowedLevels = new Set(competency.rubric.map((entry) => entry.level));
    if (question.rubric.some((entry) => !allowedLevels.has(entry.level))) throw new AiContractError("semantic_error", "Question rubric contains a level outside the pinned matrix rubric");
    if (!allowedLevels.has(question.targetLevel)) throw new AiContractError("semantic_error", "Question targetLevel outside pinned rubric");
  }
  return result;
}

const evidenceWords = (text: string) => new Set(text.toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length >= 4).map((word) => word.slice(0, 6)) ?? []);

export function validateWrittenEvaluations(value: unknown, request: EvaluateWrittenAnswersRequest): WrittenEvaluations {
  const parsed = writtenEvaluationsSchema.safeParse(value);
  if (!parsed.success) throw new AiContractError("schema_error", "Evaluation response does not match schema");
  if (parsed.data.evaluations.length !== request.answers.length) throw new AiContractError("semantic_error", "Evaluation count does not match submitted answers");
  const answers = new Map(request.answers.map((answer) => [answer.questionId, answer]));
  const seen = new Set<string>();
  for (const evaluation of parsed.data.evaluations) {
    const answer = answers.get(evaluation.questionId);
    if (!answer || seen.has(evaluation.questionId)) throw new AiContractError("semantic_error", "Evaluation references an unknown or duplicate question");
    seen.add(evaluation.questionId);
    if (evaluation.competencyId !== answer.competencyId) throw new AiContractError("semantic_error", "Evaluation competency does not match the question");
    if (!answer.rubric.some((entry) => entry.level === evaluation.demonstratedLevel)) throw new AiContractError("semantic_error", "Evaluation level is not present in the stored rubric");
    const answerWords = evidenceWords(`${answer.answer} ${answer.rubric.map((entry) => entry.criterion).join(" ")}`);
    const evidenceSummaryWords = evidenceWords(evaluation.evidenceSummary);
    if (evidenceSummaryWords.size > 0) {
      const overlap = [...evidenceSummaryWords].filter((w) => answerWords.has(w)).length;
      const required = Math.min(evidenceSummaryWords.size, Math.max(1, Math.ceil(evidenceSummaryWords.size * 0.4)));
      if (overlap < required) throw new AiContractError("semantic_error", "Evaluation claims evidence outside the written answer");
    }
    const rubricSourceWords = evidenceWords(`${answer.answer} ${answer.rubric.map((entry) => entry.criterion).join(" ")}`);
    const rubricReasonWords = evidenceWords(evaluation.rubricReason);
    if (rubricReasonWords.size > 0) {
      const overlap = [...rubricReasonWords].filter((w) => rubricSourceWords.has(w)).length;
      const required = Math.min(rubricReasonWords.size, Math.max(1, Math.ceil(rubricReasonWords.size * 0.4)));
      if (overlap < required) throw new AiContractError("semantic_error", "Evaluation reason is not grounded in the answer or rubric");
    }
  }
  return parsed.data;
}

export function validateCatalogGuideOutput(value: unknown, allowedCourseIds: string[]): CatalogGuide {
  const parsed = catalogGuideSchema.safeParse(value);
  if (!parsed.success) throw new AiContractError("schema_error", "Catalog guide response does not match schema");
  const allowed = new Set(allowedCourseIds);
  const seen = new Set<string>();
  for (const note of parsed.data.courseNotes) {
    if (!allowed.has(note.courseId)) throw new AiContractError("semantic_error", "Catalog guide references a course outside the learning path");
    if (seen.has(note.courseId)) throw new AiContractError("semantic_error", "Catalog guide course ID is duplicated");
    seen.add(note.courseId);
  }
  return parsed.data;
}

export function toLearnerQuestions(data: GeneratedQuestions): LearnerQuestion[] {
  return data.questions.map(({ id, competencyId, format, prompt, options }) => ({
    id, competencyId, format, prompt,
    options: options.map(({ id: optionId, text }) => ({ id: optionId, text })),
  }));
}
