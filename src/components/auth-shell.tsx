import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Box } from "lucide-react";
import { Logo } from "@/components/logo";
import { AuthForm } from "@/components/auth-form";
import { ThemeMenu } from "@/components/theme-menu";

export function AuthShell({ mode }: { mode: "sign-in" | "sign-up" }) {
  const signUp = mode === "sign-up";
  return <main className="auth-layout">
    <aside className="auth-aside"><Image className="auth-aside-image" src="/demo/photography/corner-chair-lifestyle.webp" alt="An upholstered chair in a sunlit living space, generated from a product reference" width={1000} height={1400} priority/><Logo light/><div className="auth-aside-copy"><span className="eyebrow">From photo to 3D</span><h2>A new angle<br/>on your products</h2><p>Build scenes people can explore.<br/>Start with a single photo.</p></div><span className="auth-aside-foot"><Box size={16}/> Built with Meta AI · Illustrative product photography</span></aside>
    <section className="auth-main"><div className="auth-top"><Link href="/" className="back-link"><ArrowLeft size={15}/> Back to ReScene</Link><ThemeMenu/></div><div className="auth-content"><span className="eyebrow">ReScene studio</span><h1>{signUp ? "Create your account" : "Log in to your studio"}</h1><p>{signUp ? "Save your photos, scenes and product collections." : "Your photos, scenes and collections are here."}</p><AuthForm mode={mode}/></div><p className="auth-bottom-note">Your photos stay private until you choose to share a scene.</p></section>
  </main>;
}
