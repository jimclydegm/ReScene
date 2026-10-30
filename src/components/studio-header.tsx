import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/logo";
import { SignOut } from "@/components/sign-out";

export function StudioHeader({ name, wide = false }: { name: string | null; wide?: boolean }) {
  return <header className={`studio-header${wide ? " studio-header-wide" : " shell"}`}><Logo/><Link href="/dashboard" className="studio-nav">Your scenes</Link><div className="studio-header-right"><Link href="/#preview" className="sample-link">Explore sample <ArrowUpRight size={13}/></Link><span className="avatar" title={name ?? "Your account"}>{name?.[0]?.toUpperCase() ?? "R"}</span><SignOut/></div></header>;
}
