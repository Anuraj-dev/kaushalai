import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AdminRepository } from "@/data/admin-repository";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const analytics = new AdminRepository().analytics();
  const completionRate = analytics.courseAssignments ? Math.round((analytics.courseCompletions / analytics.courseAssignments) * 100) : 0;
  const hasAssessments = analytics.completedAssessments > 0;
  const hasAssignments = analytics.courseAssignments > 0;

  return (
    <>
      <header className="page-header admin-page-header admin-page-header--governance">
        <div>
          <h1>Readiness and learning analytics</h1>
          <p>
            Org-level snapshot from assessment results · {analytics.completedAssessments} completed assessments · {analytics.officials} officials
            {hasAssessments ? " · updates after each completed assessment" : " · no assessment data yet"}
          </p>
        </div>
      </header>

      <section className="admin-analytics-strip" aria-label="Readiness overview">
        <div className="admin-governance-metric">
          <span>Readiness</span>
          <strong>{analytics.readinessPercent}%</strong>
          <small>{hasAssessments ? "Supported ≥ required" : "No results yet"}</small>
        </div>
        <div className="admin-governance-metric">
          <span>Coverage</span>
          <strong>{analytics.assessmentCoveragePercent}%</strong>
          <small>{hasAssessments ? "Supported / total" : "No results yet"}</small>
        </div>
        <div className="admin-governance-metric">
          <span>Completion rate</span>
          <strong>{completionRate}%</strong>
          <small>{hasAssignments ? `${analytics.courseCompletions} / ${analytics.courseAssignments}` : "No courses assigned yet"}</small>
        </div>
      </section>

      <section className="analytics-ledger" aria-label="Supported gaps by domain">
        <div className="analytics-ledger__head">
          <h2>
            Supported gaps by domain <span className="ledger-count">{analytics.supportedGapsByDomain.length} domains</span>
          </h2>
        </div>
        {analytics.supportedGapsByDomain.length ? (
          <div className="analytics-ledger__body">
            {analytics.supportedGapsByDomain.map((item) => {
              return (
                <div key={item.domain} className="analytics-ledger-row">
                  <strong>{item.domain.replaceAll("_", " ")}</strong>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{item.gaps} supported gaps</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="analytics-empty">
            <div className="analytics-empty__icon" aria-hidden="true">
              <span />
            </div>
            <strong>No supported gaps yet</strong>
            <p>
              Supported gaps appear here by domain once officials complete assessments. Ensure matrices have rubrics + course tags + questions, then check Officials.
            </p>
            <div className="analytics-empty__actions">
              <Button asChild variant="secondary" size="sm">
                <Link href="/admin">Review matrices</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/officials">View officials</Link>
              </Button>
            </div>
          </div>
        )}
      </section>
      <p className="analytics-helper">
        <strong>How it’s calculated:</strong> Readiness = supported results where assessed level ≥ required / all results · Coverage = supported / total results · Completion = completed / assigned courses.
      </p>
    </>
  );
}
