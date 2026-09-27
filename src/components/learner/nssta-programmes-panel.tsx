"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { CalendarDays, Clock, ExternalLink } from "lucide-react";
import { focusClass } from "@/components/learner/learner-session";
import type { NsstaCalendarDocument, NsstaProgramme } from "@/services/nssta";

type NsstaResponse = {
  source: string;
  calendar: NsstaCalendarDocument;
  upcomingCount: number;
  matches: Array<{ competencyName: string; programmes: NsstaProgramme[] }>;
};

const DAY_MS = 86_400_000;

const formatDate = (value: string, withYear = true) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
const formatRange = (start: string, end: string | null) =>
  !end || end === start ? formatDate(start) : `${formatDate(start, start.slice(0, 4) !== end.slice(0, 4))} – ${formatDate(end)}`;
// The calendar writes a bare number in its "No. of weeks" columns.
const formatDuration = (value: string) => (/^\d+$/.test(value) ? `${value} ${value === "1" ? "week" : "weeks"}` : value);

/** "Starts tomorrow", "Starts in 9 days", "Starts in 3 months", counted in India's calendar days. */
function startsIn(startDate: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const days = Math.round((Date.parse(startDate) - Date.parse(today)) / DAY_MS);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const phrase = days < 60 ? rtf.format(days, "day") : rtf.format(Math.round(days / 30), "month");
  return { days, label: `Starts ${phrase}` };
}

type ProgrammeCard = { key: string; programme: NsstaProgramme; competencyNames: string[] };

/** One card per programme listing every gap it covers, soonest first; one programme often covers several gaps. */
function programmeCards(matches: NsstaResponse["matches"]): ProgrammeCard[] {
  const cards = new Map<string, ProgrammeCard>();
  for (const match of matches) {
    for (const programme of match.programmes) {
      const key = `${programme.section}-${programme.serial}-${programme.startDate}`;
      const card = cards.get(key) ?? { key, programme, competencyNames: [] };
      card.competencyNames.push(match.competencyName);
      cards.set(key, card);
    }
  }
  return [...cards.values()].sort((a, b) => a.programme.startDate!.localeCompare(b.programme.startDate!));
}

const gapNames = (names: string[]) =>
  names.map((name, index) => (
    <span key={name}>
      {index > 0 && (index === names.length - 1 ? " and " : ", ")}
      <strong>{name}</strong>
    </span>
  ));

/** Upcoming NSSTA classroom programmes from the live training calendar, matched to the official's gaps. */
export function NsstaProgrammesPanel({ competencyNames, jobRole, focus = null }: { competencyNames: string[]; jobRole: string; focus?: string | null }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; data: NsstaResponse }>({ status: "loading" });
  const query = competencyNames.length
    ? [...competencyNames.map((name) => `competency=${encodeURIComponent(name)}`), `role=${encodeURIComponent(jobRole)}`].join("&")
    : "";

  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    fetch(`/api/nssta/trainings?${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setState({ status: "ready", data: (await response.json()) as NsstaResponse });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });
    return () => controller.abort();
  }, [query]);

  if (!query) return null;
  const cards = state.status === "ready" ? programmeCards(state.data.matches) : [];

  return (
    <section className="nssta-section" aria-labelledby="nssta-title" aria-busy={state.status === "loading"}>
      <div className="plan-heading">
        <div>
          <h2 id="nssta-title">Upcoming NSSTA programmes</h2>
          <p className="plan-heading-note">
            <span className="source-badge source-badge-nssta">NSSTA</span> In person · seats by nomination from your office
          </p>
        </div>
        <span className="live-tag">
          <span className="live-dot" aria-hidden="true" /> Live calendar
        </span>
      </div>
      {state.status === "loading" && (
        <div className="recommendation-list" aria-hidden="true">
          {[0, 1].map((index) => (
            <div className="nssta-skeleton" key={index}>
              <span className="skeleton" />
              <span className="skeleton" />
              <span className="skeleton" />
            </div>
          ))}
        </div>
      )}
      {state.status === "error" && <p className="muted nssta-status">NSSTA is not reachable right now. Your iGOT plan is unaffected.</p>}
      {state.status === "ready" && cards.length === 0 && <p className="muted nssta-status">No upcoming NSSTA programme matches your gaps.</p>}
      {state.status === "ready" && cards.length > 0 && (
        <div className="recommendation-list">
          {cards.map(({ key, programme, competencyNames: covers }, index) => {
            const start = startsIn(programme.startDate!);
            const audience = [programme.venue, programme.participants && `for ${programme.participants}`].filter(Boolean).join(" · ");
            return (
              <article className={`course-card nssta-card ${focusClass(focus, covers)}`} key={key} style={{ "--i": index } as CSSProperties}>
                <a
                  className="course-card-link"
                  href={state.data.calendar.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${programme.topic}: open the NSSTA training calendar`}
                >
                  <div className="course-card-head">
                    <div className="course-card-top">
                      <span className="card-badges">
                        <span className="source-badge source-badge-nssta">NSSTA</span>
                        <span className="card-rank">{formatDate(programme.startDate!, false)}</span>
                      </span>
                      <span className="course-open-icon" aria-hidden="true">
                        <ExternalLink size={17} strokeWidth={1.7} aria-hidden="true" />
                      </span>
                    </div>
                    <h3 className="course-card-title">{programme.topic}</h3>
                  </div>
                  <div className="course-card-body">
                    <div className="course-card-stats">
                      <div className="course-stat">
                        <CalendarDays size={14} strokeWidth={1.7} aria-hidden="true" />
                        <div>
                          <span className="course-stat-label">Dates</span>
                          <span className="course-stat-value">{formatRange(programme.startDate!, programme.endDate)}</span>
                        </div>
                      </div>
                      {programme.duration && (
                        <div className="course-stat">
                          <Clock size={14} strokeWidth={1.7} aria-hidden="true" />
                          <div>
                            <span className="course-stat-label">Duration</span>
                            <span className="course-stat-value">{formatDuration(programme.duration)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <p className="course-card-rationale">
                      Covers your {gapNames(covers)} {covers.length === 1 ? "gap" : "gaps"}.
                    </p>
                  </div>
                </a>
                <div className="nssta-card-foot">
                  <span className={`nssta-countdown ${start.days <= 14 ? "is-soon" : ""}`}>
                    <span className="live-dot" aria-hidden="true" /> {start.label}
                  </span>
                  {audience && <small>{audience}</small>}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {state.status === "ready" && (
        <p className="nssta-links">
          <a className="text-link" href={state.data.calendar.url} target="_blank" rel="noreferrer">
            Full calendar <ExternalLink size={13} strokeWidth={1.7} aria-hidden="true" />
          </a>
          <a className="text-link" href={state.data.source} target="_blank" rel="noreferrer">
            nssta.gov.in <ExternalLink size={13} strokeWidth={1.7} aria-hidden="true" />
          </a>
        </p>
      )}
    </section>
  );
}
