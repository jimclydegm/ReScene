"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useEffect, type FormEvent, type DragEvent } from "react";
import { ArrowUpRight, ImagePlus, LoaderCircle, LockKeyhole, Upload, X } from "lucide-react";
import { apiJson } from "@/lib/client-api";

type Scene = { id: string; title: string; revision: number };

export function UploadForm({ scene: existing }: { scene?: Scene }) {
  const router = useRouter();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [scene, setScene] = useState<Scene | undefined>(existing);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  function selectFile(next: File | undefined) {
    setError("");
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) { setError("Choose a JPEG, PNG, or WebP image."); return; }
    if (next.size > 12 * 1024 * 1024) { setError("Choose an image smaller than 12 MB."); return; }
    setFile(next);
    setPreview(URL.createObjectURL(next));
    if (!title) setTitle(next.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").slice(0, 160));
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); setDragging(false);
    if (!stage) selectFile(event.dataTransfer.files[0]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || stage) return;
    setError("");
    try {
      setStage("Creating your scene…");
      let current = scene;
      if (!current) {
        const result = await apiJson<{ scene: Scene }>("/api/scenes", { method: "POST", body: JSON.stringify({ title }) });
        current = result.scene; setScene(current);
      }
      setStage("Uploading your photo…");
      const upload = await apiJson<{ assetId: string; uploadUrl: string; headers: Record<string, string> }>(`/api/scenes/${current.id}/uploads`, {
        method: "POST", body: JSON.stringify({ contentType: file.type, byteSize: file.size, expectedRevision: current.revision })
      });
      const sent = await fetch(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: file });
      if (!sent.ok) throw new Error("The photo upload failed. Please try again.");
      setStage("Preparing your photo…");
      await apiJson(`/api/scenes/${current.id}/uploads/${upload.assetId}/complete`, { method: "POST", body: JSON.stringify({ expectedRevision: current.revision }) });
      router.push(`/scenes/${current.id}`);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The upload failed. Please try again."); setStage(""); }
  }

  return <form className="upload-form" onSubmit={submit}>
    {!existing && <label className="field-label">Scene name<input value={title} onChange={event => setTitle(event.target.value)} maxLength={160} placeholder="Sunday in the living room" required disabled={Boolean(stage) || Boolean(scene)}/></label>}
    <label className={`upload-dropzone${dragging ? " dragging" : ""}${preview ? " has-preview" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
      <input className="file-input" aria-label="Choose a room photo" type="file" accept="image/jpeg,image/png,image/webp" disabled={Boolean(stage)} onChange={event => selectFile(event.target.files?.[0])}/>
      {preview ? <><Image src={preview} alt="Selected scene photo" fill unoptimized style={{ objectFit: "contain" }}/><span className="photo-selected"><ImagePlus size={14}/>{file?.name}</span></> : <><span className="upload-icon"><Upload size={27} strokeWidth={1.3}/></span><h2>Drop your photo here</h2><p>or <span>browse your files</span></p><small>JPEG, PNG, or WebP · up to 12 MB</small></>}
    </label>
    {file && !stage && <button className="remove-file" type="button" onClick={() => { setFile(null); setPreview(null); }}><X size={13}/> Choose a different photo</button>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="upload-form-bottom"><span><LockKeyhole size={14}/> Private to your account</span><button className="button button-dark" type="submit" disabled={!file || !title.trim() || Boolean(stage)}>{stage ? <><LoaderCircle size={16} className="spin"/>{stage}</> : <>Save your photo <ArrowUpRight size={17}/></>}</button></div>
    <p className="upload-next-note">Start with a clear room photo. Review the object outlines, then build your editable 3D preview.</p>
  </form>;
}
