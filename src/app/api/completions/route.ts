import { z } from "zod";
import { LearningService } from "@/services/learning-service";

export const runtime = "nodejs";

const completionSchema = z
  .object({
    officialId: z.string().trim().min(1),
    courseId: z.string().trim().min(1),
    competencyId: z.string().trim().min(1),
    level: z.number().int().min(1).max(5).optional(),
    assessmentId: z.string().trim().optional(),
    verifiedAssessment: z.boolean().optional(),
    verifiedAssessmentLevel: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = completionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Invalid completion payload", details: parsed.error.flatten() }, { status: 400 });
    }
    const { officialId, courseId, competencyId, level, verifiedAssessment, verifiedAssessmentLevel } = parsed.data;
    const effectiveLevel = verifiedAssessmentLevel ?? level;
    return Response.json(
      new LearningService().completeCourse({
        officialId,
        courseId,
        competencyId,
        level: effectiveLevel,
        verifiedAssessment: verifiedAssessment ?? false,
      }),
      { status: 201 },
    );
  } catch {
    return Response.json({ error: "Unable to record course completion" }, { status: 400 });
  }
}
