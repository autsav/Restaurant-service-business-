# PYNK Studio — teaser maker

Turns **one real photo of a restaurant's own dish** (plus an optional moving clip of it)
into an 8-second vertical teaser (1080×1920, 30 fps, MP4) for private pitches, cut in
three scenes: a full-screen macro with a hook line, the moving clip with the dish name
and price, then the whole plate with a PYNK Studio end card.

Built with [Remotion](https://www.remotion.dev). This tool only scales, positions and
crops the photo and clip; it applies no filters or retouching. The last scene always
shows the whole plate uncropped.

**If the clip is AI-generated** (e.g. Seedance image-to-video from the photo), compare it
with the real photo before sending: the model redraws the food and can change portion
size, piece count and sauce. Use `--stills` and reject anything the kitchen could not serve.

## Setup

```bash
npm install
```

Put the dish photos in `in/` and any licensed music in `assets/audio/`. Both folders
are gitignored, so client material never lands in the repo.

## Render one teaser

```bash
npm run teaser -- \
  --photo in/crackling-spinach.jpg \
  --restaurant "Fatt Pundit" \
  --dish "Crackling Spinach" \
  --price "£9.50" \
  --hook "Still sizzling." \
  --clip in/crackling-spinach.mp4 \
  --focus-x 0.5 --focus-y 0.55 \
  --audio assets/audio/bed.mp3 \
  --stills
```

| Flag | Required | Notes |
| --- | --- | --- |
| `--photo` | yes | jpg, jpeg, png or webp; shortest side ≥ 720px |
| `--restaurant` | yes | 1–40 characters |
| `--dish` | yes | 1–60 characters |
| `--price` | no | up to 12 characters, e.g. `£9.50` |
| `--hook` | no | big opening line, 2–4 words; defaults to "Hungry yet?" |
| `--clip` | no | mp4/mov/webm of the same dish for the middle scene; without it the photo is used |
| `--focus-x`, `--focus-y` | no | where the food sits in the photo, 0–1 from left / top; default 0.5 |
| `--audio` | no | music bed; the clip's own sound plays quietly either way |
| `--out` | no | defaults to `out/<restaurant-slug>/<dish-slug>.mp4` |
| `--stills` | no | also writes six check frames as PNGs to `out/_check/` |

On success it prints one JSON line: `{"ok":true,"output":"...","durationMs":1234}`.

## Render a batch

```bash
npm run batch -- --csv leads.csv --dry-run   # validate everything, render nothing
npm run batch -- --csv leads.csv             # render
npm run batch -- --csv leads.csv --force     # re-render rows whose output exists
```

CSV columns (these five must be present; `price` and `audio` may be empty). Optional
extra columns: `hook`, `clip`, `focusX`, `focusY`.

```csv
restaurant,dish,price,photo,audio
Fatt Pundit,Crackling Spinach,£9.50,in/crackling-spinach.jpg,
Fatt Pundit,Momo Platter,,in/momo.jpg,assets/audio/bed.mp3
```

One bad row never stops the batch. Rows whose output file already exists are skipped
unless `--force`. Results are written to `out/manifest.json`.

## Preview and edit

```bash
npm run dev     # Remotion Studio, composition "Teaser"
npm run typecheck
```

## Errors

Every failure prints one JSON line on stderr:
`{"ok":false,"code":"<CODE>","message":"...","row":<number|null>}`

| Code | Meaning |
| --- | --- |
| `INVALID_ARGS` | bad or missing command-line flags, or an unreadable CSV (exit code 2) |
| `INVALID_ROW` | a CSV row failed validation |
| `PHOTO_NOT_FOUND` | the photo path does not exist |
| `PHOTO_UNSUPPORTED` | not a jpg/jpeg/png/webp, or unreadable |
| `PHOTO_TOO_SMALL` | shortest side under 720px |
| `AUDIO_NOT_FOUND` | the audio path does not exist |
| `CLIP_NOT_FOUND` | the clip path does not exist or is not mp4/mov/webm |
| `RENDER_FAILED` | the render itself failed |

Exit codes: `0` all good, `1` something failed, `2` bad arguments.

## How input files reach the render

The composition can only load files the Remotion bundle serves, and `bundle()` copies
`public/` as it stands at that moment. So both CLIs copy each job's photo and audio into
`public/_staged/` **before** bundling and delete that folder afterwards. `public/_staged`
is gitignored.

## Rendering on a locked-down machine

Remotion downloads and manages its own browser, which is the recommended setup. If the
machine cannot reach `remotion.media`, point the CLIs at a local Chrome instead:

```bash
TEASER_CHROME_PATH=/usr/bin/google-chrome npm run teaser -- ...
```

## Rules this tool is built around

- Photos must be real photos of the restaurant's own dish, and the dish on screen must
  match what the kitchen actually serves.
- Teasers are for **private pitches**. Get written permission before any public use.
- Fonts: Inter (SIL Open Font License), bundled in `public/fonts/` so renders need no
  network access.
- Remotion is free for individuals and companies of up to 3 people. Re-check the
  [licence](https://www.remotion.dev/docs/license) if the team grows.
