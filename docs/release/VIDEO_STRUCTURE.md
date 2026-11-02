# ReScene demo video structure

Revised November 2, 2026 against Jim’s actual 2:25.633 ElevenLabs recording. Target 2:55, using 29 seconds of deliberate viewing time within the three-minute limit. [VIDEO_TIMELINE.md](VIDEO_TIMELINE.md) is the current action-by-action recording/edit plan; [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md) contains the recorded narration, and [VIDEO_VISUALS.md](VIDEO_VISUALS.md) contains the explanatory diagram sources. This file retains the recording strategy and judging evidence. Show the working app throughout, with readable model labels and clearly marked cuts around processing waits.

## Problem-led opening and build baseline

The narration directly explains the shopping problem: customers compare separate product pages, galleries and prices, then imagine the combination. Annotated real product-page crops lead into the same products together in 3D. The first frame carries this caption over the working app:

“Started from scratch during the hackathon.”

Keep the caption readable for roughly six seconds. The recorded introduction also states aloud that ReScene was built from scratch during the hackathon. Jim confirmed that baseline. This introduces the customer problem first while keeping the event-built context in the opening footage. Use the exact narration and shot directions in [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md).

## Judging evidence

The supplied weights are Impact 30%, Use of Meta AI Tooling 25%, Technical Depth and Execution 20%, and Demo 25%. They guide what the footage must prove; they are not separate screen-time quotas. One successful interaction can supply evidence for several criteria.

- **Impact — 30%:** connect a business’s saved product assets/details to the shopper's ability to inspect products and compare affordable combinations in context. Show actual prices beside alternatives and the selected result in the scene. State the observed benefit without invented conversion or time-saving statistics.
- **Use of Meta AI Tooling — 25%:** visibly connect real request submission, processing and returned output to each model's role. Creator footage covers Spark analysis, SAM masks, hosted SAM 3D Objects and Muse Image composition/materials; the stylist footage covers Voice Transcribe and Spark interpretation/ranking. Identify VGGT's depth role accurately. Model-name captions support the evidence but do not prove a call happened by themselves.
- **Technical Depth and Execution — 20%:** show product Save/reload, a fixed-camera material before/after and one-step Apply/Undo. Use part of the model recap for a short, readable code view of the real budget/keep/placement validation in the shopping engine. Explain the division of work: Spark interprets/ranks; code checks integer-cent totals and constraints before a look can be applied. A list of frameworks or model names alone does not demonstrate this implementation.
- **Demo — 25%:** complete a coherent creator-to-shopper journey with legible controls and results, clearly distinguish newly generated scenes from prepared shopping examples, and end with a chosen affordable arrangement in the bag. Rehearse the microphone and avoid repeated control tours. Preserve five seconds beneath the maximum duration.

## Making live model calls visible

Capture the actual generation/voice/stylist action, its processing state and its corresponding returned result in the same recorded run. Keep enough of that chain in the edit for the judge to follow it. Annotate the model name and purpose as the operation occurs. Cut long waits with truthful elapsed-time labels rather than implying instant inference.

During the recap, show a tightly framed, sanitized server/provider trace or saved run-step record from those actual calls alongside the relevant adapter/validation code. Limit visible fields to model/provider, operation, time and outcome; tie it to the input/result already shown. Browser requests to ReScene's own API establish app submission, but do not by themselves show an upstream Meta request. Do not film authorization headers, keys, signed URLs, account identifiers, actor cookies or raw provider responses. Prepare this evidence before recording; no new tracing feature is implied.

Prepared product albums and existing-mesh showroom interactions remain labelled as saved examples. They do not need additional model calls merely to appear in the video. The live voice/stylist request supplies fresh shopping inference; the three showroom tours do not each need a duplicate request.

## Story and creation paths

A brand, retailer or other business turns an existing image into editable products with saved shopping details, or creates another scene from product references. Customers inspect a product, build an affordable combination, or personalize a prepared shopping scene.

