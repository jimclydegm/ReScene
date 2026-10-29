import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Box, ImagePlus, Plus, Clock3, ChevronLeft, ChevronRight, LockKeyhole, Layers3, LoaderCircle } from "lucide-react";
import { requirePageUser } from "@/lib/auth/user";
import { getDb } from "@/lib/db";
import { signRead } from "@/lib/storage/r2";
import { dashboardPage, dashboardProgress, SCENES_PER_PAGE } from "@/lib/scene/dashboard";
import { StudioHeader } from "@/components/studio-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your studio", robots: { index: false, follow: false } };
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "Asia/Manila" });
const pageHref = (page: number) => page === 1 ? "/dashboard" : `/dashboard?page=${page}`;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ page?: string | string[] }> }) {
  const [user, query] = await Promise.all([requirePageUser(), searchParams]);
  const db = getDb();
  const where = { ownerId: user.id, archivedAt: null };
  const groups = await db.scene.groupBy({ by: ["status"], where, _count: true });
  const total = groups.reduce((sum, group) => sum + group._count, 0);
  const ready = groups.find(group => group.status === "READY")?._count ?? 0;
  const generating = groups.filter(group => ["ANALYZING", "RECONSTRUCTING"].includes(group.status)).reduce((sum, group) => sum + group._count, 0);
  const { page, pages, skip } = dashboardPage(query.page, total);
  const scenes = await db.scene.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip, take: SCENES_PER_PAGE,
    include: { normalizedAsset: true, posterAsset: true,
      objects: { where: { status: { not: "EXCLUDED" } }, select: { status: true, maskAssetId: true, modelAssetId: true } },
      runs: { where: { status: { in: ["QUEUED", "RUNNING", "WAITING"] } }, orderBy: { createdAt: "desc" }, take: 1, select: { status: true, currentStage: true, progress: true } }
    }
  });
  const cards = await Promise.all(scenes.map(async scene => {
    const preview = [scene.posterAsset, scene.normalizedAsset].find(asset => asset?.status === "READY" && asset.sceneId === scene.id && ["POSTER", "NORMALIZED_IMAGE"].includes(asset.kind));
    return { scene, url: preview ? await signRead(preview).catch(() => null) : null, isPoster: preview?.kind === "POSTER",
      progress: dashboardProgress({ ...scene, hasMasks: scene.objects.some(object => object.maskAssetId), run: scene.runs[0] ?? null }),
      meshes: scene.objects.filter(object => object.status === "READY" && object.modelAssetId).length };
  }));
  return <><StudioHeader name={user.displayName}/><main className="studio-main shell dashboard-main">
    <div className="page-heading dashboard-heading"><div><span className="eyebrow">YOUR STUDIO</span><h1>Your scenes.</h1><p>Pick up where you left off, or start with a new photo.</p></div><Link href="/scenes/new" className="button button-dark"><Plus size={17}/> Create a scene</Link></div>
    <div className="dashboard-summary" aria-label="Studio overview"><div><Layers3 size={18}/><span><strong>{total}</strong> {total === 1 ? "project" : "projects"}</span></div><div><Box size={18}/><span><strong>{ready}</strong> ready to edit</span></div><div><LoaderCircle size={18}/><span><strong>{generating}</strong> generating</span></div><span className="dashboard-private"><LockKeyhole size={13}/> Private workspace</span></div>
    {total ? <><div className="project-list-heading"><h2>All projects <span>{total}</span></h2><span>Recently updated</span></div>
      <div className="project-grid">{cards.map(({ scene, url, isPoster, progress, meshes }) => <Link href={`/scenes/${scene.id}`} prefetch={false} key={scene.id} className="project-card" aria-label={`Open ${scene.title}`}>
        <div className="project-preview">{url ? <Image src={url} alt={`${isPoster ? "Scene" : "Photo"} preview of ${scene.title}`} fill sizes="(max-width: 600px) 100px, 144px" unoptimized/> : <div className="project-preview-empty"><ImagePlus size={28} strokeWidth={1.3}/><span>No photo yet</span></div>}{url && <span className="preview-label">{isPoster ? "Scene preview" : "Source photo"}</span>}</div>
        <div className="project-card-content"><div className="project-card-top"><span className={`project-status${progress.attention ? " attention" : progress.running ? " working" : ""}`}><span className="tiny-dot"/>{progress.label}</span><ArrowUpRight size={17} className="project-arrow"/></div>
          <h2 title={scene.title}>{scene.title}</h2><div className="project-meta"><span><Box size={12}/>{meshes ? `${meshes} 3D ${meshes === 1 ? "object" : "objects"}` : `${scene.objects.length} ${scene.objects.length === 1 ? "object" : "objects"} found`}</span><span><Clock3 size={12}/><time dateTime={scene.updatedAt.toISOString()}>Updated {dateFormat.format(scene.updatedAt)}</time></span></div>
          <div className="project-stages" aria-label={`${progress.completed} of 3 stages complete: photo, objects, 3D`}>{["Photo", "Objects", "3D scene"].map((stage, index) => <span key={stage} className={index < progress.completed ? "complete" : ""}><i/>{stage}</span>)}</div>
          <div className="project-next"><span>{progress.next}</span>{progress.runProgress !== null && <span>{progress.runProgress}%</span>}</div>
          {progress.runProgress !== null && <progress className="project-run-progress" value={progress.runProgress} max={100} aria-label={scene.status === "ANALYZING" ? "Analysis progress" : "Reconstruction progress"}/>}
        </div>
      </Link>)}</div>
      <nav className="project-pagination" aria-label="Project pages"><p>Showing <strong>{skip + 1}–{Math.min(skip + SCENES_PER_PAGE, total)}</strong> of {total} projects</p><div className="pagination-controls">{page > 1 ? <Link className="pagination-arrow" href={pageHref(page - 1)} aria-label="Previous page"><ChevronLeft size={16}/></Link> : <span className="pagination-arrow disabled" aria-disabled="true"><ChevronLeft size={16}/></span>}
        {Array.from({ length: pages }, (_, i) => i + 1).map(number => <Link key={number} href={pageHref(number)} aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined}>{number}</Link>)}
        {page < pages ? <Link className="pagination-arrow" href={pageHref(page + 1)} aria-label="Next page"><ChevronRight size={16}/></Link> : <span className="pagination-arrow disabled" aria-disabled="true"><ChevronRight size={16}/></span>}</div></nav>
    </> : <div className="empty-state"><div className="empty-scene-art"><div/><Box size={60} strokeWidth={0.8}/><span>01</span></div><span className="eyebrow">A BLANK CANVAS, FOR NOW</span><h2>Every scene starts somewhere.</h2><p>Upload a photo of a room or product arrangement.<br/>We’ll keep it ready in your private studio.</p><Link href="/scenes/new" className="button button-dark"><ImagePlus size={17}/> Upload your first photo</Link><Link className="text-link" href="/#preview">Or explore the interactive sample <ArrowUpRight size={14}/></Link></div>}
    <div className="studio-note"><LockKeyhole size={13}/><p>Only you can access your photos and drafts. Product cards and sharing are coming next.</p></div>
  </main></>;
}
