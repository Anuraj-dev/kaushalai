import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AdminRepository } from "@/data/admin-repository";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const analytics = new AdminRepository().analytics();
  // Prototype seed: show demo data when DB is empty so analytics is not blank
  const isEmpty = analytics.completedAssessments === 0 && analytics.supportedGapsByDomain.length === 0 && analytics.courseAssignments === 0;
  const display = isEmpty
    ? {
        officials: analytics.officials || 10,
        completedAssessments: 4,
        readinessPercent: 68,
        assessmentCoveragePercent: 72,
        courseAssignments: 24,
        courseCompletions: 9,
        supportedGapsByDomain: [
          { domain: "data_analysis", gaps: 5 },
          { domain: "public_policy", gaps: 3 },
          { domain: "communication", gaps: 4 },
        ],
      }
    : analytics;
  const completionRate = display.courseAssignments ? Math.round((display.courseCompletions / display.courseAssignments) * 100) : 0;
  const hasAssessments = display.completedAssessments > 0;
  const hasAssignments = display.courseAssignments > 0;

  return (
    <>
      <header className="page-header admin-page-header admin-page-header--governance">
        <div>
          <h1>Readiness and learning analytics</h1>
        </div>
      </header>

      <section className="admin-analytics-strip" aria-label="Readiness overview">
        <div className="admin-governance-metric">
          <span>Readiness</span>
          <strong>{display.readinessPercent}%</strong>
          <small>{hasAssessments ? "Supported ≥ required" : "No results yet"}</small>
        </div>
        <div className="admin-governance-metric">
          <span>Coverage</span>
          <strong>{display.assessmentCoveragePercent}%</strong>
          <small>{hasAssessments ? "Supported / total" : "No results yet"}</small>
        </div>
        <div className="admin-governance-metric">
          <span>Completion rate</span>
          <strong>{completionRate}%</strong>
          <small>{hasAssignments ? `${display.courseCompletions} / ${display.courseAssignments}` : "No courses assigned yet"}</small>
        </div>
      </section>

      <section className="analytics-ledger" aria-label="Supported gaps by domain">
        <div className="analytics-ledger__head">
          <h2>
            Supported gaps by domain <span className="ledger-count">{display.supportedGapsByDomain.length} domains</span>
          </h2>
        </div>
        {display.supportedGapsByDomain.length ? (
          <div className="analytics-ledger__body">
            {display.supportedGapsByDomain.map((item) => {
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
