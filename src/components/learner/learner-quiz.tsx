"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LOGIN_PATH, PLAN_PATH, clearSession, request, storageKey, type Session } from "@/components/learner/learner-session";
import { PlanCraftLoader } from "@/components/learner/plan-craft-loader";
import { Button } from "@/components/ui/button";

type Feedback = { questionId: string; selectedIndex: number; correct: boolean; correctIndex: number; explanation: string; sourceQuote: string };
type Snapshot = { assessedLevel: number; requiredLevel: number; gap: number; confidence: number; supported: boolean };
type Change = { competencyName: string; before: Snapshot | null; after: Snapshot | null };
type CheckQuestion = { id: string; format: "single_choice" | "short_text"; prompt: string; options: Array<{ id: string; text: string }> };
type QuizView = {
  quiz: { id: string; title: string; competencyName: string; courseTitle: string | null; sourceName: string; questions: Array<{ id: string; position: number; prompt: string; options: string[] }> };
  attempt: { id: string; status: "in_progress" | "completed"; correct: number | null; total: number; level: number | null; answers: Feedback[] } | null;
  competency: Snapshot | null;
  inMatrix: boolean;
  check: { id: string; status: string; questions: CheckQuestion[] } | null;
};

const LEVEL_BANDS = ["0–19%", "20–39%", "40–59%", "60–79%", "80–100%"];
const OPTION_LETTERS = ["A", "B", "C", "D"];

