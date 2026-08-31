import Link from "next/link";
import { Button } from "@/components/ui/button";

const flow = [
  { number: "01", title: "Assess", body: "Start with a fixed baseline against the published role matrix." },
  { number: "02", title: "Explain", body: "Answer focused questions and see how evidence supports each result." },
  { number: "03", title: "Learn", body: "Get a course path tied to the gaps that matter most." },
];

const proofRows = [
  { label: "Matrix", value: "Version 1", detail: "Pinned at assessment start" },
  { label: "Evidence", value: "Every answer", detail: "Stored with its source and reliability" },
  { label: "Outcome", value: "A clear next step", detail: "Recommendations follow verified gaps" },
];

export default function Home() {
  return <main id="main-content" className="landing">
    <section className="landing-hero" aria-labelledby="landing-title">
      <h1 id="landing-title">Make the next learning step <span>defensible.</span></h1>
      <p className="landing-lede">Kaushal AI turns demonstrated competency evidence into a clear, explainable learning path for public officials.</p>
      <div className="hero-tags" aria-label="Connected workflow">
        <span className="tag">Assessment</span><span className="tag">Evidence</span><span className="tag">Learning history</span><span className="tag">Recommendations</span>
      </div>
      <div className="landing-actions"><Button asChild variant="primary"><Link href="/learner">Open official workspace <span aria-hidden="true">→</span></Link></Button><Button asChild variant="secondary"><Link href="/admin">View administrator workspace</Link></Button></div>
    </section>

    <section className="workflow-preview" aria-labelledby="workflow-title">
      <div className="section-heading section-heading-centered"><span className="tag">The evidence loop</span><h2 id="workflow-title">A competency picture you can follow.</h2><p>One continuous path from role requirements to a practical learning decision.</p></div>
      <div className="workflow-diagram" aria-label="Assessment, evidence, result, and learning path flow">
        <div className="workflow-node"><span className="node-index">01</span><strong>Published matrix</strong><small>Required level and importance</small></div>
        <span className="workflow-arrow" aria-hidden="true">→</span>
        <div className="workflow-node workflow-node-dark"><span className="node-index">02</span><strong>Assessment rounds</strong><small>Baseline, adaptive, clarify</small></div>
        <span className="workflow-arrow" aria-hidden="true">→</span>
        <div className="workflow-node"><span className="node-index">03</span><strong>Supported gaps</strong><small>Score, confidence, evidence</small></div>
        <span className="workflow-arrow" aria-hidden="true">→</span>
        <div className="workflow-node workflow-node-lime"><span className="node-index">04</span><strong>Learning path</strong><small>Catalog-backed next actions</small></div>
      </div>
      <div className="workflow-note"><span className="tag">Pinned versioning</span><p>Active assessments stay linked to the matrix version they started with, even when an administrator publishes an update.</p></div>
    </section>

    <section className="proof-section" aria-labelledby="proof-title">
      <div className="section-heading"><span className="tag">What changes</span><h2 id="proof-title">From a difficult question to a useful answer.</h2><p>The interface keeps the reasoning visible, so a learner knows what to do and an administrator knows what changed.</p></div>
      <div className="proof-grid">{flow.map((item) => <article className="proof-card" key={item.number}><span className="proof-number">{item.number}</span><h3>{item.title}</h3><p>{item.body}</p><span className="proof-line" aria-hidden="true"/></article>)}</div>
    </section>

    <section className="dark-evidence" aria-labelledby="evidence-title">
      <div className="dark-evidence-copy"><span className="tag tag-dark">Evidence ledger</span><h2 id="evidence-title">The score is never a black box.</h2><p>Every result is grounded in a requirement, an answer, a reliability level, and a reason. The numbers stay close to the source.</p><Button asChild variant="light"><Link href="/learner">See the learner flow <span aria-hidden="true">→</span></Link></Button></div>
      <div className="evidence-ledger" aria-label="Example evidence ledger">
        {proofRows.map((row, index) => <div className="ledger-row" key={row.label}><span className="ledger-index">0{index + 1}</span><div><span className="ledger-label">{row.label}</span><strong>{row.value}</strong><small>{row.detail}</small></div><span className="ledger-mark" aria-hidden="true">✓</span></div>)}
      </div>
    </section>

    <section className="feature-section" aria-labelledby="feature-title">
      <div className="section-heading section-heading-centered"><span className="tag">Built for the work</span><h2 id="feature-title">Every part, connected.</h2><p>Short screens, clear transitions, and the detail needed for a defensible decision.</p></div>
      <div className="feature-grid">
        <article className="feature-card feature-card-wide"><div><span className="tag tag-lime">Official workspace</span><h3>Answer in rounds, not all at once.</h3><p>Start with a baseline, then move through personalized evidence and clarification only when the result needs more support.</p></div><div className="mini-stepper" aria-hidden="true"><span className="is-done">01</span><span className="is-current">02</span><span>03</span><span>04</span></div></article>
        <article className="feature-card"><span className="tag">Administrator workspace</span><h3>Publish with a paper trail.</h3><p>Review coverage, edit a draft matrix, and publish an immutable version that future assessments can reference.</p><div className="mini-table" aria-hidden="true"><span/><span/><span/><span/></div></article>
        <article className="feature-card"><span className="tag">Learning history</span><h3>Keep progress in context.</h3><p>Course completions add verified history without rewriting the assessment that came before.</p><div className="mini-bars" aria-hidden="true"><span/><span/><span/></div></article>
      </div>
    </section>

    <section className="lime-band" aria-labelledby="next-step-title">
      <div className="section-heading section-heading-centered"><span className="tag tag-ink">One connected practice</span><h2 id="next-step-title">Evidence in. A defensible next step out.</h2><p>Walk the seeded demo from assessment to recommendation, then open the administrator view to see the organization-level picture.</p></div>
      <div className="lime-actions"><Button asChild variant="dark"><Link href="/learner">Start an assessment <span aria-hidden="true">→</span></Link></Button><Button asChild variant="light"><Link href="/admin">Open administrator view</Link></Button></div>
    </section>

    <footer className="landing-footer"><div><span className="brand-mark brand-mark-light" aria-hidden="true"><span/></span><strong>Kaushal AI</strong></div><p>Evidence-based competency practice for public officials.</p><div className="footer-links"><Link href="/learner">Official workspace</Link><Link href="/admin">Administrator workspace</Link></div></footer>
  </main>;
}
