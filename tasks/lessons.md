# Lessons

- **Use the input files the user actually has.** The photo arrived as WebP, not the `.jpg` the spec named. Keep it byte-for-byte (`in/chilli-paneer.webp`) rather than re-encoding the food photo, and update the fixture paths to match.
- **This cloud environment blocks most hosts.** Remotion's browser download (`remotion.media`) and CDN downloads need either an allowed host or the pre-installed Chrome Headless Shell (`REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell`, user-approved).
- **`AbsoluteFill` is always full-size.** It sets `width: 100%` and `height: 100%`, so overriding only `top`/`bottom`/`left`/`right` shifts the whole box instead of anchoring a text block. For bottom-anchored or inset text, use a plain `position: absolute` div.
- **Studio writes prop edits back to `Root.tsx`.** After testing props in Studio, check `git diff src/Root.tsx`.
