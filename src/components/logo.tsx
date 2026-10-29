import Link from "next/link";

export function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`logo${light ? " logo-light" : ""}`} aria-label="ReScene home">
    <svg width="29" height="31" viewBox="0 0 29 31" fill="none" aria-hidden="true">
      <path d="M14.5 2L26 8.8V22.2L14.5 29L3 22.2V8.8L14.5 2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M3 8.8L14.5 15.5L26 8.8M14.5 15.5V29M8.8 5.3L20.2 12.1V18.7" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>
    </svg>
    <span>ReScene<span className="logo-period">.</span></span>
  </Link>;
}
