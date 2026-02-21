# YouTube Shorts Watch Blocker

Chrome extension (Manifest V3) that blocks YouTube Shorts for 30 minutes after 5 minutes of active Shorts watching.

## Behavior

- Active Shorts watch time is counted only when:
  - URL is `https://www.youtube.com/shorts/...`
  - tab content is visible
  - page has focus
- When active watch time reaches 5 minutes, Shorts are blocked for 30 minutes.
- During the block, navigating to any Shorts URL is redirected to the YouTube home page.
- A small banner on YouTube home shows the remaining block time.

## Install (Developer Mode)

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder:
   - `i:\Programming\PF\2026\2\YouTubeShort WatchBlocker`

## Files

- `manifest.json`: extension configuration
- `background.js`: timer and block-state management
- `content.js`: YouTube page monitoring, watch ticks, redirect and banner
