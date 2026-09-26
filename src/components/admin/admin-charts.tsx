import type { AdminOfficialSummary, AdminRoleSummary, AdminEvidenceDomain, AdminEvidenceRole } from "@/data/admin-repository";

/**
 * Prototype dashboard charts. Everything lives in this file so it can be reverted easily:
 * set ADMIN_CHARTS_ENABLED to false (or delete this file and its three imports) and the
 * admin pages fall back to their previous layout. No new dependencies — server-rendered
 * SVG + CSS, styled with the existing design tokens.
 */
export const ADMIN_CHARTS_ENABLED = true;

const KCH_CSS = `
.kch-section { margin: 4px 0 22px; }
.kch-head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
.kch-head h2 { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: -0.02em; }
.kch-grid { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 14px; align-items: stretch; }
.kch-panel { min-width: 0; padding: 16px 18px 14px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--paper); }
.kch-panel-title { margin: 0 0 12px; font-size: 13px; font-weight: 700; letter-spacing: -0.02em; }
.kch-panel-title small { margin-left: 8px; color: var(--muted); font-family: var(--font-mono); font-size: 10px; font-weight: 400; }
.kch-empty { margin: 6px 0 4px; color: var(--muted); font-family: var(--font-mono); font-size: 11px; }

.kch-bar-row { display: flex; align-items: center; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); }
.kch-bar-row:last-child { border-bottom: 0; }
.kch-bar-row:hover { background: var(--lime-wash); }
.kch-bar-label { flex: 0 0 168px; overflow: hidden; color: var(--ink); font-family: var(--font-mono); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.kch-bar-track { display: flex; flex: 1 1 auto; min-width: 0; height: 13px; overflow: hidden; border: 1px solid var(--ink); border-radius: 2px; background: var(--paper); }
.kch-bar-fill { display: block; height: 100%; flex: 0 0 auto; background: var(--lime); }
.kch-bar-fill--lime { background: var(--lime); }
.kch-bar-rest { display: block; height: 100%; flex: 1 1 auto; background: repeating-linear-gradient(45deg, transparent 0 3px, var(--line) 3px 4px); }
.kch-bar-value { flex: 0 0 auto; min-width: 96px; text-align: right; font-family: var(--font-mono); font-size: 10px; color: var(--muted); }
.kch-bar-value strong { color: var(--ink); font-weight: 700; }
.kch-bar-value .kch-warn { color: var(--warning); font-weight: 700; }

.kch-donut-wrap { display: flex; align-items: center; gap: 16px; }
.kch-donut { flex: 0 0 auto; }
.kch-donut-legend { display: grid; gap: 8px; min-width: 0; flex: 1 1 auto; }
.kch-legend-row { display: flex; align-items: center; gap: 8px; font-family: var(--font-mono); font-size: 10px; color: var(--muted); }
.kch-legend-swatch { width: 10px; height: 10px; flex: 0 0 auto; border: 1px solid var(--ink); border-radius: 2px; }
.kch-legend-row strong { margin-left: auto; color: var(--ink); font-weight: 700; }
.kch-arc--published { stroke: var(--success); }
.kch-arc--draft { stroke: var(--warning); }
.kch-donut-center { font-family: var(--font-sans); font-size: 26px; font-weight: 500; letter-spacing: -0.03em; fill: var(--ink); }
.kch-donut-center-label { font-family: var(--font-mono); font-size: 7.5px; fill: var(--muted); }

.kch-flow { display: flex; align-items: stretch; flex-wrap: wrap; gap: 8px; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--line); }
.kch-flow-node { flex: 1 1 0; min-width: 86px; padding: 9px 11px; border: 1px solid var(--ink); border-radius: var(--radius-sm); background: var(--paper); }
.kch-flow-node--muted { border-style: dashed; border-color: var(--line-strong); }
.kch-flow-node--wash { background: var(--lime-wash); }
.kch-flow-node strong { display: block; font-size: 20px; font-weight: 500; letter-spacing: -0.03em; line-height: 1.1; }
.kch-flow-node span { display: block; margin-top: 3px; color: var(--muted); font-family: var(--font-mono); font-size: 9px; }
.kch-flow-arrow { align-self: center; flex: 0 0 auto; color: var(--ink); }
.kch-flow-branch { display: flex; align-items: center; gap: 7px; margin-top: 10px; color: var(--warning); font-family: var(--font-mono); font-size: 10px; font-weight: 700; }

.kch-rail { height: 14px; overflow: hidden; margin: 10px 0 8px; border: 1px solid var(--ink); border-radius: 2px; background: var(--paper); }
.kch-rail span { display: block; height: 100%; background: var(--lime); }
.kch-rail-caption { margin: 0; color: var(--muted); font-family: var(--font-mono); font-size: 10px; }
.kch-big-number { margin: 4px 0 0; font-size: 26px; font-weight: 500; letter-spacing: -0.03em; line-height: 1.1; }
.kch-big-number small { font-size: 15px; color: var(--muted); font-weight: 400; }

.kch-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.kch-stat { display: flex; min-width: 0; flex-direction: column; gap: 8px; padding: 16px 18px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--paper); }
.kch-stat-label { color: var(--muted); font-family: var(--font-mono); font-size: 10px; }
.kch-stat-value { font-size: 40px; font-weight: 500; line-height: 1; letter-spacing: -0.04em; }
.kch-stat-value small { margin-left: 2px; color: var(--muted); font-size: 18px; letter-spacing: -0.02em; }
.kch-stat-bar { height: 6px; overflow: hidden; border: 1px solid var(--ink); border-radius: 2px; background: var(--paper); }
.kch-stat-bar span { display: block; height: 100%; background: var(--lime); }
.kch-stat-detail { margin: auto 0 0; color: var(--muted); font-size: 12px; line-height: 1.4; }
@media (max-width: 980px) { .kch-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 420px) { .kch-stat-value { font-size: 32px; } .kch-stat { padding: 14px; } }

/* Bar growth motion lives with the other motion rules in globals.css. */
@media (max-width: 980px) { .kch-grid { grid-template-columns: 1fr; } .kch-bar-label { flex-basis: 120px; } }
/* Narrow screens: label on its own line, bar and count underneath. */
@media (max-width: 560px) {
  .kch-bar-row { flex-wrap: wrap; gap: 6px 10px; padding: 9px 0; }
  .kch-bar-label { flex: 1 1 100%; overflow: visible; white-space: normal; }
  .kch-bar-value { min-width: 104px; }
}
`;

