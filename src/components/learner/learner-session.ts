export type Official = { id: string; name: string; jobRoleName: string; employeeCode: string };
export type Question = { id: string; competencyId: string; competencyName: string; format: "single_choice" | "short_text"; prompt: string; options: Array<{ id: string; text: string }> };
export type Result = { competencyId: string; competencyName: string; assessedLevel: number; requiredLevel: number; gap: number; priority: number; confidence: number; supported: boolean; evidence: Array<{ reason: string; source: string }> };
export type Recommendation = { id: string; courseId: string; competencyId: string; title: string; provider: string | null; duration: string | null; sourceUrl: string; rank: number; rationale: string };
export type Session = {
  official: Official;
  matrix: { versionId: string; version: number; competencies: Array<{ competencyId: string; name: string; requiredLevel: number; importance: number }> };
  history: Array<{ id: string; competencyName: string; source: string; level: number; courseTitle: string | null; courseId: string | null }>;
  assessment: { id: string; status: string; currentRound: number | null; roundKind: string | null; questions: Question[]; provisional: boolean };
  results: Result[];
  recommendations: Recommendation[];
  reassessmentInvited: boolean;
  dashboard: { supportedCompetencies: number; totalCompetencies: number; openGaps: number; completedCourses: number };
};

export const storageKey = "kaushal-active-assessment";
export const officialStorageKey = "kaushal-active-official";
export const PLAN_PATH = "/learner/plan";
export const ROUNDS_PATH = "/learner";
export const LOGIN_PATH = "/learner/login";
export const PLAN_CRAFT_MS = 1600;

export const request = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Something went wrong");
  return body;
};

export function isAssessmentComplete(session: Session | null | undefined): boolean {
  const status = session?.assessment.status;
  return status === "completed" || status === "provisional";
}

export function persistSession(session: Session): void {
  window.localStorage.setItem(storageKey, session.assessment.id);
  window.localStorage.setItem(officialStorageKey, JSON.stringify({ name: session.official.name, role: session.official.jobRoleName }));
  window.dispatchEvent(new Event("kaushal-assessment-started"));
}

export function clearSession(): void {
  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(officialStorageKey);
  window.dispatchEvent(new Event("kaushal-assessment-started"));
}

export function waitForPlanCraft(): Promise<void> {
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return new Promise((resolve) => window.setTimeout(resolve, reduced ? 280 : PLAN_CRAFT_MS));
}
