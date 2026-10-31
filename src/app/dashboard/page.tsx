import Image from "next/image";
import type {ReactNode} from "react";
import Link from "next/link";
import { ArrowUpRight, Play, Box, ImagePlus, Plus, Clock3, ChevronLeft, ChevronRight, LockKeyhole, Layers3, LoaderCircle, Search } from "lucide-react";
import { requirePageUser } from "@/lib/auth/user";
import { getDb } from "@/lib/db";
import { signRead } from "@/lib/storage/r2";
import { dashboardPage, dashboardProgress, dashboardQuery, SCENES_PER_PAGE } from "@/lib/scene/dashboard";
import { ProjectActions } from "@/components/project-actions";
import type { Prisma } from "@/generated/prisma/client";
import { StudioHeader } from "@/components/studio-header";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your studio", robots: { index: false, follow: false } };
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "Asia/Manila" });


function ProjectCardLink({id,title,archived,children}:{id:string;title:string;archived:boolean;children:ReactNode}){return archived?<div className="project-card">{children}</div>:<Link href={`/scenes/${id}`} prefetch={false} className="project-card" aria-label={`Open ${title}`}>{children}</Link>;}
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ page?: string | string[]; q?: string | string[]; view?: string | string[]; filter?: string | string[] }> }) {
  const [user, query] = await Promise.all([requirePageUser(), searchParams]);
  const db = getDb();
  const {q,archived,filter}=dashboardQuery(query);
  const baseWhere={ownerId:user.id,archivedAt:archived?{not:null}:null};
  const where:Prisma.SceneWhereInput={...baseWhere,...(q?{title:{contains:q,mode:"insensitive"}}:{}),...(filter==="GENERATING"?{status:{in:["ANALYZING","RECONSTRUCTING"]}}:filter==="READY"||filter==="FAILED"?{status:filter}:filter==="PUBLISHED"?{publications:{some:{revokedAt:null}}}:{})};
  function pageHref(page:number){const params=new URLSearchParams();if(q)params.set("q",q);if(archived)params.set("view","archived");if(filter!=="ALL")params.set("filter",filter);if(page>1)params.set("page",String(page));return `/dashboard${params.size?`?${params}`:""}`;}

  const [groups,filteredTotal]=await Promise.all([db.scene.groupBy({by:["status"],where:baseWhere,_count:true}),db.scene.count({where})]);
  const total = groups.reduce((sum, group) => sum + group._count, 0);
  const ready = groups.find(group => group.status === "READY")?._count ?? 0;
  const generating = groups.filter(group => ["ANALYZING", "RECONSTRUCTING"].includes(group.status)).reduce((sum, group) => sum + group._count, 0);
  const { page, pages, skip } = dashboardPage(query.page, filteredTotal);
  const scenes = await db.scene.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip, take: SCENES_PER_PAGE,
    include: { normalizedAsset: true, posterAsset: true, _count:{select:{publications:{where:{revokedAt:null}}}},
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
    <div className="dashboard-top"><div><h1>Your scenes</h1><p className="dashboard-stats" aria-label="Studio overview"><span><Layers3 size={13}/><strong>{total}</strong> {total === 1 ? "project" : "projects"}</span><span><Box size={13}/><strong>{ready}</strong> ready</span><span><LoaderCircle size={13}/><strong>{generating}</strong> generating</span><span><LockKeyhole size={12}/>Private</span></p></div><div className="dashboard-create-actions"><Link href="/demo" className="button button-light"><Play size={15}/>Demo mode</Link><Link href="/scenes/new" className="button button-dark"><Plus size={15}/>Create a scene</Link></div></div>
    <div className="dashboard-toolbar"><nav className="dashboard-views" aria-label="Project view"><Link href="/dashboard" aria-current={!archived?"page":undefined}>Active</Link><Link href="/dashboard?view=archived" aria-current={archived?"page":undefined}>Trash</Link></nav><form action="/dashboard" className="project-search">{archived&&<input type="hidden" name="view" value="archived"/>}<label className="project-search-field"><Search size={14}/><input name="q" defaultValue={q} maxLength={100} aria-label="Search projects" placeholder="Search projects…"/></label>{!archived&&<select name="filter" defaultValue={filter} aria-label="Filter projects"><option value="ALL">All statuses</option><option value="READY">Ready to edit</option><option value="GENERATING">Generating</option><option value="FAILED">Needs attention</option><option value="PUBLISHED">Published</option></select>}<button className="button button-light" type="submit">Find</button>{(q||filter!=="ALL")&&<Link className="text-link" href={archived?"/dashboard?view=archived":"/dashboard"}>Clear</Link>}</form></div>
    {filteredTotal ? <>
      <div className="project-grid">{cards.map(({ scene, url, isPoster, progress, meshes }) => <article className="project-card-frame" key={scene.id}><ProjectCardLink id={scene.id} title={scene.title} archived={archived}>
        <div className="project-preview">{url ? <Image src={url} alt={`${isPoster ? "Scene" : "Photo"} preview of ${scene.title}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 380px" unoptimized/> : <div className="project-preview-empty"><ImagePlus size={24} strokeWidth={1.3}/><span>No photo yet</span></div>}{url && <span className="preview-label">{isPoster ? "Scene preview" : "Source photo"}</span>}</div>
        <div className="project-card-content"><div className="project-card-top"><span className={`project-status${progress.attention ? " attention" : progress.running ? " working" : ""}`}><span className="tiny-dot"/>{archived?"Archived":scene._count.publications?"Published":progress.label}</span>{!archived&&<ArrowUpRight size={15} className="project-arrow"/>}</div>
          <h2 title={scene.title}>{scene.title}</h2><div className="project-meta">{scene._count.publications>0&&<span>{scene._count.publications} live {scene._count.publications===1?"link":"links"}</span>}<span><Box size={12}/>{meshes ? `${meshes} 3D ${meshes === 1 ? "object" : "objects"}` : `${scene.objects.length} ${scene.objects.length === 1 ? "object" : "objects"} found`}</span><span><Clock3 size={12}/><time dateTime={scene.updatedAt.toISOString()}>Updated {dateFormat.format(scene.updatedAt)}</time></span></div>
          <div className="project-stages" aria-label={`${progress.completed} of 3 stages complete: photo, objects, 3D`}>{["Photo", "Objects", "3D scene"].map((stage, index) => <span key={stage} className={index < progress.completed ? "complete" : ""}><i/>{stage}</span>)}</div>
          <div className="project-next"><span>{archived?"Restore to continue editing":progress.next}</span>{progress.runProgress !== null && <span>{progress.runProgress}%</span>}</div>
          {progress.runProgress !== null && <progress className="project-run-progress" value={progress.runProgress} max={100} aria-label={scene.status === "ANALYZING" ? "Analysis progress" : "Reconstruction progress"}/>}
        </div>
      </ProjectCardLink><div className="project-card-footer"><span>{archived?"Saved assets are kept":"Private project"}</span><ProjectActions id={scene.id} title={scene.title} revision={scene.revision} archived={archived}/></div></article>)}</div>
      <nav className="project-pagination" aria-label="Project pages"><p>Showing <strong>{skip + 1}–{Math.min(skip + SCENES_PER_PAGE, filteredTotal)}</strong> of {filteredTotal} projects</p><div className="pagination-controls">{page > 1 ? <Link className="pagination-arrow" href={pageHref(page - 1)} aria-label="Previous page"><ChevronLeft size={16}/></Link> : <span className="pagination-arrow disabled" aria-disabled="true"><ChevronLeft size={16}/></span>}
        {Array.from({ length: pages }, (_, i) => i + 1).map(number => <Link key={number} href={pageHref(number)} aria-label={`Page ${number}`} aria-current={number === page ? "page" : undefined}>{number}</Link>)}
        {page < pages ? <Link className="pagination-arrow" href={pageHref(page + 1)} aria-label="Next page"><ChevronRight size={16}/></Link> : <span className="pagination-arrow disabled" aria-disabled="true"><ChevronRight size={16}/></span>}</div></nav>
    </> : q||filter!=="ALL"||archived ? <div className="empty-state"><Search size={30}/><h2>{archived?"Trash is empty":"No matching projects"}</h2><p>{q?"Try another name or clear your search.":archived?"Deleted projects keep their saved assets and can be restored.":"Try a different status filter."}</p><Link className="button button-light" href="/dashboard">Back to active projects</Link></div> : <div className="empty-state"><div className="empty-scene-art"><div/><Box size={60} strokeWidth={0.8}/><span>01</span></div><span className="eyebrow">Private studio</span><h2>Create your first scene</h2><p>Upload a photo of a scene, outfit, or product.<br/>We’ll keep it ready in your private studio.</p><Link href="/scenes/new" className="button button-dark"><ImagePlus size={17}/> Upload your first photo</Link><Link className="text-link" href="/#preview">Or explore the interactive sample <ArrowUpRight size={14}/></Link></div>}
    <div className="studio-note"><LockKeyhole size={13}/><p>Your source photos and drafts stay private. Only snapshots you publish can be viewed with a share link.</p></div>
  </main></>;
}
