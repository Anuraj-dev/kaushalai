import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { KaushalDatabase } from "@/db/client";

interface SourceCourse {
  title: string; provider?: string; duration?: string; level?: string; rating?: string;
  thumbnail?: string; search_terms: string[]; competency_domains: string[];
  source_url?: string; source_search_urls: string[]; detail_available: boolean;
  [key: string]: unknown;
}
interface CatalogCapture { source: Record<string, unknown>; scrape_summary: { unique_courses: number; detailed_courses: number }; courses: SourceCourse[] }

export function stableCourseId(course: Pick<SourceCourse, "source_url" | "title" | "provider">): string {
  const identity = course.source_url || `${course.provider ?? "unknown"}\u0000${course.title}`;
  return `igot-${createHash("sha256").update(identity.trim().toLowerCase()).digest("hex").slice(0, 20)}`;
}

export function importCatalog(database: KaushalDatabase, sourcePath = resolve("sih.json")): { imported: number; detailed: number } {
  const capture = JSON.parse(readFileSync(sourcePath, "utf8")) as CatalogCapture;
  if (capture.courses.length !== 222 || capture.scrape_summary.unique_courses !== 222) throw new Error("Expected exactly 222 catalog courses");
  const detailed = capture.courses.filter((course) => course.detail_available === true).length;
  if (detailed !== 25 || capture.scrape_summary.detailed_courses !== 25) throw new Error("Expected exactly 25 detailed catalog courses");
  const insert = database.prepare(`INSERT INTO courses
    (id, source, source_url, title, provider, duration, level, rating, thumbnail_url, detail_available, incomplete_source, search_terms_json, domains_json, detail_json, provenance_json)
    VALUES (@id, @source, @sourceUrl, @title, @provider, @duration, @level, @rating, @thumbnail, @detailAvailable, 1, @searchTerms, @domains, @detail, @provenance)
    ON CONFLICT(id) DO UPDATE SET title=excluded.title, provider=excluded.provider, duration=excluded.duration, level=excluded.level, rating=excluded.rating, thumbnail_url=excluded.thumbnail_url, detail_available=excluded.detail_available, search_terms_json=excluded.search_terms_json, domains_json=excluded.domains_json, detail_json=excluded.detail_json, provenance_json=excluded.provenance_json, updated_at=CURRENT_TIMESTAMP`);
  database.transaction(() => {
    for (const course of capture.courses) {
      const detail = course.detail_available ? Object.fromEntries(Object.entries(course).filter(([key]) => !["title", "provider", "duration", "level", "rating", "thumbnail", "search_terms", "competency_domains", "source_url", "source_search_urls", "detail_available"].includes(key))) : null;
      insert.run({ id: stableCourseId(course), source: "iGOT Karmayogi", sourceUrl: course.source_url ?? course.source_search_urls[0], title: course.title, provider: course.provider ?? null, duration: course.duration ?? null, level: course.level ?? null, rating: Number.isFinite(Number(course.rating)) ? Number(course.rating) : null, thumbnail: course.thumbnail ?? null, detailAvailable: course.detail_available ? 1 : 0, searchTerms: JSON.stringify(course.search_terms), domains: JSON.stringify(course.competency_domains), detail: detail ? JSON.stringify(detail) : null, provenance: JSON.stringify({ capture: capture.source, sourceSearchUrls: course.source_search_urls }) });
    }
  })();
  return { imported: capture.courses.length, detailed };
}
