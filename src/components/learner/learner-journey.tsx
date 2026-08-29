"use client";

import { useEffect, useMemo, useState } from "react";

type Official = { id: string; name: string; jobRoleName: string; employeeCode: string };
type Question = { id: string; competencyId: string; competencyName: string; format: "single_choice" | "short_text"; prompt: string; options: Array<{ id: string; text: string }> };
type Result = { competencyId: string; competencyName: string; assessedLevel: number; requiredLevel: number; gap: number; priority: number; confidence: number; supported: boolean; evidence: Array<{ reason: string; source: string }> };
type Recommendation = { id: string; courseId: string; competencyId: string; title: string; provider: string | null; duration: string | null; rank: number; rationale: string };
type Session = { official: Official; matrix: { versionId: string; version: number; competencies: Array<{ competencyId: string; name: string; requiredLevel: number; importance: number }> }; history: Array<{ id: string; competencyName: string; source: string; level: number; courseTitle: string | null }>; assessment: { id: string; status: string; currentRound: number | null; roundKind: string | null; questions: Question[]; provisional: boolean }; results: Result[]; recommendations: Recommendation[]; reassessmentInvited: boolean; dashboard: { supportedCompetencies: number; totalCompetencies: number; openGaps: number; completedCourses: number } };

const storageKey = "kaushal-active-assessment";
const request = async (url: string, init?: RequestInit) => { const response = await fetch(url, init); const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Something went wrong"); return body; };

export function LearnerJourney() {
  const [officials, setOfficials] = useState<Official[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (saved) { const restored = await request(`/api/learner/session?assessmentId=${encodeURIComponent(saved)}`); if (mounted) setSession(restored); }
        const list = await request("/api/officials?selectable=true");
        if (mounted) setOfficials(list);
      } catch (cause) { if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load the official workspace"); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, []);

  const currentQuestions = useMemo(() => session?.assessment.questions ?? [], [session]);
  const answered = useMemo(() => currentQuestions.filter((question) => answers[question.id]?.trim()).length, [answers, currentQuestions]);

  async function start(officialId: string, action: "start" | "reassess" = "start") {
    setBusy(true); setError(null);
    try { const value = await request("/api/learner/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, officialId }) }); setSession(value); window.localStorage.setItem(storageKey, value.assessment.id); setAnswers({}); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to start assessment"); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!session || answered !== currentQuestions.length) { setError("Answer every question before continuing."); return; }
    setBusy(true); setError(null);
    try { const value = await request("/api/learner/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit-round", assessmentId: session.assessment.id, answers: currentQuestions.map((question) => ({ questionId: question.id, value: answers[question.id] })) }) }); setSession(value); setAnswers({}); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit this round"); }
    finally { setBusy(false); }
  }

  async function completeCourse(item: Recommendation) {
    if (!session) return;
    setBusy(true); setError(null);
    try { const value = await request("/api/learner/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete-course", assessmentId: session.assessment.id, officialId: session.official.id, courseId: item.courseId, competencyId: item.competencyId }) }); setSession(value); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record course completion"); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="surface"><p>Loading the official workspace…</p></div>;
  if (error && !session) return <div className="surface"><div className="alert" role="alert">{error}</div><button className="button button-primary" onClick={() => window.location.reload()}>Try again</button></div>;
  if (!session) return <><header className="page-header"><div><p className="eyebrow">Official workspace</p><h1>Choose an official to assess</h1><p>Use one of the seeded personas to walk through an evidence-based competency assessment.</p></div></header><section className="surface"><h2>Demo officials</h2><p className="muted">Each persona has a different role matrix and learning context.</p><div className="official-picker">{officials.map((official) => <button className="official-choice" key={official.id} onClick={() => start(official.id)} disabled={busy}><strong>{official.name}</strong><span>{official.jobRoleName}<br/>{official.employeeCode}</span></button>)}</div></section></>;

  const isComplete = session.assessment.status === "completed" || session.assessment.status === "provisional";
  const currentStep = isComplete ? 4 : session.assessment.currentRound ?? 1;
  return <><header className="page-header"><div><p className="eyebrow">Official workspace · {session.official.employeeCode}</p><h1>{session.official.name}</h1><p>{session.official.jobRoleName} · matrix v{session.matrix.version}</p></div>{session.reassessmentInvited && <button className="button button-secondary" onClick={() => start(session.official.id, "reassess")} disabled={busy}>Start reassessment</button>}</header><div className="stepper" aria-label="Assessment progress"><span className={`step ${currentStep === 1 ? "current" : ""}`}>01 Baseline</span><span className={`step ${currentStep === 2 ? "current" : ""}`}>02 Adaptive</span><span className={`step ${currentStep === 3 ? "current" : ""}`}>03 Clarify</span><span className={`step ${isComplete ? "current" : ""}`}>04 Learning plan</span></div>{error && <div className="alert" role="alert">{error}</div>}<div className="journey-grid"><div>{!isComplete && currentQuestions.length > 0 && <QuestionForm questions={currentQuestions} answers={answers} setAnswers={setAnswers} onSubmit={submit} busy={busy} round={session.assessment.currentRound ?? 1} answered={answered}/>} {isComplete && <Results session={session} onComplete={completeCourse} busy={busy}/>}</div><aside className="side-panel"><section className="surface"><h2>At a glance</h2><div className="metric-strip"><div className="metric"><strong>{session.dashboard.supportedCompetencies}/{session.dashboard.totalCompetencies}</strong><span>Supported</span></div><div className="metric"><strong>{session.dashboard.openGaps}</strong><span>Open gaps</span></div><div className="metric"><strong>{session.dashboard.completedCourses}</strong><span>Courses done</span></div></div></section><section className="surface"><h2>Learning history</h2>{session.history.length === 0 ? <p className="muted">No prior course evidence.</p> : session.history.slice(0, 4).map((item) => <div className="history-item" key={item.id}><strong>{item.competencyName}</strong><br/>{item.courseTitle ?? item.source} · level {item.level}</div>)}</section></aside></div></>;
}

