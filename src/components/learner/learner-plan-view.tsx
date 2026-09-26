"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Clock, ExternalLink, ListChecks } from "lucide-react";
import { CatalogGuidePanel } from "@/components/learner/catalog-guide-panel";
import { quizPath, type LearnerQuiz, type Recommendation, type Session } from "@/components/learner/learner-session";
import { Button } from "@/components/ui/button";

function useEscapeClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);
}

export function HistoryDialog({ history, onClose }: { history: Session["history"]; onClose: () => void }) {
  return (
    <div className="kaushal-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="learning-history-title" onClick={onClose}>
      <div className="kaushal-modal kaushal-modal-history" onClick={(event) => event.stopPropagation()}>
        <div className="kaushal-modal-heading">
          <h3 id="learning-history-title">Learning history</h3>
          <button type="button" className="kaushal-modal-close" aria-label="Close" autoFocus onClick={onClose}>
            ×
          </button>
        </div>
        {history.length === 0 ? (
          <p className="history-empty">
            No prior course evidence. Mark a recommended course complete to start your history.
          </p>
        ) : (
          <div className="kaushal-history-list">
            {history.map((item) => (
              <div className="history-item" key={item.id}>
                <strong>{item.competencyName}</strong>
                <span>
                  {item.courseTitle ?? (item.quizTitle ? `Quiz: ${item.quizTitle}` : item.source)} · level {item.level}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AssessmentResults({ session }: { session: Session }) {
  return (
    <section className="surface results-card">
      <div className="section-label">
        <span className="tag tag-lime">Assessment result</span>
        {session.assessment.provisional && <span className="tag">Provisional</span>}
      </div>
      <h2>{session.assessment.provisional ? "A useful result, with room to confirm" : "Your competency picture"}</h2>
      <p className="muted">Scores are calculated from your answers and verified quiz results. Marking a course complete adds history but does not change this result.</p>
      <div className="result-list">
        {session.results.map((result) => (
          <div className="result-row" key={result.competencyId}>
            <div>
              <strong>{result.competencyName}</strong>
              <div className="result-meta">
                Assessed {result.assessedLevel.toFixed(1)} · Required {result.requiredLevel} · Gap {result.gap.toFixed(1)} · {result.supported ? "supported" : "needs more evidence"}
              </div>
            </div>
            <div className={`confidence ${result.supported ? "confidence-supported" : ""}`}>{Math.round(result.confidence * 100)}% confidence</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function LearningPlan({ session, onComplete, onReassess, busy }: { session: Session; onComplete: (item: Recommendation) => void; onReassess?: () => void; busy: boolean }) {
  const [pending, setPending] = useState<Recommendation | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const isCompleted = (item: Recommendation) => session.history.some((h) => h.courseId === item.courseId);
  const quizFor = (item: Recommendation) =>
    session.quizzes.find((quiz) => quiz.courseId === item.courseId) ?? session.quizzes.find((quiz) => !quiz.courseId && quiz.competencyId === item.competencyId);
  useEscapeClose(Boolean(pending), () => {
    if (!busy) setPending(null);
  });
  useEscapeClose(historyOpen, () => setHistoryOpen(false));

  async function confirm() {
    if (!pending) return;
    const item = pending;
    setPending(null);
    await onComplete(item);
  }

  return (
    <>
      <section className="recommendation-section">
        <div className="plan-heading">
          <h2>Your learning plan</h2>
          <div className="plan-actions">
            {session.reassessmentInvited && onReassess && (
              <Button variant="secondary" size="sm" type="button" onClick={onReassess} disabled={busy}>
                Start reassessment <span aria-hidden="true">→</span>
              </Button>
            )}
            <Button variant="secondary" size="sm" type="button" className="history-open" onClick={() => setHistoryOpen(true)}>
              Learning history
            </Button>
          </div>
        </div>
        {session.recommendations.length === 0 ? (
          <p className="muted">No verified course is available for the current gaps.</p>
        ) : (
          <div className="recommendation-list">
            {session.recommendations.map((item) => {
              const completed = isCompleted(item);
              return (
                <article className={`course-card ${completed ? "course-card-done" : ""}`} key={item.id}>
                  <a
                    className="course-card-link"
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View ${item.title} course`}
                  >
                    <div className="course-card-head">
                      <div className="course-card-top">
                        <span className="tag tag-dark">Course {String(item.rank).padStart(2, "0")}</span>
                        <span className="course-open-icon" aria-hidden="true">
                          <ExternalLink size={17} strokeWidth={1.7} aria-hidden="true" />
                        </span>
                      </div>
                      <h3 className="course-card-title">{item.title}</h3>
                    </div>
                    <div className="course-card-body">
                      <div className="course-card-stats">
                        <div className="course-stat">
                          <Building2 size={14} strokeWidth={1.7} aria-hidden="true" />
                          <div>
                            <span className="course-stat-label">Provider</span>
                            <span className="course-stat-value">{item.provider ?? "iGOT catalog"}</span>
                          </div>
                        </div>
                        <div className="course-stat">
                          <Clock size={14} strokeWidth={1.7} aria-hidden="true" />
                          <div>
                            <span className="course-stat-label">Duration</span>
                            <span className="course-stat-value">{item.duration ?? "Self paced"}</span>
                          </div>
                        </div>
                      </div>
                      <p className="course-card-rationale">{item.rationale}</p>
                    </div>
                  </a>
                  <div className="course-card-actions">
                    {quizFor(item) && <QuizButton quiz={quizFor(item)!} />}
                    <Button
                      variant={completed ? "primary" : "secondary"}
                      size="sm"
                      type="button"
                      className={completed ? undefined : "mark-button"}
                      onClick={() => setPending(item)}
                      disabled={busy || completed}
                    >
                      {completed ? "Completed" : <>Mark complete <span aria-hidden="true">→</span></>}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {session.quizzes.length > 0 && <KnowledgeChecks quizzes={session.quizzes} />}
        {session.reassessmentInvited && (
          <div className="alert" style={{ marginTop: 20 }}>
            A course completion is recorded. Reassessment is available when you are ready.
          </div>
        )}
      </section>
      {historyOpen && <HistoryDialog history={session.history} onClose={() => setHistoryOpen(false)} />}
      {pending && (
        <div className="kaushal-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-complete-title" onClick={() => !busy && setPending(null)}>
          <div className="kaushal-modal" onClick={(event) => event.stopPropagation()}>
            <h3 id="confirm-complete-title">Mark as complete?</h3>
            <p>
              This will record <strong>{pending.title}</strong> in your learning history and invite a reassessment. You can’t undo this from here.
            </p>
            <div className="kaushal-modal-actions">
              <Button variant="secondary" type="button" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={() => {
                  void confirm();
                }}
                disabled={busy}
              >
                {busy ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function QuizButton({ quiz }: { quiz: LearnerQuiz }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <Link href={quizPath(quiz.id)} aria-label={`${quiz.lastAttempt ? "Retake" : "Take"} quiz: ${quiz.title}`}>
        {quiz.lastAttempt ? `Quiz ${quiz.lastAttempt.correct}/${quiz.lastAttempt.total}` : "Take quiz"} <span aria-hidden="true">→</span>
      </Link>
    </Button>
  );
}

function KnowledgeChecks({ quizzes }: { quizzes: LearnerQuiz[] }) {
  return (
    <section className="knowledge-checks" aria-labelledby="knowledge-checks-title">
      <div className="plan-heading">
        <h2 id="knowledge-checks-title">Knowledge checks</h2>
      </div>
      <p className="muted">Quizzes written from trainer material. Your score counts as verified evidence and updates your competency result.</p>
      <div className="quiz-card-list">
        {quizzes.map((quiz) => (
          <Link className="quiz-card" href={quizPath(quiz.id)} key={quiz.id}>
            <span className="quiz-card-icon" aria-hidden="true">
              <ListChecks size={18} strokeWidth={1.7} />
            </span>
            <span className="quiz-card-copy">
              <strong>{quiz.title}</strong>
              <small>
                {quiz.competencyName} · {quiz.questionCount} questions
              </small>
            </span>
            <span className={`tag ${quiz.lastAttempt ? "tag-lime" : ""}`}>
              {quiz.lastAttempt ? `${quiz.lastAttempt.correct}/${quiz.lastAttempt.total} · level ${quiz.lastAttempt.level}` : "Not taken"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function LearnerPlanLayout({
  session,
  onComplete,
  onReassess,
  busy,
}: {
  session: Session;
  onComplete: (item: Recommendation) => void;
  onReassess?: () => void;
  busy: boolean;
}) {
  return (
    <>
      <LearningPlan session={session} onComplete={onComplete} onReassess={onReassess} busy={busy} />
      <CatalogGuidePanel
        assessmentId={session.assessment.id}
      />
    </>
  );
}
