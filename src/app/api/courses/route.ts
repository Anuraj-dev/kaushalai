import { repositories } from "@/data";
export const runtime = "nodejs";
export async function GET(request: Request) { const query = new URL(request.url).searchParams; return Response.json(await repositories().courses.list({ search: query.get("search") ?? undefined, limit: Number(query.get("limit") ?? 50), offset: Number(query.get("offset") ?? 0) })); }
