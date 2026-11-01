import {describe,it,expect} from "vitest";
import {encodeWave,normalizeWave,samplesToWave,VOICE_MAX_BYTES} from "../src/lib/voice/audio";
describe("Bounded Meta voice audio",()=>{
 it("downsamples 48kHz input without changing duration and clips PCM safely",()=>{
  const input=new Float32Array(48000).fill(.5);input.fill(-2,0,24000);const audio=samplesToWave(input,48000),v=new DataView(audio.buffer);
  expect(normalizeWave(audio).durationMs).toBe(1000);expect(v.getInt16(44,true)).toBe(-32768);expect(v.getInt16(44+24000,true)).toBe(16384);expect(audio.length).toBe(48044);
 });
 it("accepts 16kHz PCM and strips non-audio metadata before provider submission",()=>{
  const wav=encodeWave(new Int16Array(8000),16000),withMetadata=new Uint8Array(wav.length+12);withMetadata.set(wav);withMetadata.set([74,85,78,75,4,0,0,0,9,8,7,6],wav.length);new DataView(withMetadata.buffer).setUint32(4,withMetadata.length-8,true);
  expect(normalizeWave(withMetadata)).toEqual({bytes:wav,durationMs:500});
 });
 it("rejects stereo, float encoding, wrong rates and truncated data",()=>{
  const original=encodeWave(new Int16Array(12000));for(const [at,value]of [[22,2],[20,3],[24,48000],[40,999999]]){const wav=new Uint8Array(original),v=new DataView(wav.buffer);if(at>=24)v.setUint32(at,value,true);else v.setUint16(at,value,true);expect(()=>normalizeWave(wav)).toThrow();}
  expect(()=>normalizeWave(original.subarray(0,-2))).toThrow();
 });
 it("enforces the duration and upload bounds without truncating submitted WAV files",()=>{
  expect(()=>normalizeWave(encodeWave(new Int16Array(200)))).toThrow();expect(()=>normalizeWave(encodeWave(new Int16Array(24000*30+1)))).toThrow();expect(()=>normalizeWave(new Uint8Array(VOICE_MAX_BYTES+1))).toThrow();expect(()=>samplesToWave(new Float32Array(48000*31),48000)).toThrow();
  expect(normalizeWave(samplesToWave(new Float32Array(24000*30),24000)).durationMs).toBe(30000);
 });
});
