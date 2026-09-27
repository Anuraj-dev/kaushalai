import { describe, expect, it } from "vitest";
import type { CalendarEntry } from "./nssta-calendar";
import { nsstaProgrammeId, retrieveNsstaProgrammes } from "./nssta-retriever";

const entry = (overrides: Partial<CalendarEntry>): CalendarEntry => ({
  section: "SSS Refresher training for SSOs and JSOs", serial: 1, topic: "Communication and Presentation Skills", participants: "SSO & JSO",
  dates: "07-11 Dec 2026", startDate: "2026-12-07", endDate: "2026-12-11", duration: "1 week", venue: "NSSTA Greater Noida",
  ...overrides,
});

// Upcoming programmes, soonest first, as `upcomingProgrammes` returns them.
const calendar = [
  entry({ serial: 1, topic: "Managing ICT Projects", startDate: "2026-10-05" }),
  entry({ serial: 2, topic: "Sample Survey Methodology and Estimation", participants: "JSO", startDate: "2026-10-12" }),
  entry({ serial: 3, topic: "Handling Large Scale Data & Data Analytics using R", participants: "SSO", startDate: "2026-10-19" }),
  entry({ serial: 4, topic: "Design of Large Scale Sample Surveys", participants: "SSO", startDate: "2026-11-02" }),
  entry({ serial: 5, topic: "Ethics in Public Service", startDate: "2026-11-16" }),
  entry({ serial: 6, topic: "Application of GIS and remote sensing", startDate: "2026-11-23" }),
];
const topics = (question: string, options: Partial<Parameters<typeof retrieveNsstaProgrammes>[2]> = {}) =>
  retrieveNsstaProgrammes(calendar, question, { gapCompetencies: [], cadre: null, ...options }).map((programme) => programme.topic);

describe("retrieveNsstaProgrammes", () => {
  it("selects programmes whose topic matches the question", () => {
    expect(topics("Any NSSTA training on sampling?")).toEqual(["Sample Survey Methodology and Estimation", "Design of Large Scale Sample Surveys"]);
    expect(topics("classroom programmes for R")).toEqual(["Handling Large Scale Data & Data Analytics using R"]);
    expect(topics("survey methodology courses")[0]).toBe("Sample Survey Methodology and Estimation");
  });

  it("limits JSO- or SSO-only programmes to the learner's cadre", () => {
    expect(topics("Any NSSTA training on sampling?", { cadre: "SSO" })).toEqual(["Design of Large Scale Sample Surveys"]);
  });

  it("uses gap competencies when an NSSTA question names no topic", () => {
    expect(topics("Upcoming NSSTA programmes for my gaps", { gapCompetencies: ["GIS", "Ethics"] })).toEqual([
      "Application of GIS and remote sensing",
      "Ethics in Public Service",
    ]);
    expect(topics("Any NSSTA programmes for me?")).toEqual(["Managing ICT Projects", "Sample Survey Methodology and Estimation", "Handling Large Scale Data & Data Analytics using R"]);
  });

  it("returns nothing for platform questions that are not about training", () => {
    expect(topics("How does the assessment work?")).toEqual([]);
    expect(topics("What can Kaushal AI help with?")).toEqual([]);
    expect(topics("Explain my gaps", { gapCompetencies: ["GIS"] })).toEqual([]);
  });

  it("caps the count and gives each programme a stable citation ID", () => {
    expect(retrieveNsstaProgrammes(calendar, "NSSTA programmes", { gapCompetencies: [], cadre: null, limit: 2 })).toHaveLength(2);
    const [first] = retrieveNsstaProgrammes(calendar, "ethics", { gapCompetencies: [], cadre: null });
    expect(first?.programmeId).toBe("nssta:sss-refresher-training-for-ssos-and-jsos-5-2026-11-16");
    expect(first?.programmeId).toBe(nsstaProgrammeId(calendar[4]!));
  });
});
