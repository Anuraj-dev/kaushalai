import type { KaushalDatabase } from "@/db/client";
import { COMPETENCY_LIBRARY, ROLE_MATRICES, validateCompetencySeeds } from "./competency-library";

export const SEEDED_ROLES = [
  "Statistical Investigator / Junior Statistical Officer", "Senior Statistical Officer", "Survey Design and Field Operations Officer", "Household Survey Data Analyst", "Industrial Statistics Analyst", "Statistical Data Quality Officer", "Statistical Data Dissemination and Open Data Officer", "Geospatial Statistics Analyst", "Statistical Data Systems Officer", "AI and Data Science Officer",
] as const;

const names = ["Aarav Sharma", "Meera Nair", "Kabir Singh", "Ananya Iyer", "Rohan Das", "Ishita Rao", "Vikram Joshi", "Sana Khan", "Dev Patel", "Nisha Verma"];

function slug(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

export function seedFoundation(database: KaushalDatabase): void {
  const role = database.prepare("INSERT OR IGNORE INTO job_roles(id,name,description) VALUES (?,?,?)");
  const official = database.prepare("INSERT OR IGNORE INTO officials(id,employee_code,name,email,job_role_id,is_demo_selectable) VALUES (?,?,?,?,?,?)");
  const matrix = database.prepare("INSERT OR IGNORE INTO competency_matrices(id,job_role_id,name) VALUES (?,?,?)");
  const version = database.prepare("INSERT OR IGNORE INTO matrix_versions(id,matrix_id,version,status,published_at,created_by) VALUES (?,?,1,'draft',NULL,?)");
  database.transaction(() => {
    database.prepare("INSERT OR IGNORE INTO administrators(id,name,email) VALUES ('admin-001','Dr. Priya Menon','admin@kaushal.gov.in')").run();
    SEEDED_ROLES.forEach((name, index) => {
      const roleId = `role-${String(index + 1).padStart(2, "0")}`;
      const matrixId = `matrix-${String(index + 1).padStart(2, "0")}`;
      role.run(roleId, name, `Official Statistics role: ${name}`);
      official.run(`official-${String(index + 1).padStart(2, "0")}`, `MOSPI-${String(index + 1).padStart(4, "0")}`, names[index], `${slug(names[index])}@mospi.gov.in`, roleId, index < 3 ? 1 : 0);
      matrix.run(matrixId, roleId, `${name} competency matrix`);
      version.run(`${matrixId}-v1`, matrixId, "admin-001");
    });
  })();
  seedCompetencyLibrary(database);
}

const OPERATIONAL_COHORT = [
  { officialId: "official-04", completedAt: "2026-06-18 11:30:00", supportedThrough: 6, completions: 2 },
  { officialId: "official-05", completedAt: "2026-07-04 15:10:00", supportedThrough: 5, completions: 2 },
  { officialId: "official-06", completedAt: "2026-07-22 10:45:00", supportedThrough: 7, completions: 2 },
  { officialId: "official-07", completedAt: "2026-08-12 16:20:00", supportedThrough: 5, completions: 1 },
] as const;

/** Seeds a small, traceable organization history after the iGOT catalog is available. */
export function seedOperationalData(database: KaushalDatabase): void {
  const courseCount = (database.prepare("SELECT COUNT(*) count FROM courses").get() as { count: number }).count;
  if (courseCount === 0) throw new Error("Import the course catalog before seeding operational data");

  const insertAssessment = database.prepare(`INSERT OR IGNORE INTO assessments
    (id,official_id,matrix_version_id,status,started_at,completed_at) VALUES (?,?,?,'completed',datetime(?,'-2 days'),?)`);
  const insertResult = database.prepare(`INSERT OR IGNORE INTO assessment_results
    (id,assessment_id,competency_id,assessed_level,required_level,gap,priority,confidence,supported) VALUES (?,?,?,?,?,?,?,?,?)`);
  const insertRecommendation = database.prepare(`INSERT OR IGNORE INTO recommendations
    (id,assessment_id,competency_id,course_id,rank,rationale,created_at) VALUES (?,?,?,?,?,?,?)`);
  const insertCompletion = database.prepare(`INSERT OR IGNORE INTO course_completions
    (id,official_id,course_id,completed_at,verified_assessment_level) VALUES (?,?,?,?,?)`);

  database.transaction(() => {
    for (const cohort of OPERATIONAL_COHORT) {
      const official = database.prepare(`SELECT o.job_role_id,v.id matrix_version_id
        FROM officials o JOIN competency_matrices m ON m.job_role_id=o.job_role_id
        JOIN matrix_versions v ON v.matrix_id=m.id AND v.status='published'
        WHERE o.id=? ORDER BY v.version DESC LIMIT 1`).get(cohort.officialId) as { job_role_id: string; matrix_version_id: string } | undefined;
      if (!official) throw new Error(`Missing published role matrix for ${cohort.officialId}`);

      const assessmentId = `seed-assessment-${cohort.officialId}`;
      insertAssessment.run(assessmentId, cohort.officialId, official.matrix_version_id, cohort.completedAt, cohort.completedAt);
      const requirements = database.prepare(`SELECT mc.competency_id,mc.required_level,mc.importance
        FROM matrix_competencies mc WHERE mc.matrix_version_id=? ORDER BY mc.competency_id`).all(official.matrix_version_id) as Array<{ competency_id: string; required_level: number; importance: number }>;

      requirements.forEach((requirement, index) => {
        const supported = index < cohort.supportedThrough;
        const adjustment = index < 2 ? -1 : 0;
        const assessedLevel = Math.max(1, Math.min(5, requirement.required_level + adjustment));
        const gap = Math.max(0, requirement.required_level - assessedLevel);
        insertResult.run(`seed-result-${cohort.officialId}-${requirement.competency_id}`, assessmentId, requirement.competency_id,
          assessedLevel, requirement.required_level, gap, gap * requirement.importance, supported ? 0.82 : 0.61, supported ? 1 : 0);
      });

      const gaps = database.prepare(`SELECT competency_id,priority FROM assessment_results
        WHERE assessment_id=? AND gap>0 ORDER BY supported DESC,priority DESC,competency_id`).all(assessmentId) as Array<{ competency_id: string; priority: number }>;
      Array.from({ length: 3 }, (_, index) => ({ gap: gaps[index % gaps.length], index })).forEach(({ gap, index }) => {
        const course = database.prepare(`SELECT c.id FROM courses c
          LEFT JOIN course_competencies cc ON cc.course_id=c.id AND cc.competency_id=?
          ORDER BY (cc.competency_id IS NOT NULL) DESC,c.detail_available DESC,c.title LIMIT 1 OFFSET ?`).get(gap.competency_id, index) as { id: string };
        const recommendationId = `seed-recommendation-${cohort.officialId}-${index + 1}`;
        insertRecommendation.run(recommendationId, assessmentId, gap.competency_id, course.id, index + 1,
          `Assigned from the official's supported ${gap.competency_id.replace("competency-", "").replaceAll("-", " ")} gap.`, cohort.completedAt);
        if (index < cohort.completions) {
          insertCompletion.run(`seed-completion-${cohort.officialId}-${index + 1}`, cohort.officialId, course.id,
            cohort.completedAt, Math.min(5, 2 + index));
        }
      });
    }
  })();
}

export function seedCompetencyLibrary(database: KaushalDatabase): void {
  validateCompetencySeeds();
  const competency = database.prepare("INSERT OR IGNORE INTO competencies(id,slug,name,domain,description) VALUES (?,?,?,?,?)");
  const rubric = database.prepare("INSERT OR IGNORE INTO competency_rubrics(id,competency_id,level,descriptor) VALUES (?,?,?,?)");
  const tag = database.prepare("INSERT OR IGNORE INTO competency_course_tags(competency_id,tag) VALUES (?,?)");
  const question = database.prepare("INSERT OR IGNORE INTO questions(id,competency_id,kind,prompt,options_json,answer_key_json,rubric_json) VALUES (?,?,?,?,?,?,?)");
  const matrixItem = database.prepare("INSERT INTO matrix_competencies(id,matrix_version_id,competency_id,required_level,importance) VALUES (?,?,?,?,?)");
  database.transaction(() => {
    for (const definition of COMPETENCY_LIBRARY) {
      competency.run(definition.id, definition.slug, definition.name, definition.domain, `Demonstrated capability in ${definition.name.toLowerCase()} for Official Statistics work.`);
      for (const entry of definition.rubric) rubric.run(`${definition.id}-level-${entry.level}`, definition.id, entry.level, entry.descriptor);
      for (const courseTag of definition.courseTags) tag.run(definition.id, courseTag);
      question.run(`${definition.id}-baseline`, definition.id, "baseline_single_choice", definition.baseline.prompt, JSON.stringify(definition.baseline.choices), JSON.stringify(Object.fromEntries(definition.baseline.choices.map((choice, index) => [String(index), choice.demonstratedLevel]))), JSON.stringify(definition.rubric));
      definition.fallbackQuestions.forEach((prompt, index) => question.run(`${definition.id}-fallback-${index + 1}`, definition.id, "adaptive_fallback", prompt, null, null, JSON.stringify(definition.rubric)));
    }
    for (const roleMatrix of ROLE_MATRICES) {
      const role = database.prepare("SELECT id FROM job_roles WHERE name=?").get(roleMatrix.role) as { id: string } | undefined;
      if (!role) throw new Error(`Missing seeded role ${roleMatrix.role}`);
      const version = database.prepare("SELECT v.id,v.status FROM matrix_versions v JOIN competency_matrices m ON m.id=v.matrix_id WHERE m.job_role_id=? AND v.version=1").get(role.id) as { id: string; status: string } | undefined;
      if (!version) throw new Error(`Missing matrix v1 for ${roleMatrix.role}`);
      if (version.status === "published") continue;
      for (const entry of roleMatrix.competencies) {
        const definition = COMPETENCY_LIBRARY.find(({ name }) => name === entry.competency)!;
        matrixItem.run(`${version.id}-${definition.slug}`, version.id, definition.id, entry.requiredLevel, entry.importance);
      }
      const count = (database.prepare("SELECT COUNT(*) count FROM matrix_competencies WHERE matrix_version_id=?").get(version.id) as { count: number }).count;
      if (count < 6 || count > 8) throw new Error(`Matrix ${roleMatrix.role} has ${count} competencies; expected 6-8`);
      database.prepare("UPDATE matrix_versions SET status='published',published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='draft'").run(version.id);
    }
  })();
}
