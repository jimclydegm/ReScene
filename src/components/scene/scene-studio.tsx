"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, memo, Component, type ReactNode, type KeyboardEvent, type FocusEvent, type PointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Box, Check, Ellipsis, Eye, EyeOff, Layers, Lightbulb, LoaderCircle, LockKeyhole, Palette, Redo2, RotateCcw, Save, ScanEye, ShoppingBag, Undo2, X } from "lucide-react";
import { apiJson } from "@/lib/client-api";
import type { SceneWorkspace, SceneObjectView } from "./types";
import { RangeField } from "@/components/ui/range-field";
import { ProjectDetails } from "./project-details";
import { UnsavedNavigation } from "./unsaved-navigation";
import { PublicationControls } from "./publication-controls";
import { CatalogControls, type CatalogItem } from "./catalog-controls";
import { ProductControls } from "./product-controls";
import { AppearanceControls } from "./appearance-controls";
import { defaultLighting, type Lighting } from "@/lib/scene/lighting";
import { ReferencePhoto } from "./reference-photo";
import { ObjectReview } from "./object-review";
import { SceneLayoutControls } from "./scene-layout-controls";
import { DismissibleNotice } from "@/components/ui/dismissible-notice";
import type { SegmentationOptions } from "@/lib/ai/controls";
import { UploadForm } from "@/components/upload-form";
import {subjectVisibility} from "@/lib/editor/visibility";
import {editHistory,recordEdit,finishEdit,undoEdit,redoEdit} from "@/lib/editor/history";
import type { RestartTarget } from "@/lib/validation/generation";

