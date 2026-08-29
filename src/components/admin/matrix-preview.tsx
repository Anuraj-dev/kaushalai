import type { AdminMatrixDetail } from "@/data/admin-repository";
export function MatrixPreview({ matrix }: { matrix: AdminMatrixDetail }) {
  return <section><header><p>Version {matrix.version} · {matrix.status}</p><h1>{matrix.roleName}</h1><p>{matrix.competencies.length} competency requirements</p></header>
    <ol className="admin-preview-list">{matrix.competencies.map((item) => <li key={item.id}><h2>{item.name}</h2><p>{item.domain.replaceAll("_", " ")} · required level {item.requiredLevel} · importance {item.importance}</p><dl><div><dt>Rubric</dt><dd>{item.rubricLevels}/5 levels</dd></div><div><dt>Course tags</dt><dd>{item.courseTags.join(", ")}</dd></div><div><dt>Questions</dt><dd>{item.baselineQuestions} baseline, {item.fallbackQuestions} fallback</dd></div></dl></li>)}</ol>
  </section>;
}
