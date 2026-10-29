"use client";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF, Grid } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { Suspense, useMemo, useRef } from "react";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import type { SceneObjectView } from "./types";

function Model({ object, selected, select }: { object: SceneObjectView; selected: boolean; select: () => void }) {
  const gltf = useGLTF(object.modelUrl!);
  const model = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.updateMatrixWorld(true);
    const box = new Box3().setFromObject(cloned);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const factor = 1.5 / Math.max(size.x, size.y, size.z, 0.001);
    return { cloned, factor, offset: [-center.x * factor, -box.min.y * factor, -center.z * factor] as [number, number, number] };
  }, [gltf.scene]);
  if (!object.visible) return null;
  return <group position={[object.positionX, object.positionY, object.positionZ]} rotation={[0, object.yaw, 0]} scale={object.scale}
    onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(); }}>
    <group position={model.offset}><primitive object={model.cloned} scale={model.factor}/></group>
    {selected && <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[0.85, 0.87, 64]}/><meshBasicMaterial color="#42785c"/></mesh>}
  </group>;
}
export default function ModelCanvas({ objects, selected, onSelect }: { objects: SceneObjectView[]; selected: string; onSelect: (id: string) => void }) {
  const controls = useRef<OrbitControlsType>(null);
  return <div className="model-viewport"><Canvas camera={{ position: [5, 4, 7], fov: 42 }} dpr={[1, 1.5]}
    fallback={<p className="canvas-loading">WebGL is unavailable in this browser. Your saved scene is safe.</p>}>
    <color attach="background" args={["#edece5"]}/><ambientLight intensity={1.8}/><directionalLight position={[5, 7, 4]} intensity={2.5}/>
    <Suspense fallback={null}>{objects.filter(o => o.modelUrl).map(o => <Model key={o.id} object={o} selected={selected === o.id} select={() => onSelect(o.id)}/>)}</Suspense>
    <Grid args={[20, 20]} cellSize={0.5} sectionSize={2} fadeDistance={20} cellColor="#c5c6ba" sectionColor="#a8b1a1"/>
    <OrbitControls ref={controls} makeDefault target={[0, 0.5, 0]} minDistance={2} maxDistance={18} maxPolarAngle={Math.PI / 2 - 0.02}/>
  </Canvas><button className="viewer-reset" onClick={() => controls.current?.reset()}>Reset camera</button><span className="viewer-help">Drag to orbit · right-drag to pan · scroll to zoom</span></div>;
}
