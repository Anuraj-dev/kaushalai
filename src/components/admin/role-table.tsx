import Link from "next/link";
import type { AdminRoleSummary } from "@/data/admin-repository";

export function RoleTable({ roles }: { roles: AdminRoleSummary[] }) {
  return <div className="admin-table-wrap"><table><thead><tr><th>Job role</th><th>Version</th><th>Status</th><th>Competencies</th><th>Question coverage</th><th>Officials</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{roles.map((role) => <tr key={role.roleId}><th scope="row">{role.roleName}</th><td>v{role.version}</td><td>{role.status}</td><td>{role.competencyCount}</td><td>{role.coveredCompetencies}/{role.competencyCount}</td><td>{role.affectedOfficials}</td><td><Link href={`/admin/matrices/${role.roleId}`}>Manage</Link></td></tr>)}</tbody></table></div>;
}
