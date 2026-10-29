import Link from "next/link";
import { ArrowLeft, Check, Lightbulb } from "lucide-react";
import { requirePageUser } from "@/lib/auth/user";
import { StudioHeader } from "@/components/studio-header";
import { UploadForm } from "@/components/upload-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create a scene" };

export default async function NewScene() {
  const user = await requirePageUser();
  return <><StudioHeader name={user.displayName}/><main className="studio-main shell"><Link href="/dashboard" className="back-link"><ArrowLeft size={15}/> Your scenes</Link><div className="page-heading"><div><span className="eyebrow">LET’S START WITH A PHOTO</span><h1>Give your space a new perspective.</h1><p>A room, a corner, a collection of things. Make it your scene.</p></div></div><div className="upload-layout"><UploadForm/><aside className="upload-tips"><Lightbulb size={23} strokeWidth={1.3}/><h2>A good photo goes a long way.</h2><ul>{["Choose a well-lit room or arrangement.", "Keep 3–5 main objects clearly visible.", "Include a little floor around the furniture.", "Start with solid objects and simple shapes."].map(tip => <li key={tip}><Check size={14}/>{tip}</li>)}</ul><p>Furniture and home decor are a good place to start. Transparent surfaces and fine details can be harder to reconstruct.</p></aside></div></main></>;
}
