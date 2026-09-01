"use client";

import { useMemo, useState } from "react";
import type { AdminMatrixDetail } from "@/data/admin-repository";
import { publishMatrix, saveMatrix } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function MatrixForm({ matrix }: { matrix: AdminMatrixDetail }) {
  const selectedMap = useMemo(() => new Map(matrix.competencies.map((item) => [item.id, item])), [matrix.competencies]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(selectedMap.keys()));
  const editable = matrix.status === "draft";

  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ id: string; name: string; domain: string }>>();
    for (const competency of matrix.availableCompetencies) {
      const arr = map.get(competency.domain) ?? [];
      arr.push(competency);
      map.set(competency.domain, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [matrix.availableCompetencies]);

  const selectedCount = selectedIds.size;
  const coverageCount = matrix.competencies.filter(
    (c) => c.rubricLevels === 5 && c.courseTags.length > 0 && c.baselineQuestions >= 1 && c.fallbackQuestions >= 3,
  ).length;
  const coveragePercent = selectedCount ? Math.round((coverageCount / Math.max(selectedCount, 1)) * 100) : 0;

  const progressPct = Math.min((selectedCount / 8) * 100, 100);
  const progressState = selectedCount >= 6 && selectedCount <= 8 ? "is-complete" : selectedCount === 0 ? "" : "is-error";
  const isValid = selectedCount >= 6 && selectedCount <= 8;

  const toggle = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <form action={saveMatrix} className={`admin-matrix-form ${editable ? "" : "is-locked"}`}>
      <input type="hidden" name="roleId" value={matrix.roleId} />
      <input type="hidden" name="versionId" value={matrix.versionId} />
      <fieldset disabled={!editable}>
        <legend>
          <span className="tag tag-lime">Working matrix</span>Competency requirements
        </legend>
        <p>Select 6 to 8 competencies. Required level uses 1 to 5; importance uses 1 to 3.</p>

        <div
          className={`admin-matrix-progress ${progressState}`}
          role="progressbar"
          aria-valuenow={selectedCount}
          aria-valuemin={0}
          aria-valuemax={8}
          aria-label={`${selectedCount} of 8 competencies selected`}
        >
          <span style={{ width: `${progressPct}%` }} />
        </div>
        <p className="admin-matrix-hint">
          <strong>
            {selectedCount} / 8 selected
          </strong>{" "}
          · {isValid ? `${coveragePercent}% coverage` : "6–8 required to publish"} · {coverageCount} with full rubric + tags + questions
        </p>

        {grouped.map(([domain, competencies]) => {
          const domainSelected = competencies.filter((c) => selectedIds.has(c.id)).length;
          return (
            <div key={domain} className="admin-competency-group">
              <div className="admin-competency-group__head">
                <strong>{domain.replaceAll("_", " ")}</strong>
                <span>
                  {domainSelected}/{competencies.length} selected
                </span>
              </div>
              {competencies.map((competency) => {
                const current = selectedMap.get(competency.id);
                const isSelected = selectedIds.has(competency.id);
                return (
                  <div key={competency.id} className={`admin-competency-row ${isSelected ? "is-selected" : ""}`}>
                    <label className="competency-name">
                      <input
                        type="checkbox"
                        name={`selected:${competency.id}`}
                        checked={isSelected}
                        onChange={(e) => toggle(competency.id, e.target.checked)}
                        disabled={!editable}
                      />{" "}
                      <span>{competency.name}</span> <small>{competency.domain.replaceAll("_", " ")}</small>
                    </label>
                    <label>
                      Required level{" "}
                      <select name={`level:${competency.id}`} defaultValue={current?.requiredLevel ?? 3} disabled={!isSelected || !editable}>
                        {[1, 2, 3, 4, 5].map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Importance{" "}
                      <select name={`importance:${competency.id}`} defaultValue={current?.importance ?? 2} disabled={!isSelected || !editable}>
                        {[1, 2, 3].map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                );
              })}
            </div>
          );
        })}
      </fieldset>
      {editable ? (
        <div className="admin-matrix-actions">
          <Button variant="secondary" type="submit">
            Save draft
          </Button>
          <Button variant="dark" formAction={publishMatrix}>
            Publish version
          </Button>
          <span className="admin-matrix-actions__hint">Save stores draft · Publish locks immutable version</span>
        </div>
      ) : (
        <p className="admin-matrix-hint" style={{ marginTop: 18 }}>
          <strong>Locked</strong> — published versions are immutable. Create a new version to edit.
        </p>
      )}
    </form>
  );
}
