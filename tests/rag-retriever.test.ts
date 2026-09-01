import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { importCatalog } from "@/data/catalog-import";
import { seedFoundation } from "@/data/seeds";
import { openDatabase, type KaushalDatabase } from "@/db/client";
import { migrate } from "@/db/migrate";
import { retrieveRagContext } from "@/services/rag-retriever";

describe("RAG catalog retrieval", () => {
  let database: KaushalDatabase;

  beforeEach(() => {
    database = openDatabase(":memory:");
    migrate(database);
    seedFoundation(database);
    importCatalog(database);
  });

  afterEach(() => database.close());

  it("links canonical catalog search terms to competency metadata", () => {
    const linked = database.prepare("SELECT COUNT(*) count FROM course_competencies").get() as { count: number };
    expect(linked.count).toBeGreaterThan(0);

    const context = retrieveRagContext(database, "Tell me about SQL", []);
    const sql = context.retrievedCourses.find((course) => course.title === "Advanced Concepts in SQL");
    expect(sql).toMatchObject({ competencyName: "SQL", competencyId: "competency-sql" });
  });

  it("ignores repeated stopwords when ranking catalog courses", () => {
    database.prepare(
      `INSERT INTO courses (id,source,source_url,title,provider,duration,level,detail_available,search_terms_json,domains_json,provenance_json,detail_json)
       VALUES ('verbose-course','test','https://example.test/verbose','The the the verbose catalog entry','Test','1h','Beginner',1,'[]','[]','{}','{"description":"the the the the the the the the"}')`,
    ).run();

    const context = retrieveRagContext(database, "the SQL", []);
    expect(context.retrievedCourses.some((course) => course.courseId === "verbose-course")).toBe(false);
    expect(context.retrievedCourses[0]?.title).toBe("Advanced Concepts in SQL");
  });
});
