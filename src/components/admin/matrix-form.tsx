import type { AdminMatrixDetail } from "@/data/admin-repository";
import { publishMatrix, saveMatrix } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function MatrixForm({ matrix }: { matrix: AdminMatrixDetail }) {
  const selected = new Map(matrix.competencies.map((item) => [item.id, item]));
  const editable = matrix.status === "draft";
  return <form action={saveMatrix} className="admin-matrix-form">
    <input type="hidden" name="roleId" value={matrix.roleId}/><input type="hidden" name="versionId" value={matrix.versionId}/>
    <fieldset disabled={!editable}><legend><span className="tag tag-lime">Working matrix</span>Competency requirements</legend>
      <p>Select 6 to 8 competencies. Required level uses 1 to 5; importance uses 1 to 3.</p>
      {matrix.availableCompetencies.map((competency) => { const current = selected.get(competency.id); return <div className="admin-competency-row" key={competency.id}>
        <label className="competency-name"><input type="checkbox" name={`selected:${competency.id}`} defaultChecked={Boolean(current)}/> <span>{competency.name}</span> <small>{competency.domain.replaceAll("_", " ")}</small></label>
        <label>Required level <select name={`level:${competency.id}`} defaultValue={current?.requiredLevel ?? 3}>{[1,2,3,4,5].map((level) => <option key={level}>{level}</option>)}</select></label>
        <label>Importance <select name={`importance:${competency.id}`} defaultValue={current?.importance ?? 2}>{[1,2,3].map((level) => <option key={level}>{level}</option>)}</select></label>
      </div>; })}
    </fieldset>
    {editable && <div className="admin-actions"><Button variant="secondary" type="submit">Save draft</Button><Button variant="dark" formAction={publishMatrix}>Publish version</Button></div>}
  </form>;
}
