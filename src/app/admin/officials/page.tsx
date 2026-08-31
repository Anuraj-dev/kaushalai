import { AdminRepository } from "@/data/admin-repository";
import { OfficialTable } from "@/components/admin/official-table";
export const dynamic = "force-dynamic";
export default async function OfficialsPage() { const officials = await new AdminRepository().listOfficials(); return <><header className="page-header admin-page-header"><div><h1>Officials</h1><p>{officials.length} persisted official profiles and their current learning status.</p></div><span className="tag">Organization</span></header><OfficialTable officials={officials}/></>; }
