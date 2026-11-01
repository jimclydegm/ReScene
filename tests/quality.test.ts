import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { BoxGeometry, Matrix4, PerspectiveCamera, Quaternion, SphereGeometry, Vector3, type BufferGeometry } from "three";
import { buildGlb } from "./helpers/glb";
import { decodeGlb, readMesh, writeGlb } from "../src/lib/quality/mesh";
import { diagnoseMesh } from "../src/lib/quality/diagnostics";
import { compareGeometry, repairGeometry } from "../src/lib/quality/geometry";
import { render, renderMesh, orbitCameras, boundsOf } from "../src/lib/quality/render";
import { bakeMaterials, provenanceCodes } from "../src/lib/quality/material-bake";
import { evaluatePlacement, solvePlacement, environmentWalls, flushRotation } from "../src/lib/quality/placement";
import { mergeSparkReview, numericReview } from "../src/lib/quality/review";
import { inspectGlb } from "../src/lib/ai/glb";
import type { SceneComposition, ModelPlacement } from "../src/lib/scene/composition";

// Box with its six faces in separate atlas cells, so UVs do not overlap.
function atlasBox(w = 1, h = 1, d = 1) {
  const box = new BoxGeometry(w, h, d), uv = box.attributes.uv;
  for (let face = 0; face < 6; face++) for (let v = 0; v < 4; v++) {
    const i = face * 4 + v, cx = face % 3, cy = Math.floor(face / 3);
    uv.setXY(i, (cx + .1 + uv.getX(i) * .8) / 3, (cy + .1 + uv.getY(i) * .8) / 2);
  }
  return box;
}
function solid(width: number, height: number, color: number[]) { const data = new Uint8Array(width * height * 4); for (let i = 0; i < width * height; i++) data.set([...color, 255], i * 4); return { data, width, height }; }
async function png(image: { data: Uint8Array; width: number; height: number }) { return sharp(Buffer.from(image.data), { raw: { width: image.width, height: image.height, channels: 4 } }).png().toBuffer(); }
function merge(...geometries: BufferGeometry[]) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (const g of geometries) { const base = positions.length / 3; positions.push(...g.attributes.position.array); uvs.push(...(g.attributes.uv?.array ?? new Float32Array(g.attributes.position.count * 2))); indices.push(...(g.index ? Array.from(g.index.array, v => v + base) : Array.from({ length: g.attributes.position.count }, (_, i) => i + base))); }
  const out = new BoxGeometry(); out.setIndex(indices); out.setAttribute("position", new (out.attributes.position.constructor as typeof import("three").Float32BufferAttribute)(positions, 3)); out.setAttribute("uv", new (out.attributes.uv.constructor as typeof import("three").Float32BufferAttribute)(uvs, 2)); out.deleteAttribute("normal"); out.clearGroups();
  return out;
}
const stage = (): SceneComposition => ({ version: "sam3d-room-v1", floorY: 0, camera: { position: [0, 1.4, 5], target: [0, .5, 0], fov: 40, aspect: 1 }, room: { centerX: 0, centerZ: 0, width: 8, depth: 8, height: 4 }, environment: { floorColor: "#dddddd", wallColor: "#eeeeee", floorMaterial: "plain", lightDirection: "diffuse", lightWarmth: "neutral", sideWall: "none" }, environmentSource: "spark", warnings: [], projectionError: 0 });
const placement = (size: [number, number, number]): ModelPlacement => ({ version: "sam3d-layout-v1", offset: [0, size[1] / 2, 0], scale: [1, 1, 1], rotation: [0, 0, 0, 1], size });
function camera(s = stage()) { const c = new PerspectiveCamera(s.camera.fov, s.camera.aspect, .01, 100); c.position.set(...s.camera.position); c.lookAt(new Vector3(...s.camera.target)); c.updateMatrixWorld(); c.updateProjectionMatrix(); return c; }
function silhouette(bytes: Buffer, matrix: Matrix4, size = 96) { const frame = render([renderMesh(readMesh(bytes), matrix, 0)], camera(), size, size, "depth"); return Uint8Array.from(frame.owners, v => v >= 0 ? 255 : 0); }

