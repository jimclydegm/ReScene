import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { requirePageUser } from "@/lib/auth/user";
import { ownedScene } from "@/lib/services/scenes";
import { AppError } from "@/lib/http";
import { signRead } from "@/lib/storage/r2";
import { workspace } from "@/lib/services/generation";
import { ProjectDetails } from "@/components/scene/project-details";
import { SceneStudio } from "@/components/scene/scene-studio";
import { StudioHeader } from "@/components/studio-header";
import { UploadForm } from "@/components/upload-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scene studio", robots: { index: false, follow: false } };

export default async function ScenePage({ params }: { params: Promise<{ sceneId: string }> }) {
  const user = await requirePageUser();
  const { sceneId } = await params;
  const scene = await ownedScene(sceneId, user.id).catch(error => { if (error instanceof AppError && error.status === 404) notFound(); throw error; });
  const preview = scene.normalizedAsset ? await signRead(scene.normalizedAsset) : null;
  if (preview) return <><StudioHeader name={user.displayName} wide/><main className="scene-main studio-wide"><SceneStudio initial={await workspace(sceneId, user.id)}/></main></>;
  return <><StudioHeader name={user.displayName}/><main className="studio-main shell scene-main"><Link href="/dashboard" className="back-link"><ArrowLeft size={15}/> Your scenes</Link><div className="page-heading"><div><span className="eyebrow">SCENE STUDIO</span><h1>{scene.title}</h1><p><LockKeyhole size={13}/> Private scene · Waiting for a photo</p></div><span className="pill"><span className="tiny-dot"/>DRAFT</span></div>
    <div className="scene-quick-actions"><ProjectDetails id={scene.id} title={scene.title} description={scene.description} revision={scene.revision} disabled={false}/></div><UploadForm key={scene.revision} scene={{ id: scene.id, title: scene.title, revision: scene.revision }}/>
  </main></>;
}
