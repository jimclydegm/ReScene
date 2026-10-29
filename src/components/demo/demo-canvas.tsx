"use client";

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls, RoundedBox } from "@react-three/drei";
import { Suspense } from "react";
import type { DemoObject } from "./demo-data";

type Props = { selected: DemoObject; onSelect: (id: DemoObject) => void; hidden: DemoObject[]; offsets: Record<DemoObject, number> };

function Block({ args, position, color, radius = 0.08 }: {
  args: [number, number, number]; position: [number, number, number]; color: string; radius?: number;
}) {
  return <RoundedBox args={args} radius={radius} smoothness={3} position={position} castShadow receiveShadow><meshStandardMaterial color={color} roughness={0.9}/></RoundedBox>;
}

function Room({ selected, onSelect, hidden, offsets }: Props) {
  const select = (id: DemoObject) => (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(id); };
  return <>
    <ambientLight intensity={1.25}/>
    <directionalLight position={[3, 6, 4]} intensity={2.6} castShadow shadow-mapSize={[1024, 1024]} shadow-normalBias={0.04}/>
    <directionalLight position={[-4, 3, -2]} intensity={0.6} color="#fff2d9"/>
    <Block args={[6, 0.14, 4.9]} position={[0, -0.1, 0]} color="#ded9cd" radius={0.04}/>
    <Block args={[6, 2.9, 0.12]} position={[0, 1.28, -2.4]} color="#eeeae2" radius={0.02}/>
    <Block args={[0.12, 2.9, 4.9]} position={[-3, 1.28, 0]} color="#e8e4db" radius={0.02}/>
    <Block args={[3.8, 0.025, 2.6]} position={[0, 0.002, 0.7]} color="#b9b4a5" radius={0.07}/>
    <Block args={[0.8, 1.25, 0.045]} position={[-1.6, 1.75, -2.3]} color="#b5b2a2" radius={0.01}/>
    <Block args={[0.62, 1.06, 0.05]} position={[-1.6, 1.75, -2.26]} color="#d3cebc" radius={0.01}/>
    {!hidden.includes("sofa") && <group position={[-0.9 + offsets.sofa, 0, -0.8]} onClick={select("sofa")}>
      <Block args={[2.55, 0.34, 1.12]} position={[0, 0.48, 0]} color="#a4a18f"/>
      <Block args={[2.58, 0.8, 0.27]} position={[0, 0.92, -0.48]} color="#b7b3a2"/>
      <Block args={[0.27, 0.63, 1.1]} position={[-1.2, 0.73, 0]} color="#b7b3a2"/>
      <Block args={[0.27, 0.63, 1.1]} position={[1.2, 0.73, 0]} color="#b7b3a2"/>
      <Block args={[1.02, 0.2, 0.86]} position={[-0.54, 0.71, 0.04]} color="#c4c0b0"/>
      <Block args={[1.02, 0.2, 0.86]} position={[0.54, 0.71, 0.04]} color="#c4c0b0"/>
      {[-1, 1].flatMap(x => [-0.35, 0.35].map(z => <Block key={`${x}-${z}`} args={[0.09, 0.3, 0.09]} position={[x, 0.15, z]} color="#514a3c" radius={0.02}/>))}
      <Block args={[0.43, 0.46, 0.2]} position={[-0.77, 1.0, -0.24]} color="#737c60"/>
      {selected === "sofa" && <Selection radius={1.5}/>}
    </group>}
    {!hidden.includes("table") && <group position={[0.65 + offsets.table, 0, 0.95]} onClick={select("table")}>
      <mesh position={[0, 0.58, 0]} castShadow><cylinderGeometry args={[0.73, 0.73, 0.09, 64]}/><meshStandardMaterial color="#b38c63" roughness={0.75}/></mesh>
      {[0, 2.0944, 4.1888].map(angle => <mesh key={angle} position={[Math.cos(angle) * 0.48, 0.28, Math.sin(angle) * 0.48]} castShadow><cylinderGeometry args={[0.055, 0.075, 0.52, 12]}/><meshStandardMaterial color="#95734f"/></mesh>)}
      <Block args={[0.3, 0.04, 0.42]} position={[-0.15, 0.65, 0.04]} color="#e2d9c6" radius={0.01}/>
      <mesh position={[0.25, 0.72, -0.12]}><cylinderGeometry args={[0.06, 0.05, 0.2, 24]}/><meshStandardMaterial color="#656b54"/></mesh>
      {selected === "table" && <Selection radius={0.9}/>}
    </group>}
    {!hidden.includes("lamp") && <group position={[1.65 + offsets.lamp, 0, -1.45]} onClick={select("lamp")}>
      <mesh position={[0, 0.045, 0]} castShadow><cylinderGeometry args={[0.23, 0.25, 0.06, 32]}/><meshStandardMaterial color="#4e5047"/></mesh>
      <mesh position={[0, 0.92, 0]} castShadow><cylinderGeometry args={[0.025, 0.025, 1.8, 16]}/><meshStandardMaterial color="#4e5047"/></mesh>
      <mesh position={[0, 1.84, 0]} castShadow><cylinderGeometry args={[0.21, 0.37, 0.43, 48]}/><meshStandardMaterial color="#e9dfc7" roughness={0.9}/></mesh>
      {selected === "lamp" && <Selection radius={0.5}/>}
    </group>}
    <group position={[-2.35, 0, 0.75]}>
      <mesh position={[0, 0.23, 0]} castShadow><cylinderGeometry args={[0.23, 0.16, 0.44, 32]}/><meshStandardMaterial color="#9c7960"/></mesh>
      {[0, 1.2, 2.5, 3.8, 5.1].map((angle, i) => <mesh key={angle} position={[Math.cos(angle) * 0.16, 0.68 + i * 0.07, Math.sin(angle) * 0.16]} rotation={[Math.sin(angle) * 0.4, angle, 0.3]} scale={[0.11, 0.36, 0.065]} castShadow><sphereGeometry args={[1, 16, 16]}/><meshStandardMaterial color={i % 2 ? "#647653" : "#7c8a61"}/></mesh>)}
    </group>
    <ContactShadows position={[0, 0.015, 0]} opacity={0.25} scale={10} blur={2.8} far={4} resolution={256}/>
  </>;
}

function Selection({ radius }: { radius: number }) {
  return <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[radius - 0.014, radius, 80]}/><meshBasicMaterial color="#356a52" transparent opacity={0.8}/></mesh>;
}

export default function DemoCanvas(props: Props) {
  return <Canvas shadows dpr={[1, 1.7]} camera={{ position: [5.8, 4.7, 6.8], fov: 39 }} fallback={<div className="canvas-loading">This browser cannot display the 3D sample.</div>}>
    <color attach="background" args={["#eeebe4"]}/>
    <Suspense fallback={null}><Room {...props}/></Suspense>
    <OrbitControls makeDefault target={[0, 0.65, 0]} minDistance={5} maxDistance={12} maxPolarAngle={1.45} minAzimuthAngle={-0.5} maxAzimuthAngle={1.4} enablePan={false}/>
  </Canvas>;
}
