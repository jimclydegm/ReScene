"use client";
import {MaterialBackground} from "./material-background";
import { useMemo, useEffect } from "react";
import { useTexture } from "@react-three/drei";
import { ClampToEdgeWrapping, MirroredRepeatWrapping, SRGBColorSpace } from "three";
import { backgroundProjection, backgroundSurfaces } from "@/lib/scene/background";
import { createSurfaceMaterial } from "@/lib/scene/surface-material";
import type { SceneComposition } from "@/lib/scene/composition";

function SurfaceMaterial({ composition, color, url, tiled = false, shadows = true }: {
  composition: SceneComposition; color: string; url?: string | null; tiled?: boolean; shadows?: boolean;
}) {
  return url ? <TexturedSurface composition={composition} color={color} url={url} tiled={tiled} shadows={shadows}/> :
    <SolidSurface composition={composition} color={color} shadows={shadows}/>;
}
function SolidSurface({composition,color,shadows}:{composition:SceneComposition;color:string;shadows:boolean}) {
  const material=useMemo(()=>createSurfaceMaterial(backgroundProjection(composition.camera),color,"solid",shadows ? .2 : 0),[composition.camera,color,shadows]);
  useEffect(()=>()=>material.dispose(),[material]);
  return <primitive object={material} attach="material"/>;
}
function TexturedSurface({composition,color,url,tiled,shadows}:{composition:SceneComposition;color:string;url:string;tiled:boolean;shadows:boolean}) {
  const source=useTexture(url);
  const owned=useMemo(()=>{
    const texture=source.clone();texture.colorSpace=SRGBColorSpace;
    texture.wrapS=texture.wrapT=tiled?MirroredRepeatWrapping:ClampToEdgeWrapping;
    // Custom shader UVs apply the tile scale below.
    texture.needsUpdate=true;
    const material=createSurfaceMaterial(backgroundProjection(composition.camera),color,tiled?"tile":"photo",shadows ? .2 : 0);
    if(tiled)material.vertexShader=material.vertexShader.replace("surfaceUv = uv;","surfaceUv = uv * 60.0;");
    material.uniforms.photo.value=texture;
    return {texture,material};
  },[source,composition.camera,color,tiled,shadows]);
  useEffect(()=>()=>{owned.texture.dispose();owned.material.dispose();},[owned]);
  return <primitive object={owned.material} attach="material"/>;
}

export function PhotoBackground({composition,url,floorY,legacyFloor=null,wallUrl=null,shadows=true}:{composition:SceneComposition;url:string|null;floorY:number;legacyFloor?:string|null;wallUrl?:string|null;shadows?:boolean}){
  if(composition.backdrop==="none")return null;
  if(composition.background?.surfaceMode==="materials")return <MaterialBackground composition={composition} floorY={floorY} floorUrl={legacyFloor} wallUrl={wallUrl} shadows={shadows}/>;
  const geometry=backgroundSurfaces(composition,floorY),plain=composition.background?.plainColor;
  const ground=composition.backdrop==="studio"||geometry.ground;
  const {room:r,environment:e}=composition;
  return <group userData={{sceneBackground:true}}>
    {ground&&<mesh receiveShadow={shadows&&!plain} position={[r.centerX,floorY-.012,r.centerZ]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[geometry.extent*4,geometry.extent*4]}/>
      <SurfaceMaterial composition={composition} color={plain??e.floorColor} url={plain?null:url??legacyFloor} tiled={!url&&!!legacyFloor} shadows={shadows&&!plain}/>
    </mesh>}
    {composition.backdrop!=="studio"&&geometry.wall&&<mesh position={geometry.wall.position} rotation={[0,geometry.wall.yaw,0]}>
      <planeGeometry args={[geometry.wall.width*4,geometry.wall.height]}/>
      <SurfaceMaterial composition={composition} color={e.wallColor} url={url} shadows={false}/>
    </mesh>}
    {/* Distant scenery is separate from a support surface, never a second floor. */}
    {composition.backdrop!=="studio"&&geometry.plan.kind==="distant"&&url&&<mesh position={composition.camera.target} renderOrder={-10}>
      <sphereGeometry args={[geometry.extent*.8,48,24]}/><SurfaceMaterial composition={composition} color={e.wallColor} url={url} shadows={false}/>
    </mesh>}
  </group>;
}
