# ReScene desktop design

The October 31 design pass applies [Unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky. Its audit, direction and token guidance informed this adaptation; attribution is retained under CC BY 4.0. Unslop is a design skill, not a browser runtime or component dependency.

## Direction and audit

ReScene turns product and scene photos into editable, shoppable 3D experiences. The interface should feel calm, exact and tactile. Its visual world is a photography studio: graphite surfaces, clear labels, restrained green selections, and photographs and reconstructions carrying the rich colors. The existing cube logo and Photo → Review → Edit steps remain the signature.

The audit found small and inconsistent captions, weak text contrast in dark mode, excessive green/brown tint across interface surfaces, competing border/radius styles, letter-spaced uppercase labels, and overlapping retail styles accumulated across releases. Scene controls also wasted vertical space while important buying actions fell below the first desktop view.

## Implementation

`src/app/design.css` owns the presentation tokens and styles across the app. The original global and retail sheets are in the `legacy` CSS cascade layer so their existing layout behavior remains available without winning specificity battles against the current design. Unlayered presentation rules always win over normal layered rules regardless of route stylesheet load order. Do not put a new color or layout patch at the bottom of one of the legacy sheets. Keep new rules scoped to their surface; retail styles start with `.demo-store` so navigating to the demos cannot restyle private studio pages.

Keep Geist and Geist Mono, the existing logo, and the persisted Light/Dark/System menu. Three text roles are `--ink`, `--ink-2` and `--muted`; surfaces are `--paper`, `--surface` and `--surface-2`. Green marks selections and links; semantic warning/error fills retain their meaning. Photography and the 3D materials are unaffected by theme changes. The existing contrast test now reads the shipped palette from design.css.

Use 4px spacing increments, 8px control radii, 12px panel radii and 32–36px compact buttons. Body and navigation text are 14px, control labels 12–13px, page titles 28–32px, and the main landing headline 48–68px. Preserve visible keyboard focus and reduced-motion behavior. Content photographs are existing approved public demo assets; no new generation is needed for this design pass.

Desktop targets are 1280×800 and a larger presentation monitor. Existing mobile rules remain as fallbacks; no mobile redesign is in scope. Do not change the camera or field of view to fill extra panel space. Keep reference-frame aspect fitting, saved transforms and render materials intact.

## Page and state coverage

- `/`: asymmetric product-preview hero, direct copy, quiet navigation, clearer process steps and footer.
- `/auth/sign-in` and `/auth/sign-up`: existing product photograph, clear form hierarchy, consistent fields/buttons and appearance menu. Login requests and provider configuration are unchanged.
- `/dashboard`: uniform smaller scene thumbnails, readable status/progress metadata, compact search/filter/actions and pagination. Active, Trash, search-empty and first-project states share the same system.
- `/scenes/new`: aligned photo and Image Studio cards, upload form, generated library, preview and empty state.
- `/scenes/create`: compact product picker/library, setting photo grid, aspect controls, prompt, saved drafts and generated-result gallery. Product/setting/generated-photo modals, Trash and review states are included.
- `/scenes/[sceneId]`: draft upload, analysis/mask review, generation, editor and recoverable failure states. All five inspector panels (Objects, Scene, Textures, Light, Products), reports, transforms, view/download tools, share/details/restart/unsaved-change dialogs and dismissible notices are included.
- `/s/[slug]`: read-only viewer, object selector, merchant card, refresh failure and unavailable-link states.
- `/demo`: three photo-led workflow cards and consistent shopping navigation.
- `/demo/products`: compact uniform product thumbnails, category/search toolbar and empty state.
- `/demo/product/[id]`: Album/3D switch, photo filmstrip, price, finishes, quantity, buying actions and reviews in one desktop layout; specifications/review/album dialogs are included.
- `/demo/spaces` and `/demo/scenes`: larger, consistent scene previews with concise context and clear entry actions.
- `/demo/space`: compact six-layout strip, saved-layout selector, collection, adjustments, finishes, lighting and purchase action.
- `/demo/shop-the-scene`: product strip and selected-product inspector, hide/show, position/rotation, finishes, lighting and shopping-list modal.
- Demo-wide shopping bag, checkout, confirmation, inspiration albums, reset, toast, loading and error states.
- Root loading, not-found and error pages, demo error and public-share not-found screens.

## Scope boundary

This is presentation work only: CSS, display text, image display dimensions and auth-shell artwork. No API handlers, services, workflows, schema, inference parameters, mesh/texture data, saved scene state or cart/arrangement logic change. Do not submit paid generation or modify saved projects to verify CSS. Temporary visual fixtures must be removed before building or publishing.

## Verification

237 existing tests, schema validation, lint, TypeScript and production build pass. The read-only demo UI smoke covers the seven demo routes, every catalog product and collection variants, Album as default, asset privacy and delivered shared styles. Built landing/auth/unavailable screens also load the shared presentation system; private routes retain authentication redirects. Exact-head CI/deployment and remaining native desktop checks are recorded in CONTEXT and ROADMAP at release. Initial native checks covered the home demo, product album, arranger and synthetic editor/review; access switched off during checks, so the remainder is not claimed as visually verified.
