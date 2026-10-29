// Explicit private CLI experiment. No public route; every paid step is checkpointed.
import { config } from "dotenv";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import sharp from "sharp";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { analyzePhoto } from "../src/lib/ai/analyze";
import { segmentConcept } from "../src/lib/ai/segment";
import { getSam3dClient } from "../src/lib/ai/sam3d";
import { getR2, putObject, bucket, storagePrefix } from "../src/lib/storage/r2";
import { validateAnalysis, type PhotoAnalysis } from "../src/lib/ai/contracts";
import { downloadFalArtifact, inspectGlb } from "../src/lib/ai/glb";

config({ path: ".env.local", quiet: true });
const [command = "help", ...args] = process.argv.slice(2);
class ExperimentError extends Error {}
function option(name: string) { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; }
const directory = resolve(option("dir") ?? "test-results/meta-bedroom");
const privateRoot = resolve("test-results");
if (!directory.startsWith(privateRoot + "/")) throw new ExperimentError("Experiment directory must be inside ignored test-results/");
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
type Attempt = { state: "STARTED" | "DONE"; reservedUsd: number; startedAt: string; finishedAt?: string; requestId?: string };
type Mask = { candidateId: string; label: string; instanceId: string; key: string; file: string; area: number; bounds: unknown };
type State = { version: 1; id: string; width: number; height: number; sha256: string; imageKey: string;
  source: string; budgetUsd?: number; attempts: Record<string, Attempt>; analysis?: PhotoAnalysis;
  masks: Mask[]; reviewed?: string[]; providerRequestId?: string; artifacts?: unknown[] };
let state: State;
async function save() {
  await writeFile(join(directory, "state.tmp"), JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(join(directory, "state.tmp"), join(directory, "state.json"));
}
async function json(name: string, value: unknown) { await writeFile(join(directory, name), JSON.stringify(value, null, 2), { mode: 0o600 }); }
async function sign(key: string) { return getSignedUrl(getR2(), new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn: 3600 }); }
async function reserve(name: string, reservedUsd: number) {
  if (state.attempts[name]) throw new ExperimentError("Attempt already recorded. Inspect its checkpoint; never silently repeat a paid submission.");
  const cap = Number(option("budget-usd"));
  if (!Number.isFinite(cap) || cap <= 0 || cap > 20 || (state.budgetUsd !== undefined && cap !== state.budgetUsd)) {
    throw new ExperimentError("Pass the same approved --budget-usd (0 < cap <= 20) for every paid step");
  }
  const total = Object.values(state.attempts).reduce((sum, a) => sum + a.reservedUsd, 0);
  if (total + reservedUsd > cap) throw new ExperimentError("Experiment reserve exceeds approved budget");
  state.budgetUsd = cap;
  state.attempts[name] = { state: "STARTED", reservedUsd, startedAt: new Date().toISOString() };
  await save(); // Persist before any network submission. Unknown attempts remain reserved.
}
async function done(name: string, requestId?: string) {
  Object.assign(state.attempts[name], { state: "DONE", finishedAt: new Date().toISOString(), requestId });
  await save();
}

