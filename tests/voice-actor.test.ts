import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
const m=vi.hoisted(()=>({get:vi.fn(),set:vi.fn(),user:vi.fn()}));vi.mock("server-only",()=>({}));vi.mock("next/headers",()=>({cookies:async()=>({get:m.get,set:m.set})}));vi.mock("@/lib/auth/user",()=>({requireUser:m.user}));
import {voiceActor,voiceHash,validVoiceCookie} from "../src/lib/voice/actor";
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("NEON_AUTH_COOKIE_SECRET","test-only-domain-separated-cookie-secret");});afterEach(()=>vi.unstubAllEnvs());
describe("Private voice identity",()=>{
 it("uses signed, expiring, purpose-scoped HMAC identity instead of raw IDs/IPs",async()=>{
  const request=new Request("https://rescene.test/api/voice/transcribe",{headers:{"x-vercel-forwarded-for":"203.0.113.2"}}),first=await voiceActor(request,"search"),[name,token,options]=m.set.mock.calls[0];expect(name).toBe("__Secure-rescene-voice");expect(options).toMatchObject({httpOnly:true,secure:true,sameSite:"strict",path:"/api/voice"});expect(validVoiceCookie(token)).toBe(true);expect(validVoiceCookie(token.slice(0,-1)+"x")).toBe(false);expect(validVoiceCookie(token,Date.now()+86400001)).toBe(false);m.get.mockReturnValue({value:token});expect(await voiceActor(request,"showroom")).toEqual(first);expect(JSON.stringify(first)).not.toContain("203.0.113");expect(voiceHash("account","same")).not.toBe(voiceHash("guest","same"));
 });
 it("requires authoring auth for creative, background and analysis purposes",async()=>{
  m.user.mockRejectedValue(new Error("auth required"));for(const purpose of ["creative","background","analysis"] as const)await expect(voiceActor(new Request("https://rescene.test/api/voice/transcribe"),purpose)).rejects.toThrow("auth required");expect(m.set).not.toHaveBeenCalled();
 });
});
