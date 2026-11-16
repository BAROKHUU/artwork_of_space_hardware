# Codebase review

Scope: `artwork_of_space_hardware`; sibling watercolor files are source references.

## Acceptance
- `/story` offers the existing video and watercolor experiences in the current visual style.
- Both choices work; users can return and switch; navigation, mobile layout, keyboard access, and locales remain usable.
- Fix verified defects with focused regression checks; list larger upgrades separately.
- Run the existing tests and production build; inspect affected screens locally.
- Preserve authored content, progress, assets, and secrets. No publication or remote changes.

## Tasks
- [x] Locate the app and confirm clean initial Git status.
- [x] Start independent frontend, backend, and story evidence reviews.
- [x] Restore project dependencies and record baseline checks (99 tests passed).
- [x] Implement unified story selection, preserve the existing visual style.
- [x] Fix assessment validation/timeouts and keyboard navigation findings.
- [x] Review changes independently; check desktop, mobile, and keyboard flows.
- [x] Supply local story media, preserve originals, exclude copies from Git.
- [x] Record results, remaining proposals, and validation gaps.

## Verification
- Current tests: 108 passed across 21 files. Production build passed under `/nested/` after Git integration.
- Independent assessment, accessibility and story reviews found no remaining confirmed defect.
- Browser checks passed at 1440, 768 and 320 pixels in English, Vietnamese and Chinese: story selection, both readers, return/switch links, keyboard navigation, dialog focus, no document overflow or captured JavaScript exceptions.
- Production regression passed under `/nested/`: invalid style fallback, watercolor exit, saved progress, completed replay, decoded/playing video, loaded thumbnail, unavailable music control.
- All 44 copied media files match original SHA256 hashes (192,324,455 bytes); copies are ignored by Git. Existing tracked watercolor illustrations remain tracked.
- Missing music no longer leaves a broken control. Pulled upstream picker copy still mentions music; review that copy against deployment media availability.
- Whitespace check passed with `core.whitespace=cr-at-eol`, preserving authored watercolor HTML line endings.
- Dependencies restored with npm ci --ignore-scripts; no new dependencies added.

## Proposed follow-up work
- Fix the watercolor header text overlapping the shared controls at 320px; this layout is present in the pulled upstream version.
- High priority before public deployment: add chat request limits and usage controls. `artwork_of_space_hardware/server/start.ts:17-41` accepts requests without an Origin header; `server/groq.ts:55-77` calls paid providers without application authentication or a rate limiter. Deployment-level protections are unknown; choose the enforcement point before implementation.
- Choose a canonical watercolor source before consolidating duplicate copies under the app's `public`, `intro` and workspace sibling folders. Preserve originals until that decision.
- Translate authored English story and legend content; interface labels already support English, Vietnamese and Chinese.
- Consider moving Gemini credentials from query parameters to the provider's supported authentication header after verifying compatibility; no credential leakage was observed.

## Limitations
- Live API calls and external media services were not tested; browser checks blocked external network requests. Credentials untouched.
- Optional `intro/reading-music.mp3` is absent. Local media must be supplied separately in another checkout or deployment; README documents setup.
- In-app browser unavailable; rendered checks used Playwright with installed Chromium.
- Full session token, usage and cache metrics unavailable.
- OMP roles adapted to Codex read-only review tasks; their tool allowlists are not enforced by this runtime. Sensitive configuration excluded from delegated scope.

## Latest Git sync
- [x] Fetch origin; main advanced from 87918eb to 8440a16 (unified story modes).
- [x] Preserve local changes; pull main; integrate overlapping story implementations.
- [x] Independently review conflict resolution; rerun tests, build and story browser checks.
- HEAD and origin/main both resolve to `8440a1615288b1909c6942e70405079cca01074a`; no unmerged paths. All local edits remain unstaged; no commit or push.
- Original local changes retained in stash `d425534c551a70f961aa5d520981813bc3aba0f5` (`codex-before-pull-2026-11-16`). Local media preserved.
- Resolved seven overlapping files using upstream story modes and shared controls, retaining local progress, nested-path, media and accessibility fixes. Reaching the last scene still completes the story as required by upstream; early exit does not.
- Final checks: 108 tests across 21 files; production build with `/nested/`; browser regression at 1440/768/320, including decoded video and named exit buttons; whitespace check. Screenshots: `.codex-review/story-QqvWas/`.
- User authorizes remote fetch/pull and conflict resolution; ask only on indecidable choices. No commit or push requested.

## Blender quick preview
- [x] Render a local 1440×900 concept containing Chú Cuội, Thỏ Ngọc, Luna Rover and the Moon mission map, using the supplied image references.
- [x] Save `previews/moon-concept.png`, `previews/moon-concept.blend` and the reusable `previews/moon_concept.py`; preserve the original Blender scene and app code.
- [x] Obtain direction on terrain and rover integration. User approved integration, sharper realistic craters and fast Vercel loading; the original concept remains a stylized blockout, not final watercolor fidelity.
- [ ] Complete production QA before claiming Vercel compatibility. Browser-ready rover export and local production loading are verified; hosted loading, frame performance and exact terrain contact remain open (see implementation record below).

## Lunar terrain reference review — 2026-11-16
- User reference: https://www.turbosquid.com/3d-models/3d-lunar-blender-model-1545577. Public request returned HTTP 403; browser access unavailable even after @Browser mention. Reference visuals, license and model contents remain unverified; no asset downloaded or purchased.
- Current `previews/moon-refined-v2.png` visually retains regular dust ripples and faceted rocks. Recommend irregular dust detail, varied eroded crater rims, natural rock clusters and scale matched to the rover. Proposed direction only; no scene or app changes in this review.
- [ ] Before running `previews/moon_refined_v3.py`, correct v2 output paths (lines 511, 521–522) to preserve existing artifacts; correct the `MAT_v2_` filter (line 436) to match `MAT_v3_` materials (line 39).
- [ ] Render and compare v3 before judging terrain quality. V3 source adds multiscale terrain noise and smooth-shaded irregular rocks; no v3 render exists yet.

