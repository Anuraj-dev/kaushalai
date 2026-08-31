import type { KaushalDatabase } from "@/db/client";
import { getDatabase } from "@/db/client";
import { SqliteRoleMatrixRepository } from "./repositories";

export interface AdminRoleSummary { roleId: string; roleName: string; matrixId: string; versionId: string; version: number; status: string; competencyCount: number; coveredCompetencies: number; affectedOfficials: number }
export interface AdminMatrixCompetency { id: string; name: string; domain: string; requiredLevel: number; importance: number; rubricLevels: number; courseTags: string[]; baselineQuestions: number; fallbackQuestions: number }
export interface AdminMatrixDetail { roleId: string; roleName: string; versionId: string; version: number; status: string; publishedAt: string | null; competencies: AdminMatrixCompetency[]; availableCompetencies: Array<{ id: string; name: string; domain: string }> }
export interface AdminOfficialSummary { id: string; employeeCode: string; name: string; roleName: string; assessmentStatus: string | null; reassessmentEligible: boolean; assignedCourses: number; completedCourses: number }
export interface AdminAnalytics { officials: number; completedAssessments: number; readinessPercent: number; assessmentCoveragePercent: number; courseAssignments: number; courseCompletions: number; supportedGapsByDomain: Array<{ domain: string; gaps: number }> }
export interface MatrixInput { competencyId: string; requiredLevel: number; importance: number }

type Row = Record<string, unknown>;
const number = (value: unknown) => Number(value ?? 0);

export class AdminRepository {
  constructor(private readonly database: KaushalDatabase = getDatabase(), private readonly matrices = new SqliteRoleMatrixRepository(database)) {}

  listRoles(): AdminRoleSummary[] {
    return (this.database.prepare(`SELECT r.id role_id,r.name role_name,m.id matrix_id,v.id version_id,v.version,v.status,
      COUNT(DISTINCT mc.competency_id) competency_count,
      COUNT(DISTINCT CASE WHEN (SELECT COUNT(*) FROM competency_rubrics cr WHERE cr.competency_id=mc.competency_id)=5
        AND EXISTS(SELECT 1 FROM competency_course_tags ct WHERE ct.competency_id=mc.competency_id)
        AND EXISTS(SELECT 1 FROM questions q WHERE q.competency_id=mc.competency_id AND q.kind='baseline_single_choice')
        AND (SELECT COUNT(*) FROM questions q WHERE q.competency_id=mc.competency_id AND q.kind='adaptive_fallback')>=3 THEN mc.competency_id END) covered,
      (SELECT COUNT(*) FROM officials o WHERE o.job_role_id=r.id) affected
      FROM job_roles r JOIN competency_matrices m ON m.job_role_id=r.id
      JOIN matrix_versions v ON v.id=(SELECT id FROM matrix_versions WHERE matrix_id=m.id ORDER BY version DESC LIMIT 1)
      LEFT JOIN matrix_competencies mc ON mc.matrix_version_id=v.id GROUP BY r.id,m.id,v.id ORDER BY r.name`).all() as Row[]).map((row) => ({ roleId: String(row.role_id), roleName: String(row.role_name), matrixId: String(row.matrix_id), versionId: String(row.version_id), version: number(row.version), status: String(row.status), competencyCount: number(row.competency_count), coveredCompetencies: number(row.covered), affectedOfficials: number(row.affected) }));
  }

