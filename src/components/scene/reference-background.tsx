"use client";
import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  Vector4,
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
      if(!surface.relief)material.color.set("white");
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
        shader.uniforms.environmentMaterialOnly = { value: surface.materialOnly&&surface.role!=="wall" ? 1 : 0 };
        shader.uniforms.environmentAtlas={value:surface.atlas?surface.atlas.mode==="tile"?1:2:0};
        shader.uniforms.environmentAtlasRect={value:new Vector4(...(surface.atlas?.rect??[0,0,1,1]))};
        shader.uniforms.environmentOpening={value:unlit?1:0};
        shader.uniforms.environmentRelief={value:surface.relief??0};
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
          "uniform sampler2D environmentPhoto; uniform mat4 environmentProjector; uniform vec3 environmentFallback; uniform vec3 environmentTileOrigin; uniform vec3 environmentTileU; uniform vec3 environmentTileV; uniform vec3 environmentDualU; uniform vec3 environmentDualV; uniform float environmentHasTile; uniform float environmentMaterialOnly; uniform float environmentAtlas; uniform vec4 environmentAtlasRect; uniform float environmentOpening; uniform float environmentRelief; varying vec4 environmentProjected; varying vec3 environmentWorld;\n" +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `vec3 backgroundColor=environmentFallback;
     if(environmentHasTile>.5){vec3 rel=environmentWorld-environmentTileOrigin;vec2 t=vec2(dot(rel,environmentDualU),dot(rel,environmentDualV));t=1.-abs(mod(t,2.)-1.);vec4 tp=environmentProjector*vec4(environmentTileOrigin+environmentTileU*t.x+environmentTileV*t.y,1.);backgroundColor=texture2D(environmentPhoto,clamp(tp.xy/tp.w*.5+.5,.001,.999)).rgb;}
     if(environmentMaterialOnly<.5&&environmentProjected.w>0.0){vec2 p=environmentProjected.xy/environmentProjected.w*.5+.5;float edge=smoothstep(0.0,.10,min(min(p.x,p.y),min(1.-p.x,1.-p.y)));backgroundColor=mix(backgroundColor,texture2D(environmentPhoto,clamp(p,.001,.999)).rgb,edge);}
     if(environmentOpening>.5&&environmentAtlas<.5){vec2 p=environmentProjected.xy/environmentProjected.w*.5+.5;backgroundColor=texture2D(environmentPhoto,clamp(p,.0001,.9999)).rgb;}
     if(environmentAtlas>.5){vec2 raw;vec2 p;if(environmentAtlas<1.5){vec3 rel=environmentWorld-environmentTileOrigin;raw=vec2(dot(rel,environmentDualU),dot(rel,environmentDualV));p=fract(raw);p.y=1.-p.y;raw.y=-raw.y;}else{raw=environmentProjected.xy/environmentProjected.w*.5+.5;p=clamp(raw,0.,1.);}vec2 span=environmentAtlasRect.zw-environmentAtlasRect.xy;backgroundColor=texture2DGradEXT(environmentPhoto,mix(environmentAtlasRect.xy,environmentAtlasRect.zw,p),dFdx(raw)*span,dFdy(raw)*span).rgb;}
     float environmentHeight=dot(backgroundColor,vec3(.2126,.7152,.0722))*environmentRelief;
     if(environmentRelief<=0.)diffuseColor.rgb *= backgroundColor;`,
        );
        if(surface.relief)shader.fragmentShader=shader.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
          vec3 surfaceDx=dFdx(-vViewPosition),surfaceDy=dFdy(-vViewPosition);
          vec3 reliefX=cross(surfaceDy,normal),reliefY=cross(normal,surfaceDx);
          float reliefDet=dot(surfaceDx,reliefX)*faceDirection;
          vec3 reliefGradient=sign(reliefDet)*(dFdx(environmentHeight)*reliefX+dFdy(environmentHeight)*reliefY);
          normal=normalize(max(abs(reliefDet),1e-10)*normal-reliefGradient);`);
      };
      material.customProgramCacheKey = () =>
        `reference-environment-v4-${unlit ? "window" : surface.relief ? "relief" : "surface"}`;
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
  // Load imperatively instead of suspending: a failed signed texture must
  // never throw during render (that crashes the viewer / triggers the dev
  // overlay). While loading or after a failure, faces render untextured.
  const [state, setState] = useState<{
    url: string;
    texture: Texture | null;
    failed: boolean;
  }>({ url: "", texture: null, failed: false });
  useEffect(() => {
    let alive = true;
    void new TextureLoader()
      .loadAsync(url)
      .then((loaded) => {
        if (!alive) {
          loaded.dispose();
          return;
        }
        loaded.colorSpace = SRGBColorSpace;
        loaded.wrapS = loaded.wrapT = ClampToEdgeWrapping;
        loaded.anisotropy = 8;
        setState({ url, texture: loaded, failed: false });
      })
      .catch(() => {
        if (alive) setState({ url, texture: null, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [url]);
  const texture = state.url === url ? state.texture : null;
  const failed = state.url === url ? state.failed : false;
  useEffect(() => () => state.texture?.dispose(), [state.texture]);
  return (
    <Faces
      composition={composition}
      texture={failed ? null : texture}
      shadows={shadows}
    />
  );
}
/**
 * A background texture must never take down the viewer. Signed texture URLs
 * can fail in the browser (expired link, CORS-blocked origin, transient
 * network) while the rest of the scene is fine, so a texture failure falls
 * back to untextured reference materials. A fresh URL resets the boundary.
 */
export class TextureErrorBoundary extends Component<
  { resetKey: string; fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
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
  if (!url) {
    return (
      <Faces composition={composition} texture={null} shadows={shadows} />
    );
  }
  return (
    <TextureErrorBoundary
      resetKey={url}
      fallback={
        <Faces composition={composition} texture={null} shadows={shadows} />
      }
    >
      <Textured composition={composition} url={url} shadows={shadows} />
    </TextureErrorBoundary>
  );
}
