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

Copy `.env.example` to the ignored `.env` file, then set `GROQ_API_KEY` and `COHERE_API_KEY`. Optionally set `GROQ_API_KEY_2` as a backup; the server retries once with it if the primary returns HTTP 429 or 402. Groq rate limits apply at organization level, so two keys in the same organization share quota. Each question is limited to 512 tokens; the server keeps at most 2,048 tokens of recent conversation history. The system prompt and retrieved context are additional input tokens. Keep keys server-side and never prefix them with `VITE_` or commit them. After editing the knowledge files, run `npm run knowledge:index` and commit the resulting `knowledge/index.json`. The index contains 512-dimensional vectors, a model identifier, and content hashes; it contains no API keys. Cohere is used both when indexing and querying, so embedding models and dimensions match.

The endpoint runs in Vite dev/preview, as `api/chat.ts` on Vercel, or as a standalone Node service on Render. If Qdrant is configured, dense retrieval is performed there; otherwise the committed local vector index is used. If Cohere and the vector index are unavailable, the bot visibly falls back to keyword retrieval. The endpoint has no user authentication or request rate limit; input token limits do not cap the number of requests or prevent API charges. Production needs access controls, rate limits and a labeled retrieval evaluation.

### Deploy: Qdrant + Render API + Vercel frontend

1. Create a free Qdrant Cloud cluster and copy its HTTPS endpoint and API key into `.env` as `QDRANT_URL` and `QDRANT_API_KEY`. Keep `QDRANT_COLLECTION=nasa_knowledge`.
2. Upload the committed 512-dimensional embeddings:

   ```bash
   npm run qdrant:upload
   ```

   The script creates a 512-dimensional Cosine collection if it does not exist and safely upserts all chunks. When the knowledge or embeddings change, run `npm run knowledge:index` followed by `npm run qdrant:upload` again.
3. Push the repository to GitHub. In Render, choose **New > Blueprint**, connect the repository, and apply `render.yaml`. Enter `GROQ_API_KEY`, optional `GROQ_API_KEY_2`, `COHERE_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, and initially set `CORS_ORIGIN=*`. After deployment, verify `https://YOUR-SERVICE.onrender.com/health` and copy the service URL.

   If creating a Render **Web Service** manually instead of a Blueprint, use `npm ci` as the Build Command and `npm start` as the Start Command.
4. Import the same repository into Vercel. Keep the detected Vite settings (`npm run build`, output `dist`) and add only this frontend variable:

   ```dotenv
   VITE_API_URL=https://YOUR-SERVICE.onrender.com
   ```

   Deploy and copy the final Vercel production URL.
5. Return to Render, change `CORS_ORIGIN` from `*` to the exact Vercel origin (for example `https://echo-nasa.vercel.app`, without a trailing slash), then choose **Save, rebuild, and deploy**. Multiple allowed origins can be comma-separated.

Do not upload or commit `.env`; add the values through each provider's Environment dashboard. `VITE_API_URL` is public and may be exposed to the browser, but API keys must never use the `VITE_` prefix. For an all-in-one Vercel deployment, leave `VITE_API_URL` unset and add the five server-side keys to Vercel; the frontend will use the included `/api/chat` function instead of Render.

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
