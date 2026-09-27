"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Building2, Clock, ExternalLink, ListChecks } from "lucide-react";
import { CatalogGuidePanel } from "@/components/learner/catalog-guide-panel";
import { NsstaProgrammesPanel } from "@/components/learner/nssta-programmes-panel";
import { focusClass, quizPath, type LearnerQuiz, type Recommendation, type Session } from "@/components/learner/learner-session";
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
          <div className="history-empty-state">
            <Image className="art history-empty-art" src="/illustrations/history-empty.webp" alt="" aria-hidden="true" width={458} height={333} sizes="150px" />
            <p className="history-empty">
              No prior course evidence. Mark a recommended course complete to start your history.
            </p>
          </div>
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

const MAX_LEVEL = 5;

export const formatLevel = (level: number) => (Number.isInteger(level) ? String(level) : level.toFixed(1));

/** Open gaps first: highest priority, then largest gap. */
export function rankedGaps(results: Session["results"]) {
  return results.filter((result) => result.gap > 0).sort((a, b) => b.priority - a.priority || b.gap - a.gap || a.competencyName.localeCompare(b.competencyName));
}

/** Assessed level as a filled bar, the shortfall hatched, and a tick at the required level. */
export function LevelBar({ assessed, required, label }: { assessed: number; required: number; label: string }) {
  const pct = (level: number) => `${(Math.max(0, Math.min(MAX_LEVEL, level)) / MAX_LEVEL) * 100}%`;
  const gap = Math.max(required - assessed, 0);
  return (
    <span
      className="level-bar"
      role="img"
      aria-label={`${label}: assessed level ${formatLevel(assessed)}, required ${formatLevel(required)} of ${MAX_LEVEL}${gap > 0 ? `, gap ${formatLevel(gap)}` : ""}`}
    >
      <span className="level-bar-fill" style={{ width: pct(assessed) }} />
      {gap > 0 && <span className="level-bar-gap" style={{ left: pct(assessed), width: pct(gap) }} />}
      <span className="level-bar-required" style={{ left: pct(required) }} />
    </span>
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
      <p className="level-legend" aria-hidden="true">
        <span><i className="level-legend-fill" /> Assessed</span>
        <span><i className="level-legend-gap" /> Gap</span>
        <span><i className="level-legend-required" /> Required</span>
      </p>
      <div className="result-list">
        {session.results.map((result) => (
          <div className={`result-row ${result.gap > 0 ? "has-gap" : ""}`} key={result.competencyId}>
            <div className="result-name">
              <strong>{result.competencyName}</strong>
              <span className={`confidence ${result.supported ? "confidence-supported" : ""}`}>
                {Math.round(result.confidence * 100)}% confidence{result.supported ? "" : " · needs more evidence"}
              </span>
            </div>
            <LevelBar assessed={result.assessedLevel} required={result.requiredLevel} label={result.competencyName} />
            <div className="result-meta">
              Level {formatLevel(result.assessedLevel)} of {formatLevel(result.requiredLevel)} required ·{" "}
              {result.gap > 0 ? <strong className="result-gap">Gap {formatLevel(result.gap)}</strong> : "Meets requirement"}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Sticky right-hand summary: every open gap, ranked. Selecting one highlights the programmes that close it. */
function PlanSummary({ session, focus, onFocus }: { session: Session; focus: string | null; onFocus: (competencyName: string | null) => void }) {
  const gaps = rankedGaps(session.results);
  const unsupported = session.results.filter((result) => !result.supported).length;
  const { supportedCompetencies, totalCompetencies } = session.dashboard;

  return (
    <section className="surface plan-summary" aria-labelledby="plan-summary-title">
      <div className="section-label">
        <span className="tag tag-lime">Assessment result</span>
        {session.assessment.provisional && <span className="tag">Provisional</span>}
      </div>
      <div className="plan-summary-intro">
        <div>
          <h2 id="plan-summary-title">
            {gaps.length === 0 ? "You meet every required level" : `${gaps.length} ${gaps.length === 1 ? "gap" : "gaps"} to close`}
          </h2>
          <Link className="text-link plan-summary-link" href="/learner/profile">
            Full result <span aria-hidden="true">→</span>
          </Link>
        </div>
        {gaps.length === 0 ? (
          <Image className="art plan-summary-art" src="/illustrations/quiz-level-high.webp" alt="" aria-hidden="true" width={343} height={458} loading="eager" sizes="60px" />
        ) : (
          <Image className="art plan-summary-art" src="/illustrations/plan-summary.webp" alt="" aria-hidden="true" width={666} height={436} loading="eager" sizes="110px" />
        )}
      </div>
      <p className="plan-summary-meta">
        {supportedCompetencies} of {totalCompetencies} competencies confirmed by evidence
        {unsupported > 0 ? ` · ${unsupported} need${unsupported === 1 ? "s" : ""} more evidence` : ""}
      </p>
      <span className="evidence-meter" role="img" aria-label={`${supportedCompetencies} of ${totalCompetencies} competencies confirmed`}>
        {Array.from({ length: totalCompetencies }, (_, index) => (
          <span key={index} className={index < supportedCompetencies ? "is-confirmed" : ""} style={{ "--i": index } as CSSProperties} />
        ))}
      </span>
      <div className="plan-summary-gaps">
        <h3 className="plan-summary-label">
          Gaps by priority{gaps.length > 0 && <span> · select to highlight</span>}
        </h3>
        {gaps.length === 0 ? (
          <p className="muted plan-summary-empty">No open gaps. The courses here keep your strongest areas current.</p>
        ) : (
          <ol className="gap-list">
            {gaps.map((result, index) => (
              <li key={result.competencyId} style={{ "--i": index } as CSSProperties}>
                <button
                  type="button"
                  className="gap-item"
                  aria-pressed={focus === result.competencyName}
                  onClick={() => onFocus(focus === result.competencyName ? null : result.competencyName)}
                >
                  <span className="gap-rank">{String(index + 1).padStart(2, "0")}</span>
                  <strong className="gap-name">{result.competencyName}</strong>
                  <small className="gap-levels">
                    {formatLevel(result.assessedLevel)} → {formatLevel(result.requiredLevel)}
                  </small>
                  <LevelBar assessed={result.assessedLevel} required={result.requiredLevel} label={result.competencyName} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
      <p className="source-legend">
        <span><span className="source-badge source-badge-igot">iGOT</span> Online course</span>
        <span><span className="source-badge source-badge-nssta">NSSTA</span> In person</span>
      </p>
    </section>
  );
}

/** Human copy for which gap a course closes, from the session's own results. */
function courseGapCopy(item: Recommendation, results: Session["results"]) {
  const result = results.find((entry) => entry.competencyId === item.competencyId);
  if (!result) return <>{item.rationale}</>;
  if (result.gap > 0) {
    return (
      <>
        Closes your <strong>{result.competencyName}</strong> gap ({formatLevel(result.assessedLevel)}&nbsp;→&nbsp;{formatLevel(result.requiredLevel)}).
      </>
    );
  }
  return (
    <>
      Keeps your <strong>{result.competencyName}</strong> at level {formatLevel(result.assessedLevel)}.
    </>
  );
}

export function LearningPlan({
  session,
  onComplete,
  onReassess,
  busy,
  focus = null,
}: {
  session: Session;
  onComplete: (item: Recommendation) => void;
  onReassess?: () => void;
  busy: boolean;
  focus?: string | null;
}) {
  const [pending, setPending] = useState<Recommendation | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const isCompleted = (item: Recommendation) => session.history.some((h) => h.courseId === item.courseId);
  const quizFor = (item: Recommendation) =>
    session.quizzes.find((quiz) => quiz.courseId === item.courseId) ?? session.quizzes.find((quiz) => !quiz.courseId && quiz.competencyId === item.competencyId);
  const competencyName = (item: Recommendation) => session.results.find((result) => result.competencyId === item.competencyId)?.competencyName ?? "";
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
      <section className="recommendation-section" aria-labelledby="learning-plan-title">
        <div className="plan-heading">
          <div>
            <h2 id="learning-plan-title">Your learning plan</h2>
            <p className="plan-heading-note">
              <span className="source-badge source-badge-igot">iGOT</span> Online, self paced
            </p>
          </div>
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
            {session.recommendations.map((item, index) => {
              const completed = isCompleted(item);
              return (
                <article
                  className={`course-card course-card-igot ${completed ? "course-card-done" : ""} ${focusClass(focus, [competencyName(item)])}`}
                  key={item.id}
                  style={{ "--i": index } as CSSProperties}
                >
                  <a
                    className="course-card-link"
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View ${item.title} course`}
                  >
                    <div className="course-card-head">
                      <div className="course-card-top">
                        <span className="card-badges">
                          <span className="source-badge source-badge-igot">iGOT</span>
                          <span className="card-rank">Course {String(item.rank).padStart(2, "0")}</span>
                        </span>
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
                      <p className="course-card-rationale">{courseGapCopy(item, session.results)}</p>
                    </div>
                  </a>
                  <div className="course-card-actions">
                    {quizFor(item) && <QuizButton quiz={quizFor(item)!} />}
                    <Button
                      variant={completed ? "primary" : "secondary"}
                      size="sm"
                      type="button"
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
  const [focus, setFocus] = useState<string | null>(null);
  useEscapeClose(Boolean(focus), () => setFocus(null));
  return (
    <>
      <div className="plan-layout">
        <aside className="plan-aside" aria-label="Your gaps">
          <PlanSummary session={session} focus={focus} onFocus={setFocus} />
        </aside>
        <div className="plan-main">
          <LearningPlan session={session} onComplete={onComplete} onReassess={onReassess} busy={busy} focus={focus} />
          <NsstaProgrammesPanel
            competencyNames={rankedGaps(session.results).map((result) => result.competencyName)}
            jobRole={session.official.jobRoleName}
            focus={focus}
          />
        </div>
      </div>
      <CatalogGuidePanel assessmentId={session.assessment.id} />
    </>
  );
}
