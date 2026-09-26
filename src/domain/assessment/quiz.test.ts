import { describe, expect, it } from "vitest";

import { quizDemonstratedLevel } from "./quiz";

describe("quiz score to proficiency level", () => {
  it("uses 20% bands and caps a perfect score at level 5", () => {
    expect(quizDemonstratedLevel(0, 8)).toBe(1);
    expect(quizDemonstratedLevel(1, 8)).toBe(1);
    expect(quizDemonstratedLevel(2, 8)).toBe(2);
    expect(quizDemonstratedLevel(4, 8)).toBe(3);
    expect(quizDemonstratedLevel(5, 8)).toBe(4);
    expect(quizDemonstratedLevel(7, 8)).toBe(5);
    expect(quizDemonstratedLevel(8, 8)).toBe(5);
  });

  it("rejects impossible scores", () => {
    expect(() => quizDemonstratedLevel(9, 8)).toThrow();
    expect(() => quizDemonstratedLevel(1, 0)).toThrow();
  });
});