export function LearnerQuiz({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [officialId, setOfficialId] = useState<string | null>(null);
  const [view, setView] = useState<QuizView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  // The question whose feedback is on screen. Cleared when the learner moves on.
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [change, setChange] = useState<Change | null>(null);
  const [checkAnswers, setCheckAnswers] = useState<Record<string, string>>({});
  const [checkChange, setCheckChange] = useState<Change | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        if (!saved) {
          router.replace(LOGIN_PATH);
          return;
        }
        const session = (await request(`/api/learner/session?assessmentId=${encodeURIComponent(saved)}`)) as Session;
        const value = (await request(`/api/learner/quizzes/${encodeURIComponent(quizId)}?officialId=${encodeURIComponent(session.official.id)}`)) as QuizView;
        if (!mounted) return;
        setOfficialId(session.official.id);
        setView(value);
      } catch (cause) {
        if (!mounted) return;
        if (cause instanceof Error && /assessment/i.test(cause.message)) {
          clearSession();
          router.replace(LOGIN_PATH);
          return;
        }
        setError(cause instanceof Error ? cause.message : "Unable to open this quiz");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [quizId, router]);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      setBusy(true);
      setError(null);
      try {
        return await request(`/api/learner/quizzes/${encodeURIComponent(quizId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ officialId, ...body }),
        });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Something went wrong");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [officialId, quizId],
  );

  async function start() {
    const value = await post({ action: "start" });
    if (!value) return;
    setChange(null);
    setCheckChange(null);
    setReviewing(null);
    setSelected(null);
    setView(value.view);
  }

  async function checkAnswer(questionId: string) {
    if (!view?.attempt || selected === null) return;
    const feedback = (await post({ action: "answer", attemptId: view.attempt.id, questionId, selectedIndex: selected })) as Feedback | null;
    if (!feedback) return;
    setView({ ...view, attempt: { ...view.attempt, answers: [...view.attempt.answers.filter((item) => item.questionId !== questionId), feedback] } });
    setReviewing(questionId);
    setSelected(null);
  }

  async function finish() {
    if (!view?.attempt) return;
    const value = await post({ action: "finish", attemptId: view.attempt.id });
    if (!value) return;
    setReviewing(null);
    setChange(value.result.change);
    setView(value.view);
  }

  async function startCheck() {
    if (!view?.attempt) return;
    const value = await post({ action: "start-check", attemptId: view.attempt.id });
    if (value) setView(value.view);
  }

  async function submitCheck() {
    if (!view?.check) return;
    const answers = view.check.questions.map((question) => ({ questionId: question.id, value: (checkAnswers[question.id] ?? "").trim() }));
    if (answers.some((answer) => !answer.value)) {
      setError("Answer every question before submitting.");
      return;
    }
    const value = await post({ action: "submit-check", checkId: view.check.id, answers });
    if (!value) return;
    setCheckChange(value.result.change);
    setView(value.view);
  }

  if (loading) return <PlanCraftLoader title="Opening your quiz" detail="Loading questions written from the trainer's material." />;
  if (!view) {
    return (
      <div className="surface error-state">
        <div className="alert" role="alert">{error ?? "This quiz is not available."}</div>
        <Button asChild variant="secondary">
          <Link href={PLAN_PATH}>Back to learning plan</Link>
        </Button>
      </div>
    );
  }

  const { quiz, attempt } = view;
  const answered = new Map((attempt?.answers ?? []).map((item) => [item.questionId, item]));
  const current = attempt?.status === "in_progress"
    ? quiz.questions.find((question) => question.id === reviewing) ?? quiz.questions.find((question) => !answered.has(question.id))
    : undefined;
  const allAnswered = attempt ? quiz.questions.every((question) => answered.has(question.id)) : false;

  return (
    <>
      <Link className="text-link back-link" href={PLAN_PATH}>
        ← Back to learning plan
      </Link>
      <header className="page-header quiz-header">
        <div>
          <span className="tag tag-lime">Knowledge check · {quiz.competencyName}</span>
          <h1>{quiz.title}</h1>
          <p>
            {quiz.questions.length} questions written from <strong>{quiz.sourceName}</strong>
            {quiz.courseTitle ? ` for ${quiz.courseTitle}` : ""}.
          </p>
        </div>
        <Image className="art quiz-header-art" src="/illustrations/quiz-intro.webp" alt="" aria-hidden="true" width={790} height={453} loading="eager" sizes="240px" />
      </header>
      {error && <div className="alert" role="alert">{error}</div>}

      {!attempt && (
        <section className="surface quiz-panel">
          <h2>How this quiz counts</h2>
          <p className="muted">
            Each answer is final once you check it, and you see the explanation right away. Your score becomes verified evidence for{" "}
            {quiz.competencyName} and updates your competency result.
          </p>
          <LevelBands />
          <div className="quiz-actions">
            <Button variant="primary" onClick={() => void start()} disabled={busy}>
              {busy ? "Starting…" : <>Start quiz <span aria-hidden="true">→</span></>}
            </Button>
          </div>
        </section>
      )}

      {attempt?.status === "in_progress" && current && (
        <QuestionStep
          key={current.id}
          question={current}
          index={quiz.questions.indexOf(current)}
          total={quiz.questions.length}
          answeredCount={answered.size}
          feedback={answered.get(current.id) ?? null}
          selected={selected}
          onSelect={setSelected}
          busy={busy}
          onCheck={() => void checkAnswer(current.id)}
          onNext={() => (allAnswered ? void finish() : setReviewing(null))}
          isLast={allAnswered}
        />
      )}

      {attempt?.status === "in_progress" && !current && allAnswered && (
        <section className="surface quiz-panel">
          <h2>All questions answered</h2>
          <div className="quiz-actions">
            <Button variant="primary" onClick={() => void finish()} disabled={busy}>
              {busy ? "Scoring…" : <>See my result <span aria-hidden="true">→</span></>}
            </Button>
          </div>
        </section>
      )}

      {attempt?.status === "completed" && (
        <>
          <section className="surface quiz-panel quiz-result" aria-live="polite">
            <div className="quiz-result-top">
              <div className="quiz-score">
                <strong>
                  {attempt.correct}/{attempt.total}
                </strong>
                <span>Level {attempt.level} evidence for {quiz.competencyName}</span>
              </div>
              <LevelArt level={attempt.level ?? 1} />
            </div>
            <LevelBands active={attempt.level ?? undefined} />
            {change ? (
              <ChangeSummary change={change} />
            ) : view.competency ? (
              <p className="muted">
                Current result for {quiz.competencyName}: assessed {view.competency.assessedLevel.toFixed(1)} of required {view.competency.requiredLevel}.
              </p>
            ) : null}
            {!view.inMatrix && (
              <p className="muted">{quiz.competencyName} is not in your role matrix, so this score is saved to your learning history only.</p>
            )}
            <div className="quiz-actions">
              <Button asChild variant="primary">
                <Link href={PLAN_PATH}>
                  Back to learning plan <span aria-hidden="true">→</span>
                </Link>
              </Button>
              <Button variant="secondary" onClick={() => void start()} disabled={busy}>
                Retake quiz
              </Button>
            </div>
          </section>

          {view.inMatrix && (
            <FocusedCheck
              competencyName={quiz.competencyName}
              check={view.check}
              answers={checkAnswers}
              onAnswer={(questionId, value) => setCheckAnswers((prev) => ({ ...prev, [questionId]: value }))}
              onStart={() => void startCheck()}
              onSubmit={() => void submitCheck()}
              change={checkChange}
              busy={busy}
            />
          )}
        </>
      )}
    </>
  );
}

function QuestionStep({
  question, index, total, answeredCount, feedback, selected, onSelect, busy, onCheck, onNext, isLast,
}: {
  question: { id: string; prompt: string; options: string[] };
  index: number;
  total: number;
  answeredCount: number;
  feedback: Feedback | null;
  selected: number | null;
  onSelect: (value: number) => void;
  busy: boolean;
  onCheck: () => void;
  onNext: () => void;
  isLast: boolean;
}) {
  const optionClass = (optionIndex: number) => {
    if (!feedback) return "";
    if (optionIndex === feedback.correctIndex) return "is-correct";
    if (optionIndex === feedback.selectedIndex) return "is-wrong";
    return "is-muted";
  };
  return (
    <section className="surface quiz-panel" aria-labelledby={`quiz-q-${question.id}`}>
      <div className="quiz-progress" aria-label={`${answeredCount} of ${total} answered`}>
        <span className="quiz-progress-label">
          Question {index + 1} of {total}
        </span>
        <span className="quiz-progress-bar" aria-hidden="true">
          <span style={{ width: `${(answeredCount / total) * 100}%` }} />
        </span>
      </div>
      <fieldset className="quiz-question" disabled={Boolean(feedback) || busy}>
        <legend id={`quiz-q-${question.id}`} className="question-prompt">
          {question.prompt}
        </legend>
        <div className="choice-list">
          {question.options.map((option, optionIndex) => (
            <label className={`choice-label quiz-choice ${optionClass(optionIndex)}`} key={optionIndex}>
              <input
                type="radio"
                name={`quiz-${question.id}`}
                checked={feedback ? feedback.selectedIndex === optionIndex : selected === optionIndex}
                onChange={() => onSelect(optionIndex)}
              />
              <span className="quiz-choice-letter" aria-hidden="true">
                {OPTION_LETTERS[optionIndex]}
              </span>
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {feedback && (
        <div className={`quiz-feedback ${feedback.correct ? "is-correct" : "is-wrong"}`} role="status">
          <span className={`tag ${feedback.correct ? "tag-lime" : "tag-ink"}`}>{feedback.correct ? "Correct" : `Answer: ${OPTION_LETTERS[feedback.correctIndex]}`}</span>
          <p>{feedback.explanation}</p>
          <blockquote>
            <span>From the material</span>“{feedback.sourceQuote}”
          </blockquote>
        </div>
      )}
      <div className="quiz-actions">
        {feedback ? (
          <Button variant="primary" onClick={onNext} disabled={busy} autoFocus>
            {isLast ? (busy ? "Scoring…" : "See my result") : "Next question"} <span aria-hidden="true">→</span>
          </Button>
        ) : (
          <Button variant="dark" onClick={onCheck} disabled={busy || selected === null}>
            {busy ? "Checking…" : "Check answer"}
          </Button>
        )}
      </div>
    </section>
  );
}

/** Seedling for levels 1–2, the climb for 3, the summit for 4–5. The level is already stated in text, so the art is decorative. */
function LevelArt({ level }: { level: number }) {
  const art = level >= 4 ? { src: "/illustrations/quiz-level-high.webp", width: 343, height: 458 }
    : level === 3 ? { src: "/illustrations/quiz-level-mid.webp", width: 458, height: 410 }
      : { src: "/illustrations/quiz-level-low.webp", width: 366, height: 458 };
  return <Image className="art quiz-level-art" src={art.src} alt="" aria-hidden="true" width={art.width} height={art.height} sizes="140px" />;
}

function LevelBands({ active }: { active?: number }) {
  return (
    <ol className="quiz-bands" aria-label="Score to level">
      {LEVEL_BANDS.map((band, index) => (
        <li key={band} className={active === index + 1 ? "is-active" : undefined}>
          <strong>L{index + 1}</strong>
          <span>{band}</span>
        </li>
      ))}
    </ol>
  );
}

function ChangeSummary({ change }: { change: Change }) {
  if (!change.after) return <p className="muted">Saved to your learning history.</p>;
  const rows: Array<[string, string, string]> = [
    ["Assessed level", change.before ? change.before.assessedLevel.toFixed(1) : "–", change.after.assessedLevel.toFixed(1)],
    ["Gap to required", change.before ? change.before.gap.toFixed(1) : "–", change.after.gap.toFixed(1)],
    ["Confidence", change.before ? `${Math.round(change.before.confidence * 100)}%` : "–", `${Math.round(change.after.confidence * 100)}%`],
  ];
  return (
    <div className="quiz-change">
      <h3>{change.competencyName} result updated</h3>
      <dl>
        {rows.map(([label, before, after]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <span className="muted">{before}</span> <span aria-hidden="true">→</span> <strong>{after}</strong>
            </dd>
          </div>
        ))}
      </dl>
      {change.before && change.after.confidence < change.before.confidence && (
        <p className="quiz-change-note">Confidence fell because this evidence disagrees with your earlier answers. More consistent evidence raises it again.</p>
      )}
    </div>
  );
}

function FocusedCheck({
  competencyName, check, answers, onAnswer, onStart, onSubmit, change, busy,
}: {
  competencyName: string;
  check: QuizView["check"];
  answers: Record<string, string>;
  onAnswer: (questionId: string, value: string) => void;
  onStart: () => void;
  onSubmit: () => void;
  change: Change | null;
  busy: boolean;
}) {
  if (!check) {
    return (
      <section className="surface quiz-panel quiz-check">
        <div className="quiz-check-intro">
          <div>
            <span className="tag">Focused check</span>
            <h2>Confirm this with three short questions</h2>
            <p className="muted">
              A quiz is history evidence, so its weight is capped. Answer three questions on {competencyName} and they count as part of your current
              assessment.
            </p>
            <div className="quiz-actions">
              <Button variant="dark" onClick={onStart} disabled={busy}>
                {busy ? "Preparing questions…" : <>Start focused check <span aria-hidden="true">→</span></>}
              </Button>
            </div>
          </div>
          <Image className="art quiz-check-art" src="/illustrations/focused-check.webp" alt="" aria-hidden="true" width={540} height={406} sizes="200px" />
        </div>
      </section>
    );
  }
  if (check.status !== "pending") {
    return (
      <section className="surface quiz-panel quiz-check">
        <span className="tag tag-lime">Focused check complete</span>
        {change ? <ChangeSummary change={change} /> : <p className="muted">Your answers are part of your current assessment.</p>}
      </section>
    );
  }
  return (
    <section className="surface quiz-panel quiz-check">
      <span className="tag">Focused check · {competencyName}</span>
      <h2>Three questions on {competencyName}</h2>
      {check.questions.map((question, index) => (
        <fieldset className="quiz-check-question" key={question.id} disabled={busy}>
          <legend className="question-prompt">
            {index + 1}. {question.prompt}
          </legend>
          {question.format === "single_choice" ? (
            <div className="choice-list">
              {question.options.map((option) => (
                <label className="choice-label" key={option.id}>
                  <input type="radio" name={`check-${question.id}`} checked={answers[question.id] === option.id} onChange={() => onAnswer(question.id, option.id)} />
                  <span>{option.text}</span>
                </label>
              ))}
            </div>
          ) : (
            <textarea
              aria-label={`Answer to question ${index + 1}`}
              maxLength={2000}
              value={answers[question.id] ?? ""}
              onChange={(event) => onAnswer(question.id, event.target.value)}
              placeholder="Explain in your own words, with an example from your work if you can."
            />
          )}
        </fieldset>
      ))}
      <div className="quiz-actions">
        <Button variant="primary" onClick={onSubmit} disabled={busy}>
          {busy ? "Evaluating…" : <>Submit answers <span aria-hidden="true">→</span></>}
        </Button>
      </div>
    </section>
  );
}
