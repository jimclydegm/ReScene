"use client";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress, Grid } from "@react-three/drei";
import { Box3, Mesh, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera, Vector3 } from "three";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import type { OrbitControls as OrbitControlsType } from "three-stdlib";
import { manualStageCamera, type SceneComposition } from "@/lib/scene/composition";
import {referenceFov} from "@/lib/scene/reference-framing";
import { PhotoBackground } from "./photo-background";
import {captureScene,focusDistance} from "@/lib/editor/capture";
import {Download,Focus,Grid3x3,House,ImageOff,Lock,LockOpen,Maximize} from "lucide-react";
import type { Lighting } from "@/lib/scene/lighting";
import type { RenderObject, SceneWorkspace } from "./types";

function Model({ object, selected, select }: { object: RenderObject; selected: boolean; select: () => void }) {
  const gltf = useGLTF(object.modelUrl!);
  const model = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    const ownedMaterials: MeshStandardMaterial[] = [];
    cloned.traverse(node => { if (node instanceof Mesh) {
      node.castShadow = true; node.receiveShadow = false;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const copies = materials.map(material => {
        const index = gltf.parser.associations.get(material)?.materials;
        const pbr = index === undefined ? undefined : gltf.parser.json.materials?.[index]?.pbrMetallicRoughness;
        // SAM exports omit metallicFactor; glTF defaults it to 1, blackening fabric/wood
        // without a reflection map. Treat unspecified generated materials as dielectric.
        // Preserve explicit metallic factors/maps and never mutate the shared loader cache.
        if (!(material instanceof MeshStandardMaterial)) return material;
        if (!object.tint && (pbr?.metallicFactor !== undefined || material.metalnessMap)) return material;
        const copy = material.clone(); if(pbr?.metallicFactor === undefined && !material.metalnessMap) copy.metalness = 0; if(object.tint) copy.color.set(object.tint); ownedMaterials.push(copy); return copy;
      });
      node.material = Array.isArray(node.material) ? copies : copies[0];
    } });
    cloned.updateMatrixWorld(true);
    const box = new Box3().setFromObject(cloned);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const factor = 1.5 / Math.max(size.x, size.y, size.z, 0.001);
    return { cloned, factor, ownedMaterials, offset: [-center.x * factor, -box.min.y * factor, -center.z * factor] as [number, number, number] };
  }, [gltf.scene, gltf.parser, object.tint]);
  useEffect(() => () => { model.ownedMaterials.forEach(material => material.dispose()); }, [model]);
  if (!object.visible) return null;
  const base = object.placement;
  const world = object.worldTransform;
  const radius = base ? Math.max(base.size[0], base.size[2]) * 0.58 : 0.85;
  return <group name={`object-${object.id}`} position={world?.position ?? [object.positionX, object.positionY, object.positionZ]} rotation={world ? undefined : [object.pitch??0, object.yaw, object.roll??0,"YXZ"]} quaternion={world?.rotation} scale={world?.scale ?? object.scale}
    onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select(); }}>
    <group position={world ? [0,0,0] : base?.offset ?? model.offset}>
      <primitive object={model.cloned} quaternion={world ? [0,0,0,1] : base?.rotation ?? [0, 0, 0, 1]} scale={world ? 1 : base?.scale ?? model.factor}/>
    </group>
    {selected && !world && <mesh userData={{editorHelper:true}} position={[0, 0.018, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[radius, radius + 0.025, 64]}/><meshBasicMaterial color="#42785c" depthWrite={false}/></mesh>}
  </group>;
}
type ViewerApi={capture:(transparent:boolean)=>Promise<Blob>;focus:(id:string,locked:boolean)=>void};
function ViewerCommands({apiRef,controlsRef}:{apiRef:RefObject<ViewerApi|null>;controlsRef:RefObject<OrbitControlsType|null>}){
 const {gl,scene,camera}=useThree();
 useEffect(()=>{
  if(!(camera instanceof PerspectiveCamera))return;
  apiRef.current={capture:transparent=>captureScene(gl,scene,camera,transparent),focus:(id,locked)=>{
   const group=scene.getObjectByName(`object-${id}`),control=controlsRef.current;if(!group||!control)return;
   const box=new Box3().setFromObject(group.children[0]??group);if(box.isEmpty())return;
   const target=box.getCenter(new Vector3()),direction=camera.position.clone().sub(control.target);
   const distance=locked?direction.length():Math.min(control.maxDistance,Math.max(control.minDistance,focusDistance(box,camera)));
   camera.position.copy(target).add(direction.normalize().multiplyScalar(distance));control.target.copy(target);control.update();
  }};
  return ()=>{apiRef.current=null;};
 },[apiRef,controlsRef,gl,scene,camera]);
 return null;
}
function ReferenceFraming({reference}:{reference:SceneComposition["camera"]|undefined}){
 const {camera,size}=useThree();
 useEffect(()=>{
  if(reference&&camera instanceof PerspectiveCamera){
   // R3F owns an imperative Three camera; resizing must update its projection.
   // eslint-disable-next-line react-hooks/immutability
   camera.fov=referenceFov(reference.fov,reference.aspect,size.width/Math.max(1,size.height));
   camera.updateProjectionMatrix();
  }
 },[camera,size.width,size.height,reference]);return null;
}
export default function ModelCanvas({ objects, selected, onSelect, composition, lighting, appearance, shopping = false }: { objects: RenderObject[]; selected: string; onSelect: (id: string) => void; composition: SceneComposition | null; lighting: Lighting; appearance: SceneWorkspace["appearance"]; shopping?: boolean }) {
  const readOnly = objects.some(o => Boolean(o.worldTransform));
  const controls = useRef<OrbitControlsType>(null);
  const bindControls = useCallback((value: OrbitControlsType | null) => {
    controls.current = value;
    // OrbitControls' constructor snapshots a zero target before JSX props are applied.
    // Save the actual photo target after mounting so Photo view restores its framing.
    if (value) { value.update(); value.saveState(); }
  }, []);
  const [grid, setGrid] = useState(false);
  const [zoomLocked,setZoomLocked]=useState(false);
  const [backgroundHidden,setBackgroundHidden]=useState(false);
  const [exporting,setExporting]=useState(false),[exportError,setExportError]=useState("");
  const viewerApi=useRef<ViewerApi|null>(null),loading=useProgress(state=>state.active);
  const viewport=useRef<HTMLDivElement>(null);
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await viewport.current?.requestFullscreen();}catch{setExportError("Fullscreen is unavailable in this browser.");}}
  async function download(transparent:boolean){
    if(!viewerApi.current){setExportError("The viewer is still loading. Try again when the objects appear.");return;}
    setExporting(true);setExportError("");
    try{const blob=await viewerApi.current.capture(transparent),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`rescene-${transparent?"transparent":"scene"}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    catch{setExportError("Could not download the screenshot. Reload the viewer and try again.");}
    finally{setExporting(false);}
  }
  const floorY=Math.min(composition?.floorY ?? 0,...objects.filter(o=>o.visible&&!o.worldTransform).map(o=>o.positionY));
  const c = composition?.camera;
  const cameraOptions=useMemo(()=>({position:c?.position??manualStageCamera.position,fov:c?.fov??manualStageCamera.fov,near:.01,far:Math.max(500,c?new Vector3(...c.position).distanceTo(new Vector3(...c.target))*16:500)}),[c]);
  const lightingColor = composition?.environment.lightWarmth === "warm" ? "#fff0d8" : composition?.environment.lightWarmth === "cool" ? "#e1edff" : "#ffffff";
  const target = c?.target ?? manualStageCamera.target;
  return <div ref={viewport} className="model-viewport" style={{ "--scene-aspect": c?.aspect ?? 1.5 } as CSSProperties}>
    <Canvas onPointerMissed={event=>{if(event.type==="click")onSelect("");}} shadows={{type:PCFShadowMap}} camera={cameraOptions} dpr={[1, 1.5]}
      fallback={<p className="canvas-loading">WebGL is unavailable in this browser. You can still browse the scene details.</p>}>
      <ReferenceFraming reference={c}/>
      <color attach="background" args={[backgroundHidden?"#f4f3ee":composition?.background?.plainColor ?? composition?.environment.wallColor ?? "#edece5"]}/>
      <hemisphereLight args={["#fffaf0", composition?.environment.floorColor ?? "#b1a38d", lighting.ambient]}/>
      <directionalLight position={lighting.key.position} intensity={lighting.key.intensity} color={lighting.key.color ?? lightingColor} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-near={0.1} shadow-camera-far={100} shadow-bias={-0.0003} shadow-normalBias={0.02}/>
      <directionalLight position={lighting.fill.position} intensity={lighting.fill.intensity} color={lighting.fill.color ?? "#ffffff"}/>
      <Suspense fallback={null}>{composition && !backgroundHidden && <PhotoBackground composition={composition} url={appearance.backgroundUrl ?? null} legacyFloor={appearance.floorUrl} wallUrl={appearance.wallUrl} floorY={floorY} shadows={lighting.key.intensity>0}/>}</Suspense>
      <Suspense fallback={null}>{objects.filter(o => o.modelUrl).map(o => <Model key={o.id} object={o} selected={selected === o.id} select={() => onSelect(selected===o.id?"":o.id)}/>)}</Suspense>
      {(!composition || grid) && <Grid userData={{editorHelper:true}} position={[0, floorY + 0.005, 0]} args={[30, 30]} cellSize={0.5} sectionSize={2} fadeDistance={20} cellColor="#c5c6ba" sectionColor="#a8b1a1"/>}
      <ViewerCommands apiRef={viewerApi} controlsRef={controls}/>
      <OrbitControls ref={bindControls} makeDefault target={target} minDistance={0.3} enableZoom={!zoomLocked}
        maxDistance={Math.max(40, c ? new Vector3(...c.position).distanceTo(new Vector3(...c.target)) * 2 : 40)} maxPolarAngle={backgroundHidden||composition?.backdrop === "none" ? Math.PI-.01 : Math.PI / 2 - 0.01}/>
    </Canvas>
    <div className="viewer-toolbar" role="toolbar" aria-label="Viewer">
      <div className="viewer-tool-group">
        <button title={readOnly ? "Reset view" : composition ? "Back to photo view" : "Reset camera"} aria-label={readOnly ? "Reset view" : composition ? "Photo view" : "Reset camera"} onClick={() => controls.current?.reset()}><House size={15}/></button>
        {!readOnly&&<button disabled={!selected||!objects.some(o=>o.id===selected&&o.visible)||loading} title="Focus selected object" aria-label="Focus selected object" onClick={()=>viewerApi.current?.focus(selected,zoomLocked)}><Focus size={15}/></button>}
        {shopping&&<button title="Fullscreen" aria-label="Fullscreen" onClick={fullscreen}><Maximize size={15}/></button>}
      </div>
      <div className="viewer-tool-group">
        {composition && !readOnly && <button aria-pressed={grid} title={grid ? "Hide grid" : "Show grid"} aria-label="Grid" onClick={() => setGrid(value => !value)}><Grid3x3 size={15}/></button>}
        <button aria-pressed={zoomLocked} title={zoomLocked ? "Unlock zoom" : "Lock zoom (orbit and pan still work)"} aria-label="Zoom lock" onClick={()=>setZoomLocked(v=>!v)}>{zoomLocked?<Lock size={15}/>:<LockOpen size={15}/>}</button>
        <button aria-pressed={backgroundHidden} title="Hide background (preview only)" aria-label="Hide background" onClick={()=>setBackgroundHidden(v=>!v)}><ImageOff size={15}/></button>
      </div>
      <details className="viewer-export"><summary title="Download PNG" aria-label="Download"><Download size={15}/>{shopping&&<span className="viewer-download-label">PNG</span>}</summary><div className="viewer-export-options"><button disabled={loading||exporting} onClick={()=>download(false)}>{exporting?"Preparing…":"Scene PNG"}</button><button disabled={loading||exporting} onClick={()=>download(true)}>Transparent PNG</button><small>Current view, without helpers. Transparent omits background and shadows.</small></div></details>
    </div>
    {loading&&<div className="viewer-loading-status" role="status">Loading 3D assets…</div>}
    {exportError&&<p role="alert" className="viewer-export-error">{exportError}</p>}
    <span className="viewer-help">Drag to orbit · right-drag to pan · {zoomLocked?"zoom locked":"scroll to zoom"}</span>
  </div>;
}
