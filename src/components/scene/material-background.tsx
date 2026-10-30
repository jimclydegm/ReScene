"use client";
import {useEffect,useMemo} from "react";
import {useTexture} from "@react-three/drei";
import {DoubleSide,MirroredRepeatWrapping,SRGBColorSpace} from "three";
import {materialSurfaceGeometry,materialSettings,sweepGeometry} from "@/lib/scene/material-background";
import type {SceneComposition} from "@/lib/scene/composition";
function Tile({url,roughness}:{url:string;roughness:number}){
 const source=useTexture(url),texture=useMemo(()=>{const t=source.clone();t.colorSpace=SRGBColorSpace;t.wrapS=t.wrapT=MirroredRepeatWrapping;t.needsUpdate=true;return t;},[source]);
 useEffect(()=>()=>texture.dispose(),[texture]);return <meshStandardMaterial map={texture} color="white" roughness={roughness} metalness={0} side={DoubleSide}/>;
}
function Finish({url,color,roughness}:{url:string|null;color:string;roughness:number}){return url?<Tile url={url} roughness={roughness}/>:<meshStandardMaterial color={color} roughness={roughness} metalness={0} side={DoubleSide}/>;}
export function MaterialBackground({composition,floorY,floorUrl,wallUrl,shadows}:{composition:SceneComposition;floorY:number;floorUrl:string|null;wallUrl:string|null;shadows:boolean}){
 const layout=useMemo(()=>materialSurfaceGeometry(composition,floorY),[composition,floorY]),plan=composition.background!,g=materialSettings(plan,"ground",composition.environment.floorColor),w=materialSettings(plan,"wall",composition.environment.wallColor);
 const floor=useMemo(()=>{const geometry=sweepGeometry(layout.extent*4,layout.radius,layout.extent);const uv=geometry.getAttribute("uv");for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*layout.extent*4/g.tileSize,uv.getY(i)/g.tileSize);return geometry;},[layout,g.tileSize]);
 useEffect(()=>()=>floor.dispose(),[floor]);
 return <group userData={{sceneBackground:true}}>
 {(plan.groundVisible||composition.backdrop==="studio")&&<mesh receiveShadow={shadows} position={[composition.room.centerX,floorY,composition.room.centerZ]} rotation={[-Math.PI/2,0,0]}>
 <planeGeometry args={[layout.extent*4,layout.extent*4]}/><WorldFinish url={floorUrl} {...g} extent={layout.extent*4}/>
 </mesh>}
 {composition.backdrop!=="studio"&&layout.walls.map((wall,i)=><mesh key={i} receiveShadow={shadows} position={wall.position} rotation={[0,wall.yaw,0]}><planeGeometry args={[wall.width,wall.height]}/><WorldFinish url={wallUrl} {...w} extent={wall.width} height={wall.height}/></mesh>)}
 {composition.backdrop!=="studio"&&layout.curve&&<mesh receiveShadow={shadows} geometry={floor} position={layout.rear} rotation={[0,layout.yaw,0]}><Finish url={floorUrl??wallUrl} {...g}/></mesh>}
 </group>;
}
function WorldFinish({url,color,roughness,tileSize,extent,height=extent}:{url:string|null;color:string;roughness:number;tileSize:number;extent:number;height?:number}){
 return url?<RepeatedTile url={url} roughness={roughness} repeats={[extent/tileSize,height/tileSize]}/>:<Finish url={null} color={color} roughness={roughness}/>;
}
function RepeatedTile({url,roughness,repeats}:{url:string;roughness:number;repeats:[number,number]}){
 const source=useTexture(url),[x,y]=repeats,texture=useMemo(()=>{const t=source.clone();t.colorSpace=SRGBColorSpace;t.wrapS=t.wrapT=MirroredRepeatWrapping;t.repeat.set(x,y);t.needsUpdate=true;return t;},[source,x,y]);
 useEffect(()=>()=>texture.dispose(),[texture]);return <meshStandardMaterial map={texture} color="white" roughness={roughness} metalness={0} side={DoubleSide}/>;
}
