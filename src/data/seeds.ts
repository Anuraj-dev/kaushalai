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
