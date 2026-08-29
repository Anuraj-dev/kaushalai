import { repositories } from "@/data";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { const item = await repositories().assessments.get((await context.params).id); return item ? Response.json(item) : Response.json({ error: "Assessment not found" }, { status: 404 }); }
