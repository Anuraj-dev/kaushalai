import { z } from "zod";
import { repositories } from "@/data";

export const runtime = "nodejs";

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "Invalid query parameters", details: parsed.error.flatten() }, { status: 400 });
  }
  const { search, limit, offset } = parsed.data;
  return Response.json(await repositories().courses.list({ search, limit, offset }));
}
