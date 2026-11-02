import data from "./photography.json";
import examples from "./example-media.json";
import { demoScenes } from "./scenes";
import { demoImage } from "./catalog";
export type AlbumImage = {
  id: string;
  title: string;
  path: string;
  kind: "photo" | "generated";
  color: number | null;
  setting: string;
  sha256?: string;
  width?: number;
  height?: number;
  model?: string;
  referencePath?: string;
  referenceSha256?: string;
  prompt?: string;
};
export function productAlbum(id: string): AlbumImage[] {
  const scene = demoScenes.find((s) => s.objects.some((o) => o.id === id));
  const order = ["studio", "profile", "finish", "blue", "lifestyle"];
  const generated = [
    ...((data.products as Record<string, AlbumImage[]>)[id] ?? []),
    ...((examples.products as Record<string, AlbumImage[]>)[id] ?? []),
  ].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return [
    ...generated,
    ...(Object.hasOwn(examples.products, id)
      ? []
      : [
          {
            id: "source",
            title: "Original reference photo",
            path: demoImage(id),
            kind: "photo",
            color: 0,
            setting: "reference",
          } as AlbumImage,
        ]),
    ...(scene
      ? [
          {
            id: "reference-scene",
            title: "Original reference scene",
            path: demoImage(scene.id),
            kind: "photo" as const,
            color: 0,
            setting: "reference",
          },
        ]
      : []),
  ];
}
export function sceneAlbum(id: string): AlbumImage[] {
  const example = (examples.scenes as Record<string, AlbumImage[]>)[id];
  if (example) return example;
  return [
    {
      id: "reference",
      title: "Reference photograph",
      path: demoImage(id),
      kind: "photo",
      color: null,
      setting: "reference",
    },
    ...((data.scenes as Record<string, AlbumImage[]>)[id] ?? []),
  ];
}
export function productCover(id: string) {
  return (
    (data.products as Record<string, AlbumImage[]>)[id]?.find(
      (i) => i.id === "studio",
    )?.path ??
    (examples.products as Record<string, AlbumImage[]>)[id]?.[0]?.path ??
    demoImage(id)
  );
}
