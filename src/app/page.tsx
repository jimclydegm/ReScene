import Link from "next/link";
import { ArrowDown, ArrowUpRight, Camera, Layers3, MousePointer2, MoveUpRight, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Logo } from "@/components/logo";
import { DemoPreview } from "@/components/demo/demo-preview";

export default function Home() {
  return <>
    <SiteHeader/>
    <main>
      <section className="hero shell">
        <div className="hero-copy">
          <div className="pill"><span className="tiny-dot"/> A NEW PERSPECTIVE ON SHOPPING</div>
          <h1>One photo.<br/>A whole new<br/><span>dimension.</span><svg className="headline-star" width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><path d="M18 0L21.5 13L33.6 6L24 16L36 18L23 21.5L30 33.6L20 24L18 36L14.5 23L2.4 30L12 20L0 18L13 14.5L6 2.4L16 12Z" fill="currentColor"/></svg></h1>
          <p>Give your products a space to be explored.<br className="desktop-break"/> Turn a room photo into an interactive, shoppable 3D scene.</p>
          <div className="hero-actions"><Link href="/scenes/new" className="button button-dark">Create your first scene <ArrowUpRight size={18}/></Link><Link href="#preview" className="text-link">Take a look around <ArrowDown size={15}/></Link></div>
          <div className="hero-footnote"><Sparkles size={14}/> Built with Meta AI <span/> Made for curious shoppers.</div>
        </div>
        <div className="hero-visual"><div className="visual-note"><span className="handwritten-arrow">↙</span> Go ahead. Look around.</div><DemoPreview/><div className="visual-corner-note"><span className="tiny-dot"/> A little more than a picture.</div></div>
      </section>
      <section className="value-strip shell" aria-label="Scene capabilities"><span><MousePointer2 size={17}/> Every object, a product.</span><span><Layers3 size={17}/> More angles. One scene.</span><span><MoveUpRight size={17}/> A space you can make your own.</span><span className="prototype-label">META HACKATHON · 2026</span></section>
      <section className="how-section shell" id="how-it-works">
        <div className="section-heading"><div><span className="eyebrow">FROM STILL TO SPATIAL</span><h2>Your next storefront<br/>starts with a photo.</h2></div><p>A new way to show what belongs together.<br/>Built for furniture, spaces, and the things in them.</p></div>
        <div className="step-grid">{[
          { number: "01", Icon: Camera, title: "Start with your space", text: "Upload a clear photo of a room or product arrangement. No 3D modeling experience needed." },
          { number: "02", Icon: Layers3, title: "Give it dimension", text: "The planned Meta AI pipeline identifies objects and reconstructs each as an editable 3D preview." },
          { number: "03", Icon: MousePointer2, title: "Make it yours", text: "Explore the sample today. Product editing and publishing are the next parts of the studio." }
        ].map(({ number, Icon, title, text }) => <article key={number} className="step-card"><div className="step-top"><span>{number}</span><Icon size={23} strokeWidth={1.3}/></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>
      <section className="bottom-cta shell"><span className="eyebrow">MAKE SPACE FOR SOMETHING NEW</span><h2>There’s more to the picture.</h2><Link href="/scenes/new" className="button button-dark">Start a scene <ArrowUpRight size={17}/></Link><p>AI reconstructed geometry is approximate. Product details come from the seller.</p></section>
    </main>
    <footer className="site-footer shell"><Logo/><span>A new perspective, by ReScene.</span><a href="https://github.com/jimclydegm/ReScene" target="_blank" rel="noopener noreferrer">Built in the open <ArrowUpRight size={13}/></a></footer>
  </>;
}
