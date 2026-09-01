"use client";

import { useMemo, useState } from "react";
import type { AdminOfficialSummary } from "@/data/admin-repository";

type AssessmentFilter = "all" | "not_started" | "active" | "completed" | "provisional";
type ReassessmentFilter = "all" | "eligible" | "not_due";

export function OfficialTable({ officials }: { officials: AdminOfficialSummary[] }) {
  const [q, setQ] = useState("");
  const [assessment, setAssessment] = useState<AssessmentFilter>("all");
  const [reassessment, setReassessment] = useState<ReassessmentFilter>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return officials.filter((official) => {
      const matchesSearch =
        !needle ||
        official.name.toLowerCase().includes(needle) ||
        official.employeeCode.toLowerCase().includes(needle) ||
        official.roleName.toLowerCase().includes(needle);
      const normalized = (official.assessmentStatus ?? "not_started").toLowerCase() as AssessmentFilter;
      const matchesAssessment = assessment === "all" || normalized === assessment;
      const reassessKey: ReassessmentFilter = official.reassessmentEligible ? "eligible" : "not_due";
      const matchesReassessment = reassessment === "all" || reassessKey === reassessment;
      return matchesSearch && matchesAssessment && matchesReassessment;
    });
  }, [officials, q, assessment, reassessment]);

  return (
    <div>
      <div className="admin-ledger-toolbar">
        <label className="admin-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search official, e.g. A-001" aria-label="Search officials" />
        </label>
        <div className="admin-filter-group" role="group" aria-label="Filter by assessment">
          <span className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 9, marginRight: 4, alignSelf: "center" }}>
            Assessment
          </span>
          {(["all", "not_started", "active", "completed", "provisional"] as const).map((value) => (
            <button key={`a-${value}`} type="button" className={`admin-filter-pill ${assessment === value ? "is-active" : ""}`} aria-pressed={assessment === value} onClick={() => setAssessment(value)}>
              {value.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        <div className="admin-filter-group" role="group" aria-label="Filter by reassessment">
          <span className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 9, marginRight: 4, alignSelf: "center" }}>
            Reassessment
          </span>
          {(["all", "eligible", "not_due"] as const).map((value) => (
            <button key={`r-${value}`} type="button" className={`admin-filter-pill ${reassessment === value ? "is-active" : ""}`} aria-pressed={reassessment === value} onClick={() => setReassessment(value)}>
              {value.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        <span className="admin-ledger-count">
          {filtered.length} of {officials.length}
        </span>
      </div>

      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Official</th>
              <th>Employee code</th>
              <th>Job role</th>
              <th>Assessment</th>
              <th>Courses</th>
              <th>Reassessment</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((official) => {
              const assessmentStatus = (official.assessmentStatus ?? "not_started").toLowerCase();
              const reassessKey = official.reassessmentEligible ? "eligible" : "not_due";
              const pct = official.assignedCourses ? Math.round((official.completedCourses / official.assignedCourses) * 100) : 0;
              const isComplete = official.assignedCourses > 0 && pct === 100;
              return (
                <tr key={official.id} data-status={assessmentStatus}>
                  <th scope="row">
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ fontWeight: 500, fontSize: 13 }}>{official.name}</strong>
                      <small className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                        {official.id}
                      </small>
                    </div>
                  </th>
                  <td>{official.employeeCode}</td>
                  <td>{official.roleName}</td>
                  <td>
                    <span className={`status-pill status-pill--${assessmentStatus}`}>
                      <span className="status-pill__dot" aria-hidden="true" />
                      {assessmentStatus.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>
                    <div className={`courses-cell ${isComplete ? "is-complete" : ""}`}>
                      <div className="courses-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${official.name} courses ${pct}%`}>
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <div className="courses-text">
                        <span>
                          {official.completedCourses}/{official.assignedCourses}
                        </span>
                        <strong>{pct}%</strong>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`status-pill status-pill--${reassessKey}`}>
                      <span className="status-pill__dot" aria-hidden="true" />
                      {reassessKey.replaceAll("_", " ")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p className="muted" role="status" style={{ marginTop: 14, fontSize: 12 }}>
          No officials match your filters.
        </p>
      ) : null}
    </div>
  );
}
