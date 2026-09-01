import { AdminRepository } from "@/data/admin-repository";
import { MetricCard } from "@/components/admin/metric-card";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const analytics = new AdminRepository().analytics();
  const completionRate = analytics.courseAssignments ? Math.round((analytics.courseCompletions / analytics.courseAssignments) * 100) : 0;
  const officialsAssessedPct = analytics.officials ? Math.round((analytics.completedAssessments / analytics.officials) * 100) : 0;
  const maxGaps = analytics.supportedGapsByDomain.length ? Math.max(...analytics.supportedGapsByDomain.map((d) => d.gaps)) : 0;

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
          <strong>{analytics.readinessPercent}%</strong>
          <small>Supported where assessed ≥ required</small>
        </div>
        <div className="admin-governance-metric">
          <span>Coverage</span>
          <strong>{analytics.assessmentCoveragePercent}%</strong>
          <small>Supported results / total</small>
        </div>
        <div className="admin-governance-metric">
          <span>Completion rate</span>
          <strong>{completionRate}%</strong>
          <small>
            {analytics.courseCompletions}/{analytics.courseAssignments} completed
          </small>
        </div>
        <div className="admin-governance-metric">
          <span>Officials assessed</span>
          <strong>
            {analytics.completedAssessments}/{analytics.officials}
          </strong>
          <small>{officialsAssessedPct}% of officials with completed assessment</small>
        </div>
      </section>

      <section className="admin-metrics--paper" aria-label="Organization totals">
        <MetricCard label="Officials" value={analytics.officials} detail={`${analytics.completedAssessments} completed`} variant="paper" />
        <MetricCard label="Completed assessments" value={analytics.completedAssessments} detail={`${officialsAssessedPct}% of officials`} variant="paper" />
        <MetricCard label="Course assignments" value={analytics.courseAssignments} detail={`${analytics.courseCompletions} completions`} variant="paper" />
        <MetricCard label="Course completions" value={analytics.courseCompletions} detail={`${completionRate}% completion rate`} variant="paper" />
        <MetricCard label="Readiness" value={`${analytics.readinessPercent}%`} detail="Org pass rate" variant="paper" />
        <MetricCard label="Assessment coverage" value={`${analytics.assessmentCoveragePercent}%`} detail="Supported / total" variant="paper" />
      </section>

      <section className="analytics-ledger" aria-label="Supported gaps by domain">
        <div className="analytics-ledger__head">
          <span className="tag">Organization signal</span>
          <h2>Supported gaps by domain</h2>
          <p>These gaps are drawn from persisted assessment results.</p>
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
          <p style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>No supported competency gaps have been recorded yet.</p>
        )}
      </section>
    </>
  );
}
