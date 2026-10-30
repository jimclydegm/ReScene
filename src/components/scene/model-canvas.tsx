"use client";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF, Grid } from "@react-three/drei";
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import type { SceneComposition } from "@/lib/scene/composition";
import { PhotoBackground } from "./photo-background";
import type { Lighting } from "@/lib/scene/lighting";
import type { RenderObject, SceneWorkspace } from "./types";

function Model({ object, selected, select }: { object: RenderObject; selected: boolean; select: () => void }) {
  const gltf = useGLTF(object.modelUrl!);
  const model = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const ownedMaterials: MeshStandardMaterial[] = [];
    cloned.traverse(node => { if (node instanceof Mesh) {
      node.castShadow = true; node.receiveShadow = true;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const copies = materials.map(material => {
        const index = gltf.parser.associations.get(material)?.materials;
        const pbr = index === undefined ? undefined : gltf.parser.json.materials?.[index]?.pbrMetallicRoughness;
        // SAM exports omit metallicFactor; glTF defaults it to 1, blackening fabric/wood
        // without a reflection map. Treat unspecified generated materials as dielectric.
        // Preserve explicit metallic factors/maps and never mutate the shared loader cache.
        if (!(material instanceof MeshStandardMaterial) || pbr?.metallicFactor !== undefined || material.metalnessMap) return material;
        const copy = material.clone(); copy.metalness = 0; ownedMaterials.push(copy); return copy;
      });
      node.material = Array.isArray(node.material) ? copies : copies[0];
    } });
    cloned.updateMatrixWorld(true);
    const box = new Box3().setFromObject(cloned);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const factor = 1.5 / Math.max(size.x, size.y, size.z, 0.001);
    return { cloned, factor, ownedMaterials, offset: [-center.x * factor, -box.min.y * factor, -center.z * factor] as [number, number, number] };
  }, [gltf.scene, gltf.parser]);
  useEffect(() => () => { model.ownedMaterials.forEach(material => material.dispose()); }, [model]);
  if (!object.visible) return null;
  const base = object.placement;
  const world = object.worldTransform;
  const radius = base ? Math.max(base.size[0], base.size[2]) * 0.58 : 0.85;
  return <group position={world?.position ?? [object.positionX, object.positionY, object.positionZ]} rotation={world ? undefined : [0, object.yaw, 0]} quaternion={world?.rotation} scale={world?.scale ?? object.scale}
    onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(); }}>
    <group position={world ? [0,0,0] : base?.offset ?? model.offset}>
      <primitive object={model.cloned} quaternion={world ? [0,0,0,1] : base?.rotation ?? [0, 0, 0, 1]} scale={world ? 1 : base?.scale ?? model.factor}/>
    </group>
    {selected && !world && <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[radius, radius + 0.025, 64]}/><meshBasicMaterial color="#42785c" depthWrite={false}/></mesh>}
  </group>;
}
export default function ModelCanvas({ objects, selected, onSelect, composition, lighting, appearance }: { objects: RenderObject[]; selected: string; onSelect: (id: string) => void; composition: SceneComposition | null; lighting: Lighting; appearance: SceneWorkspace["appearance"] }) {
  const readOnly = objects.some(o => Boolean(o.worldTransform));
  const controls = useRef<OrbitControlsType>(null);
  const bindControls = useCallback((value: OrbitControlsType | null) => {
    controls.current = value;
    // OrbitControls' constructor snapshots a zero target before JSX props are applied.
    // Save the actual photo target after mounting so Photo view restores its framing.
    if (value) { value.update(); value.saveState(); }
  }, []);
  const [grid, setGrid] = useState(false);
  const floorY=Math.min(composition?.floorY ?? 0,...objects.filter(o=>o.visible&&!o.worldTransform).map(o=>o.positionY));
  const c = composition?.camera;
  const lightingColor = composition?.environment.lightWarmth === "warm" ? "#fff0d8" : composition?.environment.lightWarmth === "cool" ? "#e1edff" : "#ffffff";
  const target = c?.target ?? [0, 0.5, 0] as [number, number, number];
  return <div className="model-viewport" style={{ "--scene-aspect": c?.aspect ?? 1.5 } as CSSProperties}>
    <Canvas shadows camera={{ position: c?.position ?? [5, 4, 7], fov: c?.fov ?? 42, near: 0.01, far: Math.max(500,c?new Vector3(...c.position).distanceTo(new Vector3(...c.target))*16:500) }} dpr={[1, 1.5]}
      fallback={<p className="canvas-loading">WebGL is unavailable in this browser. You can still browse the scene details.</p>}>
      <color attach="background" args={[composition?.environment.wallColor ?? "#edece5"]}/>
      <hemisphereLight args={["#fffaf0", composition?.environment.floorColor ?? "#b1a38d", lighting.ambient]}/>
      <directionalLight position={lighting.key.position} intensity={lighting.key.intensity} color={lightingColor} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={0.03}/>
      <directionalLight position={lighting.fill.position} intensity={lighting.fill.intensity}/>
      <Suspense fallback={null}>{composition && <PhotoBackground composition={composition} url={appearance.backgroundUrl ?? null} legacyFloor={appearance.floorUrl} floorY={floorY}/>}</Suspense>
      <Suspense fallback={null}>{objects.filter(o => o.modelUrl).map(o => <Model key={o.id} object={o} selected={selected === o.id} select={() => onSelect(o.id)}/>)}</Suspense>
      {(!composition || grid) && <Grid position={[0, floorY + 0.005, 0]} args={[30, 30]} cellSize={0.5} sectionSize={2} fadeDistance={20} cellColor="#c5c6ba" sectionColor="#a8b1a1"/>}
      <OrbitControls ref={bindControls} makeDefault target={target} minDistance={0.3}
        maxDistance={Math.max(40, c ? new Vector3(...c.position).distanceTo(new Vector3(...c.target)) * 2 : 40)} maxPolarAngle={composition?.backdrop === "none" ? Math.PI-.01 : Math.PI / 2 - 0.01}/>
    </Canvas>
    <div className="viewer-toolbar"><button onClick={() => controls.current?.reset()}>{readOnly ? "Reset view" : composition ? "Photo view" : "Reset camera"}</button>
      {composition && !readOnly && <button aria-pressed={grid} onClick={() => setGrid(value => !value)}>{grid ? "Hide grid" : "Show grid"}</button>}</div>
    <span className="viewer-help">Drag to orbit · right-drag to pan · scroll to zoom</span>
  </div>;
}
