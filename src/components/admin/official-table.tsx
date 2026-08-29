import type { AdminOfficialSummary } from "@/data/admin-repository";
export function OfficialTable({ officials }: { officials: AdminOfficialSummary[] }) {
  return <div className="admin-table-wrap"><table><thead><tr><th>Official</th><th>Employee code</th><th>Job role</th><th>Assessment</th><th>Courses</th><th>Reassessment</th></tr></thead><tbody>{officials.map((official) => <tr key={official.id}><th scope="row">{official.name}</th><td>{official.employeeCode}</td><td>{official.roleName}</td><td>{official.assessmentStatus ?? "Not started"}</td><td>{official.completedCourses}/{official.assignedCourses} complete</td><td>{official.reassessmentEligible ? "Eligible" : "Not due"}</td></tr>)}</tbody></table></div>;
}
