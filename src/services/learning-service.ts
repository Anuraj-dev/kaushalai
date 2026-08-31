import { randomUUID } from "node:crypto";
import type { KaushalDatabase } from "@/db/client";
import { getDatabase } from "@/db/client";
import { buildLearningPath, type CatalogCourse, type LearningPath, type PriorityGap } from "@/domain/recommendations";

type Row = Record<string, unknown>;
const parse = <T>(value: unknown, fallback: T): T => { try { return value ? JSON.parse(String(value)) as T : fallback; } catch { return fallback; } };

export class LearningService {
  constructor(private readonly database: KaushalDatabase = getDatabase(), private readonly id: () => string = randomUUID) {}

  createPath(assessmentId: string): LearningPath {
    const gaps = this.database.prepare(`SELECT r.competency_id,c.name,r.priority,t.tag FROM assessment_results r JOIN competencies c ON c.id=r.competency_id LEFT JOIN competency_course_tags t ON t.competency_id=c.id WHERE r.assessment_id=? AND r.supported=1 AND r.gap>0 ORDER BY r.priority DESC`).all(assessmentId) as Row[];
    const grouped = new Map<string, PriorityGap>();
    for (const row of gaps) {
      const competencyId = String(row.competency_id);
      const existing = grouped.get(competencyId) ?? { competencyId, competencyName: String(row.name), priority: Number(row.priority), tags: [] };
      if (row.tag) existing.tags.push(String(row.tag));
      grouped.set(competencyId, existing);
    }
    const rows = this.database.prepare("SELECT * FROM courses").all() as Row[];
    const courses: CatalogCourse[] = rows.map((row) => {
      const detail = parse<Record<string, unknown>>(row.detail_json, {});
      return {
        id: String(row.id), title: String(row.title), provider: row.provider ? String(row.provider) : null,
        detailAvailable: row.detail_available === 1, searchTerms: parse(row.search_terms_json, []),
        tags: Array.isArray(detail.tags) ? detail.tags.map(String) : [], description: typeof detail.description === "string" ? detail.description : "",
        learningOutcomes: Array.isArray(detail.learning_outcomes) ? detail.learning_outcomes.map(String) : [],
      };
    });
    const path = buildLearningPath([...grouped.values()], courses);
    this.database.transaction(() => {
      this.database.prepare("DELETE FROM recommendations WHERE assessment_id=?").run(assessmentId);
      const insert = this.database.prepare("INSERT INTO recommendations(id,assessment_id,competency_id,course_id,rank,rationale) VALUES (?,?,?,?,?,?)");
      for (const item of path.items) insert.run(this.id(), assessmentId, item.competencyId, item.courseId, item.rank, item.rationale);
    })();
    return path;
  }

  getPath(assessmentId: string) {
    return this.database.prepare(`SELECT r.*,c.title,c.provider,c.duration,c.level FROM recommendations r JOIN courses c ON c.id=r.course_id WHERE r.assessment_id=? ORDER BY r.rank`).all(assessmentId);
  }

  completeCourse(input: { officialId: string; courseId: string; competencyId: string; level?: number; verifiedAssessment?: boolean }) {
    if (input.level !== undefined && (!Number.isInteger(input.level) || input.level < 1 || input.level > 5)) throw new Error("Invalid level");
    const completionId = this.id();
    const reliability = input.verifiedAssessment ? 0.5 : 0.25;
    const sourceType = input.verifiedAssessment ? "verified-course-assessment" : "course-completion";
    const before = this.database
      .prepare(
        "SELECT assessed_level FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.official_id=? AND r.competency_id=? ORDER BY a.started_at DESC LIMIT 1",
      )
      .get(input.officialId, input.competencyId) as { assessed_level: number } | undefined;
    let isDuplicateHistory = false;
    let effectiveCompletionId = completionId;
    this.database.transaction(() => {
      const result = this.database
        .prepare(
          "INSERT OR IGNORE INTO course_completions(id,official_id,course_id,completed_at,verified_assessment_level) VALUES (?,?,?,CURRENT_TIMESTAMP,?)",
        )
        .run(completionId, input.officialId, input.courseId, input.verifiedAssessment ? input.level ?? 1 : null);
      if (result.changes === 0) {
        const existing = this.database.prepare("SELECT id FROM course_completions WHERE official_id=? AND course_id=?").get(input.officialId, input.courseId) as
          | { id: string }
          | undefined;
        if (existing) effectiveCompletionId = existing.id;
        const existingHistory = this.database
          .prepare("SELECT id FROM learning_history WHERE official_id=? AND source_id=? AND competency_id=?")
          .get(input.officialId, effectiveCompletionId, input.competencyId) as { id: string } | undefined;
        if (existingHistory) {
          isDuplicateHistory = true;
          return;
        }
        // Reuse existing completion for new competency gap (Codex P2)
        this.database
          .prepare("INSERT INTO learning_history(id,official_id,competency_id,source_type,source_id,level,reliability) VALUES (?,?,?,?,?,?,?)")
          .run(this.id(), input.officialId, input.competencyId, sourceType, effectiveCompletionId, input.level ?? 1, reliability);
        return;
      }
      this.database
        .prepare("INSERT INTO learning_history(id,official_id,competency_id,source_type,source_id,level,reliability) VALUES (?,?,?,?,?,?,?)")
        .run(this.id(), input.officialId, input.competencyId, sourceType, completionId, input.level ?? 1, reliability);
      this.database
        .prepare("INSERT INTO reassessment_invitations(id,official_id,reason,source_id) VALUES (?,?,?,?)")
        .run(this.id(), input.officialId, "course_completion", completionId);
    })();
    if (isDuplicateHistory) {
      return { completionId: effectiveCompletionId, reliability, reassessmentInvited: true, proficiencyChanged: false };
    }
    const after = this.database.prepare("SELECT assessed_level FROM assessment_results r JOIN assessments a ON a.id=r.assessment_id WHERE a.official_id=? AND r.competency_id=? ORDER BY a.started_at DESC LIMIT 1").get(input.officialId, input.competencyId) as { assessed_level: number } | undefined;
    return { completionId: effectiveCompletionId, reliability, reassessmentInvited: true, proficiencyChanged: before?.assessed_level !== after?.assessed_level };
  }
}
