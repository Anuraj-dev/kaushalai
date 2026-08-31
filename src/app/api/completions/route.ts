import { z } from "zod";
import { LearningService } from "@/services/learning-service";

export const runtime = "nodejs";

const completionSchema = z.object({
  officialId: z.string().min(1),
  courseId: z.string().min(1),
  competencyId: z.string().min(1),
  level: z.number().int().min(1).max(5).optional(),
  assessmentId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = completionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid completion payload", details: parsed.error.flatten() }, { status: 400 });
    }
    const { officialId, courseId, competencyId, level } = parsed.data;
    return Response.json(new LearningService().completeCourse({ officialId, courseId, competencyId, level }), { status: 201 });
  } catch {
    return Response.json({ error: "Unable to record course completion" }, { status: 400 });
  }
}
