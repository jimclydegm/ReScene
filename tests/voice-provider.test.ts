import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
vi.mock("server-only",()=>({}));
import {transcribeVoice,SpeechProviderError} from "../src/lib/ai/transcribe";
import {encodeWave} from "../src/lib/voice/audio";
const fetchMock=vi.fn();
beforeEach(()=>{vi.stubGlobal("fetch",fetchMock);vi.stubEnv("MODEL_API_KEY","test-server-secret");vi.stubEnv("META_API_BASE_URL","https://api.meta.ai/v1");vi.stubEnv("META_TRANSCRIPTION_MODEL","muse-voice-transcribe-1.0");fetchMock.mockReset();});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe("Muse Voice batch adapter",()=>{
 it("sends server-authenticated JSON settings and mono WAV with multilingual hints",async()=>{
  fetchMock.mockResolvedValue(Response.json({transcript:"  use dusk lighting  ",audioDurationMs:500,sessionId:"private",turns:[]}));
  const audio=encodeWave(new Int16Array(12000)),result=await transcribeVoice(audio,"English + Tagalog");expect(result).toEqual({text:"use dusk lighting",durationMs:500,model:"muse-voice-transcribe-1.0"});
  const [url,options]=fetchMock.mock.calls[0];expect(url).toBe("https://api.meta.ai/v1/asr/transcribe");expect(options.headers.Authorization).toBe("Bearer test-server-secret");expect(options.cache).toBe("no-store");expect(options.redirect).toBe("error");const form=options.body as FormData,request=JSON.parse(await (form.get("request") as Blob).text());expect(request).toMatchObject({audioEncoding:"WAV",mode:"PUSH_TO_TALK",languageBias:["English","Tagalog"],model:"muse-voice-transcribe-1.0"});expect(request.keywords).toContain("ReScene");expect(new Uint8Array(await (form.get("audio") as Blob).arrayBuffer())).toEqual(audio);
 });
 it("omits language bias in automatic mode and never retries a rejected request",async()=>{
  fetchMock.mockResolvedValue(new Response("private upstream details",{status:429}));await expect(transcribeVoice(encodeWave(new Int16Array(12000)),"Auto")).rejects.toBeInstanceOf(SpeechProviderError);expect(fetchMock).toHaveBeenCalledTimes(1);const form=fetchMock.mock.calls[0][1].body as FormData;expect(JSON.parse(await (form.get("request") as Blob).text())).not.toHaveProperty("languageBias");
 });
});
