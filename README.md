# Make Some Tabs

A lightweight, no-install guitar tab editor. Open `index.html` in a browser to use it,
or visit the deployed site at makesometabs.com.

## Why this exists

Writing tab in a plain text editor is annoying: typing a two-digit fret number
pushes every character after it sideways, so the other five string-lines fall
out of alignment. Tab It fixes that by treating the tab as a grid of fixed-width
slots (one column per beat/position, one row per string). Typing into a slot
only ever changes that slot — nothing else on the sheet reflows or shifts.

## Usage

- Click any slot on a string to select it, then type a fret number (`0`–`24`).
- To build a chord, select another string in the *same column* (arrow up/down)
  and type its fret — notes stack vertically in one slot.
- `x` marks a muted/dead note. `Backspace`/`Delete` clears the selected slot.
- Arrow keys move around. `Enter`/`Tab` moves to the next note slot, creating
  one if you're at the end. `|` inserts a barline after the selected slot.
- `Ctrl+Z` / `Ctrl+Y` undo/redo.
- Toolbar: add/remove note slots, barlines, and strings; switch tuning presets
  (or click a string label to rename it); save/load a project as JSON;
  export a plain-text `.txt` tab; print the sheet.
- Work autosaves to the browser's local storage as you go.

## Files

- `index.html` — page structure and toolbar
- `styles.css` — grid layout, string lines, print styles
- `app.js` — state model, rendering, and all input handling

## Deploying

This is a static site (no build step, no backend) — any static host works:

- **Netlify**: connect the repo, leave build command empty, publish directory `.`
  (see `netlify.toml`).
- **Cloudflare Pages**: same — no build command, output directory `/`.
- **GitHub Pages**: push to GitHub, enable Pages on the `main` branch/root
  (the included `.nojekyll` file stops GitHub from running Jekyll on it).

Point `makesometabs.com`'s DNS/nameservers at whichever host you choose.
