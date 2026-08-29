import { repositories } from "@/data";
export const runtime = "nodejs";
export async function POST(request: Request) { try { const body = await request.json() as { officialId?: string }; if (!body.officialId) return Response.json({ error: "officialId is required" }, { status: 400 }); return Response.json(await repositories().assessments.start(body.officialId), { status: 201 }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Unable to start assessment" }, { status: 409 }); } }
