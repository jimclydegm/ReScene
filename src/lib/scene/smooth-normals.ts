import type {BufferGeometry} from "three";
import {toCreasedNormals} from "three/examples/jsm/utils/BufferGeometryUtils.js";
/** Missing glTF normals mean flat shading. Preserve UV splits, silhouettes and
 * real sharp edges; only interpolate normals across angles below 60 degrees. */
export function completeSurfaceNormals(source:BufferGeometry){
 if(source.hasAttribute("normal")||!source.hasAttribute("position"))return source;
 const result=toCreasedNormals(source.index?source:source.clone(),Math.PI/3);
 result.deleteAttribute("tangent");
 return result;
}
