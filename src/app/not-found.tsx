import Link from "next/link";
import { ArrowLeft, Box } from "lucide-react";

export default function NotFound() {
  return <main className="error-page"><Box size={45} strokeWidth={1}/><span className="eyebrow">OUT OF FRAME</span><h1>We couldn’t find that scene.</h1><p>It may have moved, or it belongs to another account.</p><Link className="button button-dark" href="/dashboard"><ArrowLeft size={16}/> Back to your studio</Link></main>;
}