describe("Quality mesh access", () => {
  it("reads TRS nodes and writes a compact GLB that keeps data maps and alpha", async () => {
    const base = await png(solid(8, 8, [10, 200, 10])), data = await png(solid(4, 4, [0, 128, 255]));
    const bytes = buildGlb(atlasBox(), { png: base, dataMap: data, alpha: true, node: { translation: [0, 2, 0], scale: [2, 2, 2] } });
    const doc = readMesh(bytes);
    expect(Math.min(...Array.from(doc.primitives[0].positions).filter((_, i) => i % 3 === 1))).toBeCloseTo(1);
    expect(doc.roles.get(0)).toEqual(["baseColor"]); expect(doc.roles.get(1)).toEqual(["metallicRoughness"]);
    const replaced = await png(solid(8, 8, [250, 0, 0])), out = writeGlb(decodeGlb(bytes), { images: new Map([[0, { bytes: replaced, mimeType: "image/png" }]]) });
    expect(() => inspectGlb(out)).not.toThrow();
    const after = decodeGlb(out);
    expect(after.json.materials[0].alphaMode).toBe("BLEND");
    expect(after.views[after.json.images[1].bufferView].equals(data)).toBe(true);
    expect(after.views[after.json.images[0].bufferView].equals(replaced)).toBe(true);
    expect(after.views.reduce((s, v) => s + v.length, 0)).toBeLessThan(bytes.length + replaced.length);
  });
});

describe("Geometry diagnostics and conservative repair", () => {
  it("separates winding, fragments and UV problems from appearance", () => {
    const box = atlasBox(), index = box.index!; index.setXYZ(0, index.getX(0), index.getZ(0), index.getY(0));
    const debris = new BoxGeometry(.02, .02, .02).translate(3, 3, 3), noUv = new BoxGeometry(.5, .5, .5); noUv.deleteAttribute("uv");
    const d = diagnoseMesh(readMesh(buildGlb(merge(box, debris))));
    expect(d.windingConflicts).toBeGreaterThan(0); expect(d.components).toBe(2); expect(d.findings.map(f => f.layer)).toContain("geometry");
    expect(diagnoseMesh(readMesh(buildGlb(noUv))).findings.find(f => f.code === "UV_MISSING")?.layer).toBe("mapping");
  });
  it("fixes winding and removes off-mask debris while keeping a disconnected part the mask supports", () => {
    const box = atlasBox(), index = box.index!; index.setXYZ(3, index.getX(3), index.getZ(3), index.getY(3));
    const leg = new BoxGeometry(.05, .4, .05).translate(.8, -.3, 0), debris = new BoxGeometry(.03, .03, .03).translate(-1.7, 1.6, 0);
    const matrix = new Matrix4().makeTranslation(0, .7, 0), bytes = buildGlb(merge(box, leg, debris)), mask = silhouette(buildGlb(merge(atlasBox(), leg)), matrix);
    const evidence = { camera: camera(), matrix, mask, width: 96, height: 96 }, repaired = repairGeometry(bytes, { evidence });
    expect(repaired.operations.rewound).toBe(1); expect(repaired.operations.fragments).toBe(12);
    const after = diagnoseMesh(readMesh(repaired.bytes));
    expect(after.windingConflicts).toBe(0); expect(after.components).toBe(2);
    expect(Array.from(readMesh(repaired.bytes).primitives[0].uv!)).toEqual(Array.from(readMesh(bytes).primitives[0].uv!));
    expect(compareGeometry(bytes, repaired.bytes, evidence).accepted).toBe(true);
  });
  it("keeps every fragment when no mask evidence is available", () => {
    const repaired = repairGeometry(buildGlb(merge(atlasBox(), new BoxGeometry(.02, .02, .02).translate(3, 0, 0))));
    expect(repaired.operations.fragments).toBe(0); expect(repaired.skipped).toContain("fragments-without-mask-evidence");
  });
  it("flattens a noisy cited plane but leaves curved and low-confidence surfaces alone", () => {
    const plate = new BoxGeometry(1, .2, 1, 8, 1, 8), pos = plate.attributes.position;
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0 && Math.abs(pos.getX(i)) < .49 && Math.abs(pos.getZ(i)) < .49) pos.setY(i, .1 + Math.sin(i * 12.9898) * .004);
    const matrix = new Matrix4().makeTranslation(0, .5, 0), bytes = buildGlb(plate), evidence = { camera: camera(), matrix, mask: silhouette(bytes, matrix), width: 96, height: 96 };
    const top = { id: "top", kind: "planar" as const, box: [0, 0, 1, 1] as [number, number, number, number], confidence: .9 };
    const flat = repairGeometry(bytes, { evidence, constraints: [top] });
    expect(flat.operations.planarVertices).toBeGreaterThan(20); expect(flat.maxDisplacement).toBeLessThan(.01);
    const ys = Array.from(readMesh(flat.bytes).primitives[0].positions).filter((v, i) => i % 3 === 1 && v > .05);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(.0081);
    expect(repairGeometry(bytes, { evidence, constraints: [{ ...top, confidence: .3 }] }).operations.planarVertices).toBe(0);
    const sphere = buildGlb(new SphereGeometry(.5, 24, 16)), round = repairGeometry(sphere, { evidence: { ...evidence, mask: silhouette(sphere, matrix) }, constraints: [top] });
    expect(round.operations.planarVertices).toBe(0); expect(round.skipped.some(s => s.startsWith("planar-curved"))).toBe(true);
  });
  it("rejects a replacement that loses surface or photo agreement", () => {
    const bytes = buildGlb(atlasBox()), smaller = buildGlb(atlasBox(.6, .6, .6)), matrix = new Matrix4().makeTranslation(0, .6, 0);
    const result = compareGeometry(bytes, smaller, { camera: camera(), matrix, mask: silhouette(bytes, matrix), width: 96, height: 96 });
    expect(result.accepted).toBe(false); expect(result.reasons.join(" ")).toMatch(/surface-area|silhouette|extent/);
  });
});

