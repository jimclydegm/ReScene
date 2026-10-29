import { describe, expect, it } from "vitest";
import { createSceneSchema, reserveUploadSchema, updateSceneSchema } from "@/lib/validation/scenes";

describe("private scene API input boundaries", () => {
  it("never accepts a caller-supplied owner", () => {
    expect(createSceneSchema.safeParse({ title: "Living room", ownerId: "someone-else" }).success).toBe(false);
  });

  it("requires a save revision and actual changed values", () => {
    expect(updateSceneSchema.safeParse({ title: "Updated" }).success).toBe(false);
    expect(updateSceneSchema.safeParse({ expectedRevision: 2 }).success).toBe(false);
    expect(updateSceneSchema.parse({ expectedRevision: 2, title: " Updated " })).toEqual({ expectedRevision: 2, title: "Updated" });
  });

  it("rejects executable uploads and oversized image declarations", () => {
    expect(reserveUploadSchema.safeParse({ contentType: "image/svg+xml", byteSize: 100, expectedRevision: 0 }).success).toBe(false);
    expect(reserveUploadSchema.safeParse({ contentType: "image/jpeg", byteSize: 13 * 1024 * 1024, expectedRevision: 0 }).success).toBe(false);
  });
});
