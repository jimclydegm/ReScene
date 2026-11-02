import { afterEach, describe, expect, it, vi } from "vitest";
import { apiJson } from "../src/lib/client-api";
afterEach(()=>vi.unstubAllGlobals());
describe("workspace request recovery",()=>{
  it("keeps server errors readable and does not retry a mutation",async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:"Reload the changed scene."}}),{status:409}));
    vi.stubGlobal("fetch",fetch);
    await expect(apiJson("/api/scenes/example",{method:"PATCH"})).rejects.toThrow("Reload the changed scene.");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it("offers safe recovery on an interrupted response instead of returning null",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("interrupted")));
    await expect(apiJson("/api/scenes/example")).rejects.toThrow(/saved result/);
  });
  it("does not automatically resubmit a timed-out request",async()=>{
    const fetch=vi.fn().mockRejectedValue(new DOMException("timed out","TimeoutError"));vi.stubGlobal("fetch",fetch);
    await expect(apiJson("/api/scenes/example",{method:"POST"})).rejects.toThrow(/before trying again/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
