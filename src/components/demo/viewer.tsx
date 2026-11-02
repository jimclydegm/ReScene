"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, type ReactNode, useMemo } from "react";
import { ReferenceFrame } from "./reference-frame";
import { LoaderCircle } from "lucide-react";
import { demoImage } from "@/lib/demo/catalog";
import { resolvedDemoObject, type DemoScene } from "@/lib/demo/scenes";
import { demoRoomAppearance } from "@/lib/demo/room-appearance";
import type { Arrangement } from "@/lib/demo/state";
import { lightingPresets } from "@/lib/scene/lighting";
import { demoRenderObjects } from "@/lib/demo/render-objects";
const ModelCanvas = dynamic(() => import("@/components/scene/model-canvas"), {
  ssr: false,
  loading: () => (
    <div className="demo-viewer-loading">
      <LoaderCircle size={24} className="demo-spin" />
      Preparing your 3D view…
    </div>
  ),
});
class ViewerBoundary extends Component<
  { children: ReactNode; image: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="demo-viewer-fallback">
        <Image
          src={this.props.image}
          alt="Product photo; 3D view is unavailable"
          fill
          sizes="80vw"
        />
        <div>
          <p>The 3D view could not load. You can still browse and shop.</p>
          <button className="d-button" onClick={() => window.location.reload()}>
            Reload 3D view
          </button>
        </div>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function DemoViewer({
  scene,
  draft,
  selected,
  onSelect,
  individual,
  isolated,
}: {
  scene: DemoScene;
  draft: Arrangement;
  selected: string;
  onSelect: (id: string) => void;
  individual?: string;
  isolated?: string | null;
}) {
  const objects = demoRenderObjects(scene, draft, { individual, isolated });
  const room = useMemo(
    () => demoRoomAppearance(scene, draft),
    [scene, draft],
  );
  const inspected = individual
      ? resolvedDemoObject(scene, draft, individual)
      : null,
    extent = inspected ? Math.max(...inspected.placement.size) : 0,
    height = inspected?.placement.size[1] ?? 0;
  const composition = useMemo(() => {
    if (!individual) return room.composition;

    return {
      ...scene.composition,
      floorY: 0,
      backdrop: "studio" as const,
      background: {
        kind: "seamless" as const,
        groundVisible: true,
        boundary: null,
        description: "Neutral product stage",
        plainColor: "#f1efe8",
      },
      environment: {
        ...scene.composition.environment,
        floorColor: "#e7e3db",
        wallColor: "#f1efe8",
        lightWarmth: "neutral" as const,
      },
      camera: {
        position: [extent * 0.9, height * 0.75, extent * 2.3] as [
          number,
          number,
          number,
        ],
        target: [0, height * 0.48, 0] as [number, number, number],
        fov: 38,
        aspect: 1.12,
      },
    };
  }, [scene, individual, extent, height, room.composition]);
  const appearance = individual
    ? { applied: false, floorUrl: null, wallUrl: null, backgroundUrl: null }
    : room.appearance;
  const canvas = (
    <ViewerBoundary
      key={`${individual ?? scene.id}:${individual ? inspected?.productId : "room"}`}
      image={
        individual
          ? demoImage(resolvedDemoObject(scene, draft, individual).productId)
          : demoImage(scene.id)
      }
    >
      <ModelCanvas
        shopping
        objects={objects}
        selected={selected}
        onSelect={onSelect}
        composition={composition}
        appearance={appearance}
        lighting={
          draft.lighting === "Original"
            ? scene.lighting
            : lightingPresets[draft.lighting]
        }
      />
    </ViewerBoundary>
  );
  return individual ? (
    canvas
  ) : (
    <ReferenceFrame aspect={scene.composition.camera.aspect}>
      {canvas}
    </ReferenceFrame>
  );
}
