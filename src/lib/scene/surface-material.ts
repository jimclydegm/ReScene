import { Color, DoubleSide, Matrix4, ShaderLib, ShaderMaterial, UniformsUtils } from "three";

// Color and shadow are evaluated on the same opaque plane. There is no second
// almost-coplanar transparent receiver to fight with the surface depth buffer.
export function createSurfaceMaterial(projector: Matrix4, color: string, mode: "photo" | "tile" | "solid", shadowStrength = .2) {
  return new ShaderMaterial({
    name: "ReSceneSurface", lights: true, toneMapped: false, side: DoubleSide,
    uniforms: UniformsUtils.merge([ShaderLib.shadow.uniforms, {
      projector: { value: projector }, photo: { value: null }, baseColor: { value: new Color(color) },
      surfaceMode: { value: mode === "photo" ? 1 : mode === "tile" ? 2 : 0 }, shadowStrength: { value: shadowStrength }
    }]),
    vertexShader: ShaderLib.shadow.vertexShader.replace("void main()", "uniform mat4 projector; varying vec4 projected; varying vec2 surfaceUv;\nvoid main()")
      .replace("#include <project_vertex>", "#include <project_vertex>\nprojected = projector * modelMatrix * vec4(transformed,1.0); surfaceUv = uv;"),
    fragmentShader: ShaderLib.shadow.fragmentShader.replace("void main()", `
      uniform sampler2D photo; uniform vec3 baseColor; uniform float surfaceMode; uniform float shadowStrength;
      varying vec4 projected; varying vec2 surfaceUv;
      void main()`)
      .replace("gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );", `
        vec3 surface = baseColor;
        if(surfaceMode > 1.5) surface = texture2D(photo,surfaceUv).rgb;
        else if(surfaceMode > 0.5 && projected.w > 0.0){
          vec2 uv = projected.xy / projected.w * 0.5 + 0.5;
          // The photographed patch remains fixed in world space; outside it,
          // blend to the observed color without stretching a border pixel.
          float edge = smoothstep(0.0,0.04,min(min(uv.x,uv.y),min(1.0-uv.x,1.0-uv.y)));
          surface = mix(baseColor,texture2D(photo,clamp(uv,0.001,0.999)).rgb,edge);
        }
        gl_FragColor = vec4(surface * (1.0 - shadowStrength * (1.0-getShadowMask())),1.0);`)
  });
}
