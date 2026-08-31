import type { KaushalDatabase } from "./client";

type Row = Record<string, unknown>;

type AssessmentTable = "assessments" | "assessment_rounds" | "responses" | "evidence" | "assessment_results" | "recommendations";

export type AssessmentSnapshot = {
  assessmentId: string;
  officialId: string;
  tables: Record<AssessmentTable | "course_completions" | "learning_history", Row[]>;
};

export function captureAssessmentSnapshot(database: KaushalDatabase, assessmentId: string): AssessmentSnapshot | null {
  const assessment = database.prepare("SELECT * FROM assessments WHERE id=?").get(assessmentId) as Row | undefined;
  if (!assessment) return null;

  const roundIds = (database.prepare("SELECT id FROM assessment_rounds WHERE assessment_id=?").all(assessmentId) as Row[])
    .map((row) => String(row.id));
  const responses = roundIds.length === 0
    ? []
    : database.prepare(`SELECT * FROM responses WHERE round_id IN (${roundIds.map(() => "?").join(",")})`).all(...roundIds) as Row[];
  const officialId = String(assessment.official_id);

  return {
    assessmentId,
    officialId,
    tables: {
      assessments: [assessment],
      assessment_rounds: database.prepare("SELECT * FROM assessment_rounds WHERE assessment_id=? ORDER BY round_number").all(assessmentId) as Row[],
      responses,
      evidence: database.prepare("SELECT * FROM evidence WHERE assessment_id=? ORDER BY created_at,id").all(assessmentId) as Row[],
      assessment_results: database.prepare("SELECT * FROM assessment_results WHERE assessment_id=? ORDER BY competency_id").all(assessmentId) as Row[],
      recommendations: database.prepare("SELECT * FROM recommendations WHERE assessment_id=? ORDER BY rank,id").all(assessmentId) as Row[],
      course_completions: database.prepare("SELECT * FROM course_completions WHERE official_id=? ORDER BY completed_at,id").all(officialId) as Row[],
      learning_history: database.prepare("SELECT * FROM learning_history WHERE official_id=? ORDER BY recorded_at,id").all(officialId) as Row[],
    },
  };
}

function restoreRows(database: KaushalDatabase, table: string, rows: Row[]): void {
  for (const row of rows) {
    const columns = Object.keys(row);
    if (columns.length === 0) continue;
    const placeholders = columns.map(() => "?").join(",");
    database.prepare(`INSERT OR REPLACE INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`)
      .run(...columns.map((column) => row[column]));
  }
}

export function restoreAssessmentSnapshot(database: KaushalDatabase, snapshot: AssessmentSnapshot): void {
  database.transaction(() => {
    restoreRows(database, "assessments", snapshot.tables.assessments);
    restoreRows(database, "assessment_rounds", snapshot.tables.assessment_rounds);
    restoreRows(database, "responses", snapshot.tables.responses);
    restoreRows(database, "evidence", snapshot.tables.evidence);
    restoreRows(database, "assessment_results", snapshot.tables.assessment_results);
    restoreRows(database, "recommendations", snapshot.tables.recommendations);
    restoreRows(database, "course_completions", snapshot.tables.course_completions);
    restoreRows(database, "learning_history", snapshot.tables.learning_history);
  })();
}
