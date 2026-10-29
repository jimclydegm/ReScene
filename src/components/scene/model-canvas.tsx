"use client";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF, Grid } from "@react-three/drei";
import { Box3, Color, Mesh, Vector3 } from "three";
import { Suspense, useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import type { SceneComposition } from "@/lib/scene/composition";
import type { SceneObjectView } from "./types";

function Model({ object, selected, select }: { object: SceneObjectView; selected: boolean; select: () => void }) {
  const gltf = useGLTF(object.modelUrl!);
  const model = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse(node => { if (node instanceof Mesh) { node.castShadow = true; node.receiveShadow = true; } });
    cloned.updateMatrixWorld(true);
    const box = new Box3().setFromObject(cloned);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const factor = 1.5 / Math.max(size.x, size.y, size.z, 0.001);
    return { cloned, factor, offset: [-center.x * factor, -box.min.y * factor, -center.z * factor] as [number, number, number] };
  }, [gltf.scene]);
  if (!object.visible) return null;
  const base = object.placement;
  const radius = base ? Math.max(base.size[0], base.size[2]) * 0.58 : 0.85;
  return <group position={[object.positionX, object.positionY, object.positionZ]} rotation={[0, object.yaw, 0]} scale={object.scale}
    onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(); }}>
    <group position={base?.offset ?? model.offset}>
      <primitive object={model.cloned} quaternion={base?.rotation ?? [0, 0, 0, 1]} scale={base?.scale ?? model.factor}/>
    </group>
    {selected && <mesh position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[radius, radius + 0.025, 64]}/><meshBasicMaterial color="#42785c" depthWrite={false}/></mesh>}
  </group>;
}
function Room({ composition }: { composition: SceneComposition }) {
  const { room: r, environment: e } = composition;
  const back = r.centerZ - r.depth / 2;
  const side = r.centerX + (e.sideWall === "left" ? -1 : 1) * r.width / 2;
  return <group>
    <mesh receiveShadow position={[r.centerX, -0.012, r.centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[r.width, r.depth]}/><meshStandardMaterial color={e.floorColor} roughness={e.floorMaterial === "tile" ? 0.5 : 0.9}/>
    </mesh>
    <mesh receiveShadow position={[r.centerX, r.height / 2, back]}><planeGeometry args={[r.width, r.height]}/><meshStandardMaterial color={e.wallColor} roughness={1}/></mesh>
    <mesh receiveShadow position={[r.centerX, 0.07, back + 0.02]}><boxGeometry args={[r.width, 0.14, 0.035]}/><meshStandardMaterial color={e.wallColor}/></mesh>
    {e.sideWall !== "none" && <mesh receiveShadow position={[side, r.height / 2, r.centerZ]} rotation={[0, e.sideWall === "left" ? Math.PI / 2 : -Math.PI / 2, 0]}>
      <planeGeometry args={[r.depth, r.height]}/><meshStandardMaterial color={e.wallColor} roughness={1}/>
    </mesh>}
    {e.floorMaterial === "wood" && Array.from({ length: Math.floor(r.depth / 0.38) }, (_, i) => <mesh key={i} position={[r.centerX, -0.01, back + (i + 1) * 0.38]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[r.width, 0.006]}/><meshStandardMaterial color={new Color(e.floorColor).multiplyScalar(0.7)} roughness={1} transparent opacity={0.35}/>
    </mesh>)}
  </group>;
}
export default function ModelCanvas({ objects, selected, onSelect, composition }: { objects: SceneObjectView[]; selected: string; onSelect: (id: string) => void; composition: SceneComposition | null }) {
  const controls = useRef<OrbitControlsType>(null);
  const bindControls = useCallback((value: OrbitControlsType | null) => {
    controls.current = value;
    // OrbitControls' constructor snapshots a zero target before JSX props are applied.
    // Save the actual photo target after mounting so Photo view restores its framing.
    if (value) { value.update(); value.saveState(); }
  }, []);
  const [grid, setGrid] = useState(false);
  const c = composition?.camera;
  const light = composition?.environment.lightDirection;
  const lightingColor = composition?.environment.lightWarmth === "warm" ? "#fff0d8" : composition?.environment.lightWarmth === "cool" ? "#e1edff" : "#ffffff";
  const target = c?.target ?? [0, 0.5, 0] as [number, number, number];
  const lightPosition: [number, number, number] = [target[0] + (light === "left" ? -5 : light === "right" ? 5 : 0), 7, target[2] + (light === "front" ? 6 : 2)];
  return <div className="model-viewport" style={{ "--scene-aspect": c?.aspect ?? 1.5 } as CSSProperties}>
    <Canvas shadows camera={{ position: c?.position ?? [5, 4, 7], fov: c?.fov ?? 42, near: 0.01, far: 200 }} dpr={[1, 1.5]}
      fallback={<p className="canvas-loading">WebGL is unavailable in this browser. Your saved scene is safe.</p>}>
      <color attach="background" args={[composition?.environment.wallColor ?? "#edece5"]}/>
      <hemisphereLight args={["#fffaf0", composition?.environment.floorColor ?? "#b1a38d", composition ? 1.5 : 1.8]}/>
      <directionalLight position={lightPosition} intensity={light === "diffuse" ? 1 : 2} color={lightingColor} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-normalBias={0.03}/>
      {composition && <Room composition={composition}/>}
      <Suspense fallback={null}>{objects.filter(o => o.modelUrl).map(o => <Model key={o.id} object={o} selected={selected === o.id} select={() => onSelect(o.id)}/>)}</Suspense>
      {(!composition || grid) && <Grid position={[0, 0.005, 0]} args={[30, 30]} cellSize={0.5} sectionSize={2} fadeDistance={20} cellColor="#c5c6ba" sectionColor="#a8b1a1"/>}
      <OrbitControls ref={bindControls} makeDefault target={target} minDistance={0.3}
        maxDistance={Math.max(40, c ? new Vector3(...c.position).distanceTo(new Vector3(...c.target)) * 2 : 40)} maxPolarAngle={Math.PI / 2 - 0.01}/>
    </Canvas>
    <div className="viewer-toolbar"><button onClick={() => controls.current?.reset()}>{composition ? "Photo view" : "Reset camera"}</button>
      {composition && <button aria-pressed={grid} onClick={() => setGrid(value => !value)}>{grid ? "Hide grid" : "Show grid"}</button>}</div>
    <span className="viewer-help">Drag to orbit · right-drag to pan · scroll to zoom</span>
  </div>;
}
