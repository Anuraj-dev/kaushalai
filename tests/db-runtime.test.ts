import { afterEach, describe, expect, it } from "vitest";
import { databasePath, initializeDatabase, openDatabase } from "@/db/client";

describe("runtime database bootstrap", () => {
  afterEach(() => {
    delete process.env.VERCEL;
    delete process.env.DATABASE_URL;
  });

  it("initializes an empty database with the seeded learner workspace", () => {
    const database = openDatabase(":memory:");
    try {
      initializeDatabase(database);

      expect((database.prepare("SELECT COUNT(*) count FROM officials WHERE is_demo_selectable=1").get() as { count: number }).count).toBe(3);
      expect((database.prepare("SELECT COUNT(*) count FROM courses").get() as { count: number }).count).toBe(222);
    } finally {
      database.close();
    }
  });

  it("uses Vercel's writable temporary directory for the default database", () => {
    process.env.VERCEL = "1";

    expect(databasePath()).toBe("/tmp/kaushal-ai.db");
  });
});
