import { z } from "zod";
import { getDatabase } from "@/db/client";
import { persistAssessmentSnapshot } from "@/db/assessment-snapshot-store";
import { QuizError, QuizService } from "@/services/quiz-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const officialId = z.string().trim().min(1).max(64);
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), officialId }),
  z.object({ action: z.literal("answer"), officialId, attemptId: z.string().min(1).max(64), questionId: z.string().min(1).max(64), selectedIndex: z.number().int() }),
  z.object({ action: z.literal("finish"), officialId, attemptId: z.string().min(1).max(64) }),
  z.object({ action: z.literal("start-check"), officialId, attemptId: z.string().min(1).max(64) }),
  z.object({
    action: z.literal("submit-check"), officialId, checkId: z.string().min(1).max(64),
    answers: z.array(z.object({ questionId: z.string().min(1).max(200), value: z.string().trim().min(1).max(2000) })).min(1).max(5),
  }),
]);

function failure(error: unknown) {
  if (error instanceof QuizError) return Response.json({ error: error.message }, { status: error.status });
  console.error("[learner/quizzes] request failed", error);
  return Response.json({ error: "Unable to update the quiz" }, { status: 500 });
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const official = officialId.safeParse(new URL(request.url).searchParams.get("officialId"));
    if (!official.success) return Response.json({ error: "officialId is required" }, { status: 400 });
    return Response.json(new QuizService().learnerView((await context.params).id, official.data));
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid quiz request" }, { status: 400 });
    const db = getDatabase();
    const service = new QuizService(db);
    const body = parsed.data;
    switch (body.action) {
      case "start":
        service.start(id, body.officialId);
        break;
      case "answer":
        return Response.json(service.answer(body.attemptId, body.officialId, body.questionId, body.selectedIndex));
      case "finish": {
        const result = service.finish(body.attemptId, body.officialId);
        if (result.assessmentId) await persistAssessmentSnapshot(db, result.assessmentId);
        return Response.json({ result, view: service.learnerView(id, body.officialId) });
      }
      case "start-check":
        await service.startCheck(body.attemptId, body.officialId);
        break;
      case "submit-check": {
        const result = await service.submitCheck(body.checkId, body.officialId, body.answers);
        await persistAssessmentSnapshot(db, result.assessmentId);
        return Response.json({ result, view: service.learnerView(id, body.officialId) });
      }
    }
    return Response.json({ view: service.learnerView(id, body.officialId) });
  } catch (error) {
    return failure(error);
  }
}
