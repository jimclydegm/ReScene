import { describe, expect, it } from "vitest";
import { dashboardPage, dashboardProgress } from "../src/lib/scene/dashboard";

describe("dashboard paging", () => {
  it("bounds URL input and keeps empty libraries on page one", () => {
    for (const input of [undefined, "garbage", "-1", "0", "1.5", "9999999", ["2", "3"]]) expect(dashboardPage(input, 19)).toEqual({ page: 1, pages: 3, skip: 0 });
    expect(dashboardPage("2", 19)).toEqual({ page: 2, pages: 3, skip: 9 });
    expect(dashboardPage("999", 19)).toEqual({ page: 3, pages: 3, skip: 18 });
    expect(dashboardPage("2", 0)).toEqual({ page: 1, pages: 1, skip: 0 });
  });
});
describe("saved workflow progress", () => {
  const base = { status: "DRAFT", normalizedAssetId: null, hasMasks: false, run: null };
  it("does not show historical run completion after a restart", () => {
    const progress = dashboardProgress({ ...base, normalizedAssetId: "photo", run: { status: "SUCCEEDED", currentStage: "Your 3D scene is ready", progress: 100 } });
    expect(progress.completed).toBe(1); expect(progress.next).toBe("Next: find objects"); expect(progress.runProgress).toBeNull();
  });
  it("shows active run progress only within its generation phase", () => {
    const progress = dashboardProgress({ ...base, status: "RECONSTRUCTING", normalizedAssetId: "photo", hasMasks: true, run: { status: "WAITING", currentStage: "Reconstructing 3D objects", progress: 30 } });
    expect(progress.completed).toBe(2); expect(progress.runProgress).toBe(30); expect(progress.next).toBe("Reconstructing 3D objects");
  });
  it("keeps partial outlines inside the unfinished analysis stage", () => {
    const progress = dashboardProgress({ ...base, status: "ANALYZING", normalizedAssetId: "photo", hasMasks: true, run: { status: "RUNNING", currentStage: "Outlining chair", progress: 45 } });
    expect(progress.completed).toBe(1); expect(progress.runProgress).toBe(45);
  });
  it("preserves saved work while indicating an interrupted run", () => {
    const progress = dashboardProgress({ ...base, status: "FAILED", normalizedAssetId: "photo", hasMasks: true, run: { status: "FAILED", currentStage: "Reconstructing", progress: 30 } });
    expect(progress.attention).toBe(true); expect(progress.completed).toBe(2); expect(progress.runProgress).toBeNull();
  });
  it("marks a ready editor as three stages complete", () => {
    expect(dashboardProgress({ ...base, status: "READY", normalizedAssetId: "photo", hasMasks: true }).completed).toBe(3);
  });
});
