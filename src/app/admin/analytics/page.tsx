import { AdminRepository } from "@/data/admin-repository";

export const dynamic = "force-dynamic";

export default function AnalyticsPage() {
  const analytics = new AdminRepository().analytics();
  const completionRate = analytics.courseAssignments ? Math.round((analytics.courseCompletions / analytics.courseAssignments) * 100) : 0;

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
          <small>Supported ≥ required</small>
        </div>
        <div className="admin-governance-metric">
          <span>Coverage</span>
          <strong>{analytics.assessmentCoveragePercent}%</strong>
          <small>Supported / total</small>
        </div>
        <div className="admin-governance-metric">
          <span>Completion rate</span>
          <strong>{completionRate}%</strong>
          <small>
            {analytics.courseCompletions} / {analytics.courseAssignments}
          </small>
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
          <p style={{ padding: 16, color: "var(--muted)", fontSize: 12 }}>No supported gaps recorded.</p>
        )}
      </section>
    </>
  );
}
