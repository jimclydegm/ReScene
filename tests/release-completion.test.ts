import {spawnSync} from "node:child_process";
import {describe,it,expect} from "vitest";
import {dashboardQuery} from "../src/lib/scene/dashboard";
import {requiresBuild,requiresCheck} from "../scripts/vercel-ignore-build.mjs";
describe("release dashboard query bounds",()=>{
 it("normalizes search and drops unsupported or repeated filters",()=>{expect(dashboardQuery({q:"  chair  ",filter:"PUBLISHED"})).toEqual({q:"chair",archived:false,filter:"PUBLISHED"});expect(dashboardQuery({q:["a","b"],filter:"INJECT",view:["archived"]})).toEqual({q:"",archived:false,filter:"ALL"});expect(dashboardQuery({q:"x".repeat(500),view:"archived",filter:"READY"})).toEqual({q:"x".repeat(100),archived:true,filter:"ALL"});});
});
describe("deployment build decision",()=>{
 it("skips non-runtime-only changes",()=>{expect(requiresBuild(["docs/PLAN.md","README.md","tests/products.test.ts","scripts/smoke-release.mjs",".github/workflows/ci.yml"])).toBe(false);});
 it("keeps required CI green for docs-only changes without reinstalling, but checks tests/tooling/app changes",()=>{expect(requiresCheck(["docs/PLAN.md","README.md"])).toBe(false);for(const path of ["tests/products.test.ts","scripts/ci-scope.mjs",".github/workflows/ci.yml","src/app/page.tsx"])expect(requiresCheck(["docs/PLAN.md",path])).toBe(true);expect(requiresCheck([])).toBe(true);});
 it("builds rather than skipping when deployment history is unknown",()=>{const result=spawnSync(process.execPath,["scripts/vercel-ignore-build.mjs"],{encoding:"utf8",env:{...process.env,VERCEL_GIT_PREVIOUS_SHA:""}});expect(result.status).toBe(1);expect(result.stdout).toContain("Git comparison unavailable: build.");});
 it("always builds app, schema, dependencies, config and unknown comparisons",()=>{for(const path of ["src/app/page.tsx","prisma/schema.prisma","package-lock.json","next.config.ts","vercel.json","contracts/scene-manifest-v2.schema.json","public/icon.svg","scripts/vercel-ignore-build.mjs"])expect(requiresBuild(["docs/PLAN.md",path])).toBe(true);expect(requiresBuild([])).toBe(true);});
});
