import { describe, it, expect } from "vitest";
import { normalizeHexColor, PRESET_COLORS } from "../src/lib/ui/color";

describe("color helpers", () => {
  it("normalizes valid hex input", () => {
    expect(normalizeHexColor("#A1B2C3")).toBe("#a1b2c3");
    expect(normalizeHexColor("a1b2c3")).toBe("#a1b2c3");
    expect(normalizeHexColor("#abc")).toBe("#aabbcc");
    expect(normalizeHexColor(" #123456 ")).toBe("#123456");
  });
  it("rejects invalid input", () => {
    expect(normalizeHexColor("")).toBeNull();
    expect(normalizeHexColor("#12")).toBeNull();
    expect(normalizeHexColor("red")).toBeNull();
    expect(normalizeHexColor("#gg0000")).toBeNull();
    expect(normalizeHexColor("#1234567")).toBeNull();
  });
  it("ships curated presets that are all valid colors", () => {
    expect(PRESET_COLORS.length).toBeGreaterThanOrEqual(6);
    for (const c of PRESET_COLORS) expect(normalizeHexColor(c)).toBeTruthy();
  });
});
