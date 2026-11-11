import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Check } from "lucide-react";

export default function Home() {
  return (
    <main className="field-guide">
      <section className="guide-hero">
        <div className="guide-grid">
          <div className="guide-copy reveal">
            <h1>Find a college<br />that fits <em>you.</em></h1>
            <p className="hero-description">Compare schools by major, cost, and location.<br />Build a shortlist around what matters to you.</p>
            <div className="guide-actions">
              <Link className="guide-primary" href="/search">Explore colleges <ArrowUpRight size={21} /></Link>
              <Link className="guide-secondary" href="/onboarding">Take the quiz <ArrowUpRight size={17} /></Link>
            </div>
          </div>
          <figure className="guide-visual reveal campus-photo">
            <div className="atlas-frame">
              <Image src="/images/ucla-royce-hall.jpg" alt="Students walking in front of Royce Hall at UCLA" width="1500" height="1000" priority sizes="(max-width: 700px) 100vw, 50vw" />
              <figcaption>UCLA · Royce Hall <a href="https://newsroom.ucla.edu/file?fid=65e733882cfac2500b0516c2" target="_blank" rel="noreferrer">Photo: UCLA ↗</a></figcaption>
            </div>
          </figure>
        </div>
      </section>
      <section className="guide-strip reveal" aria-label="Our approach">
        <p><Check size={17} /> Federal college data</p>
        <p><Check size={17} /> Personalized fit scores</p>
        <p><Check size={17} /> Clear costs and tradeoffs</p>
      </section>
      <section className="quick-links" aria-label="College planning tools">
        <Link href="/onboarding"><span>01</span><h2>Find your fit</h2><p>Set your major, budget, and preferences.</p><ArrowUpRight size={22} /></Link>
        <Link href="/dashboard"><span>02</span><h2>Build your shortlist</h2><p>Keep your favorite schools in one place.</p><ArrowUpRight size={22} /></Link>
        <Link href="/compare"><span>03</span><h2>Compare colleges</h2><p>See costs and outcomes side by side.</p><ArrowUpRight size={22} /></Link>
      </section>
      <footer className="guide-footer"><span>Dream Campus</span><p>Decision support. Not admissions or financial advice.</p></footer>
    </main>
  );
}
