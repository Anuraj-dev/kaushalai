"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminRoleSummary } from "@/data/admin-repository";

type StatusFilter = "all" | "draft" | "published";

export function RoleTable({ roles }: { roles: AdminRoleSummary[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return roles.filter((role) => {
      const matchesSearch =
        !needle ||
        role.roleName.toLowerCase().includes(needle) ||
        role.matrixId.toLowerCase().includes(needle) ||
        role.roleId.toLowerCase().includes(needle);
      const matchesStatus = status === "all" || role.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [roles, q, status]);

  return (
    <div>
      <div className="admin-ledger-toolbar">
        <label className="admin-search-wrap">
          <span aria-hidden="true">⌕</span>
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search role, e.g. Investigator"
            aria-label="Search roles"
          />
        </label>
        <div className="admin-filter-group" role="group" aria-label="Filter by status">
          <button type="button" className="admin-filter-pill" aria-pressed={status === "all"} onClick={() => setStatus("all")}>
            All
          </button>
          <button type="button" className="admin-filter-pill" aria-pressed={status === "draft"} onClick={() => setStatus("draft")}>
            Draft
          </button>
          <button type="button" className="admin-filter-pill" aria-pressed={status === "published"} onClick={() => setStatus("published")}>
            Published
          </button>
        </div>
        <span className="admin-ledger-count">
          {filtered.length} of {roles.length}
        </span>
      </div>

      <div className="admin-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Role</th>
              <th>Status</th>
              <th>Competencies</th>
              <th>Coverage</th>
              <th>Officials</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((role) => {
              const pct = role.competencyCount ? Math.round((role.coveredCompetencies / role.competencyCount) * 100) : 0;
              const isComplete = pct === 100;
              const isLow = pct < 75;
              const coverageClass = ["coverage-cell", isComplete ? "is-complete" : "", isLow ? "coverage-cell--low" : ""]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={role.roleId} data-status={role.status}>
                  <th scope="row">
                    <div style={{ display: "grid", gap: 4 }}>
                      <strong style={{ fontWeight: 500, fontSize: 13 }}>{role.roleName}</strong>
                      <small className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>
                        {role.matrixId} · v{role.version}
                      </small>
                    </div>
                  </th>
                  <td>
                    <span className={`status-pill status-pill--${role.status}`}>
                      <span className="status-pill__dot" aria-hidden="true" />
                      {role.status}
                    </span>
                  </td>
                  <td>{role.competencyCount}</td>
                  <td>
                    <div className={coverageClass}>
                      <div
                        className="coverage-bar"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${role.roleName} coverage ${pct}%`}
                      >
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <div className="coverage-text">
                        <span>
                          {role.coveredCompetencies}/{role.competencyCount}
                        </span>
                        <strong>{pct}%</strong>
                      </div>
                    </div>
                  </td>
                  <td>{role.affectedOfficials}</td>
                  <td>
                    <Link
                      href={`/admin/matrices/${role.roleId}`}
                      className={`kaushal-button kaushal-button--sm ${role.status === "draft" ? "kaushal-button-dark" : "kaushal-button-secondary"}`}
                    >
                      {role.status === "draft" ? "Review draft →" : "View matrix →"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p className="muted" role="status" style={{ marginTop: 14, fontSize: 12 }}>
          No matrices match your filters.
        </p>
      ) : null}
    </div>
  );
}
