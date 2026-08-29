import { AdminRepository } from "@/data/admin-repository";
export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ versionId: string }> }) { try { return Response.json(await new AdminRepository().publish((await context.params).versionId)); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to publish matrix" }, { status: 409 }); } }
