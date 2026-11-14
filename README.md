# Echo: Abandoned but Not Forgotten

A browser game for the NASA Space Apps challenge *Abandoned but not Forgotten*. Players are Echo, a small rover tracing the signals of 15 machines NASA left on the Moon, on Mars, and in deep space, across eight chapters from 1964 to today.

## Run it

```bash
npm install
npm run dev       # local development
npm test          # physics, content, and translation checks
npm run build     # type-check and build the static site into dist/
npm run preview   # serve the built site
```

`dist/` is plain static files and runs on GitHub Pages, Netlify, Vercel, or any web server. Routes use `#/`, so no rewrite rules are needed.

### RISE BOT: NASA knowledge and RAG

The bot uses Groq to answer. A small hybrid RAG pipeline searches `knowledge/nasa.json` using BM25 and Cohere multilingual embeddings, fuses the rankings, and reranks candidates with Cohere. NASA source links appear below each answer. Simple greetings bypass retrieval. The system prompt is in `knowledge/system-prompt.ts`.

Set `GROQ_API_KEY`, `GROQ_CHAT_PASSWORD`, and `COHERE_API_KEY` in the ignored `.env.local` file, then restart `npm run dev`. Enter the chat password in the bot panel. Keep keys server-side and never prefix them with `VITE_` or commit them. After editing `knowledge/nasa.json`, run `npm run knowledge:index` and commit the resulting `knowledge/index.json`. The index contains vectors, a model identifier, and a content hash; it contains no API keys. Cohere is used both when indexing and querying, so embedding models and dimensions match.

The endpoint runs in Vite dev/preview and as `api/chat.ts` on Vercel. Configure the same three secrets in Vercel project environment variables and deploy the generated index. A standalone static `dist/` host still needs a separate backend. If Cohere or the index is unavailable, the bot visibly falls back to keyword retrieval. The shared password is suitable for a demo; production needs per-user authentication, rate limits and a labeled retrieval evaluation.

## Where things live

| Path | Contents |
|---|---|
| `src/data/chapters.json` | Chapter order, story beats, and mission settings |
| `src/data/hardware.json` | The 15 machines: location, status, dates, photo, sources |
| `src/data/sources.json` | Every reference |
| `src/data/generated/ephemeris.json` | Probe distances from JPL Horizons |
| `src/locales/en/` | All on-screen text |
| `src/sim/` | Physics and terrain, as pure tested functions |
| `src/missions/` | The five mission templates |
| `src/three/` | Echo, hardware models, terrain, and scenery |
| `src/screens/` | Title, Missions, Chapter, Logbook, Atlas, Lab, Sources |
| `public/assets/` | NASA photos and Moon and Mars maps |

## Common tasks

**Add a language.** Copy `src/locales/en` to `src/locales/<code>`, translate the values, and add one line to `src/i18n/languages.ts`. The Settings menu lists it automatically, and `npm test` reports any missing keys. Atkinson Hyperlegible has limited coverage outside Latin scripts, so check how the text renders and add a font if needed.

**Add a machine.** Add it to `hardware.json`, its text to `locales/en/hardware.json`, its photo to `public/assets/photos/`, and a `memory` beat to a chapter.

**Add a mission.** Add a `mission` beat with an existing template to `chapters.json`, and its text to `locales/en/missions.json`.

**Before submitting.** Run `npm run data:links`, open any links it lists, and recheck hardware status against NASA. Voyager, Curiosity, and Perseverance can change quickly. Run `npm run data:ephemeris` and `npm run data:solar` to refresh probe distances, planet elements, and probe paths.

## What is real and what is not

Photos, planetary maps, dates, distances, and status come from NASA, JPL, and USGS, and are listed on the in-game Sources page. Echo and Archive Control are fictional. Most 3D spacecraft are NASA's published models (compressed in `public/assets/models/`); Ranger, Surveyor, the laser mirror, the Lunar Rover, and Sojourner are hand-built. The simulations shorten real distances and times. This is an independent project and is not endorsed by NASA.