describe("Full-surface material bake", () => {
  async function scene(regions: Parameters<typeof bakeMaterials>[0]["regions"], protectedBoxes: [number, number, number, number][] = []) {
    const provider = solid(96, 64, [20, 160, 20]), bytes = buildGlb(atlasBox(), { png: await png(provider), dataMap: await png(solid(4, 4, [0, 90, 0])) });
    const matrix = new Matrix4().makeTranslation(0, .5, 0).multiply(new Matrix4().makeRotationY(.6)), doc = readMesh(bytes, matrix), cam = camera(), size = 128;
    const visible = render([renderMesh(doc, new Matrix4(), 0)], cam, size, size, "depth"), mask = Uint8Array.from(visible.owners, v => v >= 0 ? 255 : 0);
    const photo = { data: new Uint8Array(size * size * 3), width: size, height: size, channels: 3 as const };
    for (let i = 0; i < size * size; i++) photo.data.set(mask[i] ? [200, 40, 40] : [230, 230, 230], i * 3);
    return bakeMaterials({ doc, textures: new Map([[0, provider], [1, solid(4, 4, [0, 90, 0])]]), object: 0, photo, mask, camera: cam, visible: { ...visible, width: size, height: size }, regions, protectedBoxes });
  }
  it("covers every mapped surface: observed where visible, generated or provider elsewhere", async () => {
    const result = await scene([{ id: "paint", color: [200, 40, 40], sample: solid(16, 16, [40, 40, 200]), tileScale: .25, grain: "none", repeating: true }]);
    const { observed, generated, inferred, unmapped } = result.coverage;
    expect(observed).toBeGreaterThan(.08); expect(generated).toBeGreaterThan(.3); expect(unmapped).toBe(0);
    expect(observed + generated + inferred).toBeCloseTo(1, 2);
    expect(result.textures.has(1)).toBe(false);
    const out = result.textures.get(0)!, codes = result.provenance.get(0)!;
    const observedTexel = codes.findIndex(c => c === provenanceCodes.observed), generatedTexel = codes.findIndex(c => c === provenanceCodes.generated);
    // Observed texels carry the photo color (feathered near edges).
    const [r, g, b] = out.data.slice(observedTexel * 4, observedTexel * 4 + 3); expect(r).toBeGreaterThan(150); expect(Math.max(g, b)).toBeLessThan(80);
    // Generated texels are tinted toward the observed region color, not left blue.
    expect(out.data[generatedTexel * 4]).toBeGreaterThan(40); expect(out.data[generatedTexel * 4 + 2]).toBeLessThan(200);
    expect(out.data[3]).toBe(255);
  });
  it("keeps provider appearance for unseen surfaces when no material sample exists", async () => {
    const result = await scene([]);
    expect(result.coverage.generated).toBe(0); expect(result.coverage.inferred).toBeGreaterThan(.4);
    // Provider texels stay provider appearance, only harmonized within bounds
    // toward the observed region (here red), so seams do not step.
    const out = result.textures.get(0)!, codes = result.provenance.get(0)!, i = codes.findIndex(c => c === provenanceCodes.inferred);
    expect(Array.from(out.data.slice(i * 4, i * 4 + 3))).toEqual([32, 96, 32]);
    // Unused atlas outside islands and padding stays untouched.
    expect(codes[0]).toBe(0); expect(Array.from(out.data.slice(0, 3))).toEqual([20, 160, 20]);
  });
  it("counts protected source details separately", async () => {
    expect((await scene([], [[0, 0, 1, 1]])).coverage.protected).toBeGreaterThan(.1);
  });
  it("uses source material evidence to keep shaded cloth separate from wood on hidden faces",async()=>{
    const provider=solid(96,64,[122,112,83]),doc=readMesh(buildGlb(atlasBox(),{png:await png(provider)})),cam=camera(),size=128;
    const visible=render([renderMesh(doc,new Matrix4(),0)],cam,size,size,"depth"),mask=Uint8Array.from(visible.owners,v=>v===0?255:0),data=new Uint8Array(size*size*3);
    for(let i=0;i<size*size;i++)data.set([115,135,120],i*3);
    const result=bakeMaterials({doc,textures:new Map([[0,provider]]),object:0,photo:{width:size,height:size,channels:3,data},mask,camera:cam,visible,protectedBoxes:[],regions:[
      {id:"cloth",color:[159,181,164],sample:solid(16,16,[159,181,164]),evidence:[0,0,1,1],tileScale:.4,grain:"none",repeating:true},
      {id:"wood",color:[200,160,117],sample:solid(16,16,[200,160,117]),evidence:[0,0,.01,.01],tileScale:.4,grain:"none",repeating:true}
    ]});
    expect(result.coverage.regions.cloth).toBeGreaterThan(.99);expect(result.coverage.regions.wood).toBe(0);expect(result.coverage.unmapped).toBe(0);expect(result.coverage.generated).toBeGreaterThan(.5);
  });
});

