"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { CATALOG_GUIDE_IDENTITY_COPY } from "@/ai/contracts";
import { Button } from "@/components/ui/button";

const GREETING = "How can I help you?";
const DEFAULT_CHIPS = ["Why is this first?", "Which gap does this address?"];

function guideStorageKey(assessmentId: string) {
  return `kaushal-guide-${assessmentId}`;
}

type CitedCourse = {
  courseId: string;
  title: string;
  provider: string;
  duration: string;
  competencyName?: string;
  sourceUrl: string;
  evidence: "title" | "detailed";
  note: string;
};

type GuideResponse = {
  gapSummary: string;
  unavailable: string;
  citedCourses: CitedCourse[];
};

type Exchange = {
  question: string;
  answer?: GuideResponse;
  error?: string;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeToMount() {
  return () => undefined;
}

function clientMounted() {
  return true;
}

function serverMounted() {
  return false;
}

function guideOverlay() {
  let host = document.getElementById("catalog-guide-overlay");
  if (!host) {
    host = document.createElement("div");
    host.id = "catalog-guide-overlay";
    document.documentElement.appendChild(host);
  }
  return host;
}

function AnswerBody({ answer }: { answer: GuideResponse }) {
  const cited = answer.citedCourses;
  const unavailable = answer.unavailable.trim();
  const summary = answer.gapSummary.trim();
  if (summary === CATALOG_GUIDE_IDENTITY_COPY) {
    return <div className="catalog-guide-copy">{summary.split("\n\n").map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>;
  }
  return <>
    {summary && cited.length === 0 && !unavailable ? <p className="catalog-guide-summary">{summary}</p> : null}
    {unavailable ? <p className="catalog-guide-unavailable">{unavailable}</p> : null}
    {cited.length > 0 ? <div className="catalog-guide-cards">{cited.map((course) => <article className="catalog-guide-card" key={course.courseId}>
      <strong>{course.title}</strong>
      <p className="catalog-guide-card-meta">{[course.provider, course.duration, course.competencyName].filter(Boolean).join(" · ")}</p>
      <p>{course.note}</p>
      {course.sourceUrl ? <a href={course.sourceUrl} rel="noreferrer" target="_blank">Open course</a> : null}
    </article>)}</div> : null}
    {!summary && !unavailable && cited.length === 0 ? <p className="catalog-guide-empty">No explanation is available for that question.</p> : null}
  </>;
}

export function CatalogGuidePanel({ assessmentId, recommendedCourseIds, chips = DEFAULT_CHIPS }: { assessmentId: string; recommendedCourseIds: string[]; chips?: string[] }) {
  const allowed = new Set(recommendedCourseIds);
  const titleId = useId();
  const inputId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const greetingPlayed = useRef(false);
  const ready = useSyncExternalStore(subscribeToMount, clientMounted, serverMounted);
  const [open, setOpen] = useState(false);
  const [typedGreeting, setTypedGreeting] = useState("");
  const [typing, setTyping] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);

  // Persist sessions across hard refresh; clears only on explicit new chat
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(guideStorageKey(assessmentId));
      if (raw) {
        const parsed = JSON.parse(raw) as Exchange[];
        if (Array.isArray(parsed)) setExchanges(parsed);
      } else {
        setExchanges([]);
      }
    } catch {
      setExchanges([]);
    }
    // Reset greeting animation for new assessment session
    greetingPlayed.current = false;
  }, [assessmentId]);

  useEffect(() => {
    try {
      if (exchanges.length === 0) {
        window.localStorage.removeItem(guideStorageKey(assessmentId));
      } else {
        window.localStorage.setItem(guideStorageKey(assessmentId), JSON.stringify(exchanges));
      }
    } catch {
      // ignore quota errors
    }
  }, [assessmentId, exchanges]);

  function newChat() {
    setExchanges([]);
    setQuestion("");
    try {
      window.localStorage.removeItem(guideStorageKey(assessmentId));
    } catch {}
    greetingPlayed.current = false;
    if (open) {
      if (prefersReducedMotion()) {
        setTypedGreeting(GREETING);
        setTyping(false);
        greetingPlayed.current = true;
      } else {
        setTypedGreeting("");
        setTyping(true);
        let index = 0;
        const timer = window.setInterval(() => {
          index += 1;
          setTypedGreeting(GREETING.slice(0, index));
          if (index >= GREETING.length) {
            window.clearInterval(timer);
            greetingPlayed.current = true;
            setTyping(false);
          }
        }, 55);
      }
    } else {
      setTypedGreeting("");
      setTyping(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    if (greetingPlayed.current || prefersReducedMotion()) {
      greetingPlayed.current = true;
      setTypedGreeting(GREETING);
      setTyping(false);
      return;
    }
    setTypedGreeting("");
    setTyping(true);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedGreeting(GREETING.slice(0, index));
      if (index >= GREETING.length) {
        window.clearInterval(timer);
        greetingPlayed.current = true;
        setTyping(false);
      }
    }, 55);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [open, typedGreeting, loading, exchanges]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        launcherRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setQuestion("");
    setExchanges((current) => [...current, { question: trimmed }]);
    setLoading(true);
    try {
      const response = await fetch("/api/learner/guide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessmentId, question: trimmed }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to explain catalog guide");
      const citedCourses = (body.citedCourses as CitedCourse[] ?? []).filter((course) => allowed.has(course.courseId));
      const answer = { gapSummary: String(body.gapSummary ?? ""), unavailable: String(body.unavailable ?? ""), citedCourses };
      setExchanges((current) => current.map((item, index) => index === current.length - 1 ? { ...item, answer } : item));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to explain catalog guide";
      setExchanges((current) => current.map((item, index) => index === current.length - 1 ? { ...item, error: message } : item));
    } finally {
      setLoading(false);
    }
  }

  const widget = <div className={`catalog-guide-widget${open ? " is-open" : ""}`}>
    {open ? <section className="catalog-guide-panel" role="dialog" aria-modal="false" aria-labelledby={titleId} aria-busy={loading}>
      <header className="catalog-guide-header">
        <img src="/kaushal-logo.svg" alt="" width={28} height={30} />
        <div>
          <p className="catalog-guide-kicker">Learning path guide</p>
          <h2 id={titleId}>Kaushal</h2>
        </div>
        <button className="catalog-guide-new-chat" type="button" onClick={newChat} aria-label="New chat" title="New chat">
          <Plus size={18} strokeWidth={2} />
        </button>
        <button className="catalog-guide-close" type="button" onClick={() => { setOpen(false); launcherRef.current?.focus(); }}>Close</button>
      </header>
      <div className="catalog-guide-thread" ref={threadRef}>
        <div className="catalog-guide-msg catalog-guide-msg-assistant" aria-live="polite">
          <p>{typedGreeting}{typing ? <span className="catalog-guide-caret" aria-hidden="true" /> : null}</p>
        </div>
        {exchanges.map((item, index) => <div className="catalog-guide-exchange" key={`${item.question}-${index}`}>
          <div className="catalog-guide-msg catalog-guide-msg-user"><p>{item.question}</p></div>
          {item.error ? <div className="alert catalog-guide-error" role="alert">{item.error}</div> : null}
          {item.answer ? <div className="catalog-guide-msg catalog-guide-msg-assistant"><AnswerBody answer={item.answer} /></div> : null}
        </div>)}
        {loading ? <p className="catalog-guide-status">Looking up the recommended courses…</p> : null}
      </div>
      {exchanges.length === 0 ? <div className="catalog-guide-chips">{chips.map((chip) => <button className="catalog-guide-chip" type="button" key={chip} disabled={loading} onClick={() => void ask(chip)}>{chip}</button>)}</div> : null}
      <form className="catalog-guide-form" action="#" method="post" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void ask(question); }}>
        <label htmlFor={inputId}>Question</label>
        <input id={inputId} ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask about a course on your path" autoComplete="off" disabled={loading} />
        <Button variant="primary" type="submit" disabled={loading || !question.trim()}>{loading ? "Asking…" : <>Ask <span aria-hidden="true">→</span></>}</Button>
      </form>
    </section> : null}
    <button
      ref={launcherRef}
      className="catalog-guide-launcher"
      type="button"
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={open ? "Close learning path guide" : "Open learning path guide"}
      onClick={() => setOpen((current) => !current)}
    >
      <img src="/kaushal-logo.svg" alt="" width={40} height={42} />
    </button>
  </div>;

  if (!ready) return null;
  return createPortal(widget, guideOverlay());
}
