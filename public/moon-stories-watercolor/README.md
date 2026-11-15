# Find You in the Universe — MoonTales

Old roots hold tight; new dreams take flight.

Independent local project: `C:\D\NASA Space App\moon-stories-watercolor`. Open index.html directly. No framework, build step, dependencies or runtime network services. Not deployed.

## Current experience
The existing Grandstander cover is preserved. Begin the Adventure links into the complete story; native scrolling also works. Six scenes and a quiet closing use all 22 original numbered JPGs in exact order, 1.jpg through 22.jpg. The cover separately retains its existing 22.jpg. PNG sheets and old derived sprite/background assets are not used.

The supplied 51 authored caption beats become 97 short display units, preserving every word, punctuation mark, speaker and sentence order. Cabin Sketch 700 is self-hosted, #FFF3DD, directly over the image with a soft shadow. Fraunces supplies small speaker labels. Text units are limited to 38 characters and checked with the actual font at minimum mobile width. The renderer also measures wrapping when text/font/viewport changes. Each caption has at most two text lines, plus a separate small speaker label.

## Scroll behavior
A 100svh sticky stage sits in an explicitly sized document section. A deterministic timeline includes image crossfades, caption fades and reading holds. requestAnimationFrame renders scroll position; no timer, Next/Back buttons, compulsory snapping, scroll interception or automatic return to the cover. Upward scrolling restores prior states. Scene 04 has slower holds; the final line remains visible through an extra closing hold.

Only three story image elements preload current/previous/next images; at most two overlap during crossfades. Desktop images cover the stage without distortion; portrait screens use contain to preserve essential objects. No character or camera motion. Reduced motion switches images and captions directly. Geometry is cached on resize; scrolling does not repeatedly measure layout.

Ask Uncle Cuoi remains at the top, away from captions. Its prepared answers cover the full story. A full accessible transcript is available after the ending, including a note distinguishing fictional ROVER from real lunar science.

## Created or changed
- index.html
- css/sequence.css
- js/full-story-data.js (new exact mapping)
- js/sequence.js
- js/guide.js
- assets/fonts/cabin-sketch-bold.ttf (new, existing CabinSketch-OFL.txt applies)
- docs/story-image-map.md (new)
- verification/check-sequence.mjs
- verification/full-story-images-baseline.json (new)
- verification/full-story-validation.json (new)
- verification/original-comparison.json
- README.md

Older styles/scripts and experiments remain on disk but are not loaded. Do not rerun the obsolete tools/isolate-assets.py.

## Checks
Run node --check on js/full-story-data.js, js/sequence.js and js/guide.js; then node verification/check-sequence.mjs. python verification/verify-original.py compares the original project against its full baseline.

Passed: 22 shots; exact 51 captions; 97 attributed units; 5001 reversible positions; final hold; reduced motion; actual renderer under simulated DOM/load events; bounded preloading; two-image overlap; local references; unique IDs; font metrics. SHA-256 confirms all 26 supplied image files remain byte-identical. Original project inventory, hashes, sizes and modification times remain unchanged.

No browser or desktop automation was used. Visual layout has not been browser-verified; these static/simulated checks do not replace a rendered check. No known missing asset or narrative mismatch remains against the supplied brief. No image generation, conversion or editing was performed.
