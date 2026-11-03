import { describe, it, expect } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { productCamera } from "../src/lib/demo/product-camera";

describe("Product inspection framing", () => {
  it("fills the frame while retaining all corners of tall, wide and deep products", () => {
    for (const size of [
      [1, 2, 1],
      [4, 1, 1],
      [1, 1, 3],
      [0.12, 0.2, 0.12],
    ])
      for (const aspect of [0.8, 1.12, 1.6]) {
        const fit = productCamera(size, aspect),
          camera = new PerspectiveCamera(fit.fov, aspect, 0.001, 100);
        camera.position.fromArray(fit.position);
        camera.lookAt(new Vector3(...fit.target));
        camera.updateMatrixWorld();
        let extent = 0;
        for (const x of [-size[0] / 2, size[0] / 2])
          for (const y of [0, size[1]])
            for (const z of [-size[2] / 2, size[2] / 2]) {
              const p = new Vector3(x, y, z).project(camera);
              expect(Math.abs(p.x)).toBeLessThanOrEqual(0.821);
              expect(Math.abs(p.y)).toBeLessThanOrEqual(0.821);
              expect(p.z).toBeLessThan(1);
              extent = Math.max(extent, Math.abs(p.x), Math.abs(p.y));
            }
        expect(extent).toBeGreaterThan(0.819);
      }
  });
  it("rejects missing, empty and non-finite bounds", () => {
    for (const size of [
      [0, 1, 1],
      [1, Number.NaN, 1],
      [1, 1],
    ])
      expect(() => productCamera(size)).toThrow();
  });
});
