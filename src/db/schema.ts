import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
};

export const jobRoles = sqliteTable("job_roles", {
  id: text("id").primaryKey(), name: text("name").notNull().unique(), description: text("description"), ...timestamps,
});
export const officials = sqliteTable("officials", {
  id: text("id").primaryKey(), employeeCode: text("employee_code").notNull().unique(), name: text("name").notNull(), email: text("email").notNull().unique(), jobRoleId: text("job_role_id").notNull().references(() => jobRoles.id), isDemoSelectable: integer("is_demo_selectable", { mode: "boolean" }).notNull().default(false), ...timestamps,
});
export const administrators = sqliteTable("administrators", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(), ...timestamps,
});
export const competencies = sqliteTable("competencies", {
  id: text("id").primaryKey(), slug: text("slug").notNull().unique(), name: text("name").notNull(), domain: text("domain").notNull(), description: text("description"), ...timestamps,
});
export const competencyRubrics = sqliteTable("competency_rubrics", {
  id: text("id").primaryKey(), competencyId: text("competency_id").notNull().references(() => competencies.id), level: integer("level").notNull(), descriptor: text("descriptor").notNull(),
}, (table) => [uniqueIndex("competency_rubric_unique").on(table.competencyId, table.level)]);
export const competencyCourseTags = sqliteTable("competency_course_tags", {
  competencyId: text("competency_id").notNull().references(() => competencies.id), tag: text("tag").notNull(),
}, (table) => [uniqueIndex("competency_course_tag_unique").on(table.competencyId, table.tag)]);
export const competencyMatrices = sqliteTable("competency_matrices", {
  id: text("id").primaryKey(), jobRoleId: text("job_role_id").notNull().references(() => jobRoles.id), name: text("name").notNull(), ...timestamps,
});
export const matrixVersions = sqliteTable("matrix_versions", {
  id: text("id").primaryKey(), matrixId: text("matrix_id").notNull().references(() => competencyMatrices.id), version: integer("version").notNull(), status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"), publishedAt: text("published_at"), createdBy: text("created_by").references(() => administrators.id), ...timestamps,
}, (table) => [uniqueIndex("matrix_version_unique").on(table.matrixId, table.version)]);
export const matrixCompetencies = sqliteTable("matrix_competencies", {
  id: text("id").primaryKey(), matrixVersionId: text("matrix_version_id").notNull().references(() => matrixVersions.id), competencyId: text("competency_id").notNull().references(() => competencies.id), requiredLevel: real("required_level").notNull(), importance: real("importance").notNull(), ...timestamps,
}, (table) => [uniqueIndex("matrix_competency_unique").on(table.matrixVersionId, table.competencyId)]);
export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(), competencyId: text("competency_id").notNull().references(() => competencies.id), kind: text("kind").notNull(), prompt: text("prompt").notNull(), optionsJson: text("options_json"), answerKeyJson: text("answer_key_json"), rubricJson: text("rubric_json"), active: integer("active", { mode: "boolean" }).notNull().default(true), ...timestamps,
});
export const assessments = sqliteTable("assessments", {
  id: text("id").primaryKey(), officialId: text("official_id").notNull().references(() => officials.id), matrixVersionId: text("matrix_version_id").notNull().references(() => matrixVersions.id), status: text("status").notNull().default("active"), startedAt: text("started_at").notNull().default("CURRENT_TIMESTAMP"), completedAt: text("completed_at"), ...timestamps,
});
export const assessmentRounds = sqliteTable("assessment_rounds", {
  id: text("id").primaryKey(), assessmentId: text("assessment_id").notNull().references(() => assessments.id), roundNumber: integer("round_number").notNull(), kind: text("kind").notNull(), status: text("status").notNull().default("pending"), ...timestamps,
}, (table) => [uniqueIndex("assessment_round_unique").on(table.assessmentId, table.roundNumber)]);
export const responses = sqliteTable("responses", {
  id: text("id").primaryKey(), roundId: text("round_id").notNull().references(() => assessmentRounds.id), questionId: text("question_id").references(() => questions.id), promptSnapshot: text("prompt_snapshot").notNull(), responseJson: text("response_json").notNull(), submittedAt: text("submitted_at").notNull().default("CURRENT_TIMESTAMP"), ...timestamps,
});
export const evidence = sqliteTable("evidence", {
  id: text("id").primaryKey(), assessmentId: text("assessment_id").notNull().references(() => assessments.id), competencyId: text("competency_id").notNull().references(() => competencies.id), sourceType: text("source_type").notNull(), level: real("level").notNull(), reliability: real("reliability").notNull(), rationale: text("rationale"), ...timestamps,
});
export const assessmentResults = sqliteTable("assessment_results", {
  id: text("id").primaryKey(), assessmentId: text("assessment_id").notNull().references(() => assessments.id), competencyId: text("competency_id").notNull().references(() => competencies.id), assessedLevel: real("assessed_level").notNull(), requiredLevel: real("required_level").notNull(), gap: real("gap").notNull(), priority: real("priority").notNull(), confidence: real("confidence").notNull(), supported: integer("supported", { mode: "boolean" }).notNull(), ...timestamps,
}, (table) => [uniqueIndex("assessment_result_unique").on(table.assessmentId, table.competencyId)]);
export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(), source: text("source").notNull(), sourceUrl: text("source_url").notNull(), title: text("title").notNull(), provider: text("provider"), duration: text("duration"), level: text("level"), rating: real("rating"), thumbnailUrl: text("thumbnail_url"), detailAvailable: integer("detail_available", { mode: "boolean" }).notNull(), incompleteSource: integer("incomplete_source", { mode: "boolean" }).notNull().default(true), searchTermsJson: text("search_terms_json").notNull(), domainsJson: text("domains_json").notNull(), detailJson: text("detail_json"), provenanceJson: text("provenance_json").notNull(), ...timestamps,
});
export const courseCompetencies = sqliteTable("course_competencies", {
  courseId: text("course_id").notNull().references(() => courses.id), competencyId: text("competency_id").notNull().references(() => competencies.id), evidenceType: text("evidence_type").notNull(), relevance: real("relevance").notNull().default(0),
}, (table) => [uniqueIndex("course_competency_unique").on(table.courseId, table.competencyId)]);
export const recommendations = sqliteTable("recommendations", {
  id: text("id").primaryKey(), assessmentId: text("assessment_id").notNull().references(() => assessments.id), competencyId: text("competency_id").notNull().references(() => competencies.id), courseId: text("course_id").notNull().references(() => courses.id), rank: integer("rank").notNull(), rationale: text("rationale").notNull(), ...timestamps,
});
export const courseCompletions = sqliteTable("course_completions", {
  id: text("id").primaryKey(), officialId: text("official_id").notNull().references(() => officials.id), courseId: text("course_id").notNull().references(() => courses.id), completedAt: text("completed_at").notNull(), verifiedAssessmentLevel: real("verified_assessment_level"), ...timestamps,
});
export const learningHistory = sqliteTable("learning_history", {
  id: text("id").primaryKey(), officialId: text("official_id").notNull().references(() => officials.id), competencyId: text("competency_id").notNull().references(() => competencies.id), sourceType: text("source_type").notNull(), sourceId: text("source_id").notNull(), level: real("level").notNull(), reliability: real("reliability").notNull(), recordedAt: text("recorded_at").notNull().default("CURRENT_TIMESTAMP"), ...timestamps,
});
