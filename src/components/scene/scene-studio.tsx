"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, Component, type ReactNode, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Scan, Box, Check, LoaderCircle, Save, RotateCcw, Palette, Lightbulb, RefreshCw, Eye, ShoppingBag, Redo2 } from "lucide-react";
import { apiJson } from "@/lib/client-api";
import type { SceneWorkspace, SceneObjectView } from "./types";
import { RangeField } from "@/components/ui/range-field";
import { PublicationControls } from "./publication-controls";
import { CatalogControls, type CatalogItem } from "./catalog-controls";
import { ProductControls } from "./product-controls";
import { AppearanceControls } from "./appearance-controls";
import { defaultLighting, type Lighting } from "@/lib/scene/lighting";
import { ReferencePhoto } from "./reference-photo";
import { UploadForm } from "@/components/upload-form";
import type { RestartTarget } from "@/lib/validation/generation";

const ModelCanvas = dynamic(() => import("./model-canvas"), { ssr: false, loading: () => <div className="canvas-loading">Opening the 3D viewer…</div> });
class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="viewer-error">A 3D asset could not load. Reload to refresh its access link. Your scene is saved.</div> : this.props.children; }
}
export function SceneStudio({ initial }: { initial: SceneWorkspace }) {
  const router = useRouter();
  const restartDialog = useRef<HTMLDialogElement>(null);
  const [restartTarget, setRestartTarget] = useState<RestartTarget>("ANALYSIS");
  const [data, setData] = useState(initial);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [panel, setPanel] = useState<"objects" | "textures" | "lighting" | "products">("objects");
  const renderedStatus = useRef(initial.status);
  const [lights, setLights] = useState(initial.lighting);
  const [lightDirty, setLightDirty] = useState(false);
  const [draft, setDraft] = useState(initial.objects);
  const [selected, setSelected] = useState(initial.objects[0]?.id ?? "");
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [future, setFuture] = useState<SceneObjectView[][]>([]);
  const [history, setHistory] = useState<SceneObjectView[][]>([]);
  const base = `/api/scenes/${data.id}`;
  const running = Boolean(data.run && ["QUEUED", "RUNNING", "WAITING"].includes(data.run.status));
  const reload = useCallback(async () => {
    const next = await apiJson<SceneWorkspace>(`${base}/workspace`);
    setData(next); setDraft(next.objects); setLights(next.lighting); setLightDirty(false); setDirty(false); setHistory([]); setFuture([]);
    if (renderedStatus.current !== next.status) { renderedStatus.current = next.status; router.refresh(); }
    const selectable = next.status === "READY" ? next.objects.filter(o => o.modelUrl) : next.objects;
    setSelected(prev => selectable.some(o => o.id === prev) ? prev : selectable[0]?.id ?? "");
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
  async function action(kind: "ANALYZE" | "RECONSTRUCT") {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(`${base}/runs`, { method: "POST", body: JSON.stringify({ kind, expectedRevision: data.revision,
        idempotencyKey: crypto.randomUUID(), ...(kind === "RECONSTRUCT" ? { objectIds: chosen } : {}) }) });
      await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Generation could not start."); }
    finally { setBusy(false); }
  }
  async function resume() {
    setBusy(true); setError("");
    try { await apiJson(`${base}/runs/${data.run!.id}/resume`, { method: "POST", body: "{}" }); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not resume."); }
    finally { setBusy(false); }
  }
  function edit(id: string, fields: Partial<SceneObjectView>) {
    setFuture([]);
    setHistory(prev => [...prev.slice(-19), draft]);
    setDraft(prev => prev.map(o => o.id === id ? { ...o, ...fields } : o)); setDirty(true); setMessage("");
  }
  async function save() {
    setBusy(true); setError("");
    try {
      await apiJson(`${base}/objects`, { method: "PATCH", body: JSON.stringify({ expectedRevision: data.revision,
        ...(lightDirty ? { lighting: lights } : {}), objects: draft.filter(o => o.modelUrl).map(o => ({ id: o.id, label: o.label, positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ, yaw: o.yaw, scale: o.scale, visible: o.visible, product: o.product ? { ...o.product, imageUrl: undefined } : null })) }) });
      await reload(); setMessage("Scene saved. Your layout will be here when you return.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); }
    finally { setBusy(false); }
  }
  async function matchLayout(action: "MATCH_PHOTO" | "RESTORE") {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(`${base}/composition`, { method: "POST", body: JSON.stringify({ expectedRevision: data.revision, action }) });
      await reload();
      setMessage(action === "RESTORE" ? "Previous layout restored." : "Photo layout applied and saved. You can undo it below.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not match the photo layout."); }
    finally { setBusy(false); }
  }
  async function appearance(action: "APPLY" | "RESTORE" | "LIGHTING") {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(`${base}/appearance`, { method: "POST", body: JSON.stringify({ action, expectedRevision: data.revision, ...(action === "LIGHTING" ? { lighting: lights } : {}) }) });
      await reload(); setMessage(action === "LIGHTING" ? "Lighting saved." : action === "RESTORE" ? "Original AI textures restored." : "Photo detail copied and saved. Hidden surfaces retain their AI texture.");
    } catch (e) { setError(e instanceof Error ? e.message : "Appearance could not be saved."); }
    finally { setBusy(false); }
  }
  function editLights(value: Lighting) { setLights(value); setLightDirty(true); }
  function askRestart(target: RestartTarget) {
    setRestartTarget(target);
    restartDialog.current?.showModal();
  }
  async function restart() {
    setBusy(true); setError(""); setMessage("");
    try {
      await apiJson(`${base}/restart`, { method: "POST", body: JSON.stringify({ target: restartTarget, expectedRevision: data.revision, confirmed: true }) });
      await reload(); setChosen([]); setSelected("");
      setMessage(restartTarget === "RECONSTRUCTION" ? "3D results cleared. Review the outlines and build your scene again." : "Later steps cleared. You can start this step again.");
      restartDialog.current?.close(); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not restart this step."); restartDialog.current?.close(); }
    finally { setBusy(false); }
  }
  function moveTab(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const tabs = ["objects", "textures", "lighting", "products"] as const;
    const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); setPanel(tabs[next]);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }
  const current = draft.find(o => o.id === selected);
  const ready = data.status === "READY" && draft.some(o => o.modelUrl);
  const hasReplacements = data.objects.some(o => o.canRestoreOriginal);
  const hasMasks = data.objects.some(o => o.maskUrl);
  const restartCopy = {
    PHOTO: { title: "Change the photo?", detail: "This clears the current photo, object analysis, outlines, 3D models, room layout, and saved edits. You will upload a new photo in this scene.", confirm: "Clear scene and change photo" },
    ANALYSIS: { title: "Analyze this photo again?", detail: "This keeps your photo and clears the object analysis, outlines, 3D models, room layout, and saved edits. You can then run Find objects again.", confirm: "Clear results and analyze again" },
    RECONSTRUCTION: { title: "Return to object review?", detail: "This keeps your photo and object outlines, and clears all 3D models, room layout, and saved edits. Select the objects you want and build them again.", confirm: "Clear 3D and review objects" }
  }[restartTarget];
  if (!data.image) return <UploadForm scene={{ id: data.id, title: data.title, revision: data.revision }}/>;
  return <div className="generation-studio">
    {data.image && <div className="studio-reference-bar"><div><span className="eyebrow">SCENE STUDIO</span><p>{ready ? "Compare your scene with the original photo." : "Your photo is the reference for this scene."}</p></div><ReferencePhoto image={data.image} title={data.title}/></div>}
    <nav className="generation-steps" aria-label="Scene steps"><button className="done" disabled={busy || running} onClick={() => askRestart("PHOTO")}><Check size={14}/>1 · Photo</button>
      <button className={data.objects.length ? "done" : ""} disabled={busy || running || !hasMasks || data.status === "REVIEW"} aria-current={!ready ? "step" : undefined} onClick={() => askRestart("RECONSTRUCTION")}>2 · Review objects</button>
      <span className={ready ? "done" : ""} aria-current={ready ? "step" : undefined}>3 · Edit your scene</span></nav>
    <div className="restart-actions"><button className="text-link" disabled={busy || running} onClick={() => askRestart("PHOTO")}>Change photo</button>
      {(data.objects.length > 0 || data.status === "FAILED") && <button className="text-link" disabled={busy || running} onClick={() => askRestart("ANALYSIS")}>Analyze again</button>}
      {hasMasks && data.status !== "REVIEW" && <button className="text-link" disabled={busy || running} onClick={() => askRestart("RECONSTRUCTION")}>Rebuild 3D</button>}
      {running && <small>Previous steps become available when generation finishes.</small>}</div>
    <dialog ref={restartDialog} className="restart-dialog" aria-labelledby="restart-heading" aria-describedby="restart-description" onCancel={event => { if (busy) event.preventDefault(); }}>
      <h2 id="restart-heading">{restartCopy.title}</h2><p id="restart-description">{restartCopy.detail}</p>
      <p>Active share links will also be revoked. This cannot be undone. Generation already billed will not be refunded. Running Find objects or Build in 3D again uses API credits.{dirty && " Your unsaved edits will also be discarded."}</p>
      <div className="editor-actions"><button className="button button-light" autoFocus disabled={busy} onClick={() => restartDialog.current?.close()}>Keep current scene</button>
        <button className="button button-dark" disabled={busy} onClick={restart}>{busy ? "Clearing…" : restartCopy.confirm}</button></div>
    </dialog>
    {error && <p role="alert" className="form-error">{error}</p>}
    {message && <p role="status" className="save-message">{message}</p>}
    {data.run?.errorMessage && <div className="generation-error"><p>{data.run.errorMessage}</p>{data.run.canResume && <button className="button button-dark" disabled={busy} onClick={resume}>Resume existing generation</button>}</div>}
    {running && <div className="generation-progress" role="status"><LoaderCircle className="spin" size={20}/><div><strong>{data.run?.stage}</strong><p>You can close this page. Your progress is saved.</p><progress value={data.run?.progress} max={100}/></div>{data.run?.canResume && <button className="button button-light" onClick={resume} disabled={busy}>Resume</button>}</div>}
    {ready ? <div className="editor-layout"><div className="editor-canvas-column"><ViewerBoundary key={data.revision}><ModelCanvas objects={draft} selected={selected} onSelect={setSelected} composition={data.composition} lighting={lights} appearance={data.appearance}/></ViewerBoundary>
      <div className="scene-layout-tools"><div><strong>{data.composition ? "Photo layout · estimated room" : "Manual stage · photo layout available"}</strong><p>{data.composition ? "Relative size, orientation, depth, and camera use the saved SAM 3D estimates. Room surfaces and lighting are approximate." : "Apply the saved AI poses to restore relative sizes, depth, orientation, and a matching camera. No new generation needed."}</p></div>
        <button className="button button-light" disabled={busy || dirty || lightDirty || hasReplacements} onClick={() => matchLayout("MATCH_PHOTO")}>{busy ? "Working…" : "Match photo layout"}</button>
        {data.canRestoreLayout && <button className="text-link" disabled={busy || dirty || lightDirty || hasReplacements} onClick={() => matchLayout("RESTORE")}>Undo photo layout</button>}
      </div>
      {hasReplacements && <p className="control-hint">Restore original objects in Products before matching the photo layout or changing photo textures.</p>}
      <p className="preview-caveat">Match photo layout resets object transforms and saves them; Undo photo layout restores the previous layout. Save or reload any unsaved edits first. Hidden surfaces and measurements may differ from the photo.</p>
      {data.composition?.warnings.slice(1).map(warning => <p className="preview-caveat" key={warning}>{warning}</p>)}</div>
      <aside className="object-inspector editor-inspector" aria-label="Scene controls">
        <div className="inspector-header"><div><span className="eyebrow">SCENE CONTROLS</span><strong>Make it yours</strong></div><span className={`save-indicator${dirty || lightDirty ? " unsaved" : ""}`}><span className="tiny-dot"/>{dirty || lightDirty ? "Unsaved" : "Saved"}</span></div>
        <div className="inspector-tabs" role="tablist" aria-label="Scene control sections">{([
          ["objects", "Objects", Box], ["textures", "Textures", Palette], ["lighting", "Lighting", Lightbulb], ["products", "Products", ShoppingBag]
        ] as const).map(([value, label, Icon], index) => <button key={value} id={`inspector-tab-${value}`} role="tab" type="button" aria-selected={panel === value} aria-controls={panel === value ? `inspector-panel-${value}` : undefined} tabIndex={panel === value ? 0 : -1} onKeyDown={event => moveTab(event, index)} onClick={() => setPanel(value)}><Icon size={15}/>{label}</button>)}</div>
        <div className="inspector-scroll" key={panel} id={`inspector-panel-${panel}`} role="tabpanel" aria-labelledby={`inspector-tab-${panel}`} tabIndex={0}>
          {panel === "objects" ? <><div className="inspector-section-heading"><h3>Your objects</h3><span className="setting-badge">{draft.filter(o => o.modelUrl).length} meshes</span></div><p className="inspector-description">Select a piece to adjust its placement.</p>
            <div className="object-selector">{draft.filter(o => o.modelUrl).map((o, index) => <button key={o.id} className={o.id === selected ? "selected" : ""} aria-pressed={o.id === selected} onClick={() => setSelected(o.id)}><span className="object-number">{String(index + 1).padStart(2, "0")}</span><span>{o.label}{!o.visible && <small>Hidden</small>}</span>{o.id === selected && <Check size={14}/>}</button>)}</div>
            {current?.modelUrl && <fieldset className="transform-fields" disabled={busy}><legend className="control-group-label">Object properties</legend><label className="object-name-field">Name<input value={current.label} maxLength={120} onChange={e => edit(current.id, { label: e.target.value })}/></label>
              {([ ["positionX", "Left / right", -10, 10, 0.1], ["positionZ", "Forward / back", -10, 10, 0.1], ["positionY", "Height", -2, 5, 0.1], ["yaw", "Rotation", -Math.PI, Math.PI, 0.05], ["scale", "Size", 0.1, 5, 0.1] ] as const).map(([field, label, min, max, step]) => <RangeField key={field} label={label} min={min} max={max} step={step} value={current[field]} precision={2} onChange={value => edit(current.id, { [field]: value })}/>)}
              <label className="visibility-toggle"><span><Eye size={15}/>Show object</span><input className="switch-input" role="switch" type="checkbox" checked={current.visible} onChange={e => edit(current.id, { visible: e.target.checked })}/></label>
            </fieldset>}
          </> : panel === "products" ? current?.modelUrl ? <><CatalogControls items={catalogItems} busy={busy} dirty={dirty || lightDirty} canRestore={current.canRestoreOriginal} onSeed={() => catalogAction("SEED")} onReplace={id => catalogAction("REPLACE", id)} onRestore={() => catalogAction("RESTORE")}/><ProductControls object={current} busy={busy} onChange={product => edit(current.id, { product })}/></> : <p>Select an object first.</p> : <AppearanceControls panel={panel} lighting={lights} setLighting={editLights} dirty={lightDirty} objectDirty={dirty} busy={busy} texturesBlocked={hasReplacements} applied={data.appearance.applied} onTexture={() => appearance(data.appearance.applied ? "RESTORE" : "APPLY")} onReset={() => editLights(defaultLighting(data.composition))}/>}
        </div>
        <div className="inspector-footer"><div className="editor-actions"><button className="button button-light" disabled={!history.length || busy} onClick={() => { setFuture(prev => [...prev, draft]); setDraft(history[history.length - 1]); setHistory(history.slice(0, -1)); setDirty(true); }}><RotateCcw size={14}/>Undo</button><button className="button button-light redo-button" aria-label="Redo object edit" title="Redo object edit" disabled={!future.length || busy} onClick={() => { setHistory(prev => [...prev, draft]); setDraft(future[future.length - 1]); setFuture(future.slice(0, -1)); setDirty(true); }}><Redo2 size={14}/></button><button className="button button-dark" disabled={(!dirty && !lightDirty) || busy} onClick={save}><Save size={14}/>{busy ? "Saving…" : "Save changes"}</button></div>
          <button className="inspector-reload" disabled={busy || dirty || lightDirty} onClick={() => void reload().catch(() => setError("Could not reload."))}><RefreshCw size={12}/>Reload saved scene</button>
        </div>
      </aside></div> : <div className="analysis-layout"><div className="review-photo">{data.image && <Image src={data.image.url} alt={data.title} width={data.image.width} height={data.image.height} unoptimized/>}{data.objects.filter(o => chosen.includes(o.id) && o.maskUrl).map(o => <Image key={o.id} className="mask-overlay" src={o.maskUrl!} alt={`${o.label} outline`} fill unoptimized/>)}</div>
      <aside className="object-inspector"><span className="eyebrow">TURN THE PHOTO INTO A SCENE</span><h2>{data.objects.length ? "Choose your objects." : "Find what’s in the room."}</h2>
        {!data.objects.length && <p>Meta AI will identify up to three pieces and outline each one. You’ll review the objects before building their 3D previews.</p>}
        {data.status === "DRAFT" && <button className="button button-dark" disabled={busy || !data.generationEnabled} onClick={() => action("ANALYZE")}><Scan size={16}/>{busy ? "Starting…" : "Find objects"}</button>}
        {!data.generationEnabled && <p>Generation is temporarily disabled.</p>}
        {data.objects.map(o => <label className="review-object" key={o.id}><input className="review-checkbox" type="checkbox" checked={chosen.includes(o.id)} disabled={!o.maskUrl || running || busy} onChange={e => { setChosen(prev => e.target.checked ? [...prev, o.id].slice(0, 3) : prev.filter(id => id !== o.id)); setSelected(o.id); }}/><div><strong>{o.label}</strong><small>{o.maskUrl ? "Outline ready · select to preview" : o.errorCode ? "No clear outline found" : "Finding outline…"}</small></div></label>)}
        {data.status === "REVIEW" && <><p className="preview-caveat">Check that each highlighted outline covers the intended object. Select up to three; smaller selections are faster.</p><button className="button button-dark" disabled={busy || !chosen.length || !data.generationEnabled} onClick={() => action("RECONSTRUCT")}><Box size={16}/>{busy ? "Starting…" : `Build ${chosen.length || "your"} object${chosen.length === 1 ? "" : "s"} in 3D`}</button></>}
        {data.status === "FAILED" && !data.run?.canResume && <p>The generation stopped. Your photo is saved. Use Analyze again, Rebuild 3D, or Change photo above to restart the relevant step.</p>}
      </aside></div>}
    {ready && <PublicationControls sceneId={data.id} revision={data.revision} disabled={busy || dirty || lightDirty || running}/>}
  </div>;
}
