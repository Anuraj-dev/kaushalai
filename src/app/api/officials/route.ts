import { repositories } from "@/data";
export const runtime = "nodejs";
export async function GET(request: Request) { const selectable = new URL(request.url).searchParams.get("selectable") === "true"; return Response.json(await repositories().officials.list(selectable)); }