async function main() {
  if (command === "help") {
    console.log("Commands: prepare --image PATH; analyze --budget-usd CAP; segment --candidates ID,ID --budget-usd CAP; review --masks 0,1; reconstruct --budget-usd CAP; poll; ingest; status. Optional --dir test-results/NAME. No paid command runs implicitly.");
    return;
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const lock = await open(join(directory, "experiment.lock"), "wx", 0o600);
  try {
    if (command === "prepare") {
      try { await readFile(join(directory, "state.json")); throw new ExperimentError("Experiment already exists; use another directory for a new input"); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
      const path = option("image");
      if (!path) throw new ExperimentError("Provide --image PATH");
      const source = await readFile(path);
      if (source.length > 12 * 1024 * 1024) throw new ExperimentError("Source image exceeds 12 MiB");
      const metadata = await sharp(source, { limitInputPixels: 24_000_000 }).metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new ExperimentError("Unsupported still image");
      // Same canonical transform used by upload completion.
      const normalized = await sharp(source, { limitInputPixels: 24_000_000 }).rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
      const id = randomUUID();
      state = { version: 1, id, width: normalized.info.width, height: normalized.info.height, sha256: digest(normalized.data),
        imageKey: `${storagePrefix()}/spikes/${id}/normalized.webp`, source: "Synthetic bedroom image generated in this chat for ReScene testing; no real merchant photo.", attempts: {}, masks: [] };
      await writeFile(join(directory, "normalized.webp"), normalized.data, { mode: 0o600 });
      await putObject(state.imageKey, normalized.data, "image/webp");
      await save();
      console.log(JSON.stringify({ prepared: true, width: state.width, height: state.height, sha256: state.sha256 }));
      return;
    }
    state = JSON.parse(await readFile(join(directory, "state.json"), "utf8"));
    const image = await readFile(join(directory, "normalized.webp"));
    if (digest(image) !== state.sha256) throw new ExperimentError("Normalized input changed");
    if (command === "analyze") {
      // Conservative reserve: full 1M-token context at Standard Spark rates + 4096 output.
      const url = await sign(state.imageKey);
      await reserve("analysis", 1.4);
      const result = await analyzePhoto(url, state);
      await json("analysis-private.json", result);
      state.analysis = result.analysis;
      await done("analysis", result.requestId);
      console.log(JSON.stringify({ analysis: result.analysis, usage: result.usage, durationMs: result.durationMs }, null, 2));
    } else if (command === "segment") {
      if (!state.analysis) throw new ExperimentError("Analyze first");
      validateAnalysis(state.analysis, state);
      const ids = option("candidates")?.split(",") ?? [];
      if (ids.length !== 2 || new Set(ids).size !== 2) throw new ExperimentError("Select exactly two different candidate IDs");
      const selected = ids.map(id => state.analysis!.objects.find(o => o.candidateId === id));
      if (selected.some(o => !o)) throw new ExperimentError("Unknown candidate ID");
      // Freeze both candidates before the first request. Resume cannot silently change selection.
      try {
        const prior = JSON.parse(await readFile(join(directory, "selection.json"), "utf8"));
        if (JSON.stringify(prior) !== JSON.stringify(ids)) throw new ExperimentError("Candidate selection is frozen for this experiment");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        await json("selection.json", ids);
      }
      for (const object of selected) {
        const name = `segment-${object!.candidateId}`;
        if (state.attempts[name]?.state === "DONE") continue;
        if (Object.keys(state.attempts).filter(n => n.startsWith("segment-") && n !== name).length >= 2) throw new ExperimentError("Two-concept experiment limit reached");
        const url = await sign(state.imageKey);
        await reserve(name, 0.0025);
        const result = await segmentConcept(url, object!.segmentationConcept, state);
        await json(`${name}-private.json`, { ...result, masks: result.masks.map(({ png, ...mask }) => ({ ...mask, bytes: png.length })) });
        for (const [index, mask] of result.masks.entries()) {
          const file = `${name}-${index}.png`;
          const key = `${storagePrefix()}/spikes/${state.id}/${file}`;
          await writeFile(join(directory, file), mask.png, { mode: 0o600 });
          await putObject(key, mask.png, "image/png");
          const gray = await sharp(mask.png).raw().toBuffer();
          const rgba = await sharp(image).ensureAlpha().raw().toBuffer();
          for (let i = 0; i < gray.length; i++) rgba[i * 4 + 3] = gray[i];
          await sharp(rgba, { raw: { width: state.width, height: state.height, channels: 4 } }).png().toFile(join(directory, `${name}-${index}-cutout.png`));
          state.masks.push({ candidateId: object!.candidateId, label: object!.label, instanceId: mask.objectId, file, key, area: mask.area, bounds: mask.bounds });
        }
        await done(name, result.requestId);
      }
      console.log(JSON.stringify({ masks: state.masks.map((mask, index) => ({ index, candidateId: mask.candidateId, label: mask.label, instanceId: mask.instanceId, file: mask.file, area: mask.area, bounds: mask.bounds })) }, null, 2));
    } else if (command === "review") {
      if (state.providerRequestId || state.attempts.reconstruction) throw new ExperimentError("Reconstruction input is frozen");
      const indices = option("masks")?.split(",").map(Number) ?? [];
      if (indices.length !== 2 || !indices.every(Number.isSafeInteger) || new Set(indices).size !== 2 || indices.some(i => !state.masks[i])) throw new ExperimentError("Select two mask indices after visual inspection");
      const masks = indices.map(i => state.masks[i]);
      if (new Set(masks.map(m => m.candidateId)).size !== 2) throw new ExperimentError("Select one instance for each candidate");
      state.reviewed = masks.map(m => m.file);
      await save(); console.log("Two mask instances approved in frozen order.");
    } else if (command === "reconstruct") {
      if (!state.reviewed || state.reviewed.length !== 2) throw new ExperimentError("Review the saved masks first");
      const masks = state.reviewed.map(file => state.masks.find(m => m.file === file)!);
      const imageUrl = await sign(state.imageKey);
      const maskUrls = await Promise.all(masks.map(m => sign(m.key)));
      // Generous reserve above the public $0.02/unit quote; not a provider billing guarantee.
      await reserve("reconstruction", 1);
      const { client, model } = getSam3dClient();
      const submitted = await client.queue.submit(model, { input: { image_url: imageUrl, mask_urls: maskUrls, export_textured_glb: true, seed: 42 }, abortSignal: AbortSignal.timeout(60_000) });
      state.providerRequestId = submitted.request_id;
      await done("reconstruction", submitted.request_id);
      console.log("Provider request ID saved. Use poll; never resubmit this experiment.");
    } else if (command === "poll") {
      if (!state.providerRequestId) throw new ExperimentError("No known provider request ID; reconcile any STARTED submission manually");
      const { client, model } = getSam3dClient();
      const result = await client.queue.status(model, { requestId: state.providerRequestId, logs: false, abortSignal: AbortSignal.timeout(30_000) });
      console.log(JSON.stringify({ status: result.status }));
      if (result.status === "COMPLETED") {
        const output = await client.queue.result(model, { requestId: state.providerRequestId, abortSignal: AbortSignal.timeout(60_000) });
        await json("reconstruction-private.json", output.data);
        console.log("Private result saved; use ingest to validate individual GLBs.");
      }
    } else if (command === "ingest") {
      const output = JSON.parse(await readFile(join(directory, "reconstruction-private.json"), "utf8"));
      if (output.individual_glbs?.length !== 2 || output.metadata?.length !== 2) throw new ExperimentError("Provider did not return exactly two independent objects");
      const indices = output.metadata.map((m: { object_index: number }) => m.object_index);
      if (!indices.includes(0) || !indices.includes(1)) throw new ExperimentError("Unexpected provider object indices");
      const artifacts = [];
      for (const [i, file] of output.individual_glbs.entries()) {
        const bytes = await downloadFalArtifact(file.url);
        const inventory = inspectGlb(bytes);
        const filename = `object-${i}.glb`;
        await writeFile(join(directory, filename), bytes, { mode: 0o600 });
        await putObject(`${storagePrefix()}/spikes/${state.id}/${filename}`, bytes, "model/gltf-binary");
        artifacts.push({ file: filename, sha256: digest(bytes), bytes: bytes.length, ...inventory });
      }
      state.artifacts = artifacts;
      await save(); console.log(JSON.stringify({ artifacts, mapping: "Unverified: inspect meshes and transforms before accepting mask order/layout" }, null, 2));
    } else if (command === "status") {
      console.log(JSON.stringify({ width: state.width, height: state.height, analysis: Boolean(state.analysis), masks: state.masks.length,
        reviewed: state.reviewed, knownProviderRequest: Boolean(state.providerRequestId), attempts: state.attempts, artifacts: state.artifacts }, null, 2));
    } else throw new ExperimentError("Unknown command");
  } finally {
    await lock.close();
    const { unlink } = await import("node:fs/promises");
    await unlink(join(directory, "experiment.lock"));
  }
}
main().catch(error => {
  // SDK error messages can contain signed URLs; emit only safe classification.
  const safe = error as { status?: number; name?: string };
  console.error(JSON.stringify({ failed: command, errorType: safe.name, httpStatus: safe.status, message: error instanceof ExperimentError ? error.message : undefined,
    hint: "Check the private checkpoint. STARTED means potentially accepted/charged; do not reset or resubmit blindly." }));
  process.exitCode = 1;
}).finally(() => {
  if (command !== "help" && process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) getR2().destroy();
});
