import Link from "next/link";
import { notFound } from "next/navigation";
import { createDraft } from "@/app/admin/actions";
import { MatrixForm } from "@/components/admin/matrix-form";
import { AdminRepository } from "@/data/admin-repository";
import { Button } from "@/components/ui/button";
export const dynamic = "force-dynamic";
export default async function MatrixPage({ params }: { params: Promise<{ roleId: string }> }) { const { roleId } = await params; const matrix = new AdminRepository().getMatrix(roleId); if (!matrix) notFound(); return <><Link className="text-link back-link" href="/admin">← Back to role matrices</Link><header className="page-header admin-page-header matrix-header"><div><h1>{matrix.roleName}</h1><p>Status: {matrix.status}. Published versions are read-only.</p></div><span className="tag">Matrix editor · version {matrix.version}</span><Button asChild variant="secondary"><Link href={`/admin/matrices/${roleId}/preview`}>Preview version <span aria-hidden="true">→</span></Link></Button></header>{matrix.status === "published" && <form className="new-version-form" action={createDraft}><input type="hidden" name="roleId" value={roleId}/><Button variant="dark" type="submit">Create new version <span aria-hidden="true">→</span></Button></form>}<MatrixForm matrix={matrix}/></>; }
