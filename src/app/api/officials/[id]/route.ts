import { repositories } from "@/data";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { const item = await repositories().officials.get((await context.params).id); return item ? Response.json(item) : Response.json({ error: "Official profile not found" }, { status: 404 }); }
