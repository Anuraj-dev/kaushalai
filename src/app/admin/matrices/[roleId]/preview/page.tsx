import Link from "next/link";
import { notFound } from "next/navigation";
import { MatrixPreview } from "@/components/admin/matrix-preview";
import { AdminRepository } from "@/data/admin-repository";
export const dynamic = "force-dynamic";
export default async function PreviewPage({ params }: { params: Promise<{ roleId: string }> }) { const { roleId } = await params; const matrix = new AdminRepository().getMatrix(roleId); if (!matrix) notFound(); return <><Link className="text-link back-link" href={`/admin/matrices/${roleId}`}>← Back to editor</Link><MatrixPreview matrix={matrix}/></>; }
