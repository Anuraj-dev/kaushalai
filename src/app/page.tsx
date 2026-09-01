import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return <main id="main-content" className="landing">
    <section className="landing-hero" aria-labelledby="landing-title">
      <h1 id="landing-title">Build the skills your role demands</h1>
      <p className="landing-lede">Kaushal AI helps officials understand their skill gaps and what to learn next</p>
      <div className="landing-actions"><Button asChild variant="primary"><Link href="/learner">Continue as an official</Link></Button><Button asChild variant="secondary"><Link href="/admin">Continue as administrator</Link></Button></div>
    </section>

    <section className="workflow-preview workflow-preview-decorated" aria-labelledby="workflow-title">
      <div className="workflow-top-art workflow-top-art-left" aria-hidden="true"><Image src="/landing/top-target.png" alt="" width={160} height={160} /></div><div className="workflow-top-art workflow-top-art-right" aria-hidden="true"><Image src="/landing/top-mountain.png" alt="" width={180} height={160} /></div><div className="section-heading section-heading-centered workflow-heading-decorated"><div className="workflow-heading-text"><h2 id="workflow-title">A skill map you can actually act on</h2><p>From what your role needs to what you should learn next</p></div></div>
      <div className="workflow-diagram" aria-label="Assessment, evidence, result, and learning path flow">
        <div className="workflow-node"><span className="node-index">01</span><strong>Role Requirements</strong><small>Expected level and priority</small></div>
        <span className="workflow-arrow" aria-hidden="true">→</span>
        <div className="workflow-node workflow-node-dark"><span className="node-index">02</span><strong>Assessment rounds</strong><small>Baseline, adaptive, clarify</small></div>
        <span className="workflow-arrow" aria-hidden="true">→</span>
        <div className="workflow-node"><span className="node-index">03</span><strong>Identified skill gaps</strong><small>Scores backed by evidence</small></div>
        <span className="workflow-arrow" aria-hidden="true">→</span>
        <div className="workflow-node workflow-node-lime"><span className="node-index">04</span><strong>Personalized learning path</strong><small>Recommended courses and next steps</small></div>
      </div>
      <div className="workflow-bottom-trail" aria-hidden="true"><div className="workflow-trail-line" /><div className="workflow-trail-items"><div className="workflow-trail-item"><Image src="/landing/bottom-books.png" alt="" width={160} height={130} /></div><div className="workflow-trail-item"><Image src="/landing/bottom-clipboard.png" alt="" width={160} height={130} /></div><div className="workflow-trail-item"><Image src="/landing/bottom-bridge.png" alt="" width={170} height={130} /></div><div className="workflow-trail-item"><Image src="/landing/bottom-signpost.png" alt="" width={150} height={130} /></div></div></div>
    </section>

    <section className="feature-section" aria-labelledby="feature-title">
      <div className="feature-grid">
        <article className="feature-card feature-card-wide"><div className="feature-card-copy"><span className="tag tag-lime">Official workspace</span><h3>Assess step by step</h3><p>Begin with the basics and follow up only where more clarity is needed</p></div><div className="feature-wide-art" aria-hidden="true"><Image src="/landing/features/rounds-doc.png" alt="" width={360} height={220} className="feature-wide-doc" /><Image src="/landing/features/rounds-steps.png" alt="" width={360} height={152} className="feature-wide-steps" /><Image src="/landing/features/rounds-arc.png" alt="" width={220} height={132} className="feature-wide-arc" /></div></article>
        <article className="feature-card feature-card-admin"><span className="tag">Administrator workspace</span><h3>Publish with a paper trail</h3><p>Build, review, and publish competency matrices with a clear version history</p><div className="feature-admin-art" aria-hidden="true"><Image src="/landing/features/admin-papers.png" alt="" width={340} height={237} /></div><div className="mini-table" aria-hidden="true"><span/><span/><span/><span/></div></article>
        <article className="feature-card feature-card-learning"><span className="tag">Learning history</span><h3>Track progress over time</h3><p>New progress is recorded while previous assessment results stay intact</p><div className="feature-learning-art" aria-hidden="true"><Image src="/landing/features/learning-full.png" alt="" width={560} height={242} className="learning-timeline-img" /></div><div className="feature-learning-bars" aria-hidden="true"><div className="mini-bars"><span /><span /><span /></div></div></article>
      </div>
    </section>

    <section className="lime-band" aria-labelledby="next-step-title">
      <div className="section-heading section-heading-centered"><h2 id="next-step-title">From skill gaps to the right learning path</h2><p>Each recommendation comes from what the role requires and what the assessment shows</p></div>
    </section>

    <footer className="landing-footer"><div className="footer-brand"><div className="footer-brand-row"><span className="brand-mark brand-mark-light" aria-hidden="true"><img src="/kaushal-logo.svg" alt="" width={22} height={22} style={{ width: 22, height: 22, objectFit: "contain" }} /></span><strong>Kaushal AI</strong></div><p>Personalized learning for public officials</p></div><nav className="footer-nav" aria-label="Footer"><a href="#workflow-title">How it works</a><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="https://github.com/Anuraj-dev/kaushalai" target="_blank" rel="noreferrer">GitHub</a></nav><div className="footer-bottom"><small>© 2026 Kaushal AI</small></div></footer>
  </main>;
}
