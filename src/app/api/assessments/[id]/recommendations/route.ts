import { LearningService } from "@/services/learning-service";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { return Response.json(new LearningService().getPath((await context.params).id)); }
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) { return Response.json(new LearningService().createPath((await context.params).id), { status: 201 }); }
