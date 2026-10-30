import Link from "next/link";
import { ArrowRight, ArrowUpRight, Camera, Check, Layers, MousePointer2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Logo } from "@/components/logo";
import { DemoPreview } from "@/components/demo/demo-preview";

const steps = [
  { Icon: Camera, title: "Upload a photo", text: "A product, an outfit or a full scene. No 3D skills needed." },
  { Icon: Layers, title: "Review the objects", text: "Meta AI finds each item. Refine outlines, then build 3D meshes." },
  { Icon: MousePointer2, title: "Edit and publish", text: "Arrange, relight and add product links. Share a read-only scene." }
];

export default function Home() {
  return <>
    <SiteHeader/>
    <main>
      <section className="landing-hero shell">
        <div className="landing-copy">
          <span className="landing-kicker"><span className="tiny-dot"/>Photo to shoppable 3D · Built with Meta AI</span>
          <h1>One photo.<br/>A whole new <em>dimension.</em></h1>
          <p>Turn a product or scene photo into an interactive 3D space shoppers can explore and buy from.</p>
          <div className="landing-actions">
            <Link href="/scenes/new" className="button button-dark">Create a scene <ArrowRight size={15}/></Link>
            <Link href="#how-it-works" className="button button-light">How it works</Link>
          </div>
          <ul className="landing-points">
            <li><Check size={14}/>Products, outfits, rooms, food and more</li>
            <li><Check size={14}/>Edit layout, textures and lighting</li>
            <li><Check size={14}/>Share a read-only, shoppable link</li>
          </ul>
        </div>
        <DemoPreview/>
      </section>
      <section className="landing-steps shell" id="how-it-works" aria-labelledby="how-heading">
        <div className="landing-steps-heading"><h2 id="how-heading">How it works</h2><Link href="/scenes/new" className="text-link">Start now <ArrowUpRight size={14}/></Link></div>
        <ol>{steps.map(({ Icon, title, text }, index) => <li key={title}>
          <span className="landing-step-icon"><Icon size={17} strokeWidth={1.6}/></span>
          <div><small>Step {index + 1}</small><h3>{title}</h3><p>{text}</p></div>
        </li>)}</ol>
      </section>
    </main>
    <footer className="site-footer shell"><Logo/><span>3D geometry is approximate. Product details come from the seller.</span><a href="https://github.com/jimclydegm/ReScene" target="_blank" rel="noopener noreferrer">GitHub <ArrowUpRight size={13}/></a></footer>
  </>;
}