describe("Physical placement", () => {
  const input = (id: string, bytes: Buffer, support: string, supportedById: string | null = null) => ({ id, label: id, bytes, mask: new Uint8Array(96 * 96).fill(0), support, supportedById });
  it("lays a mis-posed object flat on its broadest base and leaves round or steep ones alone", () => {
    const points = (g: BufferGeometry, q = new Quaternion()) => { const p = readMesh(buildGlb(g)).primitives[0].positions, out: Vector3[] = []; for (let i = 0; i < p.length; i += 3) out.push(new Vector3(p[i], p[i + 1], p[i + 2]).applyQuaternion(q)); return out; };
    const tilt = (deg: number) => new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), deg * Math.PI / 180);
    const box = new BoxGeometry(1, .3, .6, 6, 2, 6);
    expect(flushRotation(points(box), new Vector3())).toBeNull();
    const fixed = flushRotation(points(box, tilt(6)), new Vector3());
    expect(fixed!.degrees).toBeGreaterThan(5.5); expect(fixed!.degrees).toBeLessThan(6.5); expect(fixed!.area).toBeGreaterThan(fixed!.before * 10);
    expect(flushRotation(points(new SphereGeometry(.5, 24, 16), tilt(6)), new Vector3())).toBeNull();
    expect(flushRotation(points(box, tilt(30)), new Vector3())).toBeNull();
  });
  it("seats on several real contacts and reports floating or sinking", () => {
    const bytes = buildGlb(atlasBox(.5, .5, .5)), objects = [{ id: "a", position: [0, .12, 0] as [number, number, number], placement: placement([.5, .5, .5]) }];
    const inputs = [{ ...input("a", bytes, "floor"), mask: silhouette(bytes, new Matrix4().makeTranslation(0, .25, 0)) }];
    const before = evaluatePlacement(objects, inputs, stage(), { width: 96, height: 96 })[0];
    expect(before.floating).toBe(true);
    const solved = solvePlacement(objects, inputs, stage(), { width: 96, height: 96 });
    expect(solved.accepted).toBe(true); expect(objects[0].position[1]).toBeCloseTo(0, 3);
    expect(solved.after[0].contacts).toBeGreaterThanOrEqual(3); expect(solved.after[0].stable).toBe(true);
  });
  it("rests a supported item on the support top under its base, not one center ray", () => {
    const table = buildGlb(atlasBox(1.2, .8, 1.2)), cup = buildGlb(atlasBox(.2, .3, .2));
    const objects = [{ id: "table", position: [0, 0, 0] as [number, number, number], placement: placement([1.2, .8, 1.2]) }, { id: "cup", position: [.3, .74, 0] as [number, number, number], placement: placement([.2, .3, .2]) }];
    const masks = { table: silhouette(table, new Matrix4().makeTranslation(0, .4, 0)), cup: silhouette(cup, new Matrix4().makeTranslation(.3, .95, 0)) };
    solvePlacement(objects, [{ ...input("table", table, "floor"), mask: masks.table }, { ...input("cup", cup, "tabletop", "table"), mask: masks.cup }], stage(), { width: 96, height: 96 });
    expect(objects[1].position[1]).toBeCloseTo(.8, 3); expect(objects[0].position[1]).toBeCloseTo(0, 5);
  });
  it("pushes geometry out of an observed wall but lets it pass through an opening", () => {
    const s = stage(); s.background = { kind: "planes", groundVisible: true, boundary: null, description: "wall", geometry: { version: "reference-environment-v1", surfaces: [
      { role: "wall", vertices: [[-3, 0, -1], [3, 0, -1], [3, 3, -1], [-3, 3, -1]], triangles: [0, 1, 2, 0, 2, 3] },
      { role: "window", vertices: [[1, .2, -1], [2.5, .2, -1], [2.5, 2, -1], [1, 2, -1]], triangles: [0, 1, 2, 0, 2, 3] }] } } as SceneComposition["background"];
    const bytes = buildGlb(atlasBox(.5, .5, .5));
    const into = [{ id: "a", position: [-1, 0, -1.1] as [number, number, number], placement: placement([.5, .5, .5]) }];
    expect(environmentWalls(s)).toHaveLength(1);
    expect(evaluatePlacement(into, [input("a", bytes, "floor")], s, { width: 96, height: 96 })[0].wallPenetration).toBeGreaterThan(.3);
    const opening = [{ id: "a", position: [1.75, .5, -1.1] as [number, number, number], placement: placement([.5, .5, .5]) }];
    expect(evaluatePlacement(opening, [input("a", bytes, "wall")], s, { width: 96, height: 96 })[0].wallPenetration).toBe(0);
  });
  it("flags two objects occupying the same space as possible duplicates", () => {
    const bytes = buildGlb(atlasBox(.6, .6, .6)), objects = ["a", "b"].map(id => ({ id, position: [0, 0, 0] as [number, number, number], placement: placement([.6, .6, .6]) }));
    const report = evaluatePlacement(objects, [input("a", bytes, "floor"), input("b", bytes, "floor")], stage(), { width: 96, height: 96 });
    expect(report[0].duplicateOf).toBe("b"); expect(report[0].collisions).toEqual(["b"]);
  });
});

