import type { CatalogCourse, LearningPath, PriorityGap } from "./types";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const includesTag = (text: string, tag: string) => ` ${normalize(text)} `.includes(` ${normalize(tag)} `);

// A4-05: Synonym fallback to prevent false-negatives (e.g., Government Cloud catalog phrasing varies).
// If tag is "government cloud", also match "government technology" or "cloud computing" in title/detail.
// Extends to survey design / industrial statistics via broader phrase matching. Documented fallback and
// kept alongside existing apis plural handling. Search terms only rank already-eligible courses (+2).
const SYNONYMS: Record<string, string[]> = {
  "government cloud": ["government technology", "cloud computing"],
  "survey design": ["survey"],
  "industrial statistics": ["industrial"],
};

// Handle plural "apis" vs singular "api" equivalently for catalog matching
const isApiTag = (normalizedTag: string) => normalizedTag === "api" || normalizedTag === "apis";
const matchesApiTag = (text: string) => includesTag(text, "api") || includesTag(text, "apis");

function evidenceScore(course: CatalogCourse, tags: string[]): number {
  const normalizedTitle = normalize(course.title);
  const detailText = `${course.tags.join(" ")} ${course.description} ${course.learningOutcomes.join(" ")}`;
  const specialistFalsePositive = tags.some((tag) => {
    const normalizedTag = normalize(tag);
    if (isApiTag(normalizedTag)) return false;
    if (normalizedTag === "sampling") {
      const pattern = /\b(soil|water|air|mineral|geological|legal|borehole|base metal|ndps|environmental|exploration)\b/;
      // Codex P1: restrict to title only — detail check removed legitimate sampling course "Data Analysis using R"
      return pattern.test(normalizedTitle);
    }
    if (normalizedTag === "national accounts") {
      // Note: "national accounts" tag does not exist in current competency library / courseTags yet;
      // filter is kept for future catalog coverage and prevents "company accounts" false matches
      const pattern = /\b(company|financial|pension|postal|partnership)\b/;
      return pattern.test(normalizedTitle);
    }
    return false;
  });
  if (specialistFalsePositive) return 0;
  // Government Cloud synonym handling: if tag is "government cloud", also match synonym phrases
  // in title/detail via SYNONYMS (government technology / cloud computing). Generic synonym
  // check also covers survey design -> survey, industrial statistics -> industrial.
  const titleMatch = tags.some((tag) => {
    const n = normalize(tag);
    if (isApiTag(n)) return matchesApiTag(normalizedTitle);
    if (includesTag(normalizedTitle, tag)) return true;
    const syns = SYNONYMS[n];
    return syns ? syns.some((syn) => includesTag(normalizedTitle, syn)) : false;
  });
  const detailMatch = course.detailAvailable && tags.some((tag) => {
    const n = normalize(tag);
    if (isApiTag(n)) return matchesApiTag(detailText);
    if (includesTag(detailText, tag)) return true;
    const syns = SYNONYMS[n];
    return syns ? syns.some((syn) => includesTag(detailText, syn)) : false;
  });
  // Search terms may only rank an already eligible (title/detail) record; membership alone scores 0.
  const searchTermsText = course.searchTerms.join(" ");
  const searchMatch = tags.some((tag) => {
    const n = normalize(tag);
    if (isApiTag(n)) return matchesApiTag(searchTermsText);
    if (includesTag(searchTermsText, tag)) return true;
    const syns = SYNONYMS[n];
    return syns ? syns.some((syn) => includesTag(searchTermsText, syn)) : false;
  });
  if (!titleMatch && !detailMatch) return 0;
  return (detailMatch ? 100 : 0) + (titleMatch ? 20 : 0) + (searchMatch ? 2 : 0) + (course.detailAvailable ? 5 : 0);
}

export function isEligibleCourse(course: CatalogCourse, tags: string[]): boolean {
  return evidenceScore(course, tags) > 0;
}

export function buildLearningPath(gaps: PriorityGap[], courses: CatalogCourse[]): LearningPath {
  const items: LearningPath["items"] = [];
  const unavailable: LearningPath["unavailable"] = [];
  const usedCourses = new Set<string>();

  for (const gap of [...gaps].filter((item) => item.priority > 0).sort((a, b) => b.priority - a.priority)) {
    const eligible = courses
      .map((course) => ({ course, score: evidenceScore(course, gap.tags) }))
      .filter(({ course, score }) => score > 0 && !usedCourses.has(course.id))
      .sort((a, b) => b.score - a.score || a.course.title.localeCompare(b.course.title))
      .slice(0, 2);
    if (eligible.length === 0) {
      unavailable.push({ competencyId: gap.competencyId, message: "No verified course available in the current catalog." });
      continue;
    }
    for (const { course } of eligible) {
      if (items.length >= 8) break;
      usedCourses.add(course.id);
      items.push({
        courseId: course.id,
        competencyId: gap.competencyId,
        competencyName: gap.competencyName,
        rank: items.length + 1,
        rationale: `${course.title} provides catalog evidence for the ${gap.competencyName} gap.`,
        evidence: course.detailAvailable ? "detailed" : "title",
      });
    }
    if (items.length >= 8) break;
  }
  return { items, unavailable };
}
