import { z } from "zod";
import { QUIZ_MAX_QUESTIONS, QUIZ_MIN_QUESTIONS } from "@/ai";
import { extractMaterialText, MaterialError } from "@/services/quiz-material";
import { QuizError, QuizService } from "@/services/quiz-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Quiz generation waits on the model while the trainer watches a progress state.
export const maxDuration = 90;

const uploadSchema = z.object({
  title: z.string().trim().min(3).max(120),
  competencyId: z.string().trim().min(1).max(80),
  courseId: z.string().trim().max(120).optional().transform((value) => value || null),
  questionCount: z.coerce.number().int().min(QUIZ_MIN_QUESTIONS).max(QUIZ_MAX_QUESTIONS),
});

export async function GET() {
  return Response.json({ quizzes: new QuizService().list() });
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Attach a PDF, TXT or MD file." }, { status: 400 });
    const parsed = uploadSchema.safeParse({
      title: form.get("title"), competencyId: form.get("competencyId"),
      courseId: form.get("courseId") ?? undefined, questionCount: form.get("questionCount"),
    });
    if (!parsed.success) return Response.json({ error: "Add a title, a competency and a question count from 3 to 10." }, { status: 400 });
    const text = await extractMaterialText({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    const created = await new QuizService().createDraft({ ...parsed.data, sourceName: file.name, text });
    return Response.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof MaterialError || error instanceof QuizError) {
      return Response.json({ error: error.message }, { status: error instanceof QuizError ? error.status : 400 });
    }
    console.error("[quizzes] upload failed", error);
    return Response.json({ error: "Unable to create the quiz" }, { status: 500 });
  }
}
