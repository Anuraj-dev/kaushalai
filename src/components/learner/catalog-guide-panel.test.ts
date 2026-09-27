import { describe, expect, it } from "vitest";

import { normalizeGuideExchanges } from "./catalog-guide-panel";

describe("catalog guide exchange persistence", () => {
  it("migrates legacy answers that only have gapSummary", () => {
    const exchanges = normalizeGuideExchanges([
      {
        question: "Why was this course recommended?",
        answer: {
          gapSummary: "This course addresses your statistics gap.",
          unavailable: "",
          citedCourses: [],
        },
      },
    ]);

    expect(exchanges).toEqual([
      {
        question: "Why was this course recommended?",
        answer: {
          answer: "This course addresses your statistics gap.",
          gapSummary: "This course addresses your statistics gap.",
          unavailable: "",
          citedCourses: [],
          citedProgrammes: [],
        },
      },
    ]);
  });

  it("keeps cited NSSTA programmes and drops malformed ones", () => {
    const programme = {
      programmeId: "nssta:sss-refresher-3-2026-12-07",
      topic: "Sampling Techniques",
      participants: "SSO & JSO",
      dates: "07-11 Dec 2026",
      duration: "1 week",
      venue: "NSSTA",
      sourceUrl: "https://nssta.gov.in/api/trainingcalendar/download/1",
      note: "Covers sampling for your gap.",
    };
    const [exchange] = normalizeGuideExchanges([
      { question: "NSSTA sampling?", answer: { answer: "Yes.", citedCourses: [], citedProgrammes: [programme, { programmeId: "nssta:x" }, null] } },
    ]);
    expect(exchange?.answer?.citedProgrammes).toEqual([programme]);
  });

  it("drops malformed persisted exchanges without throwing", () => {
    expect(normalizeGuideExchanges([null, { question: 42 }, { question: "Valid", answer: null }])).toEqual([
      { question: "Valid" },
    ]);
  });
});
