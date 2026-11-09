# NASA_hackathon

"Echo: Abandoned but Not Forgotten", a static web game for NASA Space Apps. Stack: React 19, TypeScript, Vite, React Three Fiber (WebGL), GSAP, Zustand, react-i18next. There is no backend; progress is stored in `localStorage`. See `README.md` for layout and commands.

- All player-facing text lives in `src/locales/<lang>/`; never hard-code it. `src/data/*.json` holds structure only.
- Physics belongs in pure functions under `src/sim/`, covered by `npm test`.
- Every fact needs an entry in `src/data/sources.json`. Check current hardware status against NASA before changing it.

## Choosing skills

This project has 30 private skills in `.claude/skills/`. Each skill's description already states its scope; this section only defines how to choose when several overlap.

## Rules

- Load a skill before writing code or content within its scope.
- Load only the skills the current step needs, usually 1-3. Never load a whole group.
- Once the project has code, follow the framework and renderer (WebGL or WebGPU) already in use. If there is no code yet, ask before choosing.
- If no skill fits, work normally. Do not force a loosely related skill.

## Choosing a group

| Task | Group |
|---|---|
| Anything inside a 3D canvas: scenes, models, shaders, lighting | `threejs-*` |
| DOM or SVG animation, scroll effects | `gsap-*` |
| Page structure, video scripts, titles, emails, social posts | content skills below |

When combining 3D with scrolling, `gsap-scrolltrigger` drives progress and `threejs-*` handles rendering.

## Three.js

| Situation | Skill |
|---|---|
| Scene, camera, renderer, resize, render loop | `threejs-fundamentals` |
| Writing in React | `threejs-react-three-fiber`, plus topic skills as needed |
| Shapes, vertex data, instancing, point clouds | `threejs-geometry` |
| Choosing and tuning materials | `threejs-materials` |
| Image setup, UVs, color spaces, render targets | `threejs-textures` |
| Lights, shadows, HDR environments | `threejs-lighting` |
| Loading models, textures, or HDRs at runtime | `threejs-loaders` |
| Compressing and validating glTF files before they reach the app | `threejs-asset-pipeline` |
| glTF clips, skeletons, morph targets | `threejs-animation` |
| Clicks, hover, drag, camera controls | `threejs-interaction` |
| Custom shaders, per-object effects | `threejs-shaders` |
| Full-screen effects: bloom, depth of field, color grading | `threejs-postprocessing` |
| Slow or janky scenes, high memory use | `threejs-performance` |

Order for a new scene: `threejs-fundamentals`, then `threejs-geometry` or `threejs-loaders`, then `threejs-materials`/`threejs-textures`, then `threejs-lighting`. Optimize only after measuring a problem.

## GSAP

| Situation | Skill |
|---|---|
| Basic tweens, easing, stagger, responsive, reduced motion | `gsap-core` |
| Sequencing multiple animations | `gsap-timeline` |
| Scroll-linked animation, pinning, scrub, parallax | `gsap-scrolltrigger` |
| Flip, Draggable, SplitText, SVG drawing, ScrollSmoother | `gsap-plugins` |
| React or Next.js | `gsap-react` |
| Vue, Nuxt, Svelte, SvelteKit | `gsap-frameworks` |
| Utility functions: clamp, mapRange, snap, wrap | `gsap-utils` |
| Janky DOM animation | `gsap-performance` |

## Easily confused boundaries

- Motion baked into a model uses `threejs-animation`. Tweening camera position or object properties uses `gsap-core`/`gsap-timeline`. Vertex deformation uses `threejs-shaders`.
- Jank in the canvas uses `threejs-performance`. Jank in the DOM uses `gsap-performance`.
- If a model file is too heavy, fix it with `threejs-asset-pipeline` before optimizing at runtime.
- React with both 3D and DOM animation: `threejs-react-three-fiber` for the canvas, `gsap-react` for the DOM.

## Content

| Situation | Skill |
|---|---|
| Planning a new page structure | `wireframe-writer` |
| Critiquing an existing page or wireframe | `wireframe-reviewer` |
| Short videos, hooks, opening lines | `storytelling-hooks` |
| YouTube scripts of roughly 6-25 minutes | `long-form-youtube` |
| Titles, thumbnails, low CTR | `titles-and-thumbnails` |
| Instagram or LinkedIn carousels | `carousel-narratives` |
| Emails, newsletters, subject lines | `email-hooks` |
| Finding why a published video underperformed | `retention-audit` |
| Extracting a formula from a whole channel's data | `channel-formula` |

`retention-audit` and `channel-formula` need real performance data. If it is missing, ask the user and do not guess numbers.
