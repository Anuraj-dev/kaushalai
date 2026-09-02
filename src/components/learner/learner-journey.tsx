"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CatalogGuidePanel } from "@/components/learner/catalog-guide-panel";
import {
  LOGIN_PATH,
  PLAN_PATH,
  clearSession,
  isAssessmentComplete,
  persistSession,
  request,
  storageKey,
  waitForPlanCraft,
  type Question,
  type Session,
} from "@/components/learner/learner-session";
import { PlanCraftLoader } from "@/components/learner/plan-craft-loader";
import { Button } from "@/components/ui/button";

const assessmentSteps = [
  { number: "01", label: "Baseline", value: 1 },
  { number: "02", label: "Adaptive", value: 2 },
  { number: "03", label: "Clarify", value: 3 },
];

export function LearnerJourney() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [crafting, setCrafting] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (!saved) {
          if (mounted) {
            router.replace(LOGIN_PATH);
            setLoading(false);
          }
          return;
        }
        try {
          const restored = await request(`/api/learner/session?assessmentId=${encodeURIComponent(saved)}`);
          if (!mounted) return;
          persistSession(restored);
          if (isAssessmentComplete(restored)) {
            router.replace(PLAN_PATH);
            return;
          }
          setSession(restored);
        } catch {
          clearSession();
          if (mounted) router.replace(LOGIN_PATH);
        }
      } catch (cause) {
        if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load the official workspace");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  const currentQuestions = useMemo(() => session?.assessment.questions ?? [], [session]);
  const answered = useMemo(() => currentQuestions.filter((question) => answers[question.id]?.trim()).length, [answers, currentQuestions]);

  async function submit() {
    if (!session || answered !== currentQuestions.length) {
      setError("Answer every question before continuing.");
      return;
    }
    const round = session.assessment.currentRound ?? 1;
    setBusy(true);
    setError(null);
    const finishing = round === 3;
    setTransitionMessage(round === 1 ? "Preparing your personalized questions" : round === 2 ? "Reviewing your evidence and checking whether clarification is needed" : "Crafting your personalized learning plan");
    try {
      const value = await request("/api/learner/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit-round", assessmentId: session.assessment.id, answers: currentQuestions.map((question) => ({ questionId: question.id, value: answers[question.id] })) }) });
      persistSession(value);
      setAnswers({});
      if (isAssessmentComplete(value)) {
        setCrafting(true);
        setTransitionMessage("Crafting your personalized learning plan");
        await waitForPlanCraft();
        router.push(PLAN_PATH);
        return;
      }
      setSession(value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit this round");
    } finally {
      setBusy(false);
      if (!finishing) setTransitionMessage(null);
    }
  }

  function leaveAssessment() {
    clearSession();
    setSession(null);
    setAnswers({});
    setError(null);
    router.push(LOGIN_PATH);
  }

  if (loading) return <LoadingWorkspace />;
  if (crafting) return <PlanCraftLoader />;
  if (error && !session) {
    return (
      <div className="surface error-state">
        <div className="alert" role="alert">{error}</div>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Try again <span aria-hidden="true">→</span>
        </Button>
      </div>
    );
  }
  if (!session) return <div className="loading-state surface"><span className="loading-mark" aria-hidden="true" /><p>Redirecting to sign in…</p></div>;

  const currentStep = session.assessment.currentRound ?? 1;
  return (
    <>
      <div className="workspace-back">
        <Button className="back-button" variant="ghost" type="button" onClick={leaveAssessment} disabled={busy}>
          ← Change official
        </Button>
      </div>
      <header className="page-header learner-header">
        <div>
          <h1>{session.official.name}</h1>
          <p>{session.official.jobRoleName}</p>
        </div>
      </header>
      <ol className="stepper stepper-rounds" aria-label="Assessment progress">
        {assessmentSteps.map((step) => {
          const state = currentStep === step.value ? "current" : currentStep > step.value ? "done" : "";
          return (
            <li className={`step ${state}`} key={step.value} aria-current={state === "current" ? "step" : undefined}>
              <b>{step.number}</b>
              <span>{step.label}</span>
              <span className="sr-only">{state === "current" ? "Current step" : state === "done" ? "Completed" : "Upcoming"}</span>
            </li>
          );
        })}
      </ol>
      {error && <div className="alert" role="alert">{error}</div>}
      {transitionMessage ? (
        <RoundTransition message={transitionMessage} />
      ) : (
        currentQuestions.length > 0 && (
          <QuestionForm
            key={session.assessment.currentRound}
            questions={currentQuestions}
            answers={answers}
            setAnswers={setAnswers}
            onSubmit={submit}
            busy={busy}
            round={session.assessment.currentRound ?? 1}
          />
        )
      )}
      <CatalogGuidePanel
        assessmentId={session.assessment.id}
      />
    </>
  );
}

