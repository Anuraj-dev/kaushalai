import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return <main id="main-content" className="landing">
    <section className="landing-hero" aria-labelledby="landing-title">
      <h1 id="landing-title">Find what to learn to meet your role</h1>
      <p className="landing-lede">Kaushal AI turns demonstrated competency evidence into a clear, explainable learning path for public officials.</p>
      <div className="landing-actions"><Button asChild variant="primary"><Link href="/learner">Open official workspace <span aria-hidden="true">→</span></Link></Button><Button asChild variant="secondary"><Link href="/admin">View administrator workspace</Link></Button></div>
    </section>

    <section className="workflow-preview workflow-preview-decorated" aria-labelledby="workflow-title">
      <div className="workflow-top-art workflow-top-art-left" aria-hidden="true"><Image src="/landing/top-target.png" alt="" width={160} height={160} /></div><div className="workflow-top-art workflow-top-art-right" aria-hidden="true"><Image src="/landing/top-mountain.png" alt="" width={180} height={160} /></div><div className="section-heading section-heading-centered workflow-heading-decorated"><div className="workflow-heading-text"><h2 id="workflow-title">A competency picture you can follow.</h2><p>One continuous path from role requirements to a practical learning decision.</p></div></div>
      <div className="workflow-diagram" aria-label="Assessment, evidence, result, and learning path flow">
        <div className="workflow-node"><span className="node-index">01</span><strong>Published matrix</strong><small>Required level and importance</small></div>
        <span className="workflow-arrow" aria-hidden="true">→</span>
        <div className="workflow-node workflow-node-dark"><span className="node-index">02</span><strong>Assessment rounds</strong><small>Baseline, adaptive, clarify</small></div>
        <span className="workflow-arrow" aria-hidden="true">→</span>
        <div className="workflow-node"><span className="node-index">03</span><strong>Supported gaps</strong><small>Score, confidence, evidence</small></div>
        <span className="workflow-arrow" aria-hidden="true">→</span>
        <div className="workflow-node workflow-node-lime"><span className="node-index">04</span><strong>Learning path</strong><small>Catalog-backed next actions</small></div>
      </div>
      <div className="workflow-bottom-trail" aria-hidden="true"><div className="workflow-trail-line" /><div className="workflow-trail-items"><div className="workflow-trail-item"><Image src="/landing/bottom-books.png" alt="" width={160} height={130} /></div><div className="workflow-trail-item"><Image src="/landing/bottom-clipboard.png" alt="" width={160} height={130} /></div><div className="workflow-trail-item"><Image src="/landing/bottom-bridge.png" alt="" width={170} height={130} /></div><div className="workflow-trail-item"><Image src="/landing/bottom-signpost.png" alt="" width={150} height={130} /></div></div></div>
    </section>

    <section className="feature-section" aria-labelledby="feature-title">
      <div className="feature-grid">
        <article className="feature-card feature-card-wide"><div className="feature-card-copy"><span className="tag tag-lime">Official workspace</span><h3>Answer in rounds, not all at once.</h3><p>Start with a baseline, then move through personalized evidence and clarification only when the result needs more support.</p></div><div className="feature-wide-art" aria-hidden="true"><Image src="/landing/features/rounds-doc.png" alt="" width={360} height={220} className="feature-wide-doc" /><Image src="/landing/features/rounds-steps.png" alt="" width={360} height={152} className="feature-wide-steps" /><Image src="/landing/features/rounds-arc.png" alt="" width={220} height={132} className="feature-wide-arc" /></div></article>
        <article className="feature-card feature-card-admin"><span className="tag">Administrator workspace</span><h3>Publish with a paper trail.</h3><p>Review coverage, edit a draft matrix, and publish an immutable version that future assessments can reference.</p><div className="feature-admin-art" aria-hidden="true"><Image src="/landing/features/admin-papers.png" alt="" width={340} height={237} /></div><div className="mini-table" aria-hidden="true"><span/><span/><span/><span/></div></article>
        <article className="feature-card feature-card-learning"><span className="tag">Learning history</span><h3>Keep progress in context.</h3><p>Course completions add verified history without rewriting the assessment that came before.</p><div className="feature-learning-art" aria-hidden="true"><Image src="/landing/features/learning-full.png" alt="" width={560} height={242} className="learning-timeline-img" /></div><div className="feature-learning-bars" aria-hidden="true"><div className="mini-bars"><span /><span /><span /></div></div></article>
      </div>
    </section>

    <section className="lime-band" aria-labelledby="next-step-title">
      <div className="section-heading section-heading-centered"><h2 id="next-step-title">Competency made visible.<br />Next steps made clear.</h2><p>From published matrix to supported gaps to catalog-backed learning, every recommendation traces back to demonstrated evidence.</p></div>
    </section>

    <footer className="landing-footer"><div className="footer-brand"><div className="footer-brand-row"><span className="brand-mark brand-mark-light" aria-hidden="true"><img src="/kaushal-logo.svg" alt="" width={22} height={22} style={{ width: 22, height: 22, objectFit: "contain" }} /></span><strong>Kaushal AI</strong></div><p>Evidence-based competency practice for public officials.</p></div><nav className="footer-nav" aria-label="Footer"><a href="#workflow-title">How it works</a><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="https://github.com/Anuraj-dev/kaushalai" target="_blank" rel="noreferrer">GitHub</a></nav><div className="footer-bottom"><small>© 2026 Kaushal AI</small></div></footer>
  </main>;
}
