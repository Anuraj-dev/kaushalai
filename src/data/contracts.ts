export interface OfficialProfile { id: string; employeeCode: string; name: string; email: string; jobRoleId: string; jobRoleName: string; isDemoSelectable: boolean }
export interface OfficialProfileProvider { list(selectableOnly?: boolean): Promise<OfficialProfile[]>; get(id: string): Promise<OfficialProfile | null> }
export interface CourseSummary { id: string; title: string; provider: string | null; level: string | null; detailAvailable: boolean; incompleteSource: boolean; searchTerms: string[] }
export interface CourseCatalogProvider { list(input?: { search?: string; limit?: number; offset?: number }): Promise<CourseSummary[]>; get(id: string): Promise<CourseSummary | null> }
export interface MatrixVersionSummary { id: string; matrixId: string; jobRoleId: string; version: number; status: "draft" | "published" | "archived"; publishedAt: string | null }
export interface RoleMatrixRepository { currentPublished(jobRoleId: string): Promise<MatrixVersionSummary | null>; createDraft(jobRoleId: string): Promise<MatrixVersionSummary>; publish(versionId: string): Promise<MatrixVersionSummary>; isReassessmentEligible(officialId: string): Promise<boolean> }
export interface PersistedAssessment { id: string; officialId: string; matrixVersionId: string; status: string; startedAt: string; completedAt: string | null }
export interface AssessmentRepository { start(officialId: string): Promise<PersistedAssessment>; get(id: string): Promise<PersistedAssessment | null>; latestForOfficial(officialId: string): Promise<PersistedAssessment | null> }
