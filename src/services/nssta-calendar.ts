/**
 * Parser for NSSTA's "Advance Training Calendar" PDF, the only public source of upcoming
 * programmes. The PDF is a set of tables exported from a word processor: every table cell is
 * drawn as its own clip rectangle, so rows are rebuilt from cell geometry rather than from the
 * visual text layout, where multi-line cells interleave.
 */

export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type TextItem = { x: number; y: number; width?: number; text: string };
export type PageLayout = { cells: Rect[]; items: TextItem[] };

export type CalendarEntry = {
  section: string;
  serial: number;
  topic: string;
  participants: string | null;
  dates: string | null;
  startDate: string | null;
  endDate: string | null;
  duration: string | null;
  venue: string | null;
};

type Field = "serial" | "topic" | "participants" | "dates" | "duration" | "venue";
type Column = { field: Field; x0: number; x1: number };
type Table = { section: string; columns: Column[] };

const clean = (value: string) => value.replace(/\s+/g, " ").replace(/\s+([,)])/g, "$1").replace(/\(\s+/g, "(").trim();

function fieldFor(header: string): Field | null {
  const text = header.toLowerCase();
  if (/^s(r)?no$/.test(text.replace(/[\s.]/g, ""))) return "serial";
  if (/module|topic/.test(text)) return "topic";
  if (/level of participants/.test(text)) return "participants";
  if (/^dates?$/.test(text)) return "dates";
  if (/weeks|days/.test(text)) return "duration";
  if (/^venue$/.test(text)) return "venue";
  return null;
}

const contains = (cell: Rect, item: TextItem) => item.x + 1 >= cell.x0 && item.x + 1 <= cell.x1 && item.y + 2 >= cell.y0 && item.y + 2 <= cell.y1;
const within = (inner: Rect, outer: Rect) =>
  inner !== outer && inner.x0 >= outer.x0 - 0.5 && inner.x1 <= outer.x1 + 0.5 && inner.y0 >= outer.y0 - 0.5 && inner.y1 <= outer.y1 + 0.5;
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Reads a cell's text top to bottom, left to right. */
function textOf(items: TextItem[]) {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const item of sorted) {
    const line = lines.at(-1);
    if (line && Math.abs(line[0]!.y - item.y) <= 3) line.push(item);
    else lines.push([item]);
  }
  // pdf.js splits words into separate items, sometimes without a space item between them.
  const joinLine = (line: TextItem[]) =>
    line
      .sort((a, b) => a.x - b.x)
      .map((item, index) => {
        const previous = line[index - 1];
        return previous?.width !== undefined && item.x - (previous.x + previous.width) > 1 ? ` ${item.text}` : item.text;
      })
      .join("");
  return clean(lines.map(joinLine).join(" "));
}

/** Builds calendar entries from the cell rectangles and text positions of every page. */
export function parseCalendarLayout(pages: PageLayout[]): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  let table: Table | null = null;

  for (const page of pages) {
    // Some pages also clip each text line inside its cell, so a cell is an outermost rectangle.
    const outermost = page.cells.filter((rect) => !page.cells.some((outer) => within(rect, outer)));
    const cellItems = new Map<Rect, TextItem[]>();
    const loose: TextItem[] = [];
    for (const item of page.items) {
      if (!item.text.trim()) continue;
      const cell = outermost.find((candidate) => contains(candidate, item));
      if (cell) cellItems.set(cell, [...(cellItems.get(cell) ?? []), item]);
      else loose.push(item);
    }
    const cells = [...cellItems].map(([rect, items]) => ({ ...rect, text: textOf(items) }));

    // A header row is the set of cells level with a "Venue" cell.
    const headers = cells
      .filter((cell) => fieldFor(cell.text) === "venue")
      .map((venue) => cells.filter((cell) => Math.abs(cell.y0 - venue.y0) < 2 && Math.abs(cell.y1 - venue.y1) < 2))
      .sort((a, b) => b[0]!.y1 - a[0]!.y1);
    const headerTops = headers.map((row) => Math.max(...row.map((cell) => cell.y1)));

    const tableAt = (y: number): Table | null => {
      const index = headerTops.findLastIndex((top) => top >= y);
      if (index === -1) return table;
      const row = headers[index]!;
      const top = headerTops[index]!;
      const titleLines = [...loose, ...cells.flatMap((cell) => (cell.x1 - cell.x0 > 400 ? [{ x: cell.x0, y: cell.y0, text: cell.text }] : []))]
        .filter((item) => item.y > top && item.y <= top + 70 && !/advance training calendar/i.test(item.text));
      const section = textOf(titleLines.filter((item) => item.y <= Math.min(...titleLines.map((line) => line.y)) + 16)) || table?.section || "NSSTA programme";
      const columns = row.flatMap((cell) => {
        const field = fieldFor(cell.text);
        return field ? [{ field, x0: cell.x0, x1: cell.x1 }] : [];
      });
      return { section, columns };
    };

    const serialCells = cells.filter((cell) => /^\d+(\s\d+)*$/.test(cell.text)).sort((a, b) => b.y1 - a.y1);
    for (const serialCell of serialCells) {
      const current = tableAt(serialCell.y1);
      const serialColumn = current?.columns.find((column) => column.field === "serial");
      if (!current || !serialColumn || overlap(serialCell.x0, serialCell.x1, serialColumn.x0, serialColumn.x1) <= 0) continue;
      const height = serialCell.y1 - serialCell.y0;
      const values: Partial<Record<Field, string>> = {};
      for (const cell of cells) {
        if (overlap(cell.y0, cell.y1, serialCell.y0, serialCell.y1) < height * 0.5) continue;
        const column = current.columns
          .map((candidate) => ({ candidate, shared: overlap(cell.x0, cell.x1, candidate.x0, candidate.x1) }))
          .sort((a, b) => b.shared - a.shared)[0];
        if (column && column.shared > 0 && !values[column.candidate.field]) values[column.candidate.field] = cell.text;
      }
      if (!values.topic) continue;
      const range = parseDateRange(values.dates ?? "");
      entries.push({
        section: current.section,
        serial: Number(serialCell.text.split(" ")[0]),
        topic: values.topic,
        participants: values.participants ?? null,
        dates: values.dates ?? null,
        startDate: range?.start ?? null,
        endDate: range?.end ?? null,
        duration: values.duration ?? null,
        venue: values.venue ?? null,
      });
    }
    table = headers.length ? tableAt(headerTops.at(-1)! - 1) : table;
  }
  return entries;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const iso = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * Reads the first and last date from the calendar's mixed formats: "01-06-2026 to 05-06-2026",
 * "20.07.2026 to 24.07.2026", "06 July - 24 July, 2026" and single dates. Returns null for "TBD".
 */
