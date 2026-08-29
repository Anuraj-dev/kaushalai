import { randomUUID } from "node:crypto";
import type { KaushalDatabase } from "@/db/client";
import { getDatabase } from "@/db/client";
import type { AssessmentRepository, CourseCatalogProvider, CourseSummary, MatrixVersionSummary, OfficialProfile, OfficialProfileProvider, PersistedAssessment, RoleMatrixRepository } from "./contracts";

type SqlRow = Record<string, unknown>;
const bool = (value: unknown) => value === 1;
const assessment = (row: SqlRow): PersistedAssessment => ({ id: String(row.id), officialId: String(row.official_id), matrixVersionId: String(row.matrix_version_id), status: String(row.status), startedAt: String(row.started_at), completedAt: row.completed_at ? String(row.completed_at) : null });
const matrixVersion = (row: SqlRow): MatrixVersionSummary => ({ id: String(row.id), matrixId: String(row.matrix_id), jobRoleId: String(row.job_role_id), version: Number(row.version), status: row.status as MatrixVersionSummary["status"], publishedAt: row.published_at ? String(row.published_at) : null });

export class SqliteOfficialProfileProvider implements OfficialProfileProvider {
  constructor(private readonly database: KaushalDatabase = getDatabase()) {}
  async list(selectableOnly = false): Promise<OfficialProfile[]> {
    const where = selectableOnly ? "WHERE o.is_demo_selectable = 1" : "";
    return (this.database.prepare(`SELECT o.*, r.name job_role_name FROM officials o JOIN job_roles r ON r.id=o.job_role_id ${where} ORDER BY o.employee_code`).all() as SqlRow[]).map(this.map);
  }
  async get(id: string): Promise<OfficialProfile | null> { const row = this.database.prepare("SELECT o.*, r.name job_role_name FROM officials o JOIN job_roles r ON r.id=o.job_role_id WHERE o.id=?").get(id) as SqlRow | undefined; return row ? this.map(row) : null; }
  private map(row: SqlRow): OfficialProfile { return { id: String(row.id), employeeCode: String(row.employee_code), name: String(row.name), email: String(row.email), jobRoleId: String(row.job_role_id), jobRoleName: String(row.job_role_name), isDemoSelectable: bool(row.is_demo_selectable) }; }
}

export class SqliteCourseCatalogProvider implements CourseCatalogProvider {
  constructor(private readonly database: KaushalDatabase = getDatabase()) {}
  async list(input: { search?: string; limit?: number; offset?: number } = {}): Promise<CourseSummary[]> {
    const limit = Math.min(Math.max(input.limit ?? 50, 1), 222), offset = Math.max(input.offset ?? 0, 0);
    const search = input.search?.trim();
    const rows = search ? this.database.prepare("SELECT * FROM courses WHERE title LIKE ? OR search_terms_json LIKE ? ORDER BY title LIMIT ? OFFSET ?").all(`%${search}%`, `%${search}%`, limit, offset) : this.database.prepare("SELECT * FROM courses ORDER BY title LIMIT ? OFFSET ?").all(limit, offset);
    return (rows as SqlRow[]).map(this.map);
  }
  async get(id: string): Promise<CourseSummary | null> { const row = this.database.prepare("SELECT * FROM courses WHERE id=?").get(id) as SqlRow | undefined; return row ? this.map(row) : null; }
  private map(row: SqlRow): CourseSummary { return { id: String(row.id), title: String(row.title), provider: row.provider ? String(row.provider) : null, level: row.level ? String(row.level) : null, detailAvailable: bool(row.detail_available), incompleteSource: bool(row.incomplete_source), searchTerms: JSON.parse(String(row.search_terms_json)) as string[] }; }
}

