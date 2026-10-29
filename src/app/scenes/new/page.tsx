import Link from "next/link";
import { ArrowLeft, Check, Lightbulb } from "lucide-react";
import { requirePageUser } from "@/lib/auth/user";
import { StudioHeader } from "@/components/studio-header";
import { UploadForm } from "@/components/upload-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create a scene" };

export default async function NewScene() {
  const user = await requirePageUser();
  return <><StudioHeader name={user.displayName}/><main className="studio-main shell"><Link href="/dashboard" className="back-link"><ArrowLeft size={15}/> Your scenes</Link><div className="page-heading"><div><span className="eyebrow">LET’S START WITH A PHOTO</span><h1>Give your photo a new dimension.</h1><p>A product, an outfit, or any arrangement. Make it your scene.</p></div></div><div className="upload-layout"><UploadForm/><aside className="upload-tips"><Lightbulb size={23} strokeWidth={1.3}/><h2>A good photo goes a long way.</h2><ul>{["Choose a clear, well-lit photo.", "Keep the main products clearly visible.", "Keep the whole item inside the frame.", "Separate silhouettes where possible."].map(tip => <li key={tip}><Check size={14}/>{tip}</li>)}</ul><p>Review and correct the AI outlines before building. Transparent surfaces, fine details and clothing can be harder to reconstruct; fit and unseen geometry are approximate.</p></aside></div></main></>;
}
