import { describe, it, expect } from "vitest";
import {
  emptyReplacementHistory,
  recordReplacement,
  undoReplacement,
  redoReplacement,
} from "../src/lib/editor/replacement-history";

describe("replacement undo/redo", () => {
  it("undoes a replace back to the original object", () => {
    const h = recordReplacement(emptyReplacementHistory(), {
      objectId: "o1",
      from: { productId: null },
      to: { productId: "p1" },
    });
    const result = undoReplacement(h);
    expect(result.inverse).toEqual({ objectId: "o1", productId: null });
    expect(result.history.past).toHaveLength(0);
    expect(result.history.future).toHaveLength(1);
  });
  it("redoes a replace after undo", () => {
    let h = recordReplacement(emptyReplacementHistory(), {
      objectId: "o1",
      from: { productId: null },
      to: { productId: "p1" },
    });
    h = undoReplacement(h).history;
    const result = redoReplacement(h);
    expect(result.inverse).toEqual({ objectId: "o1", productId: "p1" });
    expect(result.history.future).toHaveLength(0);
    expect(result.history.past).toHaveLength(1);
  });
  it("undoes a restore back to the replaced product", () => {
    const h = recordReplacement(emptyReplacementHistory(), {
      objectId: "o1",
      from: { productId: "p1" },
      to: { productId: null },
    });
    const result = undoReplacement(h);
    expect(result.inverse).toEqual({ objectId: "o1", productId: "p1" });
  });
  it("is a no-op without history", () => {
    const h = emptyReplacementHistory();
    const result = undoReplacement(h);
    expect(result.inverse).toBeNull();
    expect(result.history).toBe(h);
  });
});