export class SqliteRoleMatrixRepository implements RoleMatrixRepository {
  constructor(private readonly database: KaushalDatabase = getDatabase()) {}
  async currentPublished(jobRoleId: string): Promise<MatrixVersionSummary | null> { const row = this.database.prepare("SELECT v.*,m.job_role_id FROM matrix_versions v JOIN competency_matrices m ON m.id=v.matrix_id WHERE m.job_role_id=? AND v.status='published' ORDER BY v.version DESC LIMIT 1").get(jobRoleId) as SqlRow | undefined; return row ? matrixVersion(row) : null; }
  async createDraft(jobRoleId: string): Promise<MatrixVersionSummary> {
    const matrix = this.database.prepare("SELECT id FROM competency_matrices WHERE job_role_id=?").get(jobRoleId) as { id: string } | undefined;
    if (!matrix) throw new Error(`No matrix for job role ${jobRoleId}`);
    const next = (this.database.prepare("SELECT COALESCE(MAX(version),0)+1 version FROM matrix_versions WHERE matrix_id=?").get(matrix.id) as { version: number }).version;
    const id = `${matrix.id}-v${next}`;
    this.database.prepare("INSERT INTO matrix_versions(id,matrix_id,version,status,created_by) VALUES (?,?,?,'draft','admin-001')").run(id, matrix.id, next);
    return { id, matrixId: matrix.id, jobRoleId, version: next, status: "draft", publishedAt: null };
  }
  async publish(versionId: string): Promise<MatrixVersionSummary> {
    this.database.prepare("UPDATE matrix_versions SET status='published',published_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='draft'").run(versionId);
    const row = this.database.prepare("SELECT v.*,m.job_role_id FROM matrix_versions v JOIN competency_matrices m ON m.id=v.matrix_id WHERE v.id=?").get(versionId) as SqlRow | undefined;
    if (!row || row.status !== "published") throw new Error("Only an existing draft matrix version can be published");
    return matrixVersion(row);
  }
  async isReassessmentEligible(officialId: string): Promise<boolean> {
    const row = this.database.prepare(`SELECT EXISTS(SELECT 1 FROM officials o JOIN competency_matrices m ON m.job_role_id=o.job_role_id JOIN matrix_versions current ON current.matrix_id=m.id AND current.status='published' JOIN assessments a ON a.official_id=o.id AND a.status='completed' JOIN matrix_versions assessed ON assessed.id=a.matrix_version_id WHERE o.id=? AND current.version>assessed.version) eligible`).get(officialId) as { eligible: number };
    return bool(row.eligible);
  }
}

export class SqliteAssessmentRepository implements AssessmentRepository {
  constructor(private readonly database: KaushalDatabase = getDatabase(), private readonly matrices = new SqliteRoleMatrixRepository(database)) {}
  async start(officialId: string): Promise<PersistedAssessment> {
    const official = this.database.prepare("SELECT job_role_id FROM officials WHERE id=?").get(officialId) as { job_role_id: string } | undefined;
    if (!official) throw new Error(`Unknown official ${officialId}`);
    const version = await this.matrices.currentPublished(official.job_role_id);
    if (!version) throw new Error(`No published matrix for job role ${official.job_role_id}`);
    const id = randomUUID();
    this.database.prepare("INSERT INTO assessments(id,official_id,matrix_version_id) VALUES (?,?,?)").run(id, officialId, version.id);
    return (await this.get(id))!;
  }
  async get(id: string): Promise<PersistedAssessment | null> { const row = this.database.prepare("SELECT * FROM assessments WHERE id=?").get(id) as SqlRow | undefined; return row ? assessment(row) : null; }
  async latestForOfficial(officialId: string): Promise<PersistedAssessment | null> { const row = this.database.prepare("SELECT * FROM assessments WHERE official_id=? ORDER BY started_at DESC,rowid DESC LIMIT 1").get(officialId) as SqlRow | undefined; return row ? assessment(row) : null; }
}

export function repositories(database: KaushalDatabase = getDatabase()) { return { officials: new SqliteOfficialProfileProvider(database), courses: new SqliteCourseCatalogProvider(database), matrices: new SqliteRoleMatrixRepository(database), assessments: new SqliteAssessmentRepository(database) }; }
