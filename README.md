# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i --loglevel=error
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).

## Teaser maker

Turns one real dish photo into a 7-second vertical teaser (1080×1920, 30 fps, H.264 MP4, yuv420p): a slow push-in on the photo over a blurred copy of itself, restaurant/dish/price overlays, an end card, and optional music.

### Single teaser

```console
npm run teaser -- --photo in/chilli-paneer.webp --restaurant "Fatt Pundit" --dish "Crackling Spinach" [--price "£9.50"] [--audio assets/audio/bed.mp3] [--out out/custom.mp4]
```

The default output is `out/{restaurant-slug}/{dish-slug}.mp4`. An existing file is overwritten.

### Batch from CSV

```console
npm run batch -- --csv leads.csv [--dry-run] [--force]
```

- `--dry-run` validates every row and prints the plan (row, output, render or skip). It doesn't bundle, render or write any files.
- A row whose output already exists is skipped, unless `--force` is given.
- Rows render one at a time, and a bad row doesn't stop the batch.
- The batch writes `out/manifest.json`, with one entry per row: `{row, restaurant, dish, output, status: "rendered"|"skipped"|"failed", code?, durationMs}`.

The CSV columns are:

| Column | Rule |
|---|---|
| `restaurant` | 1–40 characters |
| `dish` | 1–60 characters |
| `price` | optional, at most 12 characters |
| `photo` | path to a `.jpg`, `.jpeg`, `.png` or `.webp` file, shortest side ≥ 720 px |
| `audio` | optional path to a music file |

See `tests/fixtures/leads.csv` for an example.

### Output and error codes

Each result is one JSON line. A success goes to stdout, for example `{"ok":true,"output":"out/fatt-pundit/crackling-spinach.mp4","durationMs":1234}`. An error goes to stderr as `{"ok":false,"code":"<CODE>","message":"…","row":<number|null>}`. Use `npm run -s …` to hide npm's own two-line header.

| Code | Meaning |
|---|---|
| `INVALID_ARGS` | Bad or missing flags, or an unreadable CSV (exit code 2) |
| `INVALID_ROW` | A CSV row breaks a text rule |
| `PHOTO_NOT_FOUND` | The photo file doesn't exist |
| `PHOTO_UNSUPPORTED` | The photo isn't a JPEG, PNG or WebP |
| `PHOTO_TOO_SMALL` | The photo's shortest side is under 720 px |
| `AUDIO_NOT_FOUND` | The audio file doesn't exist |
| `RENDER_FAILED` | Remotion failed to bundle or render |

The exit codes are 0 when everything succeeds, 1 when anything fails (the single teaser, or any row in a batch), and 2 for `INVALID_ARGS`.

### Notes

- Photos and music stay outside `public/`: `in/` and `assets/audio/` are gitignored. The CLI copies them into a temporary public dir for each run and never modifies them. Only the photo's scale and position change: there are no filters, grading or upscaling on the photo layer.
- Inter is bundled from local font files (`@fontsource/inter`), so a render makes no network calls.
- `npm run dev` opens Remotion Studio with the "Teaser" composition, using `in/` as the public dir.
- If Remotion can't download its own browser (for example, in a locked-down sandbox), set `REMOTION_BROWSER_EXECUTABLE` to the path of a Chrome Headless Shell.

Photos must be real photos of the restaurant's own dish. Teasers are for private pitches only; get written permission before any public use. Remotion is free for individuals and companies of up to 3 people; re-check the licence if the team grows.
