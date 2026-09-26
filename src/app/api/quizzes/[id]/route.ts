import { z } from "zod";
import { QuizError, QuizService } from "@/services/quiz-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("delete-question"), questionId: z.string().min(1).max(80) }),
  z.object({
    action: z.literal("update-question"),
    questionId: z.string().min(1).max(80),
    prompt: z.string().max(1000),
    options: z.array(z.string().max(300)).length(4),
    correctIndex: z.number().int(),
    explanation: z.string().max(1000),
  }),
]);

function failure(error: unknown) {
  if (error instanceof QuizError) return Response.json({ error: error.message }, { status: error.status });
  console.error("[quizzes] update failed", error);
  return Response.json({ error: "Unable to update the quiz" }, { status: 500 });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const quiz = new QuizService().get((await context.params).id);
  return quiz ? Response.json(quiz) : Response.json({ error: "Quiz not found" }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid quiz update" }, { status: 400 });
    const service = new QuizService();
    const body = parsed.data;
    if (body.action === "publish") service.publish(id);
    else if (body.action === "delete-question") service.deleteQuestion(id, body.questionId);
    else service.updateQuestion(id, body.questionId, body);
    return Response.json(service.get(id));
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    new QuizService().deleteDraft((await context.params).id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
}
