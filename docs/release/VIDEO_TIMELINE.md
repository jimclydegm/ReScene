# ReScene recording and editing plan

November 2, 2026. Based on Jim's ElevenLabs recording ending `14_04_01_Mark - Natural Conversations_pvc_sp100_s44_sb75_v4.mp3`.

The supplied MP3 measures **2:25.633**. Keep its narration and add **29 seconds of deliberate viewing time**, producing a **2:54.633** edit. Round the export to **2:55** with a short end-frame hold. A ready-to-import, 2:55 WAV with these pauses is saved locally as `test-results/video-nov2/rescene-demo-narration-2m55.wav`; the original MP3 is untouched. No narration rewrite or faster playback is needed.

**Audio time** below refers to the original, uninterrupted MP3. **Video time** includes the added holds. Use video time to assemble the edit; use audio time to locate the corresponding spoken phrase. Section boundaries are editing cues placed in detected pauses, approximately within half a second, not word-level alignment. Transcription confirmed the sequence and the shortened introduction, “I'm Jim.”

Record the actions normally, then edit the footage to the narration. Do not try to perform the whole app demonstration in 2:55. Keep the uncut takes and matching request receipts; shorten processing waits with truthful elapsed-time labels.

## 1. Show the problem

**Video 0:00–0:17.5 · Audio 0:00–0:17.5**

Spoken cue: “When you shop online, you spend a lot of time opening product pages and scrolling through photos.”

- **0:00–0:05.5:** show a real ReScene product page in Album mode. Click through two product photos. Keep the product and price large enough to read.
- **0:05.5–0:10.5:** while the narration mentions another side, color and comparison, show another photo, a saved color photograph, then another product page. Use products from the same collection that will appear together later.
- **0:10.5–0:17.5:** compose two or three crops of those actual pages side by side. Each should show an individual product, image and price. Finish with the chosen products still separated; reveal the interactive combination in the next section.

Use real pages and subtle annotations rather than a fictional shopping UI. Do not attempt an unmeasured click-count or time-saving chart. Put a readable first-frame caption over the footage: **“Started from scratch during the hackathon.”** The narration confirms this shortly afterward.

## 2. Introduce ReScene

**Video 0:17.5–0:25.2 · Audio 0:17.5–0:25.2**

Spoken cue: “That's what I wanted to change with ReScene. I'm Jim, and I built this app from scratch during the hackathon.”

Cut from the separate pages to the same products together in the prepared 3D showroom. Make one gentle orbit, then select one item so viewers can see it is interactive. Show **ReScene** and **Jim Clyde Monge** as a small title over the working app. This reveal is a prepared example, not the result of the upload that follows.

At “Let me show you how it works,” cut to Create a scene. Keep logo and navigation footage short.

## 3. Upload an existing photo

**Video 0:25.2–0:31.1 · Audio 0:25.2–0:31.1**

Spoken cue: “We start by uploading a photo. It could show furniture, clothes, electronics, or other products.”

Choose the existing-photo route, upload one permitted image and show its preview. Use a clean furniture scene with three or four clearly separated products for the main recording. Briefly show two actual approved example thumbnails, such as shoes and desk products, when the narration lists other categories; stay with the uploaded scene for the reconstruction.

Frame the image and Analyze photo control together. Do not spend time on the operating-system file picker. Record the actual upload and analysis submission even if the edit trims the picker and waiting period.

## 4. Explain and prove the model workflow

**Video 0:31.1–0:49.1 · Audio 0:31.1–0:49.1**

Keep a small progressive workflow annotation over the actual app and outputs. Show one current stage at a time, not a full architecture slide.