function LoadingWorkspace() {
  return (
    <section className="loading-workspace" aria-busy="true" aria-live="polite">
      <div className="loading-header">
        <div>
          <span className="tag tag-lime">Official workspace</span>
          <h1>
            Preparing your
            <br />
            official workspace
          </h1>
          <p>Loading seeded profiles and checking for a saved assessment.</p>
        </div>
        <div className="loading-status">
          <span className="loading-mark" aria-hidden="true" />
          <span>Loading workspace data</span>
          <b>01</b>
        </div>
      </div>
      <div className="loading-progress" aria-hidden="true">
        <span />
      </div>
      <div className="loading-grid" aria-hidden="true">
        <div className="loading-panel loading-panel-main">
          <div className="skeleton skeleton-tag" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-copy" />
          <div className="skeleton-list">
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </div>
        </div>
        <div className="loading-panel loading-panel-side">
          <div className="skeleton skeleton-tag" />
          <div className="skeleton skeleton-metric" />
          <div className="skeleton skeleton-metric short" />
          <div className="skeleton skeleton-copy short" />
        </div>
      </div>
    </section>
  );
}

function RoundTransition({ message }: { message: string }) {
  return (
    <section className="surface round-transition" aria-live="polite" aria-busy="true">
      <span className="transition-spinner" aria-hidden="true" />
      <div>
        <span className="tag tag-lime">Round complete</span>
        <h2>{message}</h2>
        <p>Keep this page open. Your answers are saved while Kaushal prepares the next step.</p>
      </div>
      <div className="transition-track" aria-hidden="true">
        <span />
      </div>
    </section>
  );
}

function QuestionForm({
  questions,
  answers,
  setAnswers,
  onSubmit,
  busy,
  round,
}: {
  questions: Question[];
  answers: Record<string, string>;
  setAnswers: (value: Record<string, string>) => void;
  onSubmit: () => void;
  busy: boolean;
  round: number;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQuestion = questions[currentIndex];
  const currentAnswered = Boolean(currentQuestion && answers[currentQuestion.id]?.trim());
  const committed = questions.filter((question, index) => index !== currentIndex && answers[question.id]?.trim()).length;
  const remaining = Math.max(0, questions.length - committed - 1);
  const progress = questions.length === 0 ? 0 : Math.round((committed / questions.length) * 100);

  if (!currentQuestion) return null;

  function continueAssessment() {
    if (!currentAnswered) return;
    if (currentIndex < questions.length - 1) setCurrentIndex((index) => index + 1);
    else onSubmit();
  }

  return (
    <form
      className="surface assessment-card"
      onSubmit={(event) => {
        event.preventDefault();
        continueAssessment();
      }}
    >
      <div className="question-progress" aria-label={`${committed} of ${questions.length} questions completed, ${remaining} remaining after this one`}>
        <div className="progress-copy">
          <strong>
            Question {currentIndex + 1} of {questions.length}
          </strong>
          <span>
            {remaining} {remaining === 1 ? "question" : "questions"} left
          </span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={committed}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="question-workspace">
        <section className="question-panel">
          <p className="question-prompt">{currentQuestion.prompt}</p>
          <div className="question-context">
            <span className="tag">{currentQuestion.competencyName}</span>
          </div>
        </section>
        <fieldset className="options-panel">
          <legend className="sr-only">Options</legend>
          {currentQuestion.format === "single_choice" ? (
            <div className="choice-list">
              {currentQuestion.options.map((option) => (
                <label className="choice-label" key={option.id}>
                  <input type="radio" name={currentQuestion.id} value={option.id} checked={answers[currentQuestion.id] === option.id} onChange={(event) => setAnswers({ ...answers, [currentQuestion.id]: event.target.value })} />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea aria-label={`Answer: ${currentQuestion.prompt}`} value={answers[currentQuestion.id] ?? ""} onChange={(event) => setAnswers({ ...answers, [currentQuestion.id]: event.target.value })} placeholder="Write a concise example from your work…" maxLength={2000} />
          )}
        </fieldset>
      </div>
      <div className="form-actions">
        <Button variant="secondary" type="button" onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))} disabled={busy || currentIndex === 0}>
          ← Previous
        </Button>
        <span className="answer-count">
          <strong>{committed}</strong> answered · {remaining} left
        </span>
        <Button variant="primary" type="button" onClick={continueAssessment} disabled={busy || !currentAnswered}>
          {busy ? "Saving…" : currentIndex < questions.length - 1 ? "Next question" : round === 3 ? "Finish assessment" : "Continue"}
          <span aria-hidden="true">→</span>
        </Button>
      </div>
    </form>
  );
}
