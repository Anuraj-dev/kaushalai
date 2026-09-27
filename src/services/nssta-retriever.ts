import type { CatalogGuideNsstaProgramme } from "@/ai";
import { COMPETENCY_TOPIC_PATTERNS, matchProgrammes, openToCadre, type NsstaCadre, type NsstaProgramme } from "@/services/nssta";

/** Words that say nothing about a programme's topic, so they never make a programme relevant. */
const GENERIC_WORDS = new Set([
  "about", "and", "any", "are", "available", "based", "best", "can", "classroom", "course", "courses", "does", "explain", "find", "for",
  "from", "gap", "gaps", "get", "give", "good", "has", "have", "help", "how", "india", "kaushal", "learning", "list", "management",
  "me", "national", "need", "next", "nssta", "offline", "official", "one", "ones", "person", "plan", "program", "programme", "programmes",
  "programs", "related", "show", "skill", "skills", "suggest", "that", "the", "there", "this", "training", "trainings", "upcoming",
  "want", "what", "when", "where", "which", "why", "will", "with", "work", "you", "your",
]);

/** The learner is asking for NSSTA or classroom training even without naming a topic. */
const NSSTA_INTENT = /\b(nssta|classroom|in[- ]person|offline|face[- ]to[- ]face|trainings?|programmes?|programs?)\b/i;

function words(text: string): Set<string> {
  const found = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(found.filter((word) => word.length >= 3 && !GENERIC_WORDS.has(word)).map((word) => (word.length > 4 ? word.replace(/s$/, "") : word)));
}

/** Stable citation ID for a calendar row, e.g. `nssta:sss-refresher-training-for-ssos-and-jsos-3-2026-12-07`. */
export function nsstaProgrammeId(programme: NsstaProgramme): string {
  const section = programme.section.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48).replace(/-$/, "");
  return `nssta:${section}-${programme.serial}-${programme.startDate ?? "undated"}`;
}

function toGuideProgramme(programme: NsstaProgramme): CatalogGuideNsstaProgramme {
  const { topic, section, participants, dates, startDate, endDate, duration, venue } = programme;
  return { programmeId: nsstaProgrammeId(programme), topic, section, participants, dates, startDate, endDate, duration, venue };
}

/**
 * Upcoming programmes relevant to a chat question, best match first. A programme matches when its
 * topic shares a distinctive word with the question or fits a competency the question names. A
 * question that asks for NSSTA training without a topic gets programmes for the learner's gap
 * competencies, else the soonest ones. Programmes limited to another cadre are never returned.
 */
export function retrieveNsstaProgrammes(
  programmes: NsstaProgramme[],
  question: string,
  options: { gapCompetencies: string[]; cadre: NsstaCadre | null; limit?: number },
): CatalogGuideNsstaProgramme[] {
  const limit = options.limit ?? 6;
  const open = programmes.filter((programme) => openToCadre(programme.participants, options.cadre));
  // "Kaushal AI" is the platform's name, not a question about the AI competency.
  const topicText = question.replace(/kaushal(\s+ai)?/gi, " ");
  const questionWords = words(topicText);
  const namedPatterns = Object.values(COMPETENCY_TOPIC_PATTERNS).filter((pattern) => pattern.test(topicText));

  let selected = open
    .map((programme) => {
      const topicWords = words(programme.topic);
      const overlap = [...questionWords].filter((word) => topicWords.has(word)).length;
      return { programme, score: overlap + (namedPatterns.some((pattern) => pattern.test(programme.topic)) ? 2 : 0) };
    })
    .filter(({ score }) => score > 0)
    // Stable sort keeps the calendar's soonest-first order among equal scores.
    .sort((a, b) => b.score - a.score)
    .map(({ programme }) => programme);

  if (selected.length === 0 && NSSTA_INTENT.test(question)) {
    selected = options.gapCompetencies.flatMap((name) => matchProgrammes(open, name, options.cadre, 2));
    if (selected.length === 0) selected = open.slice(0, 3);
  }

  const byId = new Map<string, CatalogGuideNsstaProgramme>();
  for (const programme of selected.map(toGuideProgramme)) if (!byId.has(programme.programmeId)) byId.set(programme.programmeId, programme);
  return [...byId.values()].slice(0, limit);
}
