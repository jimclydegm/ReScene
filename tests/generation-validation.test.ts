import { describe, expect, it } from "vitest";
import { runInputSchema, objectEditsSchema } from "../src/lib/validation/generation";
const id = "3ee61171-5730-4c80-8dc2-274eebd26576";
describe("Generation requests", () => {
  it("requires distinct reviewed object IDs for reconstruction", () => {
    const base = { kind: "RECONSTRUCT", expectedRevision: 1, idempotencyKey: id };
    expect(runInputSchema.safeParse(base).success).toBe(false);
    expect(runInputSchema.safeParse({ ...base, objectIds: [id, id] }).success).toBe(false);
    expect(runInputSchema.safeParse({ ...base, objectIds: [id] }).success).toBe(true);
  });
  it("bounds finite transforms and rejects duplicate saved objects", () => {
    const object = { id, label: "Chair", positionX: 0, positionY: 0, positionZ: 0, yaw: 0, scale: 1, visible: true };
    expect(objectEditsSchema.safeParse({ expectedRevision: 1, objects: [object] }).success).toBe(true);
    expect(objectEditsSchema.safeParse({ expectedRevision: 1, objects: [object, object] }).success).toBe(false);
    expect(objectEditsSchema.safeParse({ expectedRevision: 1, objects: [{ ...object, scale: 0 }] }).success).toBe(false);
    expect(objectEditsSchema.safeParse({ expectedRevision: 1, objects: [{ ...object, positionX: Infinity }] }).success).toBe(false);
  });
});