Keep three operations distinct:

- **Existing photo:** upload → Spark analysis → SAM 3.1 masks → SAM 3D Objects → background/material work → edit → product details → Save/reload.
- **Product reference photos:** choose product images and an empty setting → Muse Image scene photo → Use in 3D → the same reconstruction pipeline. This creates new geometry from that image; it does not preserve or assemble the selected products' original meshes.
- **Existing catalog meshes:** Build your space and Shop the scene arrange or replace approved saved models without reconstructing them again. This demonstrates the value of a prepared 3D catalog. General merchant GLB/CAD upload is not a current self-service feature.

Open with the shopping problem and the confirmed build-baseline caption. Reveal the combination, then show how a business creates the experience. Finish with the shopper's completed choice.

## The 2:55 cut

Times in this section are **edited video times**, including seven holds. The original audio is 2:25.633. Keep the recorded voice unchanged; the 29 seconds of added viewing time bring the result to2:54.633, with an optional final-frame extension to2:55.

1. **0:00–0:17.5:** establish the actual product-page/photo/comparison problem.
2. **0:17.5–0:25.2:** reveal the same products together and introduce ReScene/Jim’s fresh hackathon build.
3. **0:25.2–0:31.1:** upload the source photo.
4. **0:31.1–0:49.1:** Spark observations, SAM3.1 pixel masks and SAM3D model requests/results, with small progressive workflow annotations.
5. **0:49.1–0:57.6:** reveal that image’s completed environment and hold for5seconds; show VGGT/depth and application placement responsibility accurately.
6. **0:57.6–1:06.65:** move/color/light edits, Muse material generation and a controlled mapped-texture before/after.
7. **1:06.65–1:18.65:** product details, Save and a4-second reload/persistence proof.
8. **1:18.65–1:33.95:** select product photos and a setting, Muse composition, Use in3D and a4-second matching result comparison.
9. **1:33.95–1:36.55:** transition to the prepared shopping demos.
10. **1:36.55–1:54.7:** Haven Accent Chair album/details/reviews,3D/color inspection and saved Muse photography; includes a3-second hold.
11. **1:54.7–2:04.05:** Reading Corner catalog reuse/replacement/editing and stylist preparation.
12. **2:04.05–2:09:** record the actual kept-chair/warm-corner/$500 request.
13. **2:09–2:23.22:** real transcript and Spark proposals, with6seconds to inspect actual options/subtotals and the code’s budget/keep/placement checks.
14. **2:23.22–2:33.42:** Preview/Apply/one-step Undo;4seconds to restore the preferred choice and add to bag.
15. **2:33.42–2:45.7:** Sunday Living Room selection/replacement/Shop this look;3seconds to read the clean bag.
16. **2:45.7–2:55:** hold the final choice and creator/demo address through the closing narration.

The recorded narration has approximately438words. Local audio measurement replaces the earlier words-per-minute estimate. Speech confirmation and silence boundaries give approximate phrase cues, not precise word timestamps. See [VIDEO_TIMING.csv](VIDEO_TIMING.csv) for both clocks and [VIDEO_TIMELINE.md](VIDEO_TIMELINE.md) for the exact actions, hold insertion points and capture checklist. The full narration does not need to be regenerated for this plan.

## Visual strategy

Use a graphic when the viewer needs to understand a transformation, dependency or comparison that the UI does not make obvious. Use actual footage when the claim is an interaction or a working result. Alternate the two within a segment: explain briefly, then prove it. Keep workflow graphics brief and tied to the current spoken phrase. The18-second reconstruction section carries the main process annotation; material and stylist explanations use small callouts over genuine outputs. There is no separate model-recap or architecture-slide segment in the recorded narration.