### Supplied terrain images — reviewed 2026-11-16
- [x] Inspect all seven attached images against `previews/moon-refined-v2.png`. These establish visual direction; source geometry, license, physical scale and NASA topographic accuracy remain unverified. The website itself is still inaccessible. No models, scripts or app files changed during this review.
- Images are numbered in attachment order, all under `/tmp/`:
  1. `codex-clipboard-05fc07bc-8cf6-4b02-a328-36d5a380de27.png`: elevated overview; varied overlapping crater sizes, raised irregular rims and broken ridges. Use for overall terrain structure.
  2. `codex-clipboard-82509bef-db07-44c6-952c-1bb1365881e3.png`: broad ground-level view; uneven horizon, terrain depth and a relatively open foreground. Use for playable route composition; white block objects are not requested assets.
  3. `codex-clipboard-a3124c00-292d-40a8-935b-be4377de5255.png`: bright gravel field and sharper crater lips. Use for small-stone density and light/dark material variation.
  4. `codex-clipboard-8f40ecbf-dac3-40e6-b5a1-41b921f50914.png`: close elevated crater view; overlapping impacts, rough rim shoulders and slope grooves. Primary reference for crater geometry.
  5. `codex-clipboard-0c2880d4-fb03-4a43-bb1b-8e1a9b3e2c78.png`: foreground boulders with surface variation, partly buried bases and clustered gravel. Primary rock/material reference.
  6. `codex-clipboard-8cffb7cd-30f2-46de-9c89-106cd6b73838.png`: low horizon, dense mixed-size rocks and strongly directional shadows. Use for gameplay-level scale and lighting.
  7. `codex-clipboard-235a985e-8754-437f-b387-83b3e764cb35.png`: asymmetric foreground crater, rough slopes, sparse larger rocks and fine gravel. Primary combined terrain/lighting target; visible sun glow is optional reference styling, not a requirement.
- Shared appearance: charcoal-to-light neutral gray ground, subtle muted variation in rocks, matte dusty surfaces, black sky and one dominant low-angle light. Palette is qualitative; no pixel samples taken. Earth placement and apparent size are composition choices, not verified astronomical measurements.
- Priorities versus v2: (1) replace smooth bowls with varied raised rims, overlapping craters and irregular slopes; (2) remove regular surface ripples, add granular dust detail; (3) replace faceted scattered rocks with varied partly buried shapes, fine gravel and uneven clusters; (4) compare at a ground-level gameplay camera as well as the existing overview. Keep traversable routes and contact heights coherent.
- Separate asset direction: retain a realistic NASA-based Luna Rover using the supplied source; preserve Chú Cuội/Thỏ Ngọc's stylized identity while refining silhouettes, facial features, clothing seams and material separation. These terrain references do not specify new character designs or animation requirements.
- [x] User authorized terrain and rover only preview. Created isolated `Terrain and Rover Preview` scene using all 134 supplied community rover objects; preserved source/v2. Separate builder `previews/terrain_rover_preview.py` avoids the unrelated v3 defects above.
- [x] Created `previews/terrain-rover-preview.blend` and scene stats; corrected the copied rover's `Dial_2basecolortexture.jpeg` capitalization mismatch. No missing referenced rover images reported. Replaced periodic crater ribs with irregular spatial detail.
- [x] Rendered baseline and refined overview/ground-level views at 1440×900 using Eevee. Refined outputs: `previews/terrain-rover-refined-overview.png`, `previews/terrain-rover-refined-ground.png`, editable `previews/terrain-rover-refined.blend`. Blender exited successfully; both PNG headers verified. No character, application, export or deployment changes in this preview scope.
- [ ] Preview QA follow-up: surface grain and angular rocks were visible, but preview crater rims remained soft/clay-like; wheel contact remained unverified (source checks wheel bounding boxes near zero, not evaluated tires against terrain). Compare directly with original reference images when available again; `/tmp` attachments were unavailable. See implementation record below for later browser loading checks.
- Proposed browser delivery: GLB with standard baked PBR materials; bake fine grain into texture/normal detail, reuse rock geometry through instances, keep collision geometry simple and consistent with visible terrain. Check the current runtime's support before choosing compression or adding a decoder/dependency.
- Acceptance before a Vercel-readiness claim: reference comparison; exported assets/materials load from a served production build without missing resources; rover/characters sit on terrain; movement/collision and mission interactions work; record transfer size and browser frame performance on agreed test devices. Actual hosted verification requires a deployed build; Blender renders alone cannot guarantee it.

### Implementation and verification — 2026-11-16
- User approved terrain and rover integration, sharper realistic craters and fast loading. High graphics loads the community rover GLB; low graphics uses the procedural fallback without downloading it.
- `public/assets/models/lrv.glb`: 4,851,744 bytes, 248,082 triangles, 54 primitives and 40 materials; no external textures or decoder. The asset is untracked and must be included when deploying.
- Production build passed; 18 simulation and rover tests passed. The production GLB returned HTTP 200 with identical hashes. Browser driving reached 134 m.
- QA remains partial: hosted Vercel loading, FPS and exact crater/wheel contact are unverified. Reference comparison and remaining gameplay acceptance above still apply.
