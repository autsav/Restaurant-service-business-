# Lessons

- **Use the input files the user actually has.** The photo arrived as WebP, not the `.jpg` the spec named. Keep it byte-for-byte (`in/chilli-paneer.webp`) rather than re-encoding the food photo, and update the fixture paths to match.
- **This cloud environment blocks most hosts.** Remotion's browser download (`remotion.media`) and CDN downloads need either an allowed host or the pre-installed Chrome Headless Shell (`REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell`, user-approved).
- **`AbsoluteFill` is always full-size.** It sets `width: 100%` and `height: 100%`, so overriding only `top`/`bottom`/`left`/`right` shifts the whole box instead of anchoring a text block. For bottom-anchored or inset text, use a plain `position: absolute` div.
- **Studio writes prop edits back to `Root.tsx`.** After testing props in Studio, check `git diff src/Root.tsx`.
- **Fonts must not depend on the network in this sandbox.** Remotion's browser bypasses the proxy (`--no-proxy-server`), so Google Fonts fail with `ERR_CERT_AUTHORITY_INVALID` and the render times out on the font's delayRender. Bundling Inter from local files (`@fontsource/inter` + `@remotion/fonts`, imported as `.woff2` modules so it works in Studio and the CLI alike) was the user's choice, and it also meets "no network at render time" fully.
- **Ask before deviating from the spec, even for a blocker.** Replacing `@remotion/google-fonts` changes a stated requirement, so it was offered as an option and done only after the user chose it.
