import { z } from "zod";

import { createAiAssessmentService, createConfiguredProviderAdapters } from "@/ai";
import { getDatabase } from "@/db/client";
import { restoreAssessmentFromSnapshot } from "@/db/assessment-snapshot-store";
import { CatalogGuideService } from "@/services/catalog-guide-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  assessmentId: z.string().trim().min(1).max(64),
  question: z.string().trim().min(1).max(2000),
}).strict();

const fail = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return fail("Invalid request", 400);
    const { assessmentId, question } = parsed.data;
    const db = getDatabase();
    await restoreAssessmentFromSnapshot(db, assessmentId);
    const adapters = createConfiguredProviderAdapters();
    const ai = createAiAssessmentService({ ...adapters, logger: (event) => console.warn(JSON.stringify(event)) });
    // RAG + LLM: chat is last layer, no hardcoded early returns
    return Response.json(await new CatalogGuideService(db, (payload: Parameters<typeof ai.chat>[0]) => ai.chat(payload)).ask(assessmentId, question));
  } catch (error) {
    console.error("[learner/guide] error", error);
    const message = error instanceof Error ? error.message : "Unable to explain catalog guide";
    const status = typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : message === "Assessment not found" ? 404
        : message === "Question is required" || message === "Question is too long" ? 400
          : 500;
    return fail(status === 500 ? "Unable to explain catalog guide" : message, status);
  }
}
