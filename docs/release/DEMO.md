# ReScene demo and submission draft

Status: release preparation, not a submitted entry. Product demo freeze stays November 2, 2026, Asia/Manila. The public event page currently lists November 4 at 9 PM ET for submissions; verify the participant portal for changes and track-specific fields. [Official event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon). The details URL returns a client-side loading shell to public retrieval, so required video length and private submission fields remain unverified. [Participant details](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details).

## Description draft

ReScene turns a room photo into an editable, interactive 3D product scene. A seller uploads a photo, reviews the objects identified by Meta AI, reconstructs separate 3D meshes, and adds their own product names, prices and store links. They can move, resize, hide or replace furniture, adjust lighting, and publish a read-only showroom where visitors select objects to explore product details.

Muse Spark analyzes the photo, SAM 3.1 segments individual objects, and Meta SAM 3D Objects reconstructs meshes through fal. ReScene fits the saved poses to an approximate room, transfers visible source detail into object textures, and preserves generated appearance on unseen surfaces. Shared scenes are frozen snapshots, so subsequent merchant edits do not change earlier links.

One photo does not establish exact product identity, dimensions, hidden geometry or physical material properties. Room extensions and demo catalog assets are illustrative. Merchant prices and URLs are entered by the seller; ReScene is not a checkout system.

## Demo sequence

Use a short recording suitable for the participant portal's actual limit. The timings below are a suggested 90-second cut, not an organizer requirement.

1. 0–10s: Show the source chair/cabinet/vase photo and explain that ordinary images require switching between views and product details. Label this demo input as synthetic.
2. 10–25s: Upload, start Meta analysis, and show the reviewed masks. Cut past processing with an honest elapsed-time label from the release report; do not imply instant inference.
3. 25–40s: Show separate reconstructed objects and the reference thumbnail. Orbit, select a piece, and adjust position/size. Mention approximation rather than scan accuracy.
4. 40–55s: Show visible cabinet grain/fabric transfer and lighting controls. Explain that hidden texture and room extension are approximate. This feature uses existing saved assets and CPU graphics, not another model call.
5. 55–70s: Enter product details and replace one piece with an original catalog demo. Restore it to show the original card and mesh survive.
6. 70–85s: Save → Publish snapshot → confirm approved viewer assets. Open the link in an incognito/signed-out browser, select objects and follow the merchant URL. Use a real permitted merchant URL for the final recording; QA uses example.com only.
7. 85–90s: Change the private draft, show that the old viewer remains unchanged, and point out Revoke link.

## Model and asset attribution

- Meta Muse Spark: muse-spark-1.3, directly through Meta Model API, scene analysis/room observations.
- Meta SAM 3.1: sam-3.1, directly through Meta Model API, object masks.
- Meta SAM 3D Objects: fal-ai/sam-3/3d-objects hosted on fal, independent meshes and inferred textures.
- ReScene: source-photo UV transfer, estimated room planes, lighting UI, editing/product mapping and immutable snapshots.
- Demo catalog: three original procedural GLBs and SVG thumbnails, CC0 1.0. See CATALOG.md.
- No WorldGen API, Muse Image editing, voice, garment fit or exact unseen reconstruction is claimed. Do not list unused Meta models or Muse Code as integrations.

## Links and fields

- Live authoring app: https://rescene-eta.vercel.app
- Source: https://github.com/jimclydegm/ReScene
- Public demo link: publish an approved final scene in the app and paste its unlisted /s/ URL into the participant form. Test links are revoked automatically and are not submission links.
- Track: Indie developer (confirmed by Jim). Builder/team profile, final video URL and participant-required fields: Jim to confirm in the authenticated portal.
- Architecture: ARCHITECTURE.md; models: META_MODELS.md; verification: TESTING.md; current handoff: CONTEXT.md.

## Final human checks

- Desktop/mobile: orbit, object selection, product links, numeric controls, tabs, lighting and reference dialog.
- Compare source vs reconstructed scene: orientation, contacts, fabric/grain, plane boundaries and oblique stretching. Do not equate passing geometry tests with photorealism.
- Open the final share without a session. Confirm title and all visible merchant fields are approved, and no source photo/mask/editor controls appear.
- Confirm actual Google consent if it is part of the demonstration; email-session QA does not verify Google OAuth consent.
- Record screenshots/video once browser access is enabled, verify the portal's actual requirements, then review and submit the entry. No contest submission has been made.

## Verified release evidence

The deployed fresh author-to-shopper API flow passed on October 29 with two real Meta SAM 3D meshes. Server analysis/masking took 19.824 seconds and reconstruction/ingestion took 82.298 seconds; these exclude human review/editing time. The frozen viewer passed anonymous product/GLB access and revoke. See TESTING.md for limits and billing interpretation. Browser visual QA and recording remain pending.