The diagram set covers the shopping problem, photo-to-scene pipeline, product/asset persistence, photo composition versus mesh reuse, generated-material mapping and the stylist's validated decision flow. A two-option table should use actual returned products/subtotals. Do not add unmeasured performance, conversion or time-savings charts. Earlier “not slides” guidance is handled with annotations to actual app/code or intermediate-output footage, rather than a detached pitch deck.

## Examples and feasibility

- **Creator:** a project-owned or permitted furniture image with distinct silhouettes and visible cloth/wood. Maintain the same source, objects and labels through upload, reconstruction, editing and Save/reload. Make transitions to other prepared examples visible.
- **Image Studio:** a small product set and an empty setting. Capture the references, prompt, generated photo and its own 3D result. Generative product likeness remains approximate.
- **Product page:** [Haven Accent Chair](https://rescene-eta.vercel.app/demo/product/corner-chair) has five saved Muse photographs. Form Sage Chair currently has only one, making it a weaker album demonstration. Reuse the working album rather than generating more photographs for the edit.
- **Stylist:** [Reading Corner](https://rescene-eta.vercel.app/demo/space?collection=corner), keep corner-chair, $500 merchandise budget. A November 2 local planning check produced 24 eligible shortlisted combinations from $377 to $497, with no model calls. These are feasible candidates, not two promised Spark choices; film the actual returned options. Quiet workspace, owned laptop/notebook and a $100 mouse budget remains a verified backup.
- **Styled shopping:** [The Sunday Living Room](https://rescene-eta.vercel.app/demo/shop-the-scene?collection=living). An optional City essentials cut shows personal products if there is room; prioritize the three shopping workflows.

## Model labels and value

- **Muse Spark 1.3:** scene/material understanding and shopping interpretation/ranking; connects the catalog to a user's goal.
- **SAM 3.1:** product masks for individual review and editing.
- **Meta SAM 3D Objects, hosted by fal:** approximate textured geometry and pose for interactive inspection.
- **Muse Image 1.0:** scene compositions, product photography and material/background samples. It outputs images; ReScene handles geometry construction and texture mapping separately.
- **Oxford/Meta VGGT1B, hosted by fal:** camera/depth evidence for the surrounding environment.
- **Muse Voice Transcribe 1.0:** spoken requests become reviewable text; Spark handles their meaning afterward.

The concrete benefit is one view of appearance, product information and merchandise cost. Businesses reuse saved assets; shoppers compare products and affordable combinations in context. Do not claim measured conversion gains, time savings, exact identity/reconstruction, physical fit or completed purchases. Color previews and generated photography are illustrative.

## Recording checks

Record at 1080p or higher in desktop mode with one theme and consistent framing. Keep labels legible and texture comparisons at the same camera/light setup. Preserve an uncut recording and actual timings, then label cuts across processing waits. Use prepared catalog examples openly: saving a new private product does not automatically add it to these curated public demo pages.

Keep a private evidence index for the input, generated photo, accepted result and recorded inference steps. Public footage/evidence must exclude keys, signed source URLs, actor cookies, raw responses and unrelated user data. A saved result must not masquerade as a fresh live call.

The supplied narration is generated; a genuine app microphone take is still needed. Before filming, rehearse the microphone/transcript path and complete two-option Apply/Undo/bag interaction. Speech API checks do not establish that native microphone recording has been rehearsed. Capture genuine inference once, preserve receipts and do not blindly repeat interrupted paid submissions. Writing the outline/script submits no inference and records no footage.

Keep the submission understandable in English, at or below 3:00, and focused on working event-built features rather than slides or future ideas, following the organizer guidance Jim supplied. Provider/asset-rights and final portal checks remain in [JUDGE_READINESS.md](JUDGE_READINESS.md). Uploading the video and submitting the entry are separate actions.

Implementation sources: [model inventory](../MODEL_USAGE.md), [Image Studio adoption](../../src/lib/services/creative.ts), [product persistence](../../src/lib/services/product-library.ts), [stylist validation](../../src/lib/shopping/engine.ts), [prepared photography](../../src/lib/demo/photography.json).
