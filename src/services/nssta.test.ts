import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalendarEntry } from "./nssta-calendar";
import { NsstaUnavailableError, cadreForRole, fetchNsstaCalendar, matchProgrammes, upcomingProgrammes } from "./nssta";

const entry = (overrides: Partial<CalendarEntry>): CalendarEntry => ({
  section: "SSS Refresher training for SSOs and JSOs", serial: 1, topic: "Communication and Presentation Skills", participants: "SSO & JSO",
  dates: null, startDate: "2026-12-07", endDate: "2026-12-11", duration: "1 week", venue: "HIPA Shimla",
  ...overrides,
});

describe("upcomingProgrammes", () => {
  it("keeps open programmes starting today or later, soonest first, once each", () => {
    const programmes = upcomingProgrammes([
      entry({ topic: "Ethics in Public Service", startDate: "2027-02-22" }),
      entry({ topic: "R and Python through ISI Delhi", startDate: "2026-09-07" }),
      entry({ topic: "Pay Fixation", startDate: null }),
      entry({ topic: "Official Statistics", participants: "PG/UG students of the University/colleges", startDate: "2026-12-21" }),
      entry({ topic: "Official Statistics and related disciplines", participants: "Batch-II for ASOs of DES-U. P", startDate: "2027-01-04" }),
      entry({ serial: 15 }),
      entry({ serial: 16 }),
      entry({ topic: "Managing ICT Projects", startDate: "2026-09-27" }),
    ], "2026-09-27");
    expect(programmes.map((programme) => programme.topic)).toEqual(["Managing ICT Projects", "Communication and Presentation Skills", "Ethics in Public Service"]);
  });
});

describe("matchProgrammes", () => {
  const programmes = [
    entry({ topic: "Handling Large Scale Data & Data Analytics using R", participants: "SSO" }),
    entry({ topic: "Stress Management Through Blissful Living", participants: "JSO" }),
    entry({ topic: "Application of remote sensing and disaster management", participants: "JSO" }),
    entry({ topic: "Application of remote sensing and disaster management", participants: "SSO", startDate: "2027-01-11" }),
    entry({ topic: "Course on Artificial Intelligence (AI), ready Data", participants: "ISS officers with 8-10 years of services" }),
  ];
  const topics = (name: string, cadre: "JSO" | "SSO" | null = null) => matchProgrammes(programmes, name, cadre).map((programme) => programme.participants);

  it("matches the standalone letter R, not words that start with R", () => {
    expect(topics("R Programming")).toEqual(["SSO"]);
  });

  it("limits JSO or SSO programmes to the official's cadre", () => {
    expect(topics("GIS", "SSO")).toEqual(["SSO"]);
    expect(topics("GIS")).toEqual(["JSO", "SSO"]);
    expect(topics("AI", "JSO")).toEqual(["ISS officers with 8-10 years of services"]);
  });

  it("returns nothing for competencies NSSTA does not cover", () => {
    expect(topics("Cybersecurity")).toEqual([]);
  });
});

describe("cadreForRole", () => {
  it("reads the cadre from Statistical Services job roles only", () => {
    expect(cadreForRole("Statistical Investigator / Junior Statistical Officer")).toBe("JSO");
    expect(cadreForRole("Senior Statistical Officer")).toBe("SSO");
    expect(cadreForRole("Geospatial Statistics Analyst")).toBeNull();
  });
});

describe("fetchNsstaCalendar", () => {
  afterEach(() => vi.unstubAllGlobals());
  const respond = (body: unknown, status = 200) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));

  it("links the newest training calendar PDF, ignoring announcements", async () => {
    respond({ statusCode: true, response: { rows: [
      { id: 61, title: "iGOT learning hours", type: "announcement", report_date: "2026-09-23" },
      { id: 40, title: "Advance Training Calendar FY 2025-26", type: "training calendar", report_date: "2025-05-01" },
      { id: 57, title: "Advance Training Calendar FY 2026-27", type: "training calendar", report_date: "2026-05-18" },
    ] } });
    await expect(fetchNsstaCalendar()).resolves.toEqual({
      title: "Advance Training Calendar FY 2026-27", url: "https://nssta.gov.in/api/trainingcalendar/download/57", publishedOn: "2026-05-18",
    });
  });

  it("rejects an unexpected shape or a failed request", async () => {
    respond({ statusCode: true, response: { rows: [{ id: "x" }] } });
    await expect(fetchNsstaCalendar()).rejects.toBeInstanceOf(NsstaUnavailableError);
    respond({ msg: "API endpoint not found", statusCode: false }, 404);
    await expect(fetchNsstaCalendar()).rejects.toBeInstanceOf(NsstaUnavailableError);
  });
});
