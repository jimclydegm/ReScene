import { describe, expect, it, vi } from "vitest";
vi.mock("server-only",()=>({}));
import { readJson } from "../src/lib/http";
describe("bounded JSON requests",()=>{
  it("cancels an oversized chunked request before reading more data",async()=>{
    const cancel=vi.fn();let reads=0;
    const body=new ReadableStream({pull(controller){reads++;controller.enqueue(new Uint8Array(70*1024));},cancel});
    const request=new Request("http://localhost/api/scenes",{method:"POST",body,duplex:"half"} as RequestInit);
    await expect(readJson(request)).rejects.toMatchObject({status:413,code:"BODY_TOO_LARGE"});
    expect(cancel).toHaveBeenCalledOnce();
    expect(reads).toBeLessThanOrEqual(3);
  });
  it("accepts valid streamed JSON and rejects incomplete input",async()=>{
    expect(await readJson(new Request("http://localhost",{method:"POST",body:'{"title":"Living room"}'}))).toEqual({title:"Living room"});
    await expect(readJson(new Request("http://localhost",{method:"POST",body:'{"title":'}))).rejects.toMatchObject({status:400});
  });
});