- **0:31.1–0:36.3 — “Muse Spark identifies the objects…”** Show Analyze photo being submitted, then the actual detected-object list and source boxes. Label **“Muse Spark — objects and spatial relationships.”**
- **0:36.3–0:43.2 — “Meta's Segment Anything Model, SAM 3.1…”** Select two different objects. Show each actual mask on the photo, then one isolated mask thumbnail. Label **“SAM 3.1 — per-object pixel masks.”** The mask needs to be visibly distinct from a bounding box.
- **0:43.2–0:49.1 — “SAM 3D Objects uses the photo and those masks…”** Click Build scene in 3D, show the real processing step and then individual returned models. Label **“Meta SAM 3D Objects — textured 3D models · hosted by fal.”** Show both the source photo and mask entering the reconstruction annotation.

Long waits are cut, not depicted as instant responses. Include a small sanitized record from the actual run that identifies model, operation and success, tied to these outputs. A request to ReScene's own API alone does not prove an upstream model call. Do not film authorization headers, signed URLs or raw private receipts.

## 5. Reveal the complete environment

**Video 0:49.1–0:57.6 · Audio 0:49.1–0:52.6, followed by a 5-second hold**

Spoken cue: “ReScene puts them together in a scene we can explore and edit.”

Show the completed environment beside its reference photo. Keep the saved reference camera initially, then make a small orbit that reveals depth without exposing an extreme side view. Select one model to show it is separate from the background.

Use the added **0:52.6–0:57.6** viewing time to hold the result and, briefly, its actual background/depth step. A short annotation can say **“VGGT: camera and depth estimates”** and **“ReScene: surfaces and object placement.”** This explains environment construction without implying that SAM segmentation produces a room.

## 6. Show editing and texture improvement

**Video 0:57.6–1:06.65 · Audio 0:52.6–1:01.65**

Spoken cues: “We can move things around, change colors, and adjust the lighting.” Then: “Muse Image generates images for textures…”

- **0:57.6–1:01.3:** make one small, valid object move; change its color; choose a lighting preset. Match each action to the corresponding spoken phrase. Record these separately so the edit can be concise without rushed mouse movements.
- **1:01.3–1:06.65:** show Textures → Improve textures · Meta AI and its actual Generate materials submission, then an accepted Muse material sample and its mapped result. Use a small **“Reference → Muse Image material → mapped surface”** annotation. A same-camera, same-light before/after should occupy the final part of this shot.

Record the paid operation once and retain the matching outputs. If using a previously completed enhancement instead, label it **“Saved texture result.”** Do not use a lighting change as evidence of a texture improvement. Muse Image outputs images; ReScene handles mapping and baking.

## 7. Save product information and prove persistence

**Video 1:06.65–1:18.65 · Audio 1:01.65–1:09.65, followed by a 4-second hold**

Spoken cue: “Next, we add the product names, descriptions, prices, and shopping links.”

Select one actual reconstructed object and open Products. Fill or edit its name, description, price and merchant link; prefill most fields before the take and make one visible edit. Click Save changes as the narration says the information is saved.

During the added **1:14.65–1:18.65**, reload the saved scene and reopen the same product. Keep its restored name and price readable. Overlay a short product-card-to-model connection. Metadata and asset references live in Neon; media files live in R2. Showing Save followed by a restored field is more convincing here than filming database credentials or a table of UUIDs.

## 8. Create a scene from product photos

**Video 1:18.65–1:33.95 · Audio 1:09.65–1:20.95, followed by a 4-second hold**

Spoken cue: “We can also start by selecting product photos and a background, then describing what we want.”

Open the second creation route. Select two or three product reference photos, select an empty setting, and enter a short prompt. Show those inputs together. At “Muse Image generates a new photo,” show the actual generation submission and its returned image, with the processing wait cut and labelled.

At “we turn that photo into another 3D scene,” click Use in 3D and show that generated image's matching completed reconstruction. Use the added **1:29.95–1:33.95** to hold the generated photo beside that result.

The simple graphic is **product photos + setting + prompt → Muse Image → new photo → reconstruction**. This route creates new geometry from the generated image; it does not directly assemble the old meshes. Existing saved-mesh reuse is shown in Build Your Space. Mark the transition as a second scene so two unrelated results do not appear to belong to one run.

## 9. Enter the shopping demos

**Video 1:33.95–1:36.55 · Audio 1:20.95–1:23.55**