describe("Final output review", () => {
  const base = { id: "a", label: "Any subject", iou: .8, iouBefore: .8, occluded: 0, appearanceBefore: 20, appearanceAfter: 15, coverage: null, seams: { before: 4, after: 5 }, contact: null, geometryRejected: [] };
  it("passes only without warnings and rejects measured regressions", () => {
    expect(numericReview(base).verdict).toBe("PASS");
    const worse = numericReview({ ...base, iou: .6, appearanceAfter: 40 });
    expect(worse.verdict).toBe("REJECT"); expect(worse.issues.filter(i => i.correction === "revert-object").length).toBe(2);
  });
  it("applies a Spark correction only with numeric support", () => {
    const reviews = [numericReview(base), numericReview({ ...base, id: "b", iou: .6 })];
    const accepted = mergeSparkReview(reviews, { version: "final-render-review-v1", summary: "", objects: [
      { objectId: "object-1", verdict: "REJECT", issues: [{ type: "shape", severity: "high", confidence: .9, observed: true, evidence: "seat edge", correction: "revert-object" }] },
      { objectId: "object-2", verdict: "REJECT", issues: [{ type: "shape", severity: "high", confidence: .9, observed: true, evidence: "worse", correction: "revert-object" }] }] }, ["a", "b"]);
    expect(accepted.has("a")).toBe(false); expect(accepted.get("b")).toBe("revert-object"); expect(reviews[0].verdict).toBe("NEEDS_REVIEW");
  });
});

describe("Inspection renders", () => {
  it("covers top and underside in the orbit and renders all modes", () => {
    const doc = readMesh(buildGlb(atlasBox())), mesh = renderMesh(doc, new Matrix4().compose(new Vector3(), new Quaternion(), new Vector3(1, 1, 1)), 0);
    const cameras = orbitCameras(boundsOf([mesh]));
    expect(cameras.map(c => c.name)).toEqual(["front", "right", "back", "left", "top", "underside"]);
    for (const mode of ["wireframe", "normals", "unlit", "neutral"] as const) { const frame = render([mesh], cameras[0].camera, 64, 64, mode); expect(frame.owners.some(v => v === 0)).toBe(true); }
  });
});

