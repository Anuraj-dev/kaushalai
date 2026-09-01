"use client";

import { useMemo, useState } from "react";
import type { AdminOfficialSummary } from "@/data/admin-repository";

type SimpleFilter = "all" | "not_started" | "assessed";

export function OfficialTable({ officials }: { officials: AdminOfficialSummary[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<SimpleFilter>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return officials.filter((official) => {
      const matchesSearch =
        !needle ||
        official.name.toLowerCase().includes(needle) ||
        official.employeeCode.toLowerCase().includes(needle) ||
        official.roleName.toLowerCase().includes(needle);
      const normalized = (official.assessmentStatus ?? "not_started").toLowerCase();
      const isAssessed = normalized !== "not_started";
      const matchesFilter = filter === "all" || (filter === "not_started" && normalized === "not_started") || (filter === "assessed" && isAssessed);
      return matchesSearch && matchesFilter;
    });
  }, [officials, q, filter]);

  return (
    <div>
      <div className="admin-ledger-toolbar">
        <label className="admin-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search official, e.g. A-001" aria-label="Search officials" />
        </label>
        <div className="admin-filter-group" role="group" aria-label="Filter officials">
          {(["all", "not_started", "assessed"] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`admin-filter-pill ${filter === value ? "is-active" : ""}`}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === "assessed" ? "Assessed" : value.replaceAll("_", " ")}
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
