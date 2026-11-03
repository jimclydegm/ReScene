# Assets, dependencies and attribution

ReScene was started from scratch during the Meta Global AI Developer Hackathon. The repository was created October 28, 2026. Application workflows, editing, graphics integration and shopping behavior were built during the event. Existing libraries and pretrained models are credited separately.

The five README screenshots were captured from ReScene’s working public desktop demos on November 2, 2026: The Sunday Living Room, City essentials, Home essentials, The Everyday Collection and the Form Sage Chair product page. They show the prepared generated catalog in the actual app. Cropping removes browser chrome; the scene content is unchanged.

## Application code

Jim has chosen to leave the original application code unlicensed for now. Public availability permits inspection but is not a general license to reuse the application. This does not change licenses attached to third-party components or the limited procedural-asset dedication below.

## Prepared demonstration media

The showroom uses approved derived 3D models reconstructed with hosted Meta SAM 3D Objects and photographs generated with Muse Image. New sample photographs are AI generations from project references, rather than cropped product cards or screenshots of meshes. Catalog names, prices, measurements, reviews and checkout behavior are authored demonstration content, not verified real-world commercial listings or completed purchases.

- [Generated photo manifest](../src/lib/demo/example-media.json): 130 photographs, including eight scenes and 122 individual product photographs.
- [Earlier photographic manifest](../src/lib/demo/photography.json): earlier studio/angle/interior generations.
- [Approved model manifest](../src/lib/demo/catalog-models.json): 136 GLBs with SHA-256, byte length, placement and derived collision hulls.
- [Sample release](https://github.com/jimclydegm/ReScene/releases/tag/judge-assets-v1): deliberately public derived model copies for reproducible evaluation. Source uploads/masks/private model receipts are excluded.
- [Sample library provenance](../public/samples/v3/provenance.json): settings/products used by Image Studio. Earlier sample manifests remain beside their assets.

These records establish generation/provenance and file integrity; they do not by themselves establish rights to an uploaded source reference or all generated subject matter. The sample release grants no additional rights in underlying references, model weights or trademarks. Do not apply the procedural catalog's CC0 dedication to generated media or uploaded photographs. For the final recording, use project-generated, unbranded examples with verified input rights. Uploaded user examples are not automatically licensed for redistribution. No stock footage or music is required.

## Procedural catalog

The three original procedural catalog meshes and SVG illustrations in `src/lib/scene/catalog.ts` remain dedicated under CC0 1.0 as documented in [CATALOG.md](CATALOG.md). That dedication covers those assets only.

## Design guidance

[Unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky informed the desktop visual design, audit and token direction. ReScene adapts that guidance to its own app; attribution is retained under CC BY 4.0. See [design system](DESIGN_SYSTEM.md). Unslop is not a runtime component or model.

## Libraries and model services

Next.js/React, Three.js/React Three Fiber/Drei, Prisma, PostgreSQL adapters, the Neon Auth SDK, AWS S3 SDK, fal client and other npm dependencies retain their own licenses. See package-lock.json and the packages' distributions. Meta models and hosted inference remain subject to their respective model/service terms. This repository does not redistribute pretrained weights. Model roles and source links are in [MODEL_USAGE.md](MODEL_USAGE.md).
