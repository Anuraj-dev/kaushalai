import { AdminRepository } from "@/data/admin-repository";
import { RoleTable } from "@/components/admin/role-table";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const roles = new AdminRepository().listRoles();
  const drafts = roles.filter((role) => role.status === "draft").length;
  const published = roles.length - drafts;
  const atRisk = roles.filter((role) => role.competencyCount > 0 && Math.round((role.coveredCompetencies / role.competencyCount) * 100) < 75).length;
  const avgCoverage = roles.length
    ? Math.round(roles.reduce((sum, role) => sum + (role.competencyCount ? (role.coveredCompetencies / role.competencyCount) * 100 : 0), 0) / roles.length)
    : 0;
  const sumOfficials = roles.reduce((sum, role) => sum + role.affectedOfficials, 0);
  const ready = roles.filter((role) => role.coveredCompetencies === role.competencyCount && role.competencyCount > 0).length;
  const latest = roles.length ? Math.max(...roles.map((role) => role.version)) : 0;
  const nextVersion = latest + 1;

  return (
    <>
      <header className="page-header admin-page-header admin-page-header--governance">
        <div>
          <div className="header-meta">
            <span className="tag tag-lime">Governance</span>
            <span className="tag">
              {roles.length} roles · v{latest} latest
            </span>
          </div>
          <h1>Role matrices</h1>
          <p>
            Review question coverage and publish new immutable versions for ten Official Statistics roles. Only complete matrices
            (rubrics, tags, baseline + fallback) can be published.
          </p>
        </div>
        <div className="admin-header-actions">
          <span className="tag">Immutability enforced</span>
          <small className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
            Drafts create a new version · publish locks v{nextVersion}
          </small>
        </div>
      </header>

      <section className="admin-governance-strip" aria-label="Governance overview">
        <div className="admin-governance-metric">
          <span>Matrices governed</span>
          <strong>{roles.length}</strong>
          <small>{sumOfficials} officials impacted</small>
        </div>
        <div className="admin-governance-metric">
          <span>Average coverage</span>
          <strong>{avgCoverage}%</strong>
          <small>
            {ready} publish-ready · {atRisk} at risk &lt;75%
          </small>
        </div>
        <div className="admin-governance-metric">
          <span>Drafts</span>
          <strong>{drafts}</strong>
          <small>{published} published</small>
        </div>
        <div className={`admin-governance-metric ${ready > 0 ? "admin-governance-metric--ready" : ""}`}>
          <span>Publish-ready</span>
          <strong>{ready}</strong>
          <small>Complete rubrics + tags + questions</small>
        </div>
      </section>

      <RoleTable roles={roles} />
    </>
  );
}
