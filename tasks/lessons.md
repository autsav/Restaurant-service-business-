# Lessons

- **Use the input files the user actually has.** The photo arrived as WebP, not the `.jpg` the spec named. Keep it byte-for-byte (`in/chilli-paneer.webp`) rather than re-encoding the food photo, and update the fixture paths to match.
- **This cloud environment blocks most hosts.** Remotion's browser download (`remotion.media`) and CDN downloads need either an allowed host or the pre-installed Chrome Headless Shell (`REMOTION_BROWSER_EXECUTABLE=/opt/pw-browsers/chromium_headless_shell`, user-approved).