export function parseDateRange(value: string): { start: string; end: string } | null {
  const text = value.replace(/\s+/g, " ");
  const numeric = [...text.matchAll(/(\d{1,2})\s?[-.]\s?(\d{1,2})\s?[-.]\s?(\d{4})/g)].map((match) => iso(Number(match[3]), Number(match[2]), Number(match[1])));
  if (numeric.length) return { start: numeric[0]!, end: numeric.at(-1)! };

  const named = [...text.matchAll(/(\d{1,2})\s*([A-Za-z]+),?\s*(\d{4})?/g)].flatMap((match) => {
    const month = MONTHS.indexOf(match[2]!.toLowerCase()) + 1;
    return month ? [{ day: Number(match[1]), month, year: match[3] ? Number(match[3]) : null }] : [];
  });
  if (!named.length) return null;
  const year = named.findLast((date) => date.year)?.year;
  if (!year) return null;
  const first = named[0]!;
  const last = named.at(-1)!;
  const endYear = last.year ?? year;
  // "28 December - 01 January, 2027" starts in the previous year.
  const startYear = first.year ?? (first.month > last.month ? endYear - 1 : endYear);
  return { start: iso(startYear, first.month, first.day), end: iso(endYear, last.month, last.day) };
}

/** Extracts cell rectangles and positioned text from each page of the calendar PDF. */
export async function readCalendarPdf(bytes: Uint8Array): Promise<PageLayout[]> {
  const { getDocumentProxy, getResolvedPDFJS } = await import("unpdf");
  const { OPS } = await getResolvedPDFJS();
  const pdf = await getDocumentProxy(bytes);
  const pages: PageLayout[] = [];
  for (let number = 1; number <= pdf.numPages; number += 1) {
    const page = await pdf.getPage(number);
    const { width } = page.getViewport({ scale: 1 });
    const operators = await page.getOperatorList();
    const seen = new Set<string>();
    const rects: Rect[] = [];
    operators.fnArray.forEach((fn, index) => {
      if (fn !== OPS.constructPath) return;
      const box = operators.argsArray[index]?.[2] as ArrayLike<number> | undefined;
      if (!box || box.length < 4) return;
      const rect = { x0: box[0]!, y0: box[1]!, x1: box[2]!, y1: box[3]! };
      // Skip border strokes and the full-page clip; keep real cells once.
      if (rect.x1 - rect.x0 < 4 || rect.y1 - rect.y0 < 4 || rect.x1 - rect.x0 >= width - 1) return;
      const key = [rect.x0, rect.y0, rect.x1, rect.y1].map((n) => n.toFixed(1)).join();
      if (seen.has(key)) return;
      seen.add(key);
      rects.push(rect);
    });
    const content = await page.getTextContent();
    const items = content.items.flatMap((item) => ("str" in item ? [{ x: item.transform[4] as number, y: item.transform[5] as number, width: item.width, text: item.str }] : []));
    pages.push({ cells: rects, items });
  }
  await pdf.cleanup();
  return pages;
}
