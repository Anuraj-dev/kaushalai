import { AdminRepository } from "@/data/admin-repository";
import { OfficialTable } from "@/components/admin/official-table";

export const dynamic = "force-dynamic";

export default async function OfficialsPage() {
  const officials = await new AdminRepository().listOfficials();

  const total = officials.length;
  const assessed = officials.filter((o) => {
    const s = o.assessmentStatus?.toLowerCase();
    return s && s !== "not_started";
  }).length;
  const assessmentCoverage = total ? Math.round((assessed / total) * 100) : 0;
  const reassessmentEligible = officials.filter((o) => o.reassessmentEligible).length;
  const totalAssigned = officials.reduce((sum, o) => sum + o.assignedCourses, 0);
  const totalCompleted = officials.reduce((sum, o) => sum + o.completedCourses, 0);
  const avgCompletion = totalAssigned ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  return (
    <>
      <header className="page-header admin-page-header admin-page-header--personnel">
        <div>
          <div className="header-meta">
            <span className="tag tag-lime">Personnel</span>
            <span className="tag">{total} officials</span>
          </div>
          <h1>Officials</h1>
          <p>{total} persisted official profiles and their current learning status.</p>
        </div>
        <div className="admin-header-actions">
          <span className="tag tag-dark">Organization roster</span>
          <small className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
            Assessment + reassessment + courses
          </small>
        </div>
      </header>

      <section className="admin-personnel-strip" aria-label="Personnel overview">
        <div className="admin-personnel-metric">
          <span>Officials</span>
          <strong>{total}</strong>
          <small>{assessed} assessed · {total - assessed} not started</small>
        </div>
        <div className="admin-personnel-metric">
          <span>Assessment coverage</span>
          <strong>{assessmentCoverage}%</strong>
          <small>
            {assessed}/{total} with active or completed
          </small>
        </div>
        <div className="admin-personnel-metric">
          <span>Reassessment</span>
          <strong>{reassessmentEligible}</strong>
          <small>{reassessmentEligible} eligible · {total - reassessmentEligible} not due</small>
        </div>
        <div className="admin-personnel-metric">
          <span>Avg completion</span>
          <strong>{avgCompletion}%</strong>
          <small>
            {totalCompleted}/{totalAssigned} courses completed
          </small>
        </div>
      </section>

      <OfficialTable officials={officials} />
    </>
  );
}
