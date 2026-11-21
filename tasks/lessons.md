# Lessons

- **`bundle()` snapshots `public/` at the moment it is called.** Staging an input
  photo into `public/_staged` *after* bundling gives a 404 at render time. Stage
  every input first, bundle once, then render.
- **The render browser cannot load `file://` URLs** from the bundle's http origin,
  which is why inputs are staged into `public/` at all.
- **`chromeMode` only accepts `"headless-shell"` and `"chrome-for-testing"`.**
  To use a local Chrome, pass `browserExecutable` on its own.
- **A contain-fitted photo scaled past 1.0 crops at the frame edge.** Fit the photo
  into a box of `frame size / scale` so the end of the push-in exactly reaches the
  edge. (Caught by the plan in `todo.md` before it shipped.)
- **Remotion renders at `yuvj420p`** when the source frames are full-range JPEG, even
  with `pixelFormat: "yuv420p"`. Players handle it; worth knowing before chasing it.
