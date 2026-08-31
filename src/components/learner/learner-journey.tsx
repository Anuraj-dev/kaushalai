"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

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
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        const list = await request("/api/officials?selectable=true");
        if (mounted) setOfficials(list);
        if (saved) {
          try {
            const restored = await request(`/api/learner/session?assessmentId=${encodeURIComponent(saved)}`);
            if (mounted) setSession(restored);
          } catch {
            window.localStorage.removeItem(storageKey);
          }
        }
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
    const round = session.assessment.currentRound ?? 1;
    setBusy(true); setError(null);
    setTransitionMessage(round === 1 ? "Preparing your personalized questions" : round === 2 ? "Reviewing your evidence and checking whether clarification is needed" : "Calculating your results and building your learning plan");
    try { const value = await request("/api/learner/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit-round", assessmentId: session.assessment.id, answers: currentQuestions.map((question) => ({ questionId: question.id, value: answers[question.id] })) }) }); setSession(value); setAnswers({}); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit this round"); }
    finally { setBusy(false); setTransitionMessage(null); }
  }

  function leaveAssessment() {
    window.localStorage.removeItem(storageKey);
    setSession(null);
    setAnswers({});
    setError(null);
  }

  async function completeCourse(item: Recommendation) {
    if (!session) return;
    setBusy(true); setError(null);
    try { const value = await request("/api/learner/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete-course", assessmentId: session.assessment.id, officialId: session.official.id, courseId: item.courseId, competencyId: item.competencyId }) }); setSession(value); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to record course completion"); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="loading-state surface"><span className="loading-mark" aria-hidden="true"/><p>Loading the official workspace…</p></div>;
  if (error && !session) return <div className="surface error-state"><div className="alert" role="alert">{error}</div><Button variant="primary" onClick={() => window.location.reload()}>Try again <span aria-hidden="true">→</span></Button></div>;
  if (!session) return <><header className="page-header"><div><h1>Select an official to begin</h1><p>Choose a sample profile and start the assessment</p></div><span className="tag">Official workspace</span></header><section className="surface picker-surface"><div className="section-intro"><div><span className="tag tag-lime">Seeded officials</span><h2>Select an official</h2></div></div><div className="official-picker">{officials.map((official) => <Button variant="ghost" className="official-choice" key={official.id} onClick={() => start(official.id)} disabled={busy}><span className="official-index" aria-hidden="true">{official.id.slice(-2)}</span><span className="official-copy"><strong>{official.name}</strong><span>{official.jobRoleName}</span><small>{official.employeeCode}</small></span><span className="choice-arrow" aria-hidden="true">↗</span></Button>)}</div></section></>;

  const isComplete = session.assessment.status === "completed" || session.assessment.status === "provisional";
  const currentStep = isComplete ? 4 : session.assessment.currentRound ?? 1;
  const steps = [{ number: "01", label: "Baseline", value: 1 }, { number: "02", label: "Adaptive", value: 2 }, { number: "03", label: "Clarify", value: 3 }, { number: "04", label: "Learning plan", value: 4 }];
  return <><div className="workspace-back"><Button className="back-button" variant="ghost" type="button" onClick={leaveAssessment} disabled={busy}>← Change official</Button></div><header className="page-header learner-header"><div><h1>{session.official.name}</h1><p>{session.official.jobRoleName}</p></div>{session.reassessmentInvited && <Button variant="secondary" onClick={() => start(session.official.id, "reassess")} disabled={busy}>Start reassessment <span aria-hidden="true">→</span></Button>}</header><ol className="stepper" aria-label="Assessment progress">{steps.map((step) => { const state = currentStep === step.value ? "current" : currentStep > step.value ? "done" : ""; return <li className={`step ${state}`} key={step.value} aria-current={state === "current" ? "step" : undefined}><b>{step.number}</b><span>{step.label}</span><span className="sr-only">{state === "current" ? "Current step" : state === "done" ? "Completed" : "Upcoming"}</span></li>; })}</ol>{error && <div className="alert" role="alert">{error}</div>}<div className="journey-grid"><div>{transitionMessage ? <RoundTransition message={transitionMessage}/> : <>{!isComplete && currentQuestions.length > 0 && <QuestionForm key={session.assessment.currentRound} questions={currentQuestions} answers={answers} setAnswers={setAnswers} onSubmit={submit} busy={busy} round={session.assessment.currentRound ?? 1} answered={answered}/>} {isComplete && <Results session={session} onComplete={completeCourse} busy={busy}/>}</>}</div><aside className="side-panel"><section className="surface glance-panel"><div className="panel-heading"><span className="tag tag-dark">At a glance</span><span className="panel-mark" aria-hidden="true">↗</span></div><div className="metric-strip"><div className="metric metric-primary"><strong>{session.dashboard.supportedCompetencies}/{session.dashboard.totalCompetencies}</strong><span>Supported</span></div><div className="metric"><strong>{session.dashboard.openGaps}</strong><span>Open gaps</span></div><div className="metric"><strong>{session.dashboard.completedCourses}</strong><span>Courses done</span></div></div></section><section className="surface history-panel"><div className="panel-heading"><span className="tag">Learning history</span><span className="panel-mark" aria-hidden="true">↘</span></div>{session.history.length === 0 ? <p className="muted">No prior course evidence.</p> : session.history.slice(0, 4).map((item) => <div className="history-item" key={item.id}><strong>{item.competencyName}</strong><span>{item.courseTitle ?? item.source} · level {item.level}</span></div>)}</section></aside></div></>;
}

