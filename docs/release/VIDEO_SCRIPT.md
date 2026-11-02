# ReScene recorded narration

November 2, 2026. This is the narration corresponding to Jim's ElevenLabs recording ending `14_04_01_Mark - Natural Conversations_pvc_sp100_s44_sb75_v4.mp3`, with the recorded introduction “I'm Jim.” Normalized punctuation follows the supplied script; this is not a word-timestamp transcript.

The actual MP3 lasts **2:25.633**; the narration has approximately **438 words**. [VIDEO_TIMELINE.md](VIDEO_TIMELINE.md) maps its spoken cues to app actions and adds 29 seconds of viewing time for a **2:55** final edit. [VIDEO_TIMING.csv](VIDEO_TIMING.csv) contains the source-audio and edited-video ranges. The previous 307-word draft and its timing no longer apply.

## Narration

When you shop online, you spend a lot of time opening product pages and scrolling through photos. You want to see the other side, check another color, or compare it with something else you’re buying. But the photos only show what the store has prepared. You can’t turn the product around or put your choices together to see how they look.

That’s what I wanted to change with ReScene. I’m Jim, and I built this app from scratch during the hackathon.

Let me show you how it works.

We start by uploading a photo. It could show furniture, clothes, electronics, or other products.

Muse Spark identifies the objects and analyzes where they are and how they relate to each other. Meta’s Segment Anything Model, SAM 3.1, separates them by marking the pixels that belong to each object. SAM 3D Objects uses the photo and those masks to generate individual 3D models.

ReScene puts them together in a scene we can explore and edit. We can move things around, change colors, and adjust the lighting. Muse Image generates images for textures that ReScene maps onto the objects and background.

Next, we add the product names, descriptions, prices, and shopping links. Those details are saved in the database and linked to the models.

We can also start by selecting product photos and a background, then describing what we want. Muse Image generates a new photo using those references, and we turn that photo into another 3D scene.

Now, let’s see what this means for someone shopping.

In Explore a Product, we have the photos, details, and reviews you’d expect on a shopping page. But we can also switch to 3D, turn the product around, and try different colors. Muse Image creates additional product photos showing different angles and settings.

In Build Your Space, we can choose products from the catalog and see them together. We can replace an item, move it, or change the lighting.

And we can ask for help: “Keep this chair, make the corner warmer, and keep everything under five hundred dollars.”

Muse Voice Transcribe turns our voice into text. Spark suggests two combinations, and ReScene checks the prices and placement rules. We can compare both options, see their totals, and apply the one we prefer. One click lets us undo it.

Shop the Scene starts with a complete setup from a retailer. We can click each product to see its details, replace pieces, and add our choices to a shopping bag.

Instead of trying to picture everything from separate photos, we can see it together, make changes, and find something we’re happy to buy.

That’s ReScene.

## Editing notes

Keep the recorded narration at its existing speed. Insert the seven holds specified in VIDEO_TIMELINE.md only in the pauses around the supplied cue points. The on-screen opening caption establishes that ReScene started from scratch during the hackathon; the narration repeats that fact at about0:20. Record genuine inference and microphone interactions, preserve the matching outputs and label time cuts. The AI-narrated shopping quotation is not itself proof of recorded voice input.

The photo-composition route generates a new image and reconstructs it; Build/Shop reuse approved saved catalog meshes. Prepared photography is not fresh inference on browsing. Product metadata and asset references are in Neon, while R2 holds media. No recording or submission has been completed by writing this plan.
