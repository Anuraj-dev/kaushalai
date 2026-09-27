import { z } from "zod";
import { parseCalendarLayout, readCalendarPdf, type CalendarEntry } from "@/services/nssta-calendar";

/**
 * Live client for nssta.gov.in (National Statistical Systems Training Academy, MoSPI).
 * Upcoming programmes are published only as the "Advance Training Calendar" PDF, which is
 * listed by the site's public, undocumented JSON API. Every step is validated and callers must
 * handle `NsstaUnavailableError`.
 */
export const NSSTA_API_BASE = "https://nssta.gov.in/api/";
export const NSSTA_SITE_URL = "https://nssta.gov.in/";
const REVALIDATE_SECONDS = 3600;
const TIMEOUT_MS = 15000;

const calendarDocumentSchema = z.object({ id: z.number(), title: z.string(), type: z.string(), report_date: z.string().nullable() });
const listSchema = z.object({ statusCode: z.literal(true), response: z.object({ rows: z.array(calendarDocumentSchema) }) });

export type NsstaCalendarDocument = { title: string; url: string; publishedOn: string | null };
export type NsstaProgramme = CalendarEntry;
export type NsstaCadre = "JSO" | "SSO";

export class NsstaUnavailableError extends Error {}

async function request(path: string) {
  try {
    const response = await fetch(`${NSSTA_API_BASE}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: REVALIDATE_SECONDS } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } catch (cause) {
    throw new NsstaUnavailableError(`NSSTA request failed for ${path}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

/** The newest "training calendar" PDF published on the NSSTA site, if any. */
export async function fetchNsstaCalendar(): Promise<NsstaCalendarDocument | null> {
  const parsed = listSchema.safeParse(await (await request("trainingcalendar")).json().catch(() => null));
  if (!parsed.success) throw new NsstaUnavailableError("NSSTA calendar list has an unexpected shape");
  const latest = parsed.data.response.rows
    .filter((row) => row.type.toLowerCase() === "training calendar")
    .sort((a, b) => (b.report_date ?? "").localeCompare(a.report_date ?? ""))[0];
  return latest ? { title: latest.title, url: `${NSSTA_API_BASE}trainingcalendar/download/${latest.id}`, publishedOn: latest.report_date } : null;
}

// Parsing the PDF takes a few hundred milliseconds, so each published calendar is parsed once.
let parsedCalendar: { url: string; entries: Promise<CalendarEntry[]> } | null = null;

async function calendarEntries(calendar: NsstaCalendarDocument): Promise<CalendarEntry[]> {
  if (parsedCalendar?.url !== calendar.url) {
    const entries = (async () => {
      const path = calendar.url.slice(NSSTA_API_BASE.length);
      const entries = parseCalendarLayout(await readCalendarPdf(new Uint8Array(await (await request(path)).arrayBuffer())));
      if (entries.length === 0) throw new NsstaUnavailableError("NSSTA calendar PDF contained no programme rows");
      return entries;
    })();
    parsedCalendar = { url: calendar.url, entries };
    entries.catch(() => {
      if (parsedCalendar?.entries === entries) parsedCalendar = null;
    });
  }
  return parsedCalendar.entries;
}

/** Today's date in India, where every NSSTA programme runs. */
export const todayInIndia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

// Students, faculty and named cohorts ("Batch-II for ASOs of DES-U.P", "JTS officers promoted in VY 2025") cannot be joined by other officials.
const CLOSED_AUDIENCE = /student|faculty|\bHoD\b|\bbatch\b|promoted in/i;

/** Open programmes that start on or after `today`, soonest first, without repeated rows. */
export function upcomingProgrammes(entries: CalendarEntry[], today: string): NsstaProgramme[] {
  const seen = new Set<string>();
  return entries
    .filter((entry) => entry.startDate && entry.startDate >= today && !CLOSED_AUDIENCE.test(entry.participants ?? ""))
    .filter((entry) => {
      const key = [entry.topic, entry.startDate, entry.participants, entry.venue].join("|");
      return !seen.has(key) && Boolean(seen.add(key));
    })
    .sort((a, b) => a.startDate!.localeCompare(b.startDate!));
}

export async function fetchUpcomingProgrammes(today = todayInIndia()) {
  const calendar = await fetchNsstaCalendar();
  if (!calendar) throw new NsstaUnavailableError("NSSTA has not published a training calendar");
  return { calendar, programmes: upcomingProgrammes(await calendarEntries(calendar), today) };
}

/** Statistical Services cadre implied by a job role; JSO/SSO-only programmes are limited to it. */
export function cadreForRole(jobRole: string | null | undefined): NsstaCadre | null {
  if (/junior statistical officer/i.test(jobRole ?? "")) return "JSO";
  if (/senior statistical officer/i.test(jobRole ?? "")) return "SSO";
  return null;
}

/**
 * NSSTA topics have no competency tags, so each supported competency lists the phrases that
 * identify it in NSSTA topic titles. Competencies absent here have no NSSTA programme.
 */
const COMPETENCY_TOPIC_PATTERNS: Record<string, RegExp> = {
  "Basic Statistics": /basic statistics|basic and official statistics|official statistic/i,
  "Survey Design": /survey (design|methodology|techniques)|design(ing)? of (large scale )?sample survey/i,
  Sampling: /sampl(e|ing)|survey methodology/i,
  "R Programming": /\bR\b/,
  Python: /python/i,
  "Data Visualization": /visuali[sz]/i,
  "Industrial Statistics": /industrial statistics/i,
  GIS: /\bGIS\b|geo-?spatial|remote sensing/i,
  AI: /artificial intelligence|\bAI\b/i,
  "Machine Learning": /machine learning/i,
  "Project Management": /project/i,
  Leadership: /leadership|management programme/i,
  Communication: /communication|presentation|storytelling/i,
  Ethics: /ethic/i,
};

/** Upcoming programmes matching the competency that the official's cadre can attend, soonest first. */
export function matchProgrammes(programmes: NsstaProgramme[], competencyName: string, cadre: NsstaCadre | null, limit = 3): NsstaProgramme[] {
  const pattern = COMPETENCY_TOPIC_PATTERNS[competencyName];
  if (!pattern) return [];
  const forCadre = (participants: string | null) =>
    !cadre || !/\b(JSO|SSO)\b/.test(participants ?? "") || new RegExp(`\\b${cadre}\\b`).test(participants ?? "");
  return programmes.filter((programme) => pattern.test(programme.topic) && forCadre(programme.participants)).slice(0, limit);
}