type Panel = "objects" | "scene" | "textures" | "lighting" | "products";
const panels: [Panel, string, typeof Box][] = [["objects", "Objects", Box], ["scene", "Scene", Layers], ["textures", "Textures", Palette], ["lighting", "Light", Lightbulb], ["products", "Products", ShoppingBag]];
const ModelCanvas = dynamic(() => import("./model-canvas"), { ssr: false, loading: () => <div className="canvas-loading">Opening the 3D viewer…</div> });
// Progress polls refresh signed asset URLs. Keep the current render inputs until
// the operation finishes, then load the final assets beneath the generation cover.
const StablePreview = memo(function StablePreview({ children }: { pending: boolean; children: ReactNode }) {
  return children;
}, (previous, next) => previous.pending && next.pending);
class ViewerBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <div className="viewer-error">A 3D asset could not load. Reload to refresh its access link. Your scene is saved.</div> : this.props.children; }
}
export function SceneStudio({ initial }: { initial: SceneWorkspace }) {
  const router = useRouter();
  const discardDialog = useRef<HTMLDialogElement>(null);
  const restartDialog = useRef<HTMLDialogElement>(null);
  const [restartTarget, setRestartTarget] = useState<RestartTarget>("ANALYSIS");
  const [viewerRetry,setViewerRetry]=useState(0);
  const [data, setData] = useState(initial);
  const [analysisOptions,setAnalysisOptions]=useState(initial.analysisOptions);
  const [reconstructionOptions,setReconstructionOptions]=useState(initial.reconstructionOptions);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [panel, setPanel] = useState<Panel>("objects");
  const menu = useRef<HTMLDetailsElement>(null);
  const openDetails = useRef<(() => void) | null>(null);
  const renderedStatus = useRef(initial.status);
  const [editor,setEditor]=useState(()=>editHistory({objects:initial.objects,lighting:initial.lighting}));
  const draft=editor.present.objects,lights=editor.present.lighting;
  const interaction=useRef<string|null>(null);
  const interactionKind=useRef<"range"|"text"|null>(null);
  const [selected, setSelected] = useState(initial.objects[0]?.id ?? "");
  const [chosen, setChosen] = useState<string[]>(initial.objects.filter(o=>o.maskUrl).map(o=>o.id));
  const [busy, setBusy] = useState(false);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const dirty=JSON.stringify(draft)!==JSON.stringify(data.objects),lightDirty=JSON.stringify(lights)!==JSON.stringify(data.lighting);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const history=editor.past,future=editor.future;
  const base = `/api/scenes/${data.id}`;
  const running = Boolean(data.run && ["QUEUED", "RUNNING", "WAITING"].includes(data.run.status));
  const reload = useCallback(async () => {
    const next = await apiJson<SceneWorkspace>(`${base}/workspace`);
    setData(next); setChosen(prev=>next.status==="REVIEW"&&renderedStatus.current!=="REVIEW"?next.objects.filter(o=>o.maskUrl).map(o=>o.id):prev.filter(id=>next.objects.some(o=>o.id===id&&o.maskUrl))); setEditor(editHistory({objects:next.objects,lighting:next.lighting}));interaction.current=null;
    if (renderedStatus.current !== next.status) { renderedStatus.current = next.status; router.refresh(); }
    const selectable = next.status === "READY" ? next.objects.filter(o => o.modelUrl) : next.objects;
    setSelected(prev => prev===""?"":selectable.some(o => o.id === prev) ? prev : selectable[0]?.id ?? "");
    return next;
  }, [base, router]);
  useEffect(() => {
    if (!dirty && !lightDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, lightDirty]);
  useEffect(() => {
    if (!running) return;
    let canceled = false;
    let pending = false;
    const timer = setInterval(() => {
      if (canceled || pending) return;
      pending = true;
      void reload().then(() => { if (!canceled) setError(""); }).catch(() => { if (!canceled) setError("Could not refresh progress. Retrying…"); }).finally(() => { pending = false; });
    }, 3000);
    return () => { canceled = true; clearInterval(timer); };
  }, [running, reload]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (dirty || lightDirty || running) return;
      void reload().catch(() => {});
    }, 10 * 60_000);
    return () => clearInterval(timer);
  }, [dirty, lightDirty, running, reload]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (menu.current?.open && !menu.current.contains(event.target as Node)) menu.current.open = false; };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
  useEffect(() => {
    if (panel !== "products") return;
    let canceled = false;
    void apiJson<{products: CatalogItem[]}>(`${base}/catalog`).then(result => { if (!canceled) setCatalogItems(result.products); }).catch(() => { if (!canceled) setError("Could not load the catalog. Reopen Products to retry."); });
    return () => { canceled = true; };
  }, [base, panel]);
  async function catalogAction(action: "SEED" | "REPLACE" | "RESTORE", productId?: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(`${base}/${action === "SEED" ? "catalog" : "replacement"}`, {method:"POST", body:JSON.stringify({expectedRevision:data.revision,...(action === "SEED" ? {} : {action,objectId:selected,...(productId ? {productId} : {})})})});
      await reload();
      setCatalogItems((await apiJson<{products:CatalogItem[]}>(`${base}/catalog`)).products);
      setMessage(action === "SEED" ? "Demo catalog added." : action === "RESTORE" ? "Original object and product card restored." : "Object and product card replaced and saved.");
    } catch(e) { setError(e instanceof Error ? e.message : "Could not update the object."); }
    finally { setBusy(false); }
  }
  async function action(kind: "ANALYZE" | "RECONSTRUCT" | "SEGMENT_OBJECT" | "IMAGE_EDIT", segmentation?:SegmentationOptions,backgroundMode?:"reference"|"materials"|"photo") {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(`${base}/runs`, { method: "POST", body: JSON.stringify({ kind, expectedRevision: data.revision,
        idempotencyKey: crypto.randomUUID(), ...(backgroundMode?{background:{mode:backgroundMode}}:{}), ...(kind === "ANALYZE" ? {analysis:analysisOptions} : kind === "SEGMENT_OBJECT" ? {segmentation} : kind === "RECONSTRUCT" ? { objectIds: chosen, reconstruction:reconstructionOptions } : {}) }) });
      await reload();
    } catch (e) { await reload().catch(()=>{}); setError(e instanceof Error ? e.message : "Generation could not start."); }
    finally { setBusy(false); }
  }
  async function retryObjects(ids:string[],seed:number){
    setBusy(true);setError("");setMessage("");
    try{await apiJson(`${base}/runs`,{method:"POST",body:JSON.stringify({kind:"RECONSTRUCT",repair:true,confirmed:true,objectIds:ids,reconstruction:{...reconstructionOptions,seed,refineOpenings:false},expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()})});await reload();setMessage("Selective paid retry started. Your current scene stays available.");}
    finally{setBusy(false);}
  }
  async function chooseMask(objectId:string,mask:string|string[]){
    setBusy(true);setError("");setMessage("");
    try{await apiJson(`${base}/masks`,{method:"PATCH",body:JSON.stringify({expectedRevision:data.revision,objectId,...(Array.isArray(mask)?{maskAssetIds:mask}:{maskAssetId:mask})})});await reload();setChosen(prev=>[...new Set([...prev,objectId])]);setMessage("Outline selected and saved. No inference used.");}
    catch(e){setError(e instanceof Error?e.message:"Could not select this outline.");}
    finally{setBusy(false);}
  }
  async function resume() {
    setBusy(true); setError("");
    try { await apiJson(`${base}/runs/${data.run!.id}/resume`, { method: "POST", body: "{}" }); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not resume."); }
    finally { setBusy(false); }
  }
  function endInteraction(){interaction.current=null;interactionKind.current=null;setEditor(finishEdit);}
  function beginInteraction(event:FocusEvent<HTMLElement>|PointerEvent<HTMLElement>){
    const target=event.target;
    if(target instanceof HTMLInputElement&&["checkbox","radio","button"].includes(target.type))return;
    if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement||target instanceof HTMLSelectElement){interaction.current=crypto.randomUUID();interactionKind.current=target instanceof HTMLInputElement&&target.type==="range"?"range":"text";}
  }
  useEffect(()=>{
    const finish=()=>{if(interactionKind.current!=="range")return;interaction.current=null;interactionKind.current=null;setEditor(finishEdit);};
    const key=(event:globalThis.KeyboardEvent)=>{
      if(busy||running)return;
      const target=event.target;if(target instanceof HTMLElement&&(target.isContentEditable||target.closest('textarea,select,input:not([type="range"])')))return;
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="z"){event.preventDefault();interaction.current=null;setEditor(event.shiftKey?redoEdit:undoEdit);}
      else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="y"){event.preventDefault();interaction.current=null;setEditor(redoEdit);}
    };
    window.addEventListener("pointerup",finish);window.addEventListener("pointercancel",finish);window.addEventListener("keydown",key);
    return ()=>{window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",finish);window.removeEventListener("keydown",key);};
  },[busy,running]);
  function edit(id: string, fields: Partial<SceneObjectView>) {
    if(running||busy)return;
    const group=interaction.current;
    setEditor(prev=>recordEdit(prev,{...prev.present,objects:prev.present.objects.map(o=>{
      if(o.id===id)return {...o,...fields};
      if(o.assemblyRootId===id){const shared=Object.fromEntries(Object.entries(fields).filter(([k])=>["positionX","positionY","positionZ","yaw","pitch","roll","scale","visible"].includes(k)));return {...o,...shared};}
      return o;
    })},group));setMessage("");
  }
  function isolate(id:string|null){
    if(busy||running)return;endInteraction();
    setEditor(prev=>recordEdit(prev,{...prev.present,objects:subjectVisibility(prev.present.objects,id)}));
  }
  async function save() {
    setBusy(true); setError("");
    try {
      await apiJson(`${base}/objects`, { method: "PATCH", body: JSON.stringify({ expectedRevision: data.revision,
        ...(lightDirty ? { lighting: lights } : {}), objects: draft.filter(o => o.modelUrl).map(o => ({ id: o.id, label: o.label, positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ, yaw: o.yaw,pitch:o.pitch??0,roll:o.roll??0, scale: o.scale, visible: o.visible, tint:o.tint??null, product: o.product ? { ...o.product, imageUrl: undefined } : null })) }) });
      await reload(); setMessage("Scene saved. Your layout will be here when you return.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }
  async function matchLayout(action: "MATCH_PHOTO" | "REVIEW_PHOTO" | "RESTORE" | "RESTORE_BACKGROUND") {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(`${base}/composition`, { method: "POST", body: JSON.stringify({ expectedRevision: data.revision, action }) });
      await reload();
      setMessage(action === "RESTORE_BACKGROUND" ? "Previous background restored. Objects and lights are unchanged." : action === "RESTORE" ? "Previous layout restored." : "Photo layout applied and saved. You can undo it below.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not match the photo layout."); }
    finally { setBusy(false); }
  }
  async function quality(action:"IMPROVE"|"RESTORE"){
    setBusy(true);setError("");setMessage("");
    try{const result=await apiJson<{skipped?:number}>(`${base}/quality`,{method:"POST",body:JSON.stringify({action,expectedRevision:data.revision})});await reload();setViewerRetry(v=>v+1);setMessage(action==="RESTORE"?`Previous models restored.${result.skipped?` ${result.skipped} changed object(s) kept their current model.`:""}`:"Quality pass saved. Objects that measured worse kept their previous model.");}
    catch(e){setError(e instanceof Error?e.message:"The quality pass could not finish.");}
    finally{setBusy(false);}
  }
  async function paidQuality(options:{materials:boolean;masks:boolean;review:boolean}){
    setBusy(true);setError("");setMessage("");
    try{await apiJson(`${base}/runs`,{method:"POST",body:JSON.stringify({kind:"IMAGE_EDIT",confirmed:true,quality:options,expectedRevision:data.revision,idempotencyKey:crypto.randomUUID()})});await reload();setMessage("Meta quality pass started. Your current scene stays available.");}
    finally{setBusy(false);}
  }
  async function changeBackdrop(backdrop:"room"|"studio"|"none"){
    setBusy(true);setError("");setMessage("");
    try{await apiJson(`${base}/composition`,{method:"POST",body:JSON.stringify({action:"BACKGROUND",backdrop,expectedRevision:data.revision})});await reload();setMessage("Backdrop saved. No generation needed.");}
    catch(e){setError(e instanceof Error?e.message:"Could not change the backdrop.");}
    finally{setBusy(false);}
  }
  async function appearance(action: "APPLY" | "RESTORE" | "LIGHTING") {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(`${base}/appearance`, { method: "POST", body: JSON.stringify({ action, expectedRevision: data.revision, ...(action === "LIGHTING" ? { lighting: lights } : {}) }) });
      await reload(); setMessage(action === "LIGHTING" ? "Lighting saved." : action === "RESTORE" ? "Original AI textures restored." : "Photo detail copied and saved. Hidden surfaces retain their AI texture.");
    } catch (e) { setError(e instanceof Error ? e.message : "Appearance could not be saved."); }
    finally { setBusy(false); }
  }
  async function reloadSaved(){setBusy(true);setError("");try{await reload();setViewerRetry(v=>v+1);discardDialog.current?.close();setMessage("Saved scene reloaded.");}catch(e){setError(e instanceof Error?e.message:"Could not reload.");}finally{setBusy(false);}}
  function requestReload(){if(dirty||lightDirty)discardDialog.current?.showModal();else void reloadSaved();}
  function editLights(value: Lighting) { if(running||busy)return;const group=interaction.current;setEditor(prev=>recordEdit(prev,{...prev.present,lighting:value},group)); }
  function askRestart(target: RestartTarget) {
    setRestartTarget(target);
    restartDialog.current?.showModal();
  }
  async function restart() {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(`${base}/restart`, { method: "POST", body: JSON.stringify({ target: restartTarget, expectedRevision: data.revision, confirmed: true }) });
      const next=await reload(); setChosen([]); setSelected("");
      if(restartTarget === "ANALYSIS"){
        await apiJson(`${base}/runs`,{method:"POST",body:JSON.stringify({kind:"ANALYZE",expectedRevision:next.revision,idempotencyKey:crypto.randomUUID(),analysis:analysisOptions})});
        await reload();
      }
      setMessage(restartTarget === "RECONSTRUCTION" ? "3D results cleared. Review the outlines and build your scene again." : restartTarget === "ANALYSIS" ? "Analysis started with your updated controls." : "Later steps cleared. You can start this step again.");
      restartDialog.current?.close(); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not restart this step."); restartDialog.current?.close(); }
    finally { setBusy(false); }
  }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const tabs = panels.map(([value]) => value);
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setPanel(tabs[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }
  const current = draft.find(o => o.id === selected);
  const ready = data.status === "READY" && draft.some(o => o.modelUrl);
  const showEditor = ready || (data.status === "RECONSTRUCTING" && draft.some(o => o.modelUrl));
  const previewPending = busy || running || assetsLoading;
  const hasReplacements = data.objects.some(o => o.canRestoreOriginal);
  const hasMasks = data.objects.some(o => o.maskUrl);
  const restartCopy = {
    PHOTO: { title: "Change the photo?", detail: "This clears the current photo, object analysis, outlines, 3D models, scene layout, and saved edits. You will upload a new photo in this scene.", confirm: "Clear scene and change photo" },
    ANALYSIS: { title: "Analyze this photo again?", detail: "This keeps your photo and clears the object analysis, outlines, 3D models, scene layout, and saved edits. Analysis will run using the current focus, item limit, and instructions.", confirm: "Clear results and analyze again" },
    RECONSTRUCTION: { title: "Return to object review?", detail: "This keeps your photo and object outlines, and clears all 3D models, scene layout, and saved edits. Select the objects you want and build them again.", confirm: "Clear 3D and review objects" }
  }[restartTarget];
  if (!data.image) return <UploadForm key={data.revision} scene={{ id: data.id, title: data.title, revision: data.revision }}/>;
  const unsaved = dirty || lightDirty, locked = busy || running;
  const meshes = draft.filter(o => o.modelUrl);
  const steps = [["Photo", true, false], ["Review", data.objects.length > 0, !ready], ["Edit", ready, ready]] as const;
  function menuAction(run: () => void) { if (menu.current) menu.current.open = false; run(); }
  function resetPlacement(id: string) {
    const saved = data.objects.find(o => o.id === id);
    if (saved) edit(id, { positionX: saved.positionX, positionY: saved.positionY, positionZ: saved.positionZ, yaw: saved.yaw, pitch: saved.pitch ?? 0, roll: saved.roll ?? 0, scale: saved.scale, visible: saved.visible });
  }
  const transformGroups = [
    ["Position", [["positionX", "Left / right", -10, 10, 0.1], ["positionZ", "Forward / back", -10, 10, 0.1], ["positionY", "Height", -2, 5, 0.1]]],
    ["Rotation", [["yaw", "Turn", -Math.PI, Math.PI, 0.05], ["pitch", "Tilt", -Math.PI / 2, Math.PI / 2, 0.025], ["roll", "Lean", -Math.PI, Math.PI, 0.025]]],
    ["Size", [["scale", "Scale", 0.1, 5, 0.1]]]
  ] as const;
  const notices = <>
    {error && <p role="alert" className="form-error studio-notice">{error}<button className="icon-button" aria-label="Dismiss" onClick={() => setError("")}><X size={14}/></button></p>}
    {data.run?.errorMessage && <DismissibleNotice key={`${data.run.id}:${data.run.status}:${data.run.errorMessage}`} className="generation-error studio-notice" role={data.run.status==="FAILED"?"alert":"status"}><p>{data.run.errorMessage}</p>{data.run.canResume && <button className="button button-dark button-small" disabled={busy} onClick={resume}>Resume generation</button>}</DismissibleNotice>}
    {running && <DismissibleNotice key={`${data.run?.id}:progress`} className="generation-progress studio-notice" label="Dismiss progress notification"><LoaderCircle className="spin" size={18}/><div><strong>{data.run?.stage}</strong><progress value={data.run?.progress} max={100}/><p>Safe to close this page. Checking progress uses no credits.</p></div><button className="button button-light button-small" disabled={busy} onClick={requestReload}>Refresh</button>{data.run?.canResume && <button className="button button-light button-small" onClick={resume} disabled={busy}>Resume</button>}</DismissibleNotice>}
    </>;
  return <div className="generation-studio studio-shell">
    <UnsavedNavigation dirty={unsaved}/>
    <header className="studio-bar">
      <Link href="/dashboard" className="icon-button" aria-label="Back to your scenes" title="Your scenes"><ArrowLeft size={16}/></Link>
      <div className="studio-title"><h1>{data.title}</h1><span><LockKeyhole size={11}/>Private · {ready ? "3D ready" : "Photo ready"}</span></div>
      <ol className="studio-steps" aria-label="Scene steps">{steps.map(([label, done, current], index) => <li key={label} className={done ? "done" : ""} aria-current={current ? "step" : undefined}><span>{done && !current ? <Check size={11}/> : index + 1}</span>{label}</li>)}</ol>
      <div className="studio-bar-actions">
        {ready && <span className={`save-indicator${unsaved ? " unsaved" : ""}`}><span className="tiny-dot"/>{unsaved ? "Unsaved" : "Saved"}</span>}
        <details className="studio-menu" ref={menu}><summary className="icon-button" aria-label="Scene options" title="Scene options"><Ellipsis size={16}/></summary>
          <div className="studio-menu-list" role="menu">
            <button role="menuitem" disabled={locked || unsaved} onClick={() => menuAction(() => openDetails.current?.())}>Edit title & description</button>
            {ready && <button role="menuitem" disabled={busy} onClick={() => menuAction(requestReload)}>Reload saved scene</button>}
            <hr/>
            <button role="menuitem" disabled={locked} onClick={() => menuAction(() => askRestart("PHOTO"))}>Change photo…</button>
            {data.status !== "DRAFT" && <button role="menuitem" disabled={locked} onClick={() => menuAction(() => askRestart("ANALYSIS"))}>Analyze again…</button>}
            {hasMasks && data.status !== "REVIEW" && <button role="menuitem" disabled={locked} onClick={() => menuAction(() => askRestart("RECONSTRUCTION"))}>Rebuild 3D…</button>}
          </div>
        </details>
        {ready && <PublicationControls sceneId={data.id} revision={data.revision} disabled={busy || unsaved || running}/>}
      </div>
    </header>
    <ProjectDetails id={data.id} title={data.title} description={data.description} revision={data.revision} disabled={locked || unsaved} trigger={false} openRef={openDetails} onSaved={async()=>{await reload();router.refresh();}}/>
    <dialog ref={discardDialog} className="restart-dialog" aria-labelledby="discard-scene-title" onCancel={e=>{if(busy)e.preventDefault();}}><h2 id="discard-scene-title">Discard unsaved changes?</h2><p>This reloads the latest saved scene, including changes from another window. Unsaved object, product and lighting edits will be lost.</p><div className="editor-actions"><button className="button button-light" disabled={busy} autoFocus onClick={()=>discardDialog.current?.close()}>Keep editing</button><button className="button button-dark" disabled={busy} onClick={reloadSaved}>{busy?"Reloading…":"Discard and reload"}</button></div></dialog>
    <dialog ref={restartDialog} className="restart-dialog" aria-labelledby="restart-heading" aria-describedby="restart-description" onCancel={event => { if (busy) event.preventDefault(); }}>
      <h2 id="restart-heading">{restartCopy.title}</h2><p id="restart-description">{restartCopy.detail}</p>
      <p>Active share links will also be revoked. This cannot be undone. Generation already billed will not be refunded. Analyzing or building in 3D again uses API credits.{dirty && " Your unsaved edits will also be discarded."}</p>
      <div className="editor-actions"><button className="button button-light" autoFocus disabled={busy} onClick={() => restartDialog.current?.close()}>Keep current scene</button>
        <button className="button button-dark" disabled={busy} onClick={restart}>{busy ? "Clearing…" : restartCopy.confirm}</button></div>
    </dialog>
    {!showEditor && <div className="studio-notices">{notices}{message && <DismissibleNotice key={message} className="save-message studio-notice">{message}</DismissibleNotice>}</div>}
    {showEditor ? <div className="editor-layout studio-workspace"><div className={`studio-stage${previewPending?" preview-updating":""}`} aria-busy={previewPending}>
      <div className="studio-preview-content" inert={previewPending}><StablePreview pending={busy || running}><ViewerBoundary key={viewerRetry} onFailure={()=>setAssetsLoading(false)}><ModelCanvas objects={draft} selected={selected} onSelect={setSelected} composition={data.composition} lighting={lights} appearance={data.appearance} onLoadingChange={setAssetsLoading}/></ViewerBoundary></StablePreview></div>
      {previewPending && <div className="studio-preview-cover" role="status"><LoaderCircle className="spin" size={24}/><strong>{running?"Building your scene":assetsLoading?"Preparing the final view":"Updating your scene"}</strong><span>{running?data.run?.stage:"The finished preview will appear here."}</span>{running&&<progress value={data.run?.progress} max={100}/>}</div>}
      <ReferencePhoto image={data.image} title={data.title}/>
      <div className="studio-notices floating">{notices}</div>
      {message && <DismissibleNotice key={message} className="studio-toast"><Check size={14}/>{message}</DismissibleNotice>}
    </div>
      <aside className="object-inspector editor-inspector" aria-label="Scene controls">
        <div className="inspector-tabs" role="tablist" aria-label="Scene control sections">{panels.map(([value, label, Icon], index) => <button key={value} id={`inspector-tab-${value}`} role="tab" type="button" aria-selected={panel === value} aria-controls={`inspector-panel-${value}`} tabIndex={panel === value ? 0 : -1} onKeyDown={event => moveTab(event, index)} onClick={() => setPanel(value)}><Icon size={15}/>{label}</button>)}</div>
        {panels.map(([value]) => <div className="inspector-scroll" hidden={panel !== value} key={value} id={`inspector-panel-${value}`} role="tabpanel" aria-labelledby={`inspector-tab-${value}`} tabIndex={0} onFocusCapture={beginInteraction} onBlurCapture={endInteraction} onPointerDownCapture={beginInteraction} onKeyDownCapture={event=>{if(event.target instanceof HTMLInputElement&&event.target.type==="range"&&["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End","PageUp","PageDown"].includes(event.key)&&!interaction.current){interaction.current=crypto.randomUUID();interactionKind.current="range";}}} onKeyUpCapture={event=>{if(event.target instanceof HTMLInputElement&&event.target.type==="range")endInteraction();}}>
          {value === "objects" ? <div className="panel-stack">
            <div className="panel-block">
              <div className="panel-heading"><h3>Objects <span className="panel-count">{meshes.length}</span></h3>
                <div className="panel-icon-actions"><button className="icon-button" title="Isolate selected subject" aria-label="Isolate selected subject" disabled={!current?.modelUrl||locked} onClick={()=>isolate(current?.id??null)}><ScanEye size={15}/></button><button className="icon-button" title="Show all objects" aria-label="Show all objects" disabled={locked||!draft.some(o=>o.modelUrl&&!o.visible)} onClick={()=>isolate(null)}><Eye size={15}/></button></div></div>
              <div className="object-list">{meshes.map((o, index) => <button key={o.id} className={o.id === selected ? "selected" : ""} aria-pressed={o.id === selected} onClick={() => setSelected(prev=>prev===o.id?"":o.id)}><span className="object-number">{index + 1}</span><span className="object-name">{o.label}</span>{!o.visible && <EyeOff size={13} aria-label="Hidden"/>}{o.id === selected && <Check size={14}/>}</button>)}</div>
            </div>
            {!current?.modelUrl ? <p className="panel-empty">Select an object in the viewer or the list to move, rotate or resize it.</p> :
            <fieldset className="panel-block transform-fields" disabled={locked}>
              <div className="panel-heading"><h3>Selected</h3><button className="text-link panel-link" type="button" disabled={!dirty} onClick={() => resetPlacement(current.id)}><RotateCcw size={12}/>Reset</button></div>
              <label className="field">Name<input value={current.label} maxLength={120} onChange={e => edit(current.id, { label: e.target.value })}/></label>
              {transformGroups.map(([group, fields]) => <div className="field-group" key={group}><span className="group-label">{group}</span>{fields.map(([field, label, min, max, step]) => {const angle=["yaw","pitch","roll"].includes(field),factor=angle?180/Math.PI:1;return <RangeField key={field} label={angle?`${label} (°)`:label} min={min*factor} max={max*factor} step={angle?1:step} value={(current[field]??0)*factor} precision={angle?0:2} onChange={value => edit(current.id, { [field]: value/factor })}/>;})}</div>)}
              <div className="panel-block"><label className="field-label">Object color<input aria-label="Object color" type="color" value={current.tint??"#ffffff"} onChange={e=>edit(current.id,{tint:e.target.value})}/></label><button className="text-link" onClick={()=>edit(current.id,{tint:null})}>Restore original color</button><p className="panel-note">Color tints the existing texture and preserves surface detail. Dark textures may limit bright colors.</p></div><label className="visibility-toggle"><span><Eye size={14}/>Visible</span><input className="switch-input" role="switch" type="checkbox" checked={current.visible} onChange={e => edit(current.id, { visible: e.target.checked })}/></label>
            </fieldset>}
          </div>
          : value === "scene" ? <SceneLayoutControls onRetry={retryObjects} onMask={chooseMask} data={data} locked={locked} unsaved={unsaved} blocked={hasReplacements} onMatch={() => matchLayout("MATCH_PHOTO")} onReview={() => matchLayout("REVIEW_PHOTO")} onRestore={() => matchLayout("RESTORE")} onBackdrop={changeBackdrop} onRestoreBackground={()=>matchLayout("RESTORE_BACKGROUND")} onBackground={mode => action("IMAGE_EDIT",undefined,mode)} onQuality={()=>quality("IMPROVE")} onQualityRestore={()=>quality("RESTORE")} onQualityPaid={paidQuality}/>
          : value === "products" ? current?.modelUrl ? <div className="panel-stack">{current.assemblyRootId ? <p className="panel-note">This region shares geometry with its complete subject. Move the subject to keep them together; catalog replacement applies to standalone objects.</p> : <CatalogControls items={catalogItems} busy={locked} dirty={unsaved} canRestore={current.canRestoreOriginal} onSeed={() => catalogAction("SEED")} onReplace={id => catalogAction("REPLACE", id)} onRestore={() => catalogAction("RESTORE")}/>}<ProductControls object={current} busy={locked} onChange={product => edit(current.id, { product })}/></div> : <p className="panel-empty">Select an object to add its product card.</p>
          : <AppearanceControls panel={value} lighting={lights} setLighting={editLights} dirty={lightDirty} objectDirty={dirty} busy={locked} texturesBlocked={hasReplacements} relightableBackground={Boolean(data.composition?.background?.surfaceMode)} applied={data.appearance.applied} onRefresh={()=>appearance("APPLY")} onTexture={() => appearance(data.appearance.applied ? "RESTORE" : "APPLY")} onReset={() => editLights(defaultLighting(data.composition))}/>}
        </div>)}
        <div className="inspector-footer">
          <button className="icon-button" title="Undo (Ctrl/⌘ Z)" aria-label="Undo edit" disabled={!history.length || locked} onClick={() => {interaction.current=null;setEditor(undoEdit);}}><Undo2 size={15}/></button>
          <button className="icon-button" title="Redo (Ctrl/⌘ Shift Z)" aria-label="Redo edit" disabled={!future.length || locked} onClick={() => {interaction.current=null;setEditor(redoEdit);}}><Redo2 size={15}/></button>
          <button className="button button-dark" disabled={!unsaved || locked} onClick={save}><Save size={14}/>{busy ? "Saving…" : unsaved ? "Save changes" : "Saved"}</button>
        </div>
      </aside></div> : <ObjectReview key={data.objects.map(o=>o.id).join(":")} data={data} busy={locked} running={running} chosen={chosen} setChosen={setChosen} analysis={analysisOptions} setAnalysis={setAnalysisOptions} reconstruction={reconstructionOptions} setReconstruction={setReconstructionOptions} onAnalyze={()=>data.status==="DRAFT"?void action("ANALYZE"):askRestart("ANALYSIS")} onSegment={value=>action("SEGMENT_OBJECT",value)} onMask={chooseMask} onBuild={()=>action("RECONSTRUCT")} onReview={()=>askRestart("RECONSTRUCTION")}/>}
  </div>;
}