  getMatrix(roleId: string, versionId?: string): AdminMatrixDetail | null {
    const version = this.database.prepare(`SELECT r.id role_id,r.name role_name,v.id version_id,v.version,v.status,v.published_at FROM job_roles r JOIN competency_matrices m ON m.job_role_id=r.id JOIN matrix_versions v ON v.matrix_id=m.id WHERE r.id=? ${versionId ? "AND v.id=?" : "ORDER BY v.version DESC LIMIT 1"}`).get(...(versionId ? [roleId, versionId] : [roleId])) as Row | undefined;
    if (!version) return null;
    const selected = this.database.prepare(`SELECT c.id,c.name,c.domain,mc.required_level,mc.importance,
      (SELECT COUNT(*) FROM competency_rubrics WHERE competency_id=c.id) rubric_levels,
      (SELECT json_group_array(tag) FROM competency_course_tags WHERE competency_id=c.id) course_tags,
      (SELECT COUNT(*) FROM questions WHERE competency_id=c.id AND kind='baseline_single_choice') baseline,
      (SELECT COUNT(*) FROM questions WHERE competency_id=c.id AND kind='adaptive_fallback') fallback
      FROM matrix_competencies mc JOIN competencies c ON c.id=mc.competency_id WHERE mc.matrix_version_id=? ORDER BY c.domain,c.name`).all(version.version_id) as Row[];
    const available = this.database.prepare("SELECT id,name,domain FROM competencies ORDER BY domain,name").all() as Row[];
    return { roleId: String(version.role_id), roleName: String(version.role_name), versionId: String(version.version_id), version: number(version.version), status: String(version.status), publishedAt: version.published_at ? String(version.published_at) : null,
      competencies: selected.map((row) => ({ id: String(row.id), name: String(row.name), domain: String(row.domain), requiredLevel: number(row.required_level), importance: number(row.importance), rubricLevels: number(row.rubric_levels), courseTags: JSON.parse(String(row.course_tags ?? "[]")) as string[], baselineQuestions: number(row.baseline), fallbackQuestions: number(row.fallback) })),
      availableCompetencies: available.map((row) => ({ id: String(row.id), name: String(row.name), domain: String(row.domain) })) };
  }

  createDraft(roleId: string): AdminMatrixDetail {
    const existing = this.getMatrix(roleId);
    if (!existing) throw new Error("Role matrix not found");
    if (existing.status === "draft") return existing;
    let draftId = "";
    this.database.transaction(() => {
      const matrix = this.database.prepare("SELECT id FROM competency_matrices WHERE job_role_id=?").get(roleId) as { id: string };
      const next = number((this.database.prepare("SELECT MAX(version)+1 next FROM matrix_versions WHERE matrix_id=?").get(matrix.id) as Row).next);
      draftId = `${matrix.id}-v${next}`;
      this.database.prepare("INSERT INTO matrix_versions(id,matrix_id,version,status,created_by) VALUES (?,?,?,'draft','admin-001')").run(draftId, matrix.id, next);
      this.database.prepare(`INSERT INTO matrix_competencies(id,matrix_version_id,competency_id,required_level,importance)
        SELECT ? || '-' || c.slug,?,mc.competency_id,mc.required_level,mc.importance FROM matrix_competencies mc JOIN competencies c ON c.id=mc.competency_id WHERE mc.matrix_version_id=?`).run(draftId, draftId, existing.versionId);
    })();
    return this.getMatrix(roleId, draftId)!;
  }

  saveDraft(versionId: string, entries: MatrixInput[]): AdminMatrixDetail {
    const duplicateIds = entries.map(({ competencyId }) => competencyId);
    if (new Set(duplicateIds).size !== duplicateIds.length) throw new Error("Duplicate competencies are not allowed");
    if (entries.length < 6 || entries.length > 8) throw new Error("A matrix must contain 6 to 8 competencies");
    if (entries.some(({ requiredLevel, importance }) => !Number.isInteger(requiredLevel) || requiredLevel < 1 || requiredLevel > 5 || !Number.isInteger(importance) || importance < 1 || importance > 3)) throw new Error("Required level must be 1 to 5 and importance must be 1 to 3");
    const version = this.database.prepare("SELECT v.status,m.job_role_id FROM matrix_versions v JOIN competency_matrices m ON m.id=v.matrix_id WHERE v.id=?").get(versionId) as { status: string; job_role_id: string } | undefined;
    if (!version || version.status !== "draft") throw new Error("Only draft matrix versions can be edited");
    this.database.transaction(() => {
      this.database.prepare("DELETE FROM matrix_competencies WHERE matrix_version_id=?").run(versionId);
      const insert = this.database.prepare("INSERT INTO matrix_competencies(id,matrix_version_id,competency_id,required_level,importance) SELECT ? || '-' || slug,?,?,?,? FROM competencies WHERE id=?");
      for (const entry of entries) { const result = insert.run(versionId, versionId, entry.competencyId, entry.requiredLevel, entry.importance, entry.competencyId); if (result.changes !== 1) throw new Error(`Unknown competency ${entry.competencyId}`); }
    })();
    return this.getMatrix(version.job_role_id, versionId)!;
  }

