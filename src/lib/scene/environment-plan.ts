import { z } from "zod";
const point = z
  .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
  .strict();
const polygon = z.array(point).min(3).max(12);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
// Private observations. Image coordinates refer to the unpadded source photo.
export const environmentObservationSchema = z
  .object({
    version: z.literal("environment-observation-v1"),
    topology: z.enum(["room", "open", "cyclorama", "distant"]),
    surfaces: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z0-9-]{1,32}$/),
            role: z.enum(["floor", "wall", "ceiling", "surface", "trim"]),
            polygon,
            finish: z.enum(["plain", "textured"]),
            color,
            roughness: z.number().min(0.2).max(1),
            material: z.string().min(1).max(180),
            appearance: z.enum(["uniform","microtexture","pattern"]).optional(),
            confidence: z.number().min(0).max(1),
          })
          .strict(),
      )
      .min(1)
      .max(16),
    openings: z
      .array(
        z
          .object({
            surfaceId: z.string().max(32),
            kind: z.enum(["window", "door", "opening"]),
            polygon,
          })
          .strict(),
      )
      .max(8),
    expectedWallCount: z.number().int().min(0).max(8),
    lightingEffects: z.array(z.string().max(160)).max(6),
    explanation: z.string().min(1).max(500),
  })
  .strict()
  .superRefine((p, c) => {
    const ids = new Set(p.surfaces.map((s) => s.id));
    if (
      ids.size !== p.surfaces.length ||
      p.openings.some((o) => !ids.has(o.surfaceId))
    )
      c.addIssue({ code: "custom", message: "Invalid surface references" });
  });
export type EnvironmentObservation = z.infer<
  typeof environmentObservationSchema
>;
// Model-only strict contract; old saved observations can omit appearance.
export const environmentModelObservationSchema=environmentObservationSchema.safeExtend({surfaces:z.array(environmentObservationSchema.shape.surfaces.element.required({appearance:true})).min(1).max(16)});
const v = z.tuple([
  z.number().finite().min(-1000).max(1000),
  z.number().finite().min(-1000).max(1000),
  z.number().finite().min(-1000).max(1000),
]);
// Public render contract: numeric geometry and material settings only. No photo,
// provider data, private prompts, swatches or internal identifiers enter snapshots.
export const environmentGeometrySchema = z
  .object({
    version: z.literal("reference-environment-v1"),
    surfaces: z
      .array(
        z
          .object({
            role: z.enum([
              "floor",
              "wall",
              "ceiling",
              "surface",
              "trim",
              "window",
              "opening",
            ]),
            vertices: z.array(v).min(3).max(160),
            tile: z.object({ origin: v, u: v, v: v }).strict().optional(),
            triangles: z
              .array(z.number().int().min(0).max(159))
              .min(3)
              .max(768),
            color,
            roughness: z.number().min(0.2).max(1),
      textured: z.boolean(),
      materialOnly: z.boolean().optional(),
      atlas:z.object({mode:z.enum(["tile","photo"]),rect:z.tuple([z.number().min(0).max(1),z.number().min(0).max(1),z.number().min(0).max(1),z.number().min(0).max(1)])}).strict().refine(a=>a.rect[2]>a.rect[0]&&a.rect[3]>a.rect[1]).optional(),
      materialIndex:z.number().int().min(0).max(15).optional(),
      relief:z.number().min(0).max(.05).optional(),
          })
          .strict()
          .superRefine((s, c) => {
            if (
              s.triangles.length % 3 ||
              s.triangles.some((i) => i >= s.vertices.length)
            )
              c.addIssue({
                code: "custom",
                message: "Invalid surface triangles",
              });
          }),
      )
      .min(1)
      .max(32),
  })
  .strict();
export type EnvironmentGeometry = z.infer<typeof environmentGeometrySchema>;
