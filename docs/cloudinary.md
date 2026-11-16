# Cloudinary media

Heavy files (images, video, audio, 3D models) are served from Cloudinary when
`VITE_CLOUDINARY_CLOUD_NAME` is set at build time. Without it, the same paths load from `public/`,
so local development needs no Cloudinary account. The mapping lives in `src/media.ts`.

## Rule

A file at `public/<path>` must have the Cloudinary **Public ID** `echo/<path>`:

| Type | Public ID | URL the app requests |
|---|---|---|
| Image (`jpg png webp gif avif`) | path **without** extension | `https://res.cloudinary.com/<cloud>/image/upload/f_auto,q_auto/echo/<path>` |
| Video and audio (`mp4 webm mov mp3 wav ogg m4a`) | path **without** extension | `https://res.cloudinary.com/<cloud>/video/upload/echo/<path>` |
| Anything else, including 3D models (`.glb`) | path **with** extension | `https://res.cloudinary.com/<cloud>/raw/upload/echo/<path>` |

Audio is a `video` resource in Cloudinary. The Cloudinary web uploader usually adds a random suffix to the
Public ID and does not put the folder in it, so upload with the script below instead.

## Upload

```bash
# .env (never commit it): CLOUDINARY_URL=cloudinary://KEY:SECRET@CLOUD
npm run media:upload -- --dry-run      # list what would be uploaded and its Public ID
npm run media:upload                   # upload intro/, assets/ and moon-stories-watercolor/assets/
npm run media:upload -- assets/models  # upload one folder only
npm run media:upload -- --organize     # already uploaded: only move files into their Media Library folders
```

Folders are created by the upload; there is nothing to create by hand. `public/intro/` is not in git:
copy it in first (see README). Fonts, page code, `.zip` and `.blend` files are never uploaded.

## Deploy (Vercel)

Project → Settings → Environment Variables, for Production and Preview:

- `VITE_CLOUDINARY_CLOUD_NAME` = your cloud name
- `VITE_CLOUDINARY_FOLDER` = `echo`

Then redeploy without the build cache: `VITE_` values are read at build time. Never put the API key or
secret on Vercel; the site does not need them.

When you add a new image, video or model under one of these folders, upload it before deploying,
or it returns 404 on the live site.

## Folder tree

150 files. `intro/` is listed from what the app expects, since it is not in the repo.

```
echo/
├── assets/backdrops/   (8 files, image)
│     atlas.webp
│     deep.webp
│     lab.webp
│     logbook.webp
│     map.webp
│     mars.webp
│     moon.webp
│     sources.webp
├── assets/chat_bot/   (1 file, image)
│     Lunar Bot Sticker Expression Sheet.png
├── assets/missions/   (6 files, image)
│     no-stay1.png
│     no-stay2.png
│     no-stay3.png
│     no-stay.png
│     yes-stay2.png
│     yes-stay.png
├── assets/models/   (9 files, raw)
│     curiosity.glb
│     descent.glb
│     ingenuity.glb
│     mer.glb
│     newhorizons.glb
│     perseverance.glb
│     pioneer.glb
│     viking.glb
│     voyager.glb
├── assets/photos/   (32 files, image)
│     alsep12.webp
│     apollo11_psep.jpg
│     apollo12_descent.webp
│     apollo15_descent.webp
│     blueberries.webp
│     curiosity.webp
│     dawn.webp
│     descent.webp
│     golden.webp
│     ingenuity.webp
│     insight.webp
│     kepler.webp
│     lrrr.webp
│     lrv16.webp
│     lrv17.webp
│     lrv.webp
│     near_shoemaker.webp
│     opportunity.webp
│     pathfinder.webp
│     perseverance.webp
│     phoenix.webp
│     pioneer10.webp
│     pioneer11.webp
│     pluto.webp
│     ranger7.webp
│     sojourner.webp
│     spirit.webp
│     surveyor3.webp
│     viking1.webp
│     viking2.webp
│     voyager1.webp
│     voyager2.webp
├── assets/story/   (3 files, image)
│     chapter-logo.png
│     chu-cuoi-layout.png
│     lunar-layout.png
├── assets/textures/   (3 files, image)
│     khan-ran-weave.png
│     mars.webp
│     moon.webp
├── assets/textures/planets/   (7 files, image)
│     earth.webp
│     jupiter.webp
│     mercury.webp
│     neptune.webp
│     saturn.webp
│     uranus.webp
│     venus.webp
├── intro/images/   (22 files, image)
│     1.jpg … 22.jpg
├── intro/videos/   (22 files, video)
│     1.mp4 … 22.mp4
├── intro/   (1 file, video)
│     reading-music.mp3
├── moon-stories-watercolor/assets/backgrounds/   (3 files, image)
│     scene01_base.webp
│     scene01_fg.webp
│     scene01_mid.webp
├── moon-stories-watercolor/assets/characters/cuoi/   (2 files, image)
│     cuoi_stand.webp
│     cuoi_turn.webp
├── moon-stories-watercolor/assets/characters/rabbit/   (3 files, image)
│     rabbit_ears_up.webp
│     rabbit_hop.webp
│     rabbit_idle.webp
├── moon-stories-watercolor/assets/characters/rover/   (1 file, image)
│     rover_hint.webp
├── moon-stories-watercolor/assets/images/   (27 files, image)
│     1.jpg
│     2.jpg
│     3.jpg
│     4.jpg
│     5.jpg
│     6.jpg
│     7.jpg
│     8.jpg
│     9.jpg
│     10.jpg
│     11.jpg
│     12.jpg
│     13.jpg
│     14.jpg
│     15.jpg
│     16.jpg
│     17.jpg
│     18.jpg
│     19.jpg
│     20.jpg
│     21.jpg
│     22.jpg
│     ask-uncle-cuoi.png
│     NASA Space App.png
│     rover.png
│     rover (2).png
│     thongoc (2).png
```
