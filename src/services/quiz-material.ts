import type { QuizQuestion } from "@/ai";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MIN_MATERIAL_CHARS = 400;
/** Stored source text is capped so one upload cannot bloat the database. */
export const MAX_STORED_CHARS = 60_000;
/** Excerpt sent to the model. Long documents are sampled evenly, not truncated at the front. */
export const MAX_PROMPT_CHARS = 14_000;

export class MaterialError extends Error {}

export function normalizeMaterialText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractMaterialText(file: { name: string; bytes: Uint8Array }): Promise<string> {
  if (file.bytes.byteLength === 0) throw new MaterialError("The uploaded file is empty.");
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) throw new MaterialError("The file is larger than 10 MB.");
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  let text: string;
  if (extension === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    try {
      const pdf = await getDocumentProxy(file.bytes);
      text = (await extractText(pdf, { mergePages: true })).text;
    } catch {
      throw new MaterialError("This PDF could not be read. Export it again or upload a different file.");
    }
  } else if (extension === "txt" || extension === "md") {
    text = new TextDecoder("utf-8", { fatal: false }).decode(file.bytes);
  } else {
    throw new MaterialError("Upload a PDF, TXT or MD file. Export slides to PDF first.");
  }
  const normalized = normalizeMaterialText(text);
  if (normalized.length < MIN_MATERIAL_CHARS) {
    throw new MaterialError("Too little readable text was found. Scanned PDFs without a text layer are not supported yet.");
  }
  return normalized.slice(0, MAX_STORED_CHARS);
}

export function materialExcerpt(text: string, maxChars = MAX_PROMPT_CHARS): string {
  if (text.length <= maxChars) return text;
  const windows = 4;
  const size = Math.floor(maxChars / windows);
  const stride = Math.floor((text.length - size) / (windows - 1));
  return Array.from({ length: windows }, (_, index) => text.slice(index * stride, index * stride + size)).join("\n…\n");
}

const STOPWORDS = new Set(("about above after again against among because before being below between both could does doing during each "
  + "either every few from further have having here however into itself just more most much must only other over same should "
  + "since some such than that their them then there these they this those through under until upon very were what when where "
  + "which while whom whose will with within without would your also used using usually often called known given means makes "
  + "different number example following section material important commonly").split(" "));

function sentencesOf(text: string): string[] {
  return text
    .split("\n")
    // Short lines without closing punctuation are headings or titles, not prose.
    .filter((line) => line.length >= 60 || /[.!?:;,]$/.test(line))
    .join(" ")
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 60 && sentence.length <= 260 && /[.!?]$/.test(sentence));
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");

function termsOf(sentence: string): string[] {
  return (sentence.toLowerCase().match(/[a-z][a-z-]{5,}/g) ?? []).filter((word) => !STOPWORDS.has(word));
}

/**
 * Offline fallback used when no AI provider answers: fill-in-the-blank
 * questions built from the material's own sentences. Every answer and quote
 * comes from the text, so the result stays grounded without a model.
 */
export function fallbackQuizQuestions(text: string, count: number): QuizQuestion[] {
  const sentences = sentencesOf(text);
  const lowered = text.toLowerCase().replace(/\s+/g, " ");
  const frequency = new Map<string, number>();
  for (const sentence of sentences) for (const term of new Set(termsOf(sentence))) frequency.set(term, (frequency.get(term) ?? 0) + 1);
  const pool = [...frequency.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([term]) => term);
  const candidates = sentences
    .map((sentence) => {
      const terms = [...new Set(termsOf(sentence))];
      const key = terms.sort((a, b) => (frequency.get(b)! - frequency.get(a)!) || b.length - a.length)[0];
      return key ? { sentence, key, terms: new Set(terms) } : null;
    })
    .filter((item): item is { sentence: string; key: string; terms: Set<string> } => item !== null);
  if (candidates.length === 0) return [];
  const step = Math.max(1, Math.floor(candidates.length / count));
  const picked = Array.from({ length: Math.min(count, candidates.length) }, (_, index) => candidates[(index * step) % candidates.length]!);
  const used = new Set<string>();
  return picked.flatMap((item, index) => {
    if (used.has(item.sentence)) return [];
    used.add(item.sentence);
    const [before, after] = item.sentence.toLowerCase().split(new RegExp(`\\b${escapeRegExp(item.key)}\\b`));
    const previousWord = before?.match(/([a-z-]+)\W*$/)?.[1];
    const nextWord = after?.match(/^\W*([a-z-]+)/)?.[1];
    // A distractor that forms a phrase found elsewhere in the material
    // ("standard error" for "sampling error") could also be right. Skip it.
    const fitsContext = (term: string) => (previousWord && lowered.includes(`${previousWord} ${term}`)) || (nextWord && lowered.includes(`${term} ${nextWord}`));
    const distractors = pool
      .filter((term) => term !== item.key && !item.terms.has(term) && term.slice(0, 5) !== item.key.slice(0, 5) && !fitsContext(term))
      .sort((a, b) => Math.abs(a.length - item.key.length) - Math.abs(b.length - item.key.length))
      .slice(0, 3);
    if (distractors.length < 3) return [];
    const correctIndex = index % 4;
    const options = [...distractors];
    options.splice(correctIndex, 0, item.key);
    const blanked = item.sentence.replace(new RegExp(`\\b${escapeRegExp(item.key)}\\b`, "i"), "_____");
    return [{
      prompt: `Which term completes this statement from the material? "${blanked}"`,
      options,
      correctIndex,
      explanation: `The material states: "${item.sentence}"`,
      sourceQuote: item.sentence,
    }];
  });
}
