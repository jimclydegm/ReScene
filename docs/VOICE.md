# Meta voice input

Implemented November 1, 2026. Runtime model: `muse-voice-transcribe-1.0` through Meta Model API; showroom interpretation uses `META_ANALYSIS_MODEL` (default Muse Spark 1.3). The existing server-only `MODEL_API_KEY` is sufficient. Optional `META_TRANSCRIPTION_MODEL` is already in `.env.example`.

## Where to try it

- Image Studio → Creative direction → Speak. Review the transcript, then append or replace the prompt. Image generation remains an explicit action.
- Scene review → Analysis controls → Focus instructions → Speak. Voice adds optional instructions for the existing general-purpose image analyzer.
- Scene editor → Textures → Background designs → Style hint → Speak. Review the text before generating a new background.
- Demo → Explore a product → Voice search; replacement pickers also accept a spoken product name.
- Demo → Build your space / Shop the scene → Voice controls. Say “make the chair blue and use dusk lighting.” Review the transcript, review the proposed changes, then Apply changes. Undo restores the entire scene edit in one step.

Showroom commands can select, recolor, show/hide, replace with approved catalog products, make small X/Z moves or yaw rotations, switch room/lighting presets, shuffle finishes and reset an item. Existing placement, support, lock and overlap guards still apply. Unsupported or ambiguous requests produce no applicable changes. Voice does not execute checkout, cart additions, image generation or arbitrary server actions. This control is currently in the two shopping demos; the private editor uses dictation in its prompt fields.

## Audio and request flow

The browser asks for microphone permission only after Record. An AudioWorklet captures mono samples, converts them to 24 kHz signed 16-bit PCM WAV and stops at 30 seconds. Stop & transcribe sends the clip once; a WAV upload is available when recording is unavailable. Closing the dialog stops microphone tracks and releases the audio context. The site permits same-origin microphone access through Permissions-Policy; browsers still require user permission and HTTPS outside localhost.

Meta's [speech guide](https://dev.meta.ai/docs/speech-to-text) documents recorded clips and realtime recognition. This implementation uses recorded clips, avoiding a long-lived Vercel WebSocket proxy. The [batch endpoint](https://dev.meta.ai/docs/api-reference/voice/transcribe) receives multipart `request` JSON and `audio` WAV at `/v1/asr/transcribe`. Settings use `audioEncoding: WAV`, `mode: PUSH_TO_TALK`, optional language hints and catalog keywords. The [audio schema](https://dev.meta.ai/docs/api-reference/voice/schemas) specifies mono PCM at 16/24 kHz; the application accepts those rates and limits clips to 30 seconds, below Vercel's request-size ceiling. Auto language detection and English + Tagalog hints are available. Transcripts remain editable because names, punctuation and phrasing can be misheard.

`POST /api/voice/transcribe` checks origin, bounds the streamed request before multipart parsing, validates/rebuilds WAV headers and reserves a durable receipt before one paid request. `GET` retrieves the same actor's saved result. Creative/background/analysis purposes require the normal author session; demo search/showroom use a signed HttpOnly SameSite cookie. Account/network identifiers are domain-separated HMACs. Anonymous rate accounting uses Vercel's overwritten forwarding header ([Vercel header contract](https://vercel.com/docs/headers/request-headers)); cookies alone do not reset a network's minute limit.

`POST /api/voice/commands` accepts an owned successful showroom transcript receipt plus the current draft and selected slot. Muse Spark returns strict allowlisted JSON, never executable code. A preview passes through the same pure scene guards as manual edits. Apply requires an unchanged draft/selection and records one existing undo operation. These requests do not mutate saved projects, publish source images or add scene assets.

## Receipts and privacy

The additive `VoiceAttempt` table stores request/input hashes, purpose, status, model, duration, expiry and optional transcript/proposal. ReScene does not persist recordings in Neon or R2. Transcripts/proposals are privately recoverable for 15 minutes; expired content is cleared on subsequent new transcription requests, so physical deletion is not an exact 15-minute timer. Minimal receipt metadata remains for duplicate-request protection. Provider retention is governed separately by Meta.

Identical actor/key/audio/language requests reuse the receipt. Changed inputs and expired keys are rejected. Interrupted/failed attempts never automatically resubmit; “Retrieve this clip's saved result” and “Check saved proposal” only recover the same operation. There is no cumulative monetary cap. The existing `GENERATION_ENABLED` switch applies, with 12 new clips per minute per actor/network, one active clip per actor and eight active clips globally. No key or raw IP is exposed to the browser.

## Verification

Twenty focused voice cases cover PCM/resampling/format limits, model multipart settings, no retries, receipt reuse/expiry, rate/concurrency guards, identity/auth, bounded commands, support/lock failures and grouped undo. The full suite has 279 passing cases; Prisma validation, lint, types and production build pass.

Live development evidence: one adapter preflight and one end-to-end 2.24-second clip were transcribed; one Muse Spark proposal produced the requested blue chair and Dusk lighting. The HTTP test verified duplicate transcription/proposal reuse, transcript retrieval, guest isolation, author-purpose authentication, changed-context rejection and cross-origin denial. No saved scene was changed. Private audio/receipts live only in ignored `test-results/voice`; do not repeat these paid checks for unchanged code.

Browser access is disabled in Work settings. Real microphone capture, dialog appearance and click-to-Apply are not natively verified; API tests exercise the audio-upload path and the same pure application guards.

Release: PR40 merged at `2c5fc98`; PR/main CI pass. Production `rescene-gc397a0wt-jimclydegms-projects.vercel.app` is READY at `rescene-eta.vercel.app`. `SMOKE_BASE_URL=https://rescene-eta.vercel.app VOICE_SESSION_FILE=<private session file> node scripts/verify-voice.mjs` passes delivered public/private prompt controls, styles/worklet, microphone policy, guest identity, auth/origin and malformed-input guards without inference or saved-scene writes. Local4317 server stopped.
