"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, Component, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Scan, Box, Check, LoaderCircle, Save, RotateCcw } from "lucide-react";
import { apiJson } from "@/lib/client-api";
import type { SceneWorkspace, SceneObjectView } from "./types";
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
  const [history, setHistory] = useState<SceneObjectView[][]>([]);
  const base = `/api/scenes/${data.id}`;
  const running = Boolean(data.run && ["QUEUED", "RUNNING", "WAITING"].includes(data.run.status));
  const reload = useCallback(async () => {
    const next = await apiJson<SceneWorkspace>(`${base}/workspace`);
    setData(next); setDraft(next.objects); setLights(next.lighting); setLightDirty(false); setDirty(false); setHistory([]);
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
    setHistory(prev => [...prev.slice(-19), draft]);
    setDraft(prev => prev.map(o => o.id === id ? { ...o, ...fields } : o)); setDirty(true); setMessage("");
  }
  async function save() {
    setBusy(true); setError("");
    try {
      await apiJson(`${base}/objects`, { method: "PATCH", body: JSON.stringify({ expectedRevision: data.revision,
        ...(lightDirty ? { lighting: lights } : {}), objects: draft.filter(o => o.modelUrl).map(o => ({ id: o.id, label: o.label, positionX: o.positionX, positionY: o.positionY, positionZ: o.positionZ, yaw: o.yaw, scale: o.scale, visible: o.visible })) }) });
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
  const current = draft.find(o => o.id === selected);
  const ready = data.status === "READY" && draft.some(o => o.modelUrl);
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
      <p>This cannot be undone. Generation already billed will not be refunded. Running Find objects or Build in 3D again uses API credits.{dirty && " Your unsaved edits will also be discarded."}</p>
      <div className="editor-actions"><button className="button button-light" autoFocus disabled={busy} onClick={() => restartDialog.current?.close()}>Keep current scene</button>
        <button className="button button-dark" disabled={busy} onClick={restart}>{busy ? "Clearing…" : restartCopy.confirm}</button></div>
    </dialog>
    {error && <p role="alert" className="form-error">{error}</p>}
    {message && <p role="status" className="save-message">{message}</p>}
    {data.run?.errorMessage && <div className="generation-error"><p>{data.run.errorMessage}</p>{data.run.canResume && <button className="button button-dark" disabled={busy} onClick={resume}>Resume existing generation</button>}</div>}
    {running && <div className="generation-progress" role="status"><LoaderCircle className="spin" size={20}/><div><strong>{data.run?.stage}</strong><p>You can close this page. Your progress is saved.</p><progress value={data.run?.progress} max={100}/></div>{data.run?.canResume && <button className="button button-light" onClick={resume} disabled={busy}>Resume</button>}</div>}
    {ready ? <div className="editor-layout"><div><ViewerBoundary key={data.revision}><ModelCanvas objects={draft} selected={selected} onSelect={setSelected} composition={data.composition} lighting={lights} appearance={data.appearance}/></ViewerBoundary>
      <div className="scene-layout-tools"><div><strong>{data.composition ? "Photo layout · estimated room" : "Manual stage · photo layout available"}</strong><p>{data.composition ? "Relative size, orientation, depth, and camera use the saved SAM 3D estimates. Room surfaces and lighting are approximate." : "Apply the saved AI poses to restore relative sizes, depth, orientation, and a matching camera. No new generation needed."}</p></div>
        <button className="button button-light" disabled={busy || dirty || lightDirty} onClick={() => matchLayout("MATCH_PHOTO")}>{busy ? "Working…" : "Match photo layout"}</button>
        {data.canRestoreLayout && <button className="text-link" disabled={busy || dirty || lightDirty} onClick={() => matchLayout("RESTORE")}>Undo photo layout</button>}
      </div>
      <p className="preview-caveat">Match photo layout resets object transforms and saves them; Undo photo layout restores the previous layout. Save or reload any unsaved edits first. Hidden surfaces and measurements may differ from the photo.</p>
      {data.composition?.warnings.slice(1).map(warning => <p className="preview-caveat" key={warning}>{warning}</p>)}</div>
      <aside className="object-inspector"><span className="eyebrow">YOUR OBJECTS</span><div className="object-selector">{draft.filter(o => o.modelUrl).map(o => <button key={o.id} className={o.id === selected ? "selected" : ""} onClick={() => setSelected(o.id)}>{o.label}{!o.visible && " · hidden"}</button>)}</div>
        {current?.modelUrl && <div className="transform-fields"><label>Name<input value={current.label} maxLength={120} onChange={e => edit(current.id, { label: e.target.value })}/></label>
          {([ ["positionX", "Left / right", -10, 10, 0.1], ["positionZ", "Forward / back", -10, 10, 0.1], ["positionY", "Height", -2, 5, 0.1], ["yaw", "Rotation", -Math.PI, Math.PI, 0.05], ["scale", "Size", 0.1, 5, 0.1] ] as const).map(([field, label, min, max, step]) => <label key={field}>{label}<input type="range" min={min} max={max} step={step} value={current[field]} onChange={e => edit(current.id, { [field]: Number(e.target.value) })}/><output>{current[field].toFixed(2)}</output></label>)}
          <label className="visibility-toggle"><input type="checkbox" checked={current.visible} onChange={e => edit(current.id, { visible: e.target.checked })}/> Show object</label>
        </div>}
        <div className="editor-actions"><button className="button button-light" disabled={!history.length || busy} onClick={() => { setDraft(history[history.length - 1]); setHistory(history.slice(0, -1)); setDirty(true); }}><RotateCcw size={14}/>Undo</button><button className="button button-dark" disabled={(!dirty && !lightDirty) || busy} onClick={save}><Save size={14}/>{busy ? "Saving…" : "Save scene"}</button></div>
        <AppearanceControls lighting={lights} setLighting={editLights} dirty={lightDirty} objectDirty={dirty} busy={busy} applied={data.appearance.applied} onSave={save} onTexture={() => appearance(data.appearance.applied ? "RESTORE" : "APPLY")} onReset={() => editLights(defaultLighting(data.composition))}/>
        <button className="text-link" disabled={busy} onClick={() => void reload().catch(() => setError("Could not reload."))}>Reload saved layout</button>
      </aside></div> : <div className="analysis-layout"><div className="review-photo">{data.image && <Image src={data.image.url} alt={data.title} width={data.image.width} height={data.image.height} unoptimized/>}{data.objects.filter(o => chosen.includes(o.id) && o.maskUrl).map(o => <Image key={o.id} className="mask-overlay" src={o.maskUrl!} alt={`${o.label} outline`} fill unoptimized/>)}</div>
      <aside className="object-inspector"><span className="eyebrow">TURN THE PHOTO INTO A SCENE</span><h2>{data.objects.length ? "Choose your objects." : "Find what’s in the room."}</h2>
        {!data.objects.length && <p>Meta AI will identify up to three pieces and outline each one. You’ll review the objects before building their 3D previews.</p>}
        {data.status === "DRAFT" && <button className="button button-dark" disabled={busy || !data.generationEnabled} onClick={() => action("ANALYZE")}><Scan size={16}/>{busy ? "Starting…" : "Find objects"}</button>}
        {!data.generationEnabled && <p>Generation is temporarily disabled.</p>}
        {data.objects.map(o => <label className="review-object" key={o.id}><input type="checkbox" checked={chosen.includes(o.id)} disabled={!o.maskUrl || running} onChange={e => { setChosen(prev => e.target.checked ? [...prev, o.id].slice(0, 3) : prev.filter(id => id !== o.id)); setSelected(o.id); }}/><div><strong>{o.label}</strong><small>{o.maskUrl ? "Outline ready · select to preview" : o.errorCode ? "No clear outline found" : "Finding outline…"}</small></div></label>)}
        {data.status === "REVIEW" && <><p className="preview-caveat">Check that each highlighted outline covers the intended object. Select up to three; smaller selections are faster.</p><button className="button button-dark" disabled={busy || !chosen.length || !data.generationEnabled} onClick={() => action("RECONSTRUCT")}><Box size={16}/>{busy ? "Starting…" : `Build ${chosen.length || "your"} object${chosen.length === 1 ? "" : "s"} in 3D`}</button></>}
        {data.status === "FAILED" && !data.run?.canResume && <p>The generation stopped. Your photo is saved. Use Analyze again, Rebuild 3D, or Change photo above to restart the relevant step.</p>}
      </aside></div>}
  </div>;
}
