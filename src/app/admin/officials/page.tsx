import { AdminRepository } from "@/data/admin-repository";
import { OfficialTable } from "@/components/admin/official-table";
export const dynamic = "force-dynamic";
export default async function OfficialsPage() { const officials = await new AdminRepository().listOfficials(); return <><header><p>Organization</p><h1>Officials</h1><p>{officials.length} persisted official profiles and their current learning status.</p></header><OfficialTable officials={officials}/></>; }