  async publish(versionId: string): Promise<AdminMatrixDetail> {
    const row = this.database.prepare("SELECT m.job_role_id FROM matrix_versions v JOIN competency_matrices m ON m.id=v.matrix_id WHERE v.id=? AND v.status='draft'").get(versionId) as { job_role_id: string } | undefined;
    if (!row) throw new Error("Only a draft can be published");
    const detail = this.getMatrix(row.job_role_id, versionId)!;
    if (detail.competencies.length < 6 || detail.competencies.length > 8) throw new Error("A matrix must contain 6 to 8 competencies");
    const invalid = detail.competencies.find((item) => item.rubricLevels !== 5 || item.courseTags.length === 0 || item.baselineQuestions < 1 || item.fallbackQuestions < 3);
    if (invalid) throw new Error(`${invalid.name} lacks rubric, course tags, baseline question, or fallback coverage`);
    await this.matrices.publish(versionId);
    return this.getMatrix(row.job_role_id, versionId)!;
  }

  async listOfficials(): Promise<AdminOfficialSummary[]> {
    const rows = this.database.prepare(`SELECT o.id,o.employee_code,o.name,r.name role_name,
      (SELECT status FROM assessments WHERE official_id=o.id ORDER BY started_at DESC,rowid DESC LIMIT 1) assessment_status,
      (SELECT COUNT(*) FROM recommendations rec JOIN assessments a ON a.id=rec.assessment_id WHERE a.official_id=o.id) assignments,
      (SELECT COUNT(*) FROM course_completions cc WHERE cc.official_id=o.id) completions FROM officials o JOIN job_roles r ON r.id=o.job_role_id ORDER BY o.employee_code`).all() as Row[];
    return Promise.all(rows.map(async (row) => ({ id: String(row.id), employeeCode: String(row.employee_code), name: String(row.name), roleName: String(row.role_name), assessmentStatus: row.assessment_status ? String(row.assessment_status) : null, reassessmentEligible: await this.matrices.isReassessmentEligible(String(row.id)), assignedCourses: number(row.assignments), completedCourses: number(row.completions) })));
  }

  analytics(): AdminAnalytics {
    const totals = this.database.prepare(`SELECT
      (SELECT COUNT(*) FROM officials) officials,
      (SELECT COUNT(*) FROM assessments WHERE status='completed') completed,
      (SELECT COUNT(*) FROM recommendations) assignments,
      (SELECT COUNT(*) FROM course_completions) completions,
      (SELECT COUNT(*) FROM assessment_results WHERE supported=1 AND assessed_level>=required_level) ready,
      (SELECT COUNT(*) FROM assessment_results) results,
      (SELECT COUNT(*) FROM assessment_results WHERE supported=1) supported`).get() as Row;
    const resultCount = number(totals.results);
    const gaps = this.database.prepare("SELECT c.domain,COUNT(*) gaps FROM assessment_results ar JOIN competencies c ON c.id=ar.competency_id WHERE ar.supported=1 AND ar.gap>0 GROUP BY c.domain ORDER BY c.domain").all() as Row[];
    // M5: readinessPercent here is org-level pass rate (supported results where assessed_level >= required_level / total results),
    // diverging from domain/assessment/scoring.ts:145 weighted readiness (attainment * importance / importanceTotal) which is per-assessment learner readiness.
    // Intentionally separate metric: org pass rate vs learner readiness. No logic change.
    return { officials: number(totals.officials), completedAssessments: number(totals.completed), readinessPercent: resultCount ? Math.round(number(totals.ready) / resultCount * 100) : 0, assessmentCoveragePercent: resultCount ? Math.round(number(totals.supported) / resultCount * 100) : 0, courseAssignments: number(totals.assignments), courseCompletions: number(totals.completions), supportedGapsByDomain: gaps.map((row) => ({ domain: String(row.domain), gaps: number(row.gaps) })) };
  }
}