function QuestionForm({ questions, answers, setAnswers, onSubmit, busy, round, answered }: { questions: Question[]; answers: Record<string, string>; setAnswers: (value: Record<string, string>) => void; onSubmit: () => void; busy: boolean; round: number; answered: number }) {
  return <section className="surface"><p className="eyebrow">Round {round} · {round === 1 ? "Fixed baseline" : round === 2 ? "Personalized evidence" : "Clarification"}</p><h2>{round === 1 ? "Show us how you work today" : "A few focused questions"}</h2><p className="muted">{round === 1 ? "Choose the statement that best matches your current practice for each competency." : "Short answers help us understand the evidence behind your current level."}</p><div className="question-list">{questions.map((question, index) => <div className="question" key={question.id}><h3><span className="muted">{index + 1}. </span>{question.prompt}</h3>{question.format === "single_choice" ? <div className="choice-list">{question.options.map((option) => <label className="choice-label" key={option.id}><input type="radio" name={question.id} value={option.id} checked={answers[question.id] === option.id} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })}/><span>{option.text}</span></label>)}</div> : <textarea aria-label={question.prompt} value={answers[question.id] ?? ""} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} placeholder="Write a concise example from your work…"/>}</div>)}</div><div className="form-actions"><span className="muted">{answered} of {questions.length} answered</span><button className="button button-primary" onClick={onSubmit} disabled={busy}>{busy ? "Saving…" : round === 3 ? "Finish assessment" : "Continue"}</button></div></section>;
}

function Results({ session, onComplete, busy }: { session: Session; onComplete: (item: Recommendation) => void; busy: boolean }) {
  return <><section className="surface"><p className="eyebrow">Assessment result {session.assessment.provisional && "· provisional"}</p><h2>{session.assessment.provisional ? "A useful result, with room to confirm" : "Your competency picture"}</h2><p className="muted">Scores are calculated from your answers against matrix v{session.matrix.version}. Course completion adds history and does not rewrite this result.</p><div className="result-list">{session.results.map((result) => <div className="result-row" key={result.competencyId}><div><strong>{result.competencyName}</strong><div className="result-meta">Assessed {result.assessedLevel.toFixed(1)} · Required {result.requiredLevel} · Gap {result.gap.toFixed(1)} · {result.supported ? "supported" : "needs more evidence"}</div></div><div className="confidence">{Math.round(result.confidence * 100)}% confidence</div></div>)}</div></section><section className="surface" style={{ marginTop: 16 }}><p className="eyebrow">Learning plan</p><h2>Start with the highest-priority gaps</h2>{session.recommendations.length === 0 ? <p className="muted">No verified course is available for the current gaps.</p> : <div className="recommendation-list">{session.recommendations.map((item) => <div className="recommendation-row" key={item.id}><div><strong>{item.rank}. {item.title}</strong><div className="result-meta">{item.provider ?? "iGOT catalog"} {item.duration ? `· ${item.duration}` : ""}<br/>{item.rationale}</div></div><button className="button button-secondary" onClick={() => onComplete(item)} disabled={busy}>Mark complete</button></div>)}</div>}{session.reassessmentInvited && <div className="alert" style={{ marginTop: 20 }}>A course completion is recorded. Reassessment is available when you are ready.</div>}</section></>;
}
