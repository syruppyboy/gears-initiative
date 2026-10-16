# Gears Initiative website

Live site: https://syruppyboy.github.io/gears-initiative/

## Editing the site (no code needed)

1. Open **https://syruppyboy.github.io/gears-initiative/#edit**
2. Click any outlined text to change it. Click a photo to upload a new one.
3. Use the toolbar at the bottom to switch pages, change colors and fonts (🎨 Theme), and **Publish**.
4. On a lesson page, use **🎬 Set lesson video** to paste a YouTube, Vimeo or .mp4 link.
5. The live site updates about a minute after you publish.

The first time you publish on a device, the editor asks for a GitHub access key and walks you through creating one
(fine-grained token, only this repository, Contents: Read and write). The key is stored only in that browser.
Visitors can't publish anything without it.

Every publish is saved in the repository's history, so any change can be rolled back.

## Files

- `index.html` — the whole site. All content lives in the `site-data` block near the bottom.
- `editor.js` — the visual editor, loaded only at `#edit`.
- `images/` — photos uploaded through the editor.
