import { AdminRepository } from "@/data/admin-repository";
import { RoleTable } from "@/components/admin/role-table";
export const dynamic = "force-dynamic";
export default function AdminPage() { const roles = new AdminRepository().listRoles(); return <><header className="page-header admin-page-header"><div><h1>Role matrices</h1><p>Review question coverage and publish new immutable versions for ten Official Statistics roles.</p></div><span className="tag">Competency governance</span></header><RoleTable roles={roles}/></>; }
