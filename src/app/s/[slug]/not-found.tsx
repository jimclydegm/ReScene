import { Logo } from "@/components/logo";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
export default function SharedNotFound(){return <main className="error-page"><Logo/><span className="eyebrow">Shared scene</span><h1>This share link is unavailable</h1><p>The owner may have revoked it. Ask them for a current link.</p><Link href="/" className="button button-light"><ArrowLeft size={16}/>Back to ReScene</Link></main>;}
