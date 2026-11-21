# Teaser maker: plan

Status: **approved, in progress.**

## Blockers (resolved 2026-11-21)

- [x] **B1. Photo.** You supplied a WebP (1347×1679). It is kept byte-for-byte as `in/chilli-paneer.webp`, so it is never re-encoded. The sample CSV and the validation commands use `.webp` instead of `.jpg` (your choice). The photo has text printed on it already, so the overlays sit on top of that text.
- [x] **B2. Music.** `assets/audio/bed.mp3` is an 8.0 s instrumental, generated with ElevenLabs Music v2.5 via Higgsfield at your request.
- [x] **B3. Browser.** Option B, at your request: the render helper passes `browserExecutable` only when the `REMOTION_BROWSER_EXECUTABLE` env var is set. In this container it points at `/opt/pw-browsers/chromium_headless_shell`. On a normal machine, leave it unset and Remotion uses its own browser. `www.remotion.dev` was then allowed in a personal environment, and the dataset-render page has been read: bundle once, then `selectComposition` + `renderMedia` per entry, one render at a time.
- [x] **B5. Fonts (found while rendering).** Remotion starts its browser with `--no-proxy-server`, and this sandbox signs those direct connections with a CA the browser does not trust, so Google Fonts could not load. Adding that CA was blocked by the safety check, and you are on a remote session. Your call: Inter is now bundled from local files (`@fontsource/inter` 600 + 800 via `@remotion/fonts`) instead of `@remotion/google-fonts`, so renders make no network calls at all.
- [x] **B4. Packages.** You approved all three: `@remotion/media`, `@remotion/layout-utils` and `@types/node`.

## Decisions (and why)

- **Local photos and audio go through `bundle({ publicDir })` plus `staticFile()`.** The skills say assets are served from the public dir and loaded with `staticFile()`. `file://` URLs do not load from the http-served bundle, and base64 data URLs bloat `inputProps`. So the render helper does the following:
  1. Copies each needed photo/audio into a fresh temp **staging dir**, named `<sha1(abs path)[0..12]>.<ext>` so the same file used by several rows is copied once.
  2. Calls `bundle({ entryPoint: "src/index.ts", publicDir: stagingDir })` **once**.
  3. Passes `photo` / `audio` to the composition as staging names. The composition calls `staticFile(name)`.
  4. Deletes the staging dir and the bundle dir at the end.

  The originals are never modified. Batch mode stages every valid row before the single `bundle()` call.
- **Studio.** Add `Config.setPublicDir("./in")` to `remotion.config.ts` (one added line, existing lines unchanged), so Studio and `npx remotion still` serve `in/`. The Teaser default props then use `photo: "chilli-paneer.webp"`. The Node APIs ignore the config file and get `publicDir` explicitly.
- **"Never crop the dish" vs "scale to 1.12".** A contain-fit photo scaled 1.12× would overflow the frame. So the photo is contain-fit inside a centred box of `1080/1.12 × 1920/1.12` (≈ 964 × 1714). At peak scale it exactly reaches the frame edge, and nothing is ever cut off.
- **Photo layer:** `<CanvasImage fit="contain">` with no filter, effect or colour change. Only `scale` is animated: `interpolate(frame,[0,209],[1,1.12],{easing: Easing.inOut(Easing.cubic), output:"perceptual-scale"})`, per the skill.
- **Background layer:** the same image with `fit="cover"` and CSS `filter: blur(40px) brightness(0.5)`. This is allowed because it is the background, not the food layer. Plain CSS is used instead of `@remotion/effects` to avoid another package.
- **Dish-name auto-shrink:** wait for Inter to load (`waitUntilDone()` under `delayRender`). Then step the font size down from 84 to 56 until the text fits in 2 lines of 920px width. At 56px, clamp to 2 lines with an ellipsis. This is measured once, not per frame.
- **Text is plain markup, not `Interactive.*`.** The skill says that content driven by external data may stay programmatic. All text comes from props or the CSV.
- **Licence key:** pass `licenseKey: null`. Both a real key and `"free-license"` send a usage event over the network (checked in `render-media.js`), and the spec forbids network calls at render time apart from fonts. Remotion logs one warning, which is expected.
- **Output:** `codec: "h264"`, `pixelFormat: "yuv420p"`, `imageFormat: "jpeg"`. `Config.setRspack(true)` in the config file does not apply to the Node API, so it is passed to `bundle()` as `rspack: true` to match the scaffold.
- **Image size probe (`scripts/lib/probe.ts`):** a small header parser for PNG (IHDR), JPEG (SOFn) and WebP (VP8/VP8L/VP8X). It has no dependencies and no ffprobe, so the CLI works on any machine. The validation steps use the system `ffprobe` to check the MP4s.
- **Row numbers** are the 1-based data rows, header excluded, so "Test Bad Row" is row 3.
- **Scaffold cleanup:** `src/Composition.tsx` (the empty "MyComp" placeholder) stays as it is. `Root.tsx` only gains the `Teaser` registration.

