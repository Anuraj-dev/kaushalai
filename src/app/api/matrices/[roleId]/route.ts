import { repositories } from "@/data";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ roleId: string }> }) { const item = await repositories().matrices.currentPublished((await context.params).roleId); return item ? Response.json(item) : Response.json({ error: "No published matrix" }, { status: 404 }); }
export async function POST(_request: Request, context: { params: Promise<{ roleId: string }> }) { return Response.json(await repositories().matrices.createDraft((await context.params).roleId), { status: 201 }); }
