import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Check, Layers3, LockKeyhole, MousePointer2, Scan } from "lucide-react";
import { requirePageUser } from "@/lib/auth/user";
import { ownedScene } from "@/lib/services/scenes";
import { AppError } from "@/lib/http";
import { signRead } from "@/lib/storage/r2";
import { StudioHeader } from "@/components/studio-header";
import { UploadForm } from "@/components/upload-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scene studio", robots: { index: false, follow: false } };

export default async function ScenePage({ params }: { params: Promise<{ sceneId: string }> }) {
  const user = await requirePageUser();
  const { sceneId } = await params;
  const scene = await ownedScene(sceneId, user.id).catch(error => { if (error instanceof AppError && error.status === 404) notFound(); throw error; });
  const preview = scene.normalizedAsset ? await signRead(scene.normalizedAsset) : null;
  return <><StudioHeader name={user.displayName}/><main className="studio-main shell"><Link href="/dashboard" className="back-link"><ArrowLeft size={15}/> Your scenes</Link><div className="page-heading"><div><span className="eyebrow">SCENE STUDIO</span><h1>{scene.title}</h1><p><LockKeyhole size={13}/> Private scene · {preview ? "Photo saved" : "Waiting for a photo"}</p></div><span className="pill"><span className="tiny-dot"/>{preview ? "PHOTO READY" : "DRAFT"}</span></div>
    {!preview ? <UploadForm scene={{ id: scene.id, title: scene.title, revision: scene.revision }}/> : <div className="workspace-layout"><div className="source-frame"><div className="source-toolbar"><span><Scan size={14}/> SOURCE PHOTO</span><span>Saved to your studio <Check size={13}/></span></div><div className="source-image"><Image src={preview} alt={scene.title} fill unoptimized sizes="(max-width: 800px) 100vw, 65vw" style={{ objectFit: "contain" }} priority/></div><div className="source-footer">{scene.normalizedAsset?.width} × {scene.normalizedAsset?.height} · Ready for object detection</div></div><aside className="workspace-next"><span className="eyebrow">YOUR SCENE’S NEXT CHAPTER</span><h2>There’s more<br/>in the picture.</h2><ol><li className="complete"><span><Check size={13}/></span><div><h3>Start with a photo</h3><p>Your image is saved and ready.</p></div></li><li><span><Scan size={13}/></span><div><h3>Find the objects</h3><p>Identify and review individual pieces.</p></div></li><li><span><Layers3 size={13}/></span><div><h3>Build the scene</h3><p>Reconstruct editable 3D previews.</p></div></li><li><span><MousePointer2 size={13}/></span><div><h3>Make it shoppable</h3><p>Connect products and share your scene.</p></div></li></ol><div className="next-build-note">Object detection and 3D reconstruction are coming in the next build.</div><Link href="/#preview" className="text-link">Explore the interactive sample <ArrowUpRight size={14}/></Link></aside></div>}
  </main></>;
}
