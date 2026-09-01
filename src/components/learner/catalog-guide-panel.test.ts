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
        },
      },
    ]);
  });

  it("drops malformed persisted exchanges without throwing", () => {
    expect(normalizeGuideExchanges([null, { question: 42 }, { question: "Valid", answer: null }])).toEqual([
      { question: "Valid" },
    ]);
  });
});