describe("Coordinated pipeline and contracts", () => {
  it("keeps Meta observation schemas strict and separate from render state", async () => {
    const { strictResponseFormat } = await import("../src/lib/ai/structured-output");
    const { qualityPlanObservationSchema, qualityReviewObservationSchema } = await import("../src/lib/quality/contracts");
    expect(() => strictResponseFormat("plan", qualityPlanObservationSchema)).not.toThrow();
    expect(() => strictResponseFormat("review", qualityReviewObservationSchema)).not.toThrow();
  });
  it("requires an explicit confirmation for the paid quality run", async () => {
    const { runInputSchema } = await import("../src/lib/validation/generation");
    const base = { kind: "IMAGE_EDIT", expectedRevision: 3, idempotencyKey: crypto.randomUUID(), quality: { materials: true, masks: false, review: true } };
    expect(runInputSchema.safeParse(base).success).toBe(false);
    expect(runInputSchema.safeParse({ ...base, confirmed: true }).success).toBe(true);
    expect(runInputSchema.safeParse({ ...base, confirmed: true, background: { mode: "reference" } }).success).toBe(false);
  });
  it("repairs, seats, bakes and reviews jointly while keeping textures attached to the mesh", async () => {
    const { runQualityPipeline, planRegions, planConstraints } = await import("../src/lib/quality/pipeline");
    const provider = solid(96, 64, [20, 160, 20]), table = buildGlb(atlasBox(1.2, .8, 1.2), { png: await png(provider) }), cup = buildGlb(atlasBox(.2, .3, .2), { png: await png(provider) });
    const size = 128, s = stage(), poses = [{ id: "table", position: [0, 0, 0] as [number, number, number], placement: placement([1.2, .8, 1.2]) }, { id: "cup", position: [.3, .9, 0] as [number, number, number], placement: placement([.2, .3, .2]) }];
    const masks = [silhouette(table, new Matrix4().makeTranslation(0, .4, 0), size), silhouette(cup, new Matrix4().makeTranslation(.3, .95, 0), size)];
    const photo = { data: new Uint8Array(size * size * 3), width: size, height: size, channels: 3 as const };
    for (let i = 0; i < size * size; i++) photo.data.set(masks[1][i] ? [30, 30, 200] : masks[0][i] ? [200, 180, 140] : [240, 240, 240], i * 3);

    const result = await runQualityPipeline({ composition: s, photo, placements: poses, objects: [
      { id: "table", label: "Table", bytes: table, mask: masks[0], support: "floor", supportedById: null, rootId: null, repairable: true, plan: null, samples: new Map() },
      { id: "cup", label: "Cup", bytes: cup, mask: masks[1], support: "tabletop", supportedById: "table", rootId: null, repairable: true, plan: null, samples: new Map() }] });
    expect(result.placement.rejected).toEqual([]); expect(result.placement.accepted).toBe(true);
    expect(result.placements.find(p => p.id === "cup")!.position[1]).toBeCloseTo(.8, 3);
    for (const o of result.objects) { expect(() => inspectGlb(o.bytes)).not.toThrow(); expect("coverage" in o.bake && o.bake.coverage.unmapped).toBe(0); }
    const cupBaked = readMesh(result.objects[1].bytes), original = readMesh(cup);
    expect(Array.from(cupBaked.primitives[0].uv!)).toEqual(Array.from(original.primitives[0].uv!));
    expect(cupBaked.json.images).toHaveLength(1); expect(cupBaked.primitives[0].image).toBe(0);
    expect(result.objects[1].review.metrics.appearanceAfter!).toBeLessThan(result.objects[1].review.metrics.appearanceBefore!);
    // Plans never ask for manufactured repair on deformable or organic subjects.
    const plan = { version: "object-quality-plan-v1" as const, construction: "deformable" as const, components: [], constraints: [{ id: "top", kind: "planar" as const, evidence: { x0: 0, y0: 0, x1: 1, y1: 1 }, confidence: .9, note: "" }], materials: [{ id: "cloth", name: "cloth", material: "cotton", color: "#336699", finish: "matte" as const, grain: "along-part" as const, patternScale: .1, repeating: true, evidence: { x0: 0, y0: 0, x1: 1, y1: 1 }, confidence: .9 }], protectedDetails: [], maskCorrections: [], lightingEffects: [], uncertainty: "" };
    expect(planConstraints(plan)).toEqual([]); expect(planRegions(plan, new Map())[0].color).toEqual([51, 102, 153]);
  });
});
