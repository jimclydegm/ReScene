"use client";
import { useMemo, useEffect } from "react";
import { useTexture } from "@react-three/drei";
import { BackSide, ClampToEdgeWrapping, Color, DoubleSide, MirroredRepeatWrapping, ShaderMaterial, SRGBColorSpace } from "three";
import { backgroundProjection, backgroundSurfaces } from "@/lib/scene/background";
import type { SceneComposition } from "@/lib/scene/composition";

function ProjectedMaterial({url,composition,color}:{url:string;composition:SceneComposition;color?:string}) {
  const source=useTexture(url);
  const material=useMemo(()=>{
    const texture=source.clone();texture.colorSpace=SRGBColorSpace;texture.wrapS=texture.wrapT=ClampToEdgeWrapping;texture.needsUpdate=true;
    const shader=new ShaderMaterial({toneMapped:false,side:DoubleSide,uniforms:{photo:{value:texture},projector:{value:backgroundProjection(composition.camera)},fallback:{value:new Color(color??composition.environment.wallColor)}},
      vertexShader:`varying vec4 projected; uniform mat4 projector; void main(){ vec4 world=modelMatrix*vec4(position,1.0); projected=projector*world; gl_Position=projectionMatrix*viewMatrix*world; }`,
      fragmentShader:`
        uniform sampler2D photo;
        uniform vec3 fallback;
        varying vec4 projected;
        void main(){
          vec2 uv=projected.xy/max(projected.w,0.0001)*0.5+0.5;
          vec3 sampled=texture2D(photo,clamp(uv,0.001,0.999)).rgb;
          float visible=step(0.001,projected.w);
          float edge=smoothstep(-0.18,0.0,min(min(uv.x,uv.y),min(1.0-uv.x,1.0-uv.y)));
          gl_FragColor=vec4(mix(fallback,sampled,visible*edge),1.0);
          #include <colorspace_fragment>
        }`});
    return {shader,texture};
  },[source,composition,color]);
  useEffect(()=>()=>{material.shader.dispose();material.texture.dispose();},[material]);
  return <primitive object={material.shader} attach="material"/>;
}

function LegacySurface({url,color}:{url:string|null;color:string}){
  return url?<LegacyTexture url={url}/>:<meshBasicMaterial color={color} side={DoubleSide}/>;
}
function LegacyTexture({url}:{url:string}){
  const source=useTexture(url);
  const map=useMemo(()=>{const t=source.clone();t.colorSpace=SRGBColorSpace;t.wrapS=t.wrapT=MirroredRepeatWrapping;t.repeat.set(60,60);t.needsUpdate=true;return t;},[source]);
  useEffect(()=>()=>map.dispose(),[map]);
  return <meshBasicMaterial map={map} side={DoubleSide}/>;
}

export function PhotoBackground({composition,url,floorY,legacyFloor=null}:{composition:SceneComposition;url:string|null;floorY:number;legacyFloor?:string|null}){
  const plain=composition.background?.plainColor;
  if(plain)return composition.backdrop==="none"?null:<mesh position={[composition.room.centerX,floorY-.012,composition.room.centerZ]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[2000,2000]}/><meshBasicMaterial color={plain} side={DoubleSide} toneMapped={false}/></mesh>;
  const geometry=backgroundSurfaces(composition,floorY);
  if(composition.backdrop==="none")return null;
  const {room:r,environment:e}=composition;
  const ground=composition.backdrop==="studio"||geometry.ground;
  return <group>
    {/* A distant shell covers the photograph's observed context without adding
        a room box. It remains an estimated extension when the camera orbits. */}
    {composition.backdrop!=="studio"&&url&&<mesh position={composition.camera.target} renderOrder={-10}>
      <sphereGeometry args={[geometry.extent*.8,48,24]}/><ProjectedMaterial url={url} composition={composition}/>
    </mesh>}
    {ground&&<><mesh position={[r.centerX,floorY-.012,r.centerZ]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[geometry.extent*4,geometry.extent*4]}/>{url?<ProjectedMaterial url={url} composition={composition} color={e.floorColor}/>:<LegacySurface url={legacyFloor} color={e.floorColor}/>}
    </mesh><mesh receiveShadow position={[r.centerX,floorY-.01,r.centerZ]} rotation={[-Math.PI/2,0,0]}><planeGeometry args={[geometry.extent*4,geometry.extent*4]}/><shadowMaterial transparent opacity={.2} depthWrite={false}/></mesh></>}
    {composition.backdrop!=="studio"&&geometry.wall&&<mesh position={geometry.wall.position} rotation={[0,geometry.wall.yaw,0]}>
      <planeGeometry args={[geometry.wall.width*4,geometry.wall.height]}/>{url?<ProjectedMaterial url={url} composition={composition}/>:<meshBasicMaterial color={e.wallColor} side={DoubleSide}/>}
    </mesh>}
    {!url&&!ground&&<mesh position={composition.camera.target}><sphereGeometry args={[geometry.extent*.8,32,16]}/><meshBasicMaterial color={e.wallColor} side={BackSide}/></mesh>}
  </group>;
}
