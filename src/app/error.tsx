"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("ReScene page could not load", { digest: error.digest }); }, [error]);
  return <main className="error-page"><span className="eyebrow">Page unavailable</span><h1>The page could not load</h1><p>We couldn’t load the page. Please try again in a moment.</p><button className="button button-dark" onClick={reset}><RotateCcw size={16}/> Try again</button><Link className="text-link" href="/"><ArrowLeft size={14}/> Back to ReScene</Link></main>;
}
