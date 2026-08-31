import Link from "next/link";

export const metadata = { title: "Terms — Kaushal AI" };

export default function TermsPage() {
  return (
    <main id="main-content" className="page-shell">
      <div className="workspace-back">
        <Link href="/" className="back-button">← Back to home</Link>
      </div>
      <div className="page-header">
        <div>
          <span className="tag tag-ink">Terms</span>
          <h1>Terms of use</h1>
          <p>Conditions for using the Kaushal AI prototype. By continuing you acknowledge this is an SIH demonstration, not a government service.</p>
        </div>
        <span className="tag">Last updated 31 Aug 2026</span>
      </div>

      <div className="surface" style={{ marginTop: 28, borderTop: "3px solid var(--ink)" }}>
        <div style={{ display: "grid", gap: 22 }}>
          <section>
            <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Acceptance</h2>
            <p className="muted" style={{ margin: 0 }}>Use of Kaushal AI means you accept these terms. If you do not accept, do not use the prototype workspaces.</p>
          </section>
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
            <div>
              <strong style={{ fontSize: 13 }}>Prototype disclaimer</strong>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 12.5 }}>Working prototype for a 5–7 minute SIH demo. Scores and recommendations are from seeded data and bounded AI for demonstration only.</p>
            </div>
            <div>
              <strong style={{ fontSize: 13 }}>Not a government service</strong>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 12.5 }}>Not affiliated with iGOT, Karmayogi Bharat, or any ministry. Do not use for real personnel decisions.</p>
            </div>
          </section>
          <section style={{ paddingTop: 20, borderTop: "1px solid var(--line)" }}>
            <h3 style={{ margin: "0 0 8px" }}>Intellectual property</h3>
            <p className="muted" style={{ margin: 0 }}>UI adapts the Frame reference for institutional use. Doodles are generated assets. Code and seeded catalog remain with the team, iGOT course content attributed to owners.</p>
          </section>
          <section style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingTop: 20, borderTop: "1px solid var(--line)" }}>
            <div style={{ flex: "1 1 260px" }}>
              <strong style={{ fontSize: 13 }}>Limitation of liability</strong>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 12.5 }}>Provided as-is without warranty. Team not liable for decisions from prototype outputs.</p>
            </div>
            <div style={{ flex: "1 1 260px" }}>
              <strong style={{ fontSize: 13 }}>Changes</strong>
              <p className="muted" style={{ margin: "8px 0 0", fontSize: 12.5 }}>Terms may evolve toward production. Continued use indicates acceptance of updates.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