## Todo (one commit per item)

- [x] 1. `chore: add teaser deps and scripts`. Run `npx remotion add zod @remotion/google-fonts @remotion/bundler @remotion/renderer` + `@remotion/media @remotion/layout-utils`, plus `npm i -D tsx @types/node@22`, `npm i csv-parse`. Check that every `@remotion/*` is at 4.0.545. Add the `teaser` and `batch` npm scripts. Add `in/` and `assets/audio/` to `.gitignore` (`out` is already there). Add the `setPublicDir` line. Create `tasks/lessons.md`.
- [x] 2. `feat(teaser): props schema`. `src/schema.ts` holds the zod `teaserSchema` (composition props: `restaurant` 1-40, `dish` 1-60, `price` ≤ 12 with "" = none, `photo` file name, `audio` with "" = silent) and `leadSchema` (CSV row / CLI flags, same rules, paths on disk).
- [x] 3. `feat(teaser): Teaser composition`. `src/Teaser.tsx` has the background, photo and text layers plus audio, exactly per the VIDEO SPEC, all driven by `useCurrentFrame()` + `interpolate`. Register it as `id="Teaser"` (1080×1920, 30fps, 210 frames) in `Root.tsx` with inline `defaultProps` and `schema`.
- [x] 4. `feat(teaser): CLI libs`. Four files in `scripts/lib/`:
  - `slug.ts`
  - `errors.ts`: the `TeaserError` class, the code union, and a single `printError` / `printOk` JSON-line writer.
  - `probe.ts`: image size.
  - `render.ts`: `validateInput()` (photo exists, extension, ≥ 720px, audio exists) and `renderTeasers(jobs)`, which stages files, bundles once, then runs `selectComposition` + `renderMedia` sequentially for each job.
- [x] 5. `feat(teaser): single-render CLI`. `scripts/teaser.ts` parses arguments with `node:util` `parseArgs` (no extra dependency). It exits with 2 on `INVALID_ARGS`, 1 on any other failure and 0 on success, and prints one JSON line to stdout or stderr.
- [x] 6. `feat(batch): CSV batch CLI`. `scripts/batch.ts` uses `csv-parse/sync`:
  - With `--dry-run`, it prints one line per row (`row`, `output`, `ok` or the error) and touches nothing.
  - Without it, rows are processed one at a time. A row is skipped if its output exists (unless `--force`), and each row's failure is caught.
  - It writes `out/manifest.json` and exits with 1 if any row failed.
- [x] 7. `test: sample CSV fixture`. `tests/fixtures/leads.csv`, as specified but with `in/chilli-paneer.webp` (B1).
- [ ] 8. Run VALIDATION 1–7 and paste the output.
- [ ] 9. `docs: teaser maker usage`. Append a README section with both commands, the CSV columns, the error codes and the required note.

## Validation (to run at step 8)

1. `npx tsc --noEmit`
2. `npm run batch -- --csv tests/fixtures/leads.csv --dry-run`, then `git status` / `ls out` to show nothing was written
3. `npm run teaser -- --photo in/chilli-paneer.webp --restaurant "Fatt Pundit" --dish "Crackling Spinach" --price "£9.50"`, then `ffprobe` the output
4. `npm run batch -- --csv tests/fixtures/leads.csv; echo exit=$?`, then `cat out/manifest.json`
5. Repeat step 4 and check for "skipped"
6. `npx remotion render Teaser out/_check --frames=0,100,200 --image-format=png` (uses `in/` as the public dir)
7. `npx remotion studio --no-open`: check that the Teaser composition is listed (`npx remotion compositions`) and that the Studio server starts
