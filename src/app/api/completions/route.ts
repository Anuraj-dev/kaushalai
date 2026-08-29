import { LearningService } from "@/services/learning-service";
export const runtime = "nodejs";
export async function POST(request: Request) { try { return Response.json(new LearningService().completeCourse(await request.json()), { status: 201 }); } catch { return Response.json({ error: "Unable to record course completion" }, { status: 400 }); } }