function RoundTransition({ message }: { message: string }) {
  return <section className="surface round-transition" aria-live="polite" aria-busy="true"><span className="transition-spinner" aria-hidden="true"/><div><span className="tag tag-lime">Round complete</span><h2>{message}</h2><p>Keep this page open. Your answers are saved while Kaushal prepares the next step.</p></div><div className="transition-track" aria-hidden="true"><span/></div></section>;
}

function QuestionForm({ questions, answers, setAnswers, onSubmit, busy, round, answered }: { questions: Question[]; answers: Record<string, string>; setAnswers: (value: Record<string, string>) => void; onSubmit: () => void; busy: boolean; round: number; answered: number }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const roundName = round === 1 ? "Initial baseline" : round === 2 ? "Personalized evidence" : "Clarification";
  const currentQuestion = questions[currentIndex];
  const currentAnswered = Boolean(currentQuestion && answers[currentQuestion.id]?.trim());
  const remaining = questions.length - answered;
  const progress = questions.length === 0 ? 0 : Math.round((answered / questions.length) * 100);

  if (!currentQuestion) return null;

  function continueAssessment() {
    if (!currentAnswered) return;
    if (currentIndex < questions.length - 1) setCurrentIndex((index) => index + 1);
    else onSubmit();
  }

  return <form className="surface assessment-card" onSubmit={(event) => { event.preventDefault(); continueAssessment(); }}>
    <div className="round-heading"><div><span className="tag tag-lime">Round {round}</span><h2>{round === 1 ? "Show us how you work today" : "A few focused questions"}</h2></div><span className="round-kind">{roundName}</span></div>
    <p className="muted">{round === 1 ? "Choose the statement that best matches how you work today." : "Short answers help us understand the evidence behind your current level."}</p>
    <div className="question-progress" aria-label={`${answered} of ${questions.length} questions answered, ${remaining} remaining`}>
      <div className="progress-copy"><strong>Question {currentIndex + 1} of {questions.length}</strong><span>{remaining} {remaining === 1 ? "question" : "questions"} left</span></div>
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answered}><span style={{ width: `${progress}%` }}/></div>
    </div>
    <div className="question-tabs" role="tablist" aria-label="Questions">{questions.map((question, index) => <button id={`question-tab-${question.id}`} className={`question-tab ${index === currentIndex ? "current" : ""} ${answers[question.id]?.trim() ? "answered" : ""}`} type="button" role="tab" aria-selected={index === currentIndex} aria-controls={`question-${question.id}`} key={question.id} onClick={() => setCurrentIndex(index)}><span className="sr-only">Question </span>{index + 1}<span className="sr-only">{answers[question.id]?.trim() ? ", answered" : ", not answered"}</span></button>)}</div>
    <div className="question-list"><fieldset className="question" id={`question-${currentQuestion.id}`} role="tabpanel" aria-labelledby={`question-tab-${currentQuestion.id}`}>
      <legend className="question-prompt">{currentQuestion.prompt}</legend>
      <div className="question-context"><span className="tag">{currentQuestion.competencyName}</span><span>Question {String(currentIndex + 1).padStart(2, "0")}</span></div>
      {currentQuestion.format === "single_choice" ? <div className="choice-list">{currentQuestion.options.map((option) => <label className="choice-label" key={option.id}><input type="radio" name={currentQuestion.id} value={option.id} checked={answers[currentQuestion.id] === option.id} onChange={(event) => setAnswers({ ...answers, [currentQuestion.id]: event.target.value })}/><span>{option.text}</span></label>)}</div> : <textarea aria-label={`Answer: ${currentQuestion.prompt}`} value={answers[currentQuestion.id] ?? ""} onChange={(event) => setAnswers({ ...answers, [currentQuestion.id]: event.target.value })} placeholder="Write a concise example from your work…"/>}
    </fieldset></div>
    <div className="form-actions"><Button variant="secondary" type="button" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={busy || currentIndex === 0}>← Previous</Button><span className="answer-count"><strong>{answered}</strong> answered · {remaining} left</span><Button variant="primary" type="button" onClick={continueAssessment} disabled={busy || !currentAnswered}>{busy ? "Saving…" : currentIndex < questions.length - 1 ? "Next question" : round === 3 ? "Finish assessment" : "Continue"}<span aria-hidden="true">→</span></Button></div>
  </form>;
}

