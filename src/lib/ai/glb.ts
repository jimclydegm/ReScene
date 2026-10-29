// Validation for provider artifacts before they can enter a browser loader.
export function inspectGlb(bytes: Buffer) {
  if (bytes.length < 20 || bytes.length > 40 * 1024 * 1024 || bytes.toString("ascii", 0, 4) !== "glTF" ||
    bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error("Invalid or oversized GLB");
  const length = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a || length % 4 !== 0 || length > bytes.length - 20) throw new Error("GLB has no valid JSON chunk");
  const json = JSON.parse(bytes.toString("utf8", 20, 20 + length));
  if (json.asset?.version !== "2.0" || !json.meshes?.length || !json.buffers?.length || !json.accessors?.length) {
    throw new Error("GLB contains no mesh data");
  }
  // Reject all external resources, even data URIs. Only embedded buffer views pass.
  if ([...(json.buffers ?? []), ...(json.images ?? [])].some((item: Record<string, unknown>) => "uri" in item)) throw new Error("GLB has external resources");
  const binaryStart = 20 + length;
  if (json.buffers.length !== 1 || binaryStart + 8 > bytes.length || bytes.readUInt32LE(binaryStart + 4) !== 0x004e4942 ||
    binaryStart + 8 + bytes.readUInt32LE(binaryStart) !== bytes.length ||
    !Number.isSafeInteger(json.buffers[0].byteLength) || json.buffers[0].byteLength < 1 ||
    json.buffers[0].byteLength > bytes.readUInt32LE(binaryStart)) throw new Error("Missing or truncated embedded GLB buffer");
  for (const accessor of json.accessors) for (const field of ["min", "max"]) {
    if (accessor[field] && (!Array.isArray(accessor[field]) || !accessor[field].every(Number.isFinite))) throw new Error("Nonfinite GLB bounds");
  }
  for (const node of json.nodes ?? []) for (const key of ["matrix", "translation", "rotation", "scale"]) {
    if (node[key] && (!Array.isArray(node[key]) || !node[key].every(Number.isFinite))) throw new Error("Nonfinite GLB transform");
  }
  return { meshes: json.meshes.length as number, nodes: (json.nodes?.length ?? 0) as number,
    nodesWithTransforms: (json.nodes ?? []).filter((node: Record<string, unknown>) => node.matrix || node.translation || node.rotation || node.scale).length as number };
}

export async function downloadFalArtifact(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port ||
    !(parsed.hostname === "fal.media" || parsed.hostname.endsWith(".fal.media"))) throw new Error("Unapproved provider artifact host");
  const response = await fetch(parsed, { redirect: "error", signal: AbortSignal.timeout(60_000) });
  if (!response.ok || !response.body) throw new Error("Provider artifact unavailable");
  const limit = 40 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > limit) throw new Error("Artifact exceeds byte limit");
  const chunks = [];
  let size = 0;
  const reader = response.body.getReader();
  try { while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("Artifact exceeds byte limit"); }
    chunks.push(Buffer.from(value));
  } } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