Spoken cue: “Now, let's see what this means for someone shopping.”

Briefly show the three demo choices, then open Explore a Product. This is a transition, not a feature tour. Add **“Prepared catalog examples”** once when entering the shopping section; newly saved private products are not automatically promoted into this curated public catalog.

## 10. Explore a Product

**Video 1:36.55–1:54.7 · Audio 1:23.55–1:38.7, followed by a 3-second hold**

Use **Haven Accent Chair**, route `/demo/product/corner-chair`, because it already has five Muse photographs. Do not use the one-photo Form Sage Chair for an album demonstration.

- **1:36.55–1:42.3 — “photos, details, and reviews…”** Start in Album mode with the name, price, buying controls and reviews visible. Click a thumbnail once.
- **1:42.3–1:47.15 — “switch to 3D…”** Click 3D, rotate slowly, and choose one contrasting color.
- **1:47.15–1:51.7 — “Muse Image creates additional product photos…”** Return to Album and show a studio view followed by a lifestyle photograph. Label them **“Muse Image · saved product photography.”** Browsing these images does not trigger generation.
- **1:51.7–1:54.7 — added hold:** let the best product photograph or a clear 3D angle remain visible. Do not introduce another menu during this hold.

Actual product-page interaction should dominate; no workflow diagram is needed here.

## 11. Build Your Space and prepare the stylist

**Video 1:54.7–2:04.05 · Audio 1:38.7–1:48.05**

Use **Reading Corner**, route `/demo/space?collection=corner`. Keep the chair and use a **$500 merchandise budget**.

At “choose products from the catalog,” open the replacement picker and choose one compatible saved model. At “replace an item, move it, or change the lighting,” show one replacement, a small allowed movement and a lighting preset. Label this briefly **“Reusing saved 3D products”** to distinguish it from the photo-composition route.

Before “And we can ask for help,” open AI stylist, mark the chair as kept, set the budget and open its voice input. Record the full preparation, then trim it to the useful actions. Leave the stylist ready to record when the quoted request begins.

## 12. Record the spoken shopping request

**Video 2:04.05–2:09 · Audio 1:48.05–1:53**

Spoken cue: “Keep this chair, make the corner warmer, and keep everything under five hundred dollars.”

Record that actual request through the app's microphone, then click Stop & transcribe. Show the real recording indicator or waveform while it is spoken. Rehearse this take before any paid submission.

The ElevenLabs quotation is narration, not evidence that the microphone was used. Either keep that narration over footage of the genuine recording, or replace just the quotation with Jim's real microphone audio. Do not play both voices simultaneously, and do not pretend typed input was recorded speech. If the genuine recording needs an extra second, use a second from a later hold rather than speeding the voice up.

## 13. Show the transcript and two affordable proposals

**Video 2:09–2:23.22 · Audio 1:53–2:01.22, followed by a 6-second hold**

- **2:09–2:12.25 — “Muse Voice Transcribe turns our voice into text.”** Show the returned transcript, review it and use it in the stylist prompt. Keep the words and the budget readable.
- **2:12.25–2:17.22 — “Spark suggests two combinations…”** Submit the actual stylist request, show its processing state and then the two returned looks. Label **“Muse Spark: understands the request and ranks options.”** Keep a sanitized matching model-call record in the captured evidence.
- **2:17.22–2:23.22 — added hold:** display both actual option cards with product names and merchandise subtotals. Show the kept chair and **“Budget: $500”**. Briefly pair the returned numbers with readable validation code or a small **“ReScene checks prices, kept items and placement”** annotation. Use real returned prices, not numbers prepared for the edit.

This is the main agentic demonstration. The customer supplies the goal; Spark interprets/ranks; code checks catalog prices and constraints; the customer chooses application. Do not repeat another paid stylist request in Shop the Scene just to show the same feature again.

## 14. Preview, apply and undo

**Video 2:23.22–2:33.42 · Audio 2:01.22–2:07.42, followed by a 4-second hold**

