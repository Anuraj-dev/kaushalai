import { describe, expect, it } from "vitest";
import { APPLICATION_NAME } from "@/services";

describe("application foundation", () => {
  it("identifies the product", () => expect(APPLICATION_NAME).toBe("Kaushal AI"));
});
