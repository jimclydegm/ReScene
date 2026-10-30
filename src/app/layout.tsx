import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "ReScene — Give your photos another dimension", template: "%s · ReScene" },
  description: "Turn a photo into an editable, shoppable 3D scene. Built with Meta AI."
};

// Applies a saved light/dark choice before first paint; no saved choice follows the system.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }}/></head><body className={`${geist.variable} ${mono.variable}`}>{children}</body></html>;
}
