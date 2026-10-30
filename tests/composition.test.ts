import { describe, expect, it } from "vitest";
import { Matrix4, Quaternion, Vector3 } from "three";
import { composeRoom, glbBounds, samPose, type CompositionInput, type Environment } from "../src/lib/scene/composition";

const environment: Environment = { floorColor: "#b69c7a", wallColor: "#ddd4c6", floorMaterial: "wood", lightDirection: "left", lightWarmth: "warm", sideWall: "left" };
const input = (id: string, x: number, z: number, scale: number): CompositionInput => ({
  id, metadata: { translation: [[x, 0, z]], rotation: [[0, 0, Math.SQRT1_2, Math.SQRT1_2]], scale: [[scale, scale, scale]] },
  bounds: { min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] }, support: "floor",
  imageBounds: { xMin: 25, yMin: 25, xMax: 75, yMax: 75 }
});
describe("SAM 3D scene import", () => {
  it("undoes GLB export axes and Meta's WXYZ row-vector rotation without mirroring the photo", () => {
    const pose = samPose(input("chair", -2, 5, 2).metadata);
    expect(pose.position.toArray()).toEqual([2, 0, -5]);
    expect(pose.rotation.angleTo(new Quaternion())).toBeCloseTo(0);
    expect(new Vector3(0, 1, 0).applyQuaternion(pose.rotation).toArray()[1]).toBeCloseTo(1);
    const observed = samPose({ scale: [[1, 1, 1]], rotation: [[0.10175525, 0.11713774, -0.73126227, -0.66421217]], translation: [[-0.267, -0.044, 2.274]] });
    expect(new Vector3(0, 1, 0).applyQuaternion(observed.rotation).y).toBeGreaterThan(0.99);
  });
  it("uses one scene scale and retains size ratios, depth, and floor contacts", () => {
    const result = composeRoom([input("small", 1, 6, 1), input("large", -1, 4, 2)], { width: 150, height: 100 }, environment, "spark");
    const [small, large] = result.objects;
    expect(large.placement.scale[0] / small.placement.scale[0]).toBeCloseTo(2);
    expect(large.placement.size[1] / small.placement.size[1]).toBeCloseTo(2);
    expect(large.position[0]).toBeGreaterThan(small.position[0]);
    expect(large.position[2]).toBeGreaterThan(small.position[2]);
    expect(Math.min(small.position[1],large.position[1])).toBe(0); expect(small.position[1]).toBeGreaterThanOrEqual(0);expect(large.position[1]).toBeGreaterThanOrEqual(0);
    expect(result.composition.camera.position[2]).toBeGreaterThan(result.composition.camera.target[2]);
    expect(result.composition.camera.aspect).toBe(1.5);
  });
  it("places the floor below shoes when garment support is unknown",()=>{
    const items=[input("shirt",0,5,1),input("shorts",0,5,1),input("shoes",0,5,1)];
    items.forEach((o,i)=>{o.support="unknown";(o.metadata as {translation:number[][]}).translation[0][1]=3-i*1.5;});
    const result=composeRoom(items,{width:100,height:150},environment,"spark");
    expect(result.objects.find(o=>o.id==="shoes")!.position[1]).toBe(0);
    expect(result.objects.every(o=>o.position[1]>=0)).toBe(true);
    expect(result.composition.floorY).toBe(0);
  });
  it("recovers photo framing from a projected cube instead of using a fixed orbit camera", () => {
    const item = input("cube", 0, 5, 1);
    const edge = 0.5 / 4.5 / 0.5; // fov = 2 atan(0.5), aspect = 1
    item.imageBounds = { xMin: (1 - edge) * 50, xMax: (1 + edge) * 50, yMin: (1 - edge) * 50, yMax: (1 + edge) * 50 };
    const result = composeRoom([item], { width: 100, height: 100 }, environment, "spark");
    expect(result.composition.camera.fov).toBeCloseTo(2 * Math.atan(0.5) * 180 / Math.PI);
    expect(result.composition.projectionError).toBeLessThan(0.00001);
    // Local base pose plus bottom pivot reconstructs the original projected size exactly.
    const o = result.objects[0];
    const matrix = new Matrix4().compose(new Vector3(...o.position).add(new Vector3(...o.placement.offset)), new Quaternion(...o.placement.rotation), new Vector3(...o.placement.scale));
    expect(new Vector3(0, -0.5, 0).applyMatrix4(matrix).y).toBeCloseTo(0);
  });
  it("rejects nonfinite/missing poses and behind-camera meshes", () => {
    const item = input("cube", 0, 5, 1);
    expect(() => samPose({})).toThrow();
    expect(() => samPose({ ...item.metadata as object, translation: [[NaN, 0, 5]] })).toThrow();
    expect(() => composeRoom([{ ...item, metadata: { ...item.metadata as object, translation: [[0, 0, 0.1]] } }], { width: 100, height: 100 }, environment, "spark")).toThrow();
  });
  it("keeps a usable photo layout when a grounded subject has an arbitrary local axis", () => {
    const anchor=input("anchor",-1,5,1),round=input("round",1,5,.3);
    round.metadata={...round.metadata as object,rotation:[[1,0,0,0]]};
    const result=composeRoom([anchor,round],{width:100,height:100},environment,"spark");
    expect(result.objects).toHaveLength(2);
    const pose=samPose(round.metadata);
    expect(new Quaternion(...result.objects[1].placement.rotation).angleTo(pose.rotation)).toBeCloseTo(0);
    expect(result.objects.every(o=>o.position[1]>=-1e-8)).toBe(true);
    expect(result.composition.warnings.some(w=>w.includes("poses are preserved"))).toBe(true);
  });
  it("falls back to camera-space up when no object establishes upright without inventing a rotation",()=>{
    const item=input("lying-subject",0,5,1);item.metadata={...item.metadata as object,rotation:[[1,0,0,0]]};
    const result=composeRoom([item],{width:100,height:100},environment,"spark");
    expect(new Quaternion(...result.objects[0].placement.rotation).angleTo(samPose(item.metadata).rotation)).toBeCloseTo(0);
    expect(result.composition.warnings.some(w=>w.includes("Camera-space up"))).toBe(true);
  });
  it("reads mesh bounds through GLB node transforms and rejects cyclic hierarchies", () => {
    const doc = { scene: 0, scenes: [{ nodes: [0] }], nodes: [{ translation: [1, 2, 3], mesh: 0, children: [] as number[] }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ type: "VEC3", min: [-1, -1, -1], max: [1, 1, 1] }] };
    function bytes() {
      const json = Buffer.from(JSON.stringify(doc)); const length = Math.ceil(json.length / 4) * 4;
      const b = Buffer.alloc(20 + length, 32); b.writeUInt32LE(length, 12); json.copy(b, 20); return b;
    }
    expect(glbBounds(bytes())).toEqual({ min: [0, 1, 2], max: [2, 3, 4] });
    doc.nodes[0].children = [0]; expect(() => glbBounds(bytes())).toThrow();
  });
});
