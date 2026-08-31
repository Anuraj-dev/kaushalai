import { createClient, type Client } from "@libsql/client";
import type { KaushalDatabase } from "./client";
import {
  captureAssessmentSnapshot,
  restoreAssessmentSnapshot,
  type AssessmentSnapshot,
} from "./assessment-snapshot";

let client: Client | null | undefined;
let initialized: Promise<Client | null> | undefined;

async function snapshotClient(): Promise<Client | null> {
  if (client !== undefined) return client;
  if (initialized) return initialized;

  initialized = (async () => {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) {
      client = null;
      return null;
    }

    const remote = createClient({ url, authToken });
    await remote.execute(`CREATE TABLE IF NOT EXISTS assessment_snapshots (
      assessment_id TEXT PRIMARY KEY,
      official_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    client = remote;
    return remote;
  })();

  return initialized;
}

export async function persistAssessmentSnapshot(database: KaushalDatabase, assessmentId: string): Promise<void> {
  const remote = await snapshotClient();
  if (!remote) return;
  const snapshot = captureAssessmentSnapshot(database, assessmentId);
  if (!snapshot) return;

  await remote.execute({
    sql: `INSERT INTO assessment_snapshots(assessment_id,official_id,payload_json,updated_at)
      VALUES (?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(assessment_id) DO UPDATE SET
        official_id=excluded.official_id,
        payload_json=excluded.payload_json,
        updated_at=CURRENT_TIMESTAMP`,
    args: [assessmentId, snapshot.officialId, JSON.stringify(snapshot)],
  });
}

export async function restoreAssessmentFromSnapshot(database: KaushalDatabase, assessmentId: string): Promise<boolean> {
  const remote = await snapshotClient();
  if (!remote) return Boolean(database.prepare("SELECT 1 FROM assessments WHERE id=?").get(assessmentId));
  const result = await remote.execute({
    sql: "SELECT payload_json FROM assessment_snapshots WHERE assessment_id=?",
    args: [assessmentId],
  });
  const payload = result.rows[0]?.payload_json;
  if (typeof payload !== "string") return Boolean(database.prepare("SELECT 1 FROM assessments WHERE id=?").get(assessmentId));
  restoreAssessmentSnapshot(database, JSON.parse(payload) as AssessmentSnapshot);
  return true;
}
