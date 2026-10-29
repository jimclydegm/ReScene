import { describe, expect, it } from "vitest";
import { productSchema } from "../src/lib/validation/products";
import { objectEditsSchema } from "../src/lib/validation/generation";
const product = { name: "Walnut cabinet", description: "Merchant supplied description", brand: "Example", price: "129.95", currency: "USD", productUrl: "https://example.com/product" };
describe("merchant product validation", () => {
  it("preserves exact decimal amounts and optional fields", () => {
    expect(productSchema.parse(product).price).toBe("129.95");
    expect(productSchema.parse({ ...product, price: null, productUrl: "", brand: "" }).price).toBeNull();
    expect(productSchema.parse({ ...product, price: "0" }).price).toBe("0");
  });
  it("rejects scripts, non-HTTPS links and credential-bearing URLs", () => {
    for (const productUrl of ["javascript:alert(1)", "data:text/html,test", "http://example.com", "https://user:password@example.com"]) expect(productSchema.safeParse({ ...product, productUrl }).success).toBe(false);
  });
  it("rejects unbounded, fractional, negative or unsupported money values", () => {
    for (const price of ["-1", "1.234", "1e5", "NaN", "1000000000", ""]) expect(productSchema.safeParse({ ...product, price }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, currency: "BAD" }).success).toBe(false);
  });
  it("does not accept asset or product bindings supplied by the client", () => {
    expect(productSchema.safeParse({ ...product, imageAssetId: crypto.randomUUID() }).success).toBe(false);
    expect(productSchema.safeParse({ ...product, id: crypto.randomUUID() }).success).toBe(false);
  });
  it("keeps product edits in the atomic object save contract", () => {
    const edit = { id: crypto.randomUUID(), label: "Cabinet", positionX: 0, positionY: 0, positionZ: 0, yaw: 0, scale: 1, visible: true, product };
    expect(objectEditsSchema.safeParse({ expectedRevision: 1, objects: [edit] }).success).toBe(true);
    expect(objectEditsSchema.safeParse({ expectedRevision: 1, objects: [{ ...edit, product: null }] }).success).toBe(true);
  });
});
