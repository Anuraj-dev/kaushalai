import Link from "next/link";
import { notFound } from "next/navigation";
import { createDraft } from "@/app/admin/actions";
import { MatrixForm } from "@/components/admin/matrix-form";
import { AdminRepository } from "@/data/admin-repository";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function MatrixPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const matrix = new AdminRepository().getMatrix(roleId);
  if (!matrix) notFound();

  const selectedCount = matrix.competencies.length;
  const coverageCount = matrix.competencies.filter(
    (c) => c.rubricLevels === 5 && c.courseTags.length > 0 && c.baselineQuestions >= 1 && c.fallbackQuestions >= 3,
  ).length;
  const coveragePercent = selectedCount ? Math.round((coverageCount / selectedCount) * 100) : 0;
  const isValidCount = selectedCount >= 6 && selectedCount <= 8;
  const isReady = isValidCount && coveragePercent === 100 && matrix.status === "draft";

  return (
    <>
      <Link className="text-link back-link" href="/admin">
        ← Back to role matrices
      </Link>
      <header className="page-header admin-page-header admin-page-header--matrix">
        <div>
          <h1>{matrix.roleName}</h1>
        </div>
        <div className="admin-header-actions">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/admin/matrices/${roleId}/preview`}>
              Preview version <span aria-hidden="true">→</span>
            </Link>
          </Button>
        </div>
      </header>

      {matrix.status === "published" && (
        <form action={createDraft} style={{ margin: "18px 0 14px" }}>
          <input type="hidden" name="roleId" value={roleId} />
          <Button variant="dark" type="submit" size="sm">
            Create new version <span aria-hidden="true">→</span>
          </Button>
        </form>
      )}

      <section className="admin-matrix-strip" aria-label="Matrix overview">
        <div className="admin-governance-metric">
          <span>Selected</span>
          <strong>
            {selectedCount} / 8
          </strong>
          <small>{isValidCount ? "6–8 required · valid" : "6–8 required"}</small>
        </div>
        <div className="admin-governance-metric">
          <span>Coverage</span>
          <strong>{coveragePercent}%</strong>
          <small>
            {coverageCount}/{selectedCount} complete · rubric + tags + questions
          </small>
        </div>
        <div className={`admin-governance-metric ${isReady ? "admin-governance-metric--ready" : ""}`}>
          <span>Publish readiness</span>
          <strong>{matrix.status === "published" ? "Published" : isReady ? "Ready" : "Not ready"}</strong>
          <small>{matrix.status === "published" ? `Immutable · v${matrix.version}` : isReady ? "Complete — can publish" : "Needs 6–8 and 100% coverage"}</small>
        </div>
      </section>

      <MatrixForm matrix={matrix} />
    </>
  );
}
