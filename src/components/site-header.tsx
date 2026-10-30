import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/logo";

export function SiteHeader() {
  return <header className="site-header shell">
    <Logo/>
    <nav className="desktop-nav" aria-label="Main navigation">
      <Link href="/#how-it-works">How it works</Link>
      <Link href="/#preview">Sample scene</Link>
    </nav>
    <div className="header-actions">
      <Link href="/auth/sign-in" className="login-link">Log in</Link>
      <Link href="/dashboard" className="button button-dark button-small">Open studio <ArrowUpRight size={14}/></Link>
    </div>
  </header>;
}
