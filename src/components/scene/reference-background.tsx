"use client";
import { useEffect, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
  type Texture,
} from "three";
import { backgroundProjection } from "@/lib/scene/background";
import type { SceneComposition } from "@/lib/scene/composition";
import type { EnvironmentGeometry } from "@/lib/scene/environment-plan";
type Surface = EnvironmentGeometry["surfaces"][number];
function Face({
  surface,
  composition,
  texture,
  shadows,
}: {
  surface: Surface;
  composition: SceneComposition;
  texture: Texture | null;
  shadows: boolean;
}) {
  const owned = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(surface.vertices.flat()), 3),
    );
    geometry.setIndex(surface.triangles);
    geometry.computeVertexNormals();
    const unlit = surface.role === "window" || surface.role === "opening",
      material = unlit
        ? new MeshBasicMaterial({ color: "white", side: DoubleSide })
        : new MeshStandardMaterial({
            color: surface.color,
            roughness: surface.roughness,
            metalness: 0,
          });
    if (surface.role === "trim") {
      material.polygonOffset = true;
      material.polygonOffsetFactor = -1;
      material.polygonOffsetUnits = -1;
    }
    if (surface.textured && texture) {
      material.color.set("white");
      const projector = backgroundProjection(composition.camera);
      material.onBeforeCompile = (shader) => {
        shader.uniforms.environmentPhoto = { value: texture };
        shader.uniforms.environmentProjector = { value: projector };
        const tile = surface.tile,
          a = tile ? new Vector3(...tile.u) : new Vector3(1, 0, 0),
          b = tile ? new Vector3(...tile.v) : new Vector3(0, 0, 1),
          aa = a.dot(a),
          bb = b.dot(b),
          ab = a.dot(b),
          det = Math.max(1e-9, aa * bb - ab * ab);
        shader.uniforms.environmentTileOrigin = {
          value: new Vector3(...(tile?.origin ?? [0, 0, 0])),
        };
        shader.uniforms.environmentTileU = { value: a };
        shader.uniforms.environmentTileV = { value: b };
        shader.uniforms.environmentDualU = {
          value: a
            .clone()
            .multiplyScalar(bb)
            .addScaledVector(b, -ab)
            .divideScalar(det),
        };
        shader.uniforms.environmentDualV = {
          value: b
            .clone()
            .multiplyScalar(aa)
            .addScaledVector(a, -ab)
            .divideScalar(det),
        };
        shader.uniforms.environmentHasTile = { value: tile ? 1 : 0 };
        shader.uniforms.environmentFallback = {
          value: material.color.clone().set(surface.color),
        };
        shader.vertexShader =
          "uniform mat4 environmentProjector; varying vec4 environmentProjected; varying vec3 environmentWorld;\n" +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nenvironmentWorld=(modelMatrix * vec4(transformed,1.0)).xyz; environmentProjected = environmentProjector * vec4(environmentWorld,1.0);",
        );
        shader.fragmentShader =
          "uniform sampler2D environmentPhoto; uniform mat4 environmentProjector; uniform vec3 environmentFallback; uniform vec3 environmentTileOrigin; uniform vec3 environmentTileU; uniform vec3 environmentTileV; uniform vec3 environmentDualU; uniform vec3 environmentDualV; uniform float environmentHasTile; varying vec4 environmentProjected; varying vec3 environmentWorld;\n" +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `vec3 backgroundColor=environmentFallback;
     if(environmentHasTile>.5){vec3 rel=environmentWorld-environmentTileOrigin;vec2 t=vec2(dot(rel,environmentDualU),dot(rel,environmentDualV));t=1.-abs(mod(t,2.)-1.);vec4 tp=environmentProjector*vec4(environmentTileOrigin+environmentTileU*t.x+environmentTileV*t.y,1.);backgroundColor=texture2D(environmentPhoto,clamp(tp.xy/tp.w*.5+.5,.001,.999)).rgb;}
     if(environmentProjected.w>0.0){vec2 p=environmentProjected.xy/environmentProjected.w*.5+.5;float edge=smoothstep(0.0,.10,min(min(p.x,p.y),min(1.-p.x,1.-p.y)));backgroundColor=mix(backgroundColor,texture2D(environmentPhoto,clamp(p,.001,.999)).rgb,edge);}
     diffuseColor.rgb *= backgroundColor;`,
        );
      };
      material.customProgramCacheKey = () =>
        `reference-environment-${unlit ? "window" : "surface"}`;
    }
    return { geometry, material };
  }, [surface, composition.camera, texture]);
  useEffect(
    () => () => {
      owned.geometry.dispose();
      owned.material.dispose();
    },
    [owned],
  );
  return (
    <mesh
      geometry={owned.geometry}
      material={owned.material}
      receiveShadow={
        shadows && surface.role !== "window" && surface.role !== "opening"
      }
      userData={{ sceneBackground: true }}
    />
  );
}
function Faces({
  composition,
  texture,
  shadows,
}: {
  composition: SceneComposition;
  texture: Texture | null;
  shadows: boolean;
}) {
  return (
    <group userData={{ sceneBackground: true }}>
      {composition
        .background!.geometry!.surfaces.filter(
          (s) =>
            composition.backdrop !== "studio" ||
            s.role === "floor" ||
            s.role === "surface",
        )
        .map((s, i) => (
          <Face
            key={i}
            surface={s}
            composition={composition}
            texture={texture}
            shadows={shadows}
          />
        ))}
    </group>
  );
}
function Textured({
  composition,
  url,
  shadows,
}: {
  composition: SceneComposition;
  url: string;
  shadows: boolean;
}) {
  const source = useTexture(url),
    texture = useMemo(() => {
      const t = source.clone();
      t.colorSpace = SRGBColorSpace;
      t.wrapS = t.wrapT = ClampToEdgeWrapping;
      t.anisotropy = 8;
      t.needsUpdate = true;
      return t;
    }, [source]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <Faces composition={composition} texture={texture} shadows={shadows} />
  );
}
export function ReferenceBackground({
  composition,
  url,
  shadows,
}: {
  composition: SceneComposition;
  url: string | null;
  shadows: boolean;
}) {
  return url ? (
    <Textured composition={composition} url={url} shadows={shadows} />
  ) : (
    <Faces composition={composition} texture={null} shadows={shadows} />
  );
}