Spoken cue: “We can compare both options, see their totals, and apply the one we prefer. One click lets us undo it.”

Preview option one, then option two, with the scene and subtotal both in view. Click Apply for the preferred look. On “One click lets us undo it,” click Undo exactly once and let the previous arrangement become visible.

Use the added **2:29.42–2:33.42** to reapply the preferred look and add its merchandise to the bag. Give the actual result time to settle. Do not show a second unrelated adjustment between Apply and Undo; the judge should see that one undo restores the entire combination.

## 15. Shop the Scene

**Video 2:33.42–2:45.7 · Audio 2:07.42–2:16.7, followed by a 3-second hold**

Use **The Sunday Living Room**, route `/demo/shop-the-scene?collection=living`.

At “a complete setup from a retailer,” show the whole prepared living room in its reference framing. Click the sofa as “click each product to see its details” is spoken; make sure the selection visibly opens the correct product card. At “replace pieces,” choose one compatible alternative. At “shopping bag,” use Shop this look.

During the added **2:42.7–2:45.7**, open the bag and let the products and combined price remain readable. Use a clean bag for this separate recording take so an earlier demonstration does not create duplicate or unrelated line items. The checkout is a prototype interaction, not a real payment.

## 16. Finish with the result

**Video 2:45.7–2:54.633 · Audio 2:16.7–2:25.633**

Spoken cue: “Instead of trying to picture everything from separate photos, we can see it together…”

Return to the final chosen combination. Keep its products and actual subtotal in view, make one gentle orbit or hold a strong fixed angle, and remove distracting edit selections. Show **ReScene**, **Jim Clyde Monge**, and **rescene-eta.vercel.app** over the real scene. Hold through “That's ReScene.” Extend the last frame to 2:55 if useful; no extra spoken ending is needed.

## Audio edit points

Split only in the pauses near these original-audio times; do not cut inside a word. The exact sample can move slightly within its existing silence gap.

- **0:52.600 — add 5 seconds:** inspect the reconstructed environment.
- **1:09.650 — add 4 seconds:** Save/reload proof.
- **1:20.950 — add 4 seconds:** generated-photo/3D comparison.
- **1:38.700 — add 3 seconds:** product inspection.
- **2:01.220 — add 6 seconds:** read both stylist proposals and their prices.
- **2:07.420 — add 4 seconds:** Undo result, reapply and bag.
- **2:16.700 — add 3 seconds:** shopping bag and subtotal.

Total added time: **29 seconds**. Use quiet room tone or a low licensed music bed through these gaps; do not leave a frozen cursor over a loading screen. The narration stays at its recorded speed. Every later video cue moves when an earlier gap changes, so use the supplied CSV or recalculate offsets if altering this allocation.

## Capture checklist

1. Record one permitted source photo through actual analysis, masks, reconstruction, editing, product Save and reload. Keep the source/result matched throughout.
2. Record one source-material sample, accepted Muse output and mapped result, with the before/after at the same camera and light.
3. Record the second route from product photos and setting through its generated photo, Use in 3D and matching completed reconstruction.
4. Record Haven Accent Chair's existing album, 3D rotation and color change.
5. Rehearse Reading Corner's microphone, then capture one real transcript/stylist submission and both returned proposals, Preview, Apply, one-step Undo and bag.
6. Record The Sunday Living Room selection, compatible replacement and clean bag.
7. Prepare only the short workflow annotations already described. Record actual request evidence once; diagrams and model names are not substitutes for calls.
8. Assemble the footage under the existing narration, insert the seven holds, and verify the exported file's duration is at or below 3:00. Check captions, prices, sound balance and text legibility at normal playback size.

Keep the original MP3 and raw request evidence private. Timing analysis used local FFmpeg and Muse Voice Transcribe. A full-clip ENDPOINTING request returned one turn, so section cues use the existing script, local silence boundaries and seven shorter confirmation clips rather than treating provider turn markers as precise word timings. Private analysis is under ignored `test-results/video-nov2/`. No video footage, rendered animations or final submission was produced by this planning pass.
