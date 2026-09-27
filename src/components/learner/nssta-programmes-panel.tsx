"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, ExternalLink, MapPin, Users } from "lucide-react";
import type { NsstaCalendarDocument, NsstaProgramme } from "@/services/nssta";

type NsstaResponse = {
  source: string;
  calendar: NsstaCalendarDocument;
  upcomingCount: number;
  matches: Array<{ competencyName: string; programmes: NsstaProgramme[] }>;
};

const formatDate = (value: string, withYear = true) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
const formatRange = (start: string, end: string | null) =>
  !end || end === start ? formatDate(start) : `${formatDate(start, start.slice(0, 4) !== end.slice(0, 4))} – ${formatDate(end)}`;
// The calendar writes a bare number in its "No. of weeks" columns.
const formatDuration = (value: string) => (/^\d+$/.test(value) ? `${value} ${value === "1" ? "week" : "weeks"}` : value);

/** Upcoming NSSTA classroom programmes from the live training calendar, matched to the official's gaps. */
export function NsstaProgrammesPanel({ competencyNames, jobRole }: { competencyNames: string[]; jobRole: string }) {
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
  const matches = state.status === "ready" ? state.data.matches.filter((match) => match.programmes.length > 0) : [];

  return (
    <section className="nssta-section" aria-labelledby="nssta-title" aria-busy={state.status === "loading"}>
      <div className="plan-heading">
        <h2 id="nssta-title">Upcoming NSSTA programmes</h2>
        <span className="tag">Live · nssta.gov.in</span>
      </div>
      <p className="muted">
        In-person programmes from the National Statistical Systems Training Academy calendar that match your gaps. Seats are allotted by nomination: ask your
        controlling office to nominate you before the start date.
      </p>
      {state.status === "loading" && <p className="muted nssta-status">Reading the NSSTA training calendar…</p>}
      {state.status === "error" && <p className="muted nssta-status">NSSTA is not reachable right now. Your iGOT plan above is unaffected.</p>}
      {state.status === "ready" && matches.length === 0 && (
        <p className="muted nssta-status">No upcoming NSSTA programme matches your current gaps. The full calendar lists every programme.</p>
      )}
      {matches.map((match) => (
        <div className="nssta-group" key={match.competencyName}>
          <h3 className="plan-summary-label">{match.competencyName}</h3>
          <ul className="nssta-list">
            {match.programmes.map((programme) => (
              <li className="nssta-card" key={`${programme.section}-${programme.serial}-${programme.startDate}`}>
                <span className="nssta-when">
                  <CalendarDays size={14} strokeWidth={1.7} aria-hidden="true" /> {formatRange(programme.startDate!, programme.endDate)}
                </span>
                <strong>{programme.topic}</strong>
                <span className="nssta-meta">
                  {programme.venue && (
                    <span>
                      <MapPin size={13} strokeWidth={1.7} aria-hidden="true" /> {programme.venue}
                    </span>
                  )}
                  {programme.duration && (
                    <span>
                      <Clock size={13} strokeWidth={1.7} aria-hidden="true" /> {formatDuration(programme.duration)}
                    </span>
                  )}
                  {programme.participants && (
                    <span>
                      <Users size={13} strokeWidth={1.7} aria-hidden="true" /> {programme.participants}
                    </span>
                  )}
                </span>
                <small>{programme.section}</small>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {state.status === "ready" && (
        <p className="nssta-links">
          <a className="text-link" href={state.data.calendar.url} target="_blank" rel="noreferrer">
            {state.data.calendar.title} <ExternalLink size={13} strokeWidth={1.7} aria-hidden="true" />
          </a>
          <a className="text-link" href={state.data.source} target="_blank" rel="noreferrer">
            NSSTA website <ExternalLink size={13} strokeWidth={1.7} aria-hidden="true" />
          </a>
        </p>
      )}
    </section>
  );
}
