import Link from "next/link";
import { notFound } from "next/navigation";
import { createDraft } from "@/app/admin/actions";
import { MatrixForm } from "@/components/admin/matrix-form";
import { AdminRepository } from "@/data/admin-repository";
export const dynamic = "force-dynamic";
export default async function MatrixPage({ params }: { params: Promise<{ roleId: string }> }) { const { roleId } = await params; const matrix = new AdminRepository().getMatrix(roleId); if (!matrix) notFound(); return <><header><p>Matrix editor · version {matrix.version}</p><h1>{matrix.roleName}</h1><p>Status: {matrix.status}. Published versions are read-only.</p><Link href={`/admin/matrices/${roleId}/preview`}>Preview version</Link></header>{matrix.status === "published" && <form action={createDraft}><input type="hidden" name="roleId" value={roleId}/><button>Create new version</button></form>}<MatrixForm matrix={matrix}/></>; }
