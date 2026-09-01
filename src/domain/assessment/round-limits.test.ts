import { describe, expect, it } from "vitest";

import {
  isValidQuestionCount,
  round1QuestionCount,
  round2QuestionCount,
  round3QuestionCount,
} from "./round-limits";

describe("halved round question limits", () => {
  it("cuts a seven-question baseline to four and an eight-question matrix to four", () => {
    expect(round1QuestionCount(7)).toBe(4);
    expect(round1QuestionCount(8)).toBe(4);
    expect(round1QuestionCount(6)).toBe(3);
  });

  it("keeps personalized rounds at 4-5 questions", () => {
    expect(round2QuestionCount(6)).toBe(4);
    expect(round2QuestionCount(8)).toBe(4);
    expect(isValidQuestionCount(2, 3)).toBe(false);
    expect(isValidQuestionCount(2, 4)).toBe(true);
    expect(isValidQuestionCount(2, 5)).toBe(true);
    expect(isValidQuestionCount(2, 7)).toBe(false);
  });

  it("caps clarification at three questions", () => {
    expect(round3QuestionCount(5)).toBe(3);
    expect(round3QuestionCount(1)).toBe(1);
    expect(isValidQuestionCount(3, 3)).toBe(true);
    expect(isValidQuestionCount(3, 4)).toBe(false);
  });
});
