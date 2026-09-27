import { z } from "zod";
import { NSSTA_SITE_URL, NsstaUnavailableError, cadreForRole, fetchUpcomingProgrammes, matchProgrammes } from "@/services/nssta";

export const runtime = "nodejs";

const querySchema = z.object({
  competencies: z.array(z.string().trim().min(1).max(80)).min(1).max(30),
  role: z.string().trim().max(120).optional(),
});

/** Upcoming NSSTA programmes matched to competencies (`?competency=Python&competency=GIS&role=...`). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({ competencies: params.getAll("competency"), role: params.get("role") ?? undefined });
  if (!parsed.success) {
    return Response.json({ error: "Provide one to 30 competency query parameters" }, { status: 400 });
  }
  try {
    const { calendar, programmes } = await fetchUpcomingProgrammes();
    const cadre = cadreForRole(parsed.data.role);
    return Response.json({
      source: NSSTA_SITE_URL,
      calendar,
      upcomingCount: programmes.length,
      matches: [...new Set(parsed.data.competencies)].map((competencyName) => ({ competencyName, programmes: matchProgrammes(programmes, competencyName, cadre) })),
    });
  } catch (cause) {
    if (cause instanceof NsstaUnavailableError) {
      console.error(cause.message);
      return Response.json({ error: "NSSTA is not reachable right now" }, { status: 502 });
    }
    throw cause;
  }
}