function ChartStyle() {
  return <style dangerouslySetInnerHTML={{ __html: KCH_CSS }} />;
}

function SectionHead({ title }: { title: string }) {
  return (
    <div className="kch-head">
      <h2>{title}</h2>
    </div>
  );
}

interface BarDatum {
  label: string;
  fill: number;
  total: number;
  value: string;
  warn?: string;
  variant?: "lime" | "ink";
  title?: string;
}

function BarRows({ rows, emptyNote }: { rows: BarDatum[]; emptyNote: string }) {
  if (!rows.length) return <p className="kch-empty">{emptyNote}</p>;
  const max = Math.max(...rows.map((row) => row.total), 1);
  return (
    <div>
      {rows.map((row) => {
        const fillPct = Math.round((row.fill / max) * 100);
        return (
          <div className="kch-bar-row" key={row.label} title={row.title}>
            <span className="kch-bar-label">{row.label}</span>
            <div
              className="kch-bar-track"
              role="img"
              aria-label={`${row.label}: ${row.value}${row.warn ? `, ${row.warn}` : ""}`}
            >
              <span className={`kch-bar-fill ${row.variant === "lime" ? "kch-bar-fill--lime" : ""}`} style={{ width: `${fillPct}%` }} />
              <span className="kch-bar-rest" />
            </div>
            <span className="kch-bar-value">
              <strong>{row.value}</strong>
              {row.warn ? <span className="kch-warn"> · {row.warn}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function FlowArrow() {
  return (
    <span className="kch-flow-arrow" aria-hidden="true">
      <svg width="26" height="12" viewBox="0 0 26 12">
        <line x1="0" y1="6" x2="18" y2="6" stroke="currentColor" strokeWidth="1.5" />
        <polygon points="18,1.5 26,6 18,10.5" fill="currentColor" />
      </svg>
    </span>
  );
}

function FlowNode({ count, total, label, variant }: { count: number; total: number; label: string; variant?: "muted" | "wash" }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className={`kch-flow-node ${variant === "muted" ? "kch-flow-node--muted" : ""} ${variant === "wash" ? "kch-flow-node--wash" : ""}`}>
      <strong>{count}</strong>
      <span>
        {label} · {pct}%
      </span>
    </div>
  );
}

const DONUT_R = 54;
const DONUT_C = 2 * Math.PI * DONUT_R;

function StatusDonut({ published, drafts }: { published: number; drafts: number }) {
  const total = published + drafts;
  const segments = [
    { key: "published", count: published, className: "kch-arc--published" },
    { key: "draft", count: drafts, className: "kch-arc--draft" },
  ].filter((segment) => segment.count > 0);
  const gap = segments.length > 1 ? 2.5 : 0;
  let acc = 0;

  return (
    <div className="kch-donut-wrap">
      <svg className="kch-donut" width="148" height="148" viewBox="0 0 148 148" role="img" aria-label={`${published} published and ${drafts} draft matrices of ${total} total`}>
        <g transform="rotate(-90 74 74)">
          <circle cx="74" cy="74" r={DONUT_R} fill="none" stroke="var(--line)" strokeWidth="20" />
          {segments.map((segment) => {
            const len = total ? (segment.count / total) * DONUT_C : 0;
            const dashLen = Math.max(len - gap, 0.01);
            const offset = -acc;
            acc += len;
            return (
              <circle
                key={segment.key}
                cx="74"
                cy="74"
                r={DONUT_R}
                fill="none"
                className={segment.className}
                strokeWidth="20"
                strokeDasharray={`${dashLen} ${DONUT_C - dashLen}`}
                strokeDashoffset={offset}
              >
                <title>{`${segment.key}: ${segment.count} of ${total}`}</title>
              </circle>
            );
          })}
        </g>
        <text className="kch-donut-center" x="74" y="72" textAnchor="middle">
          {total}
        </text>
        <text className="kch-donut-center-label" x="74" y="90" textAnchor="middle">
          MATRICES
        </text>
      </svg>
      <div className="kch-donut-legend">
        <div className="kch-legend-row">
          <span className="kch-legend-swatch" style={{ background: "var(--success)" }} /> Published <strong>{published}</strong>
        </div>
        <div className="kch-legend-row">
          <span className="kch-legend-swatch" style={{ background: "var(--warning)" }} /> Draft <strong>{drafts}</strong>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, detail, progress }: { label: string; value: number; unit?: string; detail: string; progress?: number }) {
  const clamped = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : undefined;
  return (
    <article className="kch-stat">
      <span className="kch-stat-label">{label}</span>
      <strong className="kch-stat-value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </strong>
      {typeof clamped === "number" ? (
        <div className="kch-stat-bar" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} aria-label={`${label} ${clamped}%`}>
          <span style={{ width: `${Math.max(clamped, clamped > 0 ? 1.5 : 0)}%` }} />
        </div>
      ) : null}
      <p className="kch-stat-detail">{detail}</p>
    </article>
  );
}

/* ---------------------------------- Dashboard (/admin) ---------------------------------- */

export function AdminDashboardCharts({
  roles,
  evidence,
}: {
  roles: AdminRoleSummary[];
  evidence: { domains: AdminEvidenceDomain[]; roles: AdminEvidenceRole[] };
}) {
  const published = roles.filter((role) => role.status === "published").length;
  const drafts = roles.length - published;
  const ready = roles.filter((role) => role.status === "draft" && role.competencyCount > 0 && role.coveredCompetencies === role.competencyCount).length;
  const atRisk = roles.filter((role) => role.competencyCount > 0 && Math.round((role.coveredCompetencies / role.competencyCount) * 100) < 75).length;
  const domainRows: BarDatum[] = evidence.domains.map((domain) => ({
    label: domain.domain.replaceAll("_", " "),
    fill: domain.supported,
    total: domain.total,
    value: `${domain.supported}/${domain.total}`,
    warn: domain.gaps ? `${domain.gaps} gap${domain.gaps === 1 ? "" : "s"}` : undefined,
    variant: "lime",
    title: `${domain.domain}: ${domain.supported} of ${domain.total} results supported, ${domain.gaps} supported gap${domain.gaps === 1 ? "" : "s"}`,
  }));
  const maxRoleResults = Math.max(...evidence.roles.map((item) => item.results), 1);
  const roleRows: BarDatum[] = evidence.roles.map((item) => ({
    label: item.role,
    fill: item.results,
    total: maxRoleResults,
    value: String(item.results),
    variant: "lime",
    title: `${item.role}: ${item.results} assessment results`,
  }));

  return (
    <section className="kch-section" aria-label="Portfolio intelligence">
      <ChartStyle />
      <SectionHead title="Portfolio intelligence" />
      <div className="kch-grid">
        <div className="kch-panel">
          <h3 className="kch-panel-title">Evidence by competency domain</h3>
          <BarRows rows={domainRows} emptyNote="No assessment results yet — charts fill in as officials complete assessments." />
        </div>
        <div className="kch-panel">
          <h3 className="kch-panel-title">
            Matrix status <small>latest version per role</small>
          </h3>
          <StatusDonut published={published} drafts={drafts} />
          <div className="kch-flow" aria-label="Governance flow">
            <FlowNode count={drafts} total={roles.length} label="drafts" />
            <FlowArrow />
            <FlowNode count={ready} total={roles.length} label="publish-ready" />
            <FlowArrow />
            <FlowNode count={published} total={roles.length} label="published" variant="wash" />
          </div>
          {atRisk > 0 ? (
            <p className="kch-flow-branch" aria-label={`${atRisk} matrices at risk`}>
              ↳ {atRisk} draft{atRisk === 1 ? "" : "s"} at risk (coverage &lt;75%)
            </p>
          ) : null}
        </div>
      </div>
      <div className="kch-panel" style={{ marginTop: 14 }}>
        <h3 className="kch-panel-title">Assessment evidence by role</h3>
        <BarRows rows={roleRows} emptyNote="No assessment evidence yet." />
      </div>
    </section>
  );
}

/* ---------------------------------- Officials (/admin/officials) ---------------------------------- */

export function OfficialsCharts({ officials }: { officials: AdminOfficialSummary[] }) {
  const assigned = officials.reduce((sum, official) => sum + official.assignedCourses, 0);
  const completed = officials.reduce((sum, official) => sum + official.completedCourses, 0);
  const completionPct = assigned ? Math.round((completed / assigned) * 100) : 0;
  const inProgress = Math.max(assigned - completed, 0);

  return (
    <section className="kch-section" aria-label="Learning progress">
      <ChartStyle />
      <SectionHead title="Learning progress" />
      <div className="kch-panel">
        <h3 className="kch-panel-title">Course completion</h3>
        <p className="kch-big-number">
          {completed} <small>/ {assigned} courses</small>
        </p>
        <div
          className="kch-rail"
          role="progressbar"
          aria-valuenow={completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Course completion ${completionPct}%`}
        >
          <span style={{ width: `${assigned ? Math.max((completed / assigned) * 100, assigned > 0 ? 1.5 : 0) : 0}%` }} />
        </div>
        <p className="kch-rail-caption">
          {completionPct}% completed · {inProgress} in progress
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------- Analytics (/admin/analytics) ---------------------------------- */

export function AnalyticsCharts({
  metrics,
  gaps,
}: {
  metrics: {
    readinessPercent: number;
    assessmentCoveragePercent: number;
    completionRate: number;
    courseCompletions: number;
    courseAssignments: number;
    completedAssessments: number;
    officials: number;
  };
  gaps: Array<{ domain: string; gaps: number }>;
}) {
  const maxGaps = Math.max(...gaps.map((item) => item.gaps), 1);
  const totalGaps = gaps.reduce((sum, item) => sum + item.gaps, 0);
  const gapRows: BarDatum[] = gaps.map((item) => ({
    label: item.domain.replaceAll("_", " "),
    fill: item.gaps,
    total: maxGaps,
    value: String(item.gaps),
    warn: undefined,
    variant: "lime",
    title: `${item.domain}: ${item.gaps} supported gaps`,
  }));

  return (
    <section className="kch-section" aria-label="Readiness overview and gaps chart">
      <ChartStyle />
      <div className="kch-stats">
        <StatCard label="Readiness" value={metrics.readinessPercent} unit="%" progress={metrics.readinessPercent} detail="of results meet the required level" />
        <StatCard label="Coverage" value={metrics.assessmentCoveragePercent} unit="%" progress={metrics.assessmentCoveragePercent} detail="of results backed by enough evidence" />
        <StatCard
          label="Course completion"
          value={metrics.completionRate}
          unit="%"
          progress={metrics.completionRate}
          detail={metrics.courseAssignments ? `${metrics.courseCompletions} of ${metrics.courseAssignments} assigned courses` : "No courses assigned yet"}
        />
        <StatCard
          label="Completed assessments"
          value={metrics.completedAssessments}
          detail={`${metrics.officials} officials on record · ${totalGaps} open gap${totalGaps === 1 ? "" : "s"}`}
        />
      </div>
      {gapRows.length ? (
        <div className="kch-panel" style={{ marginTop: 14 }}>
          <h3 className="kch-panel-title">
            Supported gaps by domain <small>{gaps.length} domains</small>
          </h3>
          <BarRows rows={gapRows} emptyNote="No supported gaps yet." />
        </div>
      ) : null}
    </section>
  );
}
