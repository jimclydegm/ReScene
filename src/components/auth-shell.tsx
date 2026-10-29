import Link from "next/link";
import { ArrowLeft, Box, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { AuthForm } from "@/components/auth-form";

export function AuthShell({ mode }: { mode: "sign-in" | "sign-up" }) {
  const signUp = mode === "sign-up";
  return <main className="auth-layout">
    <aside className="auth-aside"><Logo light/><div className="auth-aside-copy"><span className="eyebrow">A NEW PERSPECTIVE</span><h2>Make room<br/>for your<br/><em>next idea.</em></h2><p>A photo is just the beginning.<br/>Your space has more to show.</p><div className="auth-cube"><Box size={140} strokeWidth={0.5}/></div></div><span className="auth-aside-foot"><Sparkles size={14}/> Built with Meta AI</span></aside>
    <section className="auth-main"><Link href="/" className="back-link"><ArrowLeft size={15}/> Back to ReScene</Link><div className="auth-content"><span className="eyebrow">YOUR CREATIVE SPACE</span><h1>{signUp ? "A fresh perspective." : "Good to see you."}</h1><p>{signUp ? "Create an account and start your first scene." : "Step back into your studio."}</p><AuthForm mode={mode}/></div><p className="auth-bottom-note">Your photos stay private until you choose to share a scene.</p></section>
  </main>;
}
