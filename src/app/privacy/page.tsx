import Link from "next/link";

export const metadata = { title: "Privacy — Kaushal AI" };

export default function PrivacyPage() {
  return (
    <main id="main-content" className="page-shell">
      <div className="workspace-back">
        <Link href="/" className="back-button">← Back to home</Link>
      </div>
      <div className="page-header">
        <div>
          <span className="tag tag-ink">Privacy</span>
          <h1>Privacy policy</h1>
          <p>How Kaushal AI handles demonstration data. This prototype is built for SIH evaluation and does not process real personal data.</p>
        </div>
        <span className="tag">Last updated 31 Aug 2026</span>
      </div>

      <div className="surface" style={{ marginTop: 28, borderTop: "3px solid var(--lime)" }}>
        <h2 style={{ marginBottom: 8 }}>Overview</h2>
        <p className="muted">Kaushal AI is an evidence-based competency prototype. Seeded official profiles and assessment responses are synthetic and stored for demonstration only.</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, marginTop: 28 }}>
          <div style={{ padding: 16, border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "var(--lime-wash)" }}>
            <strong style={{ fontSize: 13 }}>Data we collect</strong>
            <ul style={{ margin: "10px 0 0", paddingLeft: 16, color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6 }}>
              <li>Seeded official profiles (name, designation, department) — synthetic</li>
              <li>Assessment choices and short written evidence — per session</li>
              <li>Published matrix versions and catalog imports — seeded iGOT data</li>
            </ul>
          </div>
          <div style={{ padding: 16, border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
            <strong style={{ fontSize: 13 }}>What we do not collect</strong>
            <p className="muted" style={{ margin: "10px 0 0", fontSize: 12.5 }}>No Aadhaar, no government IDs, no real employee records. No tracking cookies or analytics beyond basic error logs.</p>
          </div>
        </div>

        <h3 style={{ marginTop: 28 }}>Storage and security</h3>
        <p className="muted">Demo data lives in a local SQLite database seeded via scripts. Session state is held server-side and cleared on reset. For production, data would be encrypted at rest and scoped by organization.</p>

        <h3 style={{ marginTop: 24 }}>Your rights</h3>
        <p className="muted">As this is a controlled prototype, you may request a full data reset at any time. Contact the team via <a href="https://github.com/Anuraj-dev/kaushalai" target="_blank" rel="noreferrer">GitHub</a>.</p>
      </div>
    </main>
  );
}
