import { describe, expect, it } from "vitest";
import { parseCalendarLayout, parseDateRange, type PageLayout, type Rect, type TextItem } from "./nssta-calendar";

const COLUMNS = { serial: [20, 50], topic: [50, 200], participants: [200, 300], dates: [300, 380], duration: [380, 450], venue: [450, 570] } as const;
type Column = keyof typeof COLUMNS;

/** One table row: a cell per column, each holding its lines of text from the top down. */
function row(y0: number, y1: number, values: Partial<Record<Column, string[]>>): PageLayout {
  const cells: Rect[] = [];
  const items: TextItem[] = [];
  for (const [column, [x0, x1]] of Object.entries(COLUMNS) as Array<[Column, readonly [number, number]]>) {
    cells.push({ x0, y0, x1, y1 });
    (values[column] ?? []).forEach((text, line) => {
      const y = y1 - 14 * (line + 1);
      items.push({ x: x0 + 4, y, width: text.length * 5, text });
      // Mirror PDFs that also clip each line inside its cell.
      cells.push({ x0: x0 + 2, y0: y - 2, x1: x1 - 2, y1: y + 12 });
    });
  }
  return { cells, items };
}
const page = (...parts: PageLayout[]): PageLayout => ({ cells: parts.flatMap((part) => part.cells), items: parts.flatMap((part) => part.items) });
const header = (y0: number) =>
  row(y0, y0 + 40, { serial: ["Sr", ".", "no"], topic: ["Module/Topic"], participants: ["Level of", "Participants"], dates: ["Dates"], duration: ["No. of", "Weeks/days"], venue: ["Venue"] });
const title = (y: number, text: string): PageLayout => ({ cells: [], items: [{ x: 150, y, text }] });

describe("parseCalendarLayout", () => {
  const pages = [
    page(
      { cells: [], items: [{ x: 90, y: 800, text: "Advance Training Calendar of NSSTA for FY 2026-27" }] },
      title(700, "SSS Refresher training for SSOs and JSOs"),
      header(640),
      row(570, 640, { serial: ["1"], topic: ["Handling Large Scale Data", "& Data Analytics using R"], participants: ["SSO"], dates: ["21 September -", "25 September,", "2026"], duration: ["1 week"], venue: ["IASRI Delhi"] }),
      row(530, 570, { serial: ["2"], topic: ["Pay Fixation"], participants: ["JSO"], dates: ["TBD"], duration: ["1"], venue: ["NSSTA"] }),
    ),
    page(row(700, 760, { serial: ["3"], topic: ["Communication and", "Presentation Skills"], participants: ["SSO & JSO"], dates: ["07.12.2026 to", "11.12.2026"], duration: ["1 week"], venue: ["HIPA Shimla"] })),
  ];

  it("rebuilds multi-line cells into one entry per serial number", () => {
    expect(parseCalendarLayout(pages)[0]).toEqual({
      section: "SSS Refresher training for SSOs and JSOs",
      serial: 1,
      topic: "Handling Large Scale Data & Data Analytics using R",
      participants: "SSO",
      dates: "21 September - 25 September, 2026",
      startDate: "2026-09-21",
      endDate: "2026-09-25",
      duration: "1 week",
      venue: "IASRI Delhi",
    });
  });

  it("keeps undated rows and continues a table onto the next page", () => {
    const [, undated, continued] = parseCalendarLayout(pages);
    expect(undated).toMatchObject({ serial: 2, dates: "TBD", startDate: null });
    expect(continued).toMatchObject({ section: "SSS Refresher training for SSOs and JSOs", serial: 3, topic: "Communication and Presentation Skills", startDate: "2026-12-07" });
  });
});

describe("parseDateRange", () => {
  it.each([
    ["01-06-2026 to 05-06- 2026", "2026-06-01", "2026-06-05"],
    ["27.07.2026 to21.08.2026", "2026-07-27", "2026-08-21"],
    ["06 July - 24 July, 2026", "2026-07-06", "2026-07-24"],
    ["28 December - 01 January, 2027", "2026-12-28", "2027-01-01"],
    ["07.09.2026 to 13.11.2026 (online 10 weeks) & 23.11.2026 to 04.12.2026 (Offline 2 Weeks)", "2026-09-07", "2026-12-04"],
    ["23.04.2026", "2026-04-23", "2026-04-23"],
  ])("reads %s", (value, start, end) => {
    expect(parseDateRange(value)).toEqual({ start, end });
  });

  it("returns null when dates are to be decided", () => {
    expect(parseDateRange("TBD")).toBeNull();
  });
});
