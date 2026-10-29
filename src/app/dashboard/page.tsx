import Link from "next/link";
import { ArrowUpRight, Box, ImagePlus, Plus, Clock3 } from "lucide-react";
import { requirePageUser } from "@/lib/auth/user";
import { getDb } from "@/lib/db";
import { StudioHeader } from "@/components/studio-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your studio" };

export default async function Dashboard() {
  const user = await requirePageUser();
  const scenes = await getDb().scene.findMany({ where: { ownerId: user.id, archivedAt: null }, orderBy: { updatedAt: "desc" }, take: 50 });
  return <><StudioHeader name={user.displayName}/><main className="studio-main shell"><div className="page-heading"><div><span className="eyebrow">YOUR STUDIO</span><h1>Room for a new idea.</h1><p>Your scenes, all in one place.</p></div><Link href="/scenes/new" className="button button-dark"><Plus size={17}/> Create a scene</Link></div>
    {scenes.length ? <div className="scene-grid">{scenes.map((scene, i) => <Link href={`/scenes/${scene.id}`} key={scene.id} className="scene-card"><div className={`scene-cover scene-cover-${i % 3}`}><Box size={62} strokeWidth={0.8}/><span className="scene-state"><span className="tiny-dot"/>{scene.normalizedAssetId ? "Photo ready" : "Draft"}</span><ArrowUpRight className="scene-open" size={20}/></div><div className="scene-card-body"><h2>{scene.title}</h2><p><Clock3 size={12}/>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(scene.updatedAt)}</p></div></Link>)}</div> : <div className="empty-state"><div className="empty-scene-art"><div/><Box size={60} strokeWidth={0.8}/><span>01</span></div><span className="eyebrow">A BLANK CANVAS, FOR NOW</span><h2>Every scene starts somewhere.</h2><p>Upload a photo of a room or product arrangement.<br/>We’ll keep it ready in your private studio.</p><Link href="/scenes/new" className="button button-dark"><ImagePlus size={17}/> Upload your first photo</Link><Link className="text-link" href="/#preview">Or explore the interactive sample <ArrowUpRight size={14}/></Link></div>}
    <div className="studio-note"><span className="tiny-dot"/><p>The studio is taking shape. Photo upload is ready; AI reconstruction and publishing are the next steps.</p></div>
  </main></>;
}
