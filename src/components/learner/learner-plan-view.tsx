"use client";

import { useState } from "react";
import { CatalogGuidePanel } from "@/components/learner/catalog-guide-panel";
import type { Recommendation, Session } from "@/components/learner/learner-session";
import { Button } from "@/components/ui/button";

export function AssessmentResults({ session }: { session: Session }) {
  return (
    <section className="surface results-card">
      <div className="section-label">
        <span className="tag tag-lime">Assessment result</span>
        {session.assessment.provisional && <span className="tag">Provisional</span>}
      </div>
      <h2>{session.assessment.provisional ? "A useful result, with room to confirm" : "Your competency picture"}</h2>
      <p className="muted">Scores are calculated from your answers. Course completion adds history and does not rewrite this result.</p>
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

export function LearningPlan({ session, onComplete, busy }: { session: Session; onComplete: (item: Recommendation) => void; busy: boolean }) {
  const [pending, setPending] = useState<Recommendation | null>(null);
  const isCompleted = (item: Recommendation) => session.history.some((h) => h.courseId === item.courseId);

  async function confirm() {
    if (!pending) return;
    const item = pending;
    setPending(null);
    await onComplete(item);
  }

  return (
    <>
      <section className="surface recommendation-card">
        <div className="section-label">
          <span className="tag tag-dark">Learning plan</span>
          <span className="muted">Prioritized from current gaps</span>
        </div>
        <h2>Start with the highest-priority gaps</h2>
        {session.recommendations.length === 0 ? (
          <p className="muted">No verified course is available for the current gaps.</p>
        ) : (
          <div className="recommendation-list">
            {session.recommendations.map((item) => {
              const completed = isCompleted(item);
              return (
                <div className="recommendation-row" key={item.id}>
                  <div>
                    <strong>
                      {item.rank}. {item.title}
                    </strong>
                    <div className="result-meta">
                      {item.provider ?? "iGOT catalog"} {item.duration ? `· ${item.duration}` : ""}
                      <br />
                      {item.rationale}
                    </div>
                  </div>
                  <Button variant={completed ? "primary" : "secondary"} type="button" onClick={() => setPending(item)} disabled={busy || completed}>
                    {completed ? "Completed ✓" : <>Mark complete <span aria-hidden="true">→</span></>}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        {session.reassessmentInvited && (
          <div className="alert" style={{ marginTop: 20 }}>
            A course completion is recorded. Reassessment is available when you are ready.
          </div>
        )}
      </section>
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
      <header className="page-header learner-header">
        <div>
          <h1>{session.official.name}</h1>
          <p>{session.official.jobRoleName}</p>
        </div>
        {session.reassessmentInvited && onReassess && (
          <Button variant="secondary" onClick={onReassess} disabled={busy}>
            Start reassessment <span aria-hidden="true">→</span>
          </Button>
        )}
      </header>
      <div className="journey-grid">
        <div>
          <LearningPlan session={session} onComplete={onComplete} busy={busy} />
        </div>
        <aside className="side-panel">
          <AssessmentResults session={session} />
          <section className="surface history-panel">
            <div className="panel-heading">
              <span className="tag">Learning history</span>
              <span className="panel-mark" aria-hidden="true">↘</span>
            </div>
            {session.history.length === 0 ? (
              <p className="muted">No prior course evidence.</p>
            ) : (
              session.history.slice(0, 4).map((item) => (
                <div className="history-item" key={item.id}>
                  <strong>{item.competencyName}</strong>
                  <span>
                    {item.courseTitle ?? item.source} · level {item.level}
                  </span>
                </div>
              ))
            )}
          </section>
        </aside>
      </div>
      <CatalogGuidePanel
        assessmentId={session.assessment.id}
        recommendedCourseIds={session.recommendations.map((item) => item.courseId)}
        chips={["Why is this first?", "Which gap does this address?", ...session.recommendations.slice(0, 1).map((item) => `Why was ${item.title} recommended?`)]}
      />
    </>
  );
}