function Results({ session, onComplete, busy }: { session: Session; onComplete: (item: Recommendation) => void; busy: boolean }) {
  return <><section className="surface results-card"><div className="section-label"><span className="tag tag-lime">Assessment result</span>{session.assessment.provisional && <span className="tag">Provisional</span>}</div><h2>{session.assessment.provisional ? "A useful result, with room to confirm" : "Your competency picture"}</h2><p className="muted">Scores are calculated from your answers. Course completion adds history and does not rewrite this result.</p><div className="result-list">{session.results.map((result) => <div className="result-row" key={result.competencyId}><div><strong>{result.competencyName}</strong><div className="result-meta">Assessed {result.assessedLevel.toFixed(1)} · Required {result.requiredLevel} · Gap {result.gap.toFixed(1)} · {result.supported ? "supported" : "needs more evidence"}</div></div><div className={`confidence ${result.supported ? "confidence-supported" : ""}`}>{Math.round(result.confidence * 100)}% confidence</div></div>)}</div></section><section className="surface recommendation-card"><div className="section-label"><span className="tag tag-dark">Learning plan</span><span className="muted">Prioritized from current gaps</span></div><h2>Start with the highest-priority gaps</h2>{session.recommendations.length === 0 ? <p className="muted">No verified course is available for the current gaps.</p> : <div className="recommendation-list">{session.recommendations.map((item) => <div className="recommendation-row" key={item.id}><div><strong>{item.rank}. {item.title}</strong><div className="result-meta">{item.provider ?? "iGOT catalog"} {item.duration ? `· ${item.duration}` : ""}<br/>{item.rationale}</div></div><Button variant="secondary" onClick={() => onComplete(item)} disabled={busy}>Mark complete <span aria-hidden="true">→</span></Button></div>)}</div>}{session.reassessmentInvited && <div className="alert" style={{ marginTop: 20 }}>A course completion is recorded. Reassessment is available when you are ready.</div>}</section></>;
}
