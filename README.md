# Vice Cover Lab

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Made for make.fun](https://img.shields.io/badge/make.fun-bounty%20gta6--cover--art--01-ff2d78)](https://make.fun/bounty/gta6-cover-art-01)
[![Offline](https://img.shields.io/badge/offline-zero%20network%20requests-00e5c0)](app/index.html)

Turn your photo into a sun-soaked, multi-panel GTA VI-style poster — offline, in
your browser, nothing uploaded anywhere. Built for the
[make.fun bounty “Make GTA 6 Cover Art”](https://make.fun/bounty/gta6-cover-art-01)
by [dedenabduloh07-ctrl](https://github.com/dedenabduloh07-ctrl).

## What it does

Upload one or more photos (or use the two built-in samples), pick a layout, pick
a grade, type a caption — and export a poster PNG in all three post sizes at
once. Every pixel of the poster is drawn in code on a canvas: the panels, the
sunset/neon grade, the bold poster lettering with its misregistered-print
shadow, the halftone strip, the film grain and the vignette. No Rockstar Games
logo, artwork or fonts are used anywhere.

- **6 layouts** — Hero + 3 (the classic multi-panel poster), Four Grid, Full
  Bleed, Trio Strip, Nine Grid, and tilted polaroid Snapshots.
- **5 grades** — Sunset, Neon Night, Teal Gold, Vice Pink, Mono Noir, each a
  gradient-map wash over the photos, plus toggleable film grain and vignette.
- **Any photo, per panel** — click a panel to select it, drag the photo inside
  it to reposition, scroll to zoom, or drop in another photo from the tray.
  Panels you leave empty show a dashed “add photo” placeholder.
- **Lettering** — a big gradient title that fits itself into two lines, a
  script subtitle, a tilted badge ribbon and a 5-star heat meter.
- **Export** — PNG in **1080 × 1080** (square), **1080 × 1350** (story) and
  **1920 × 1080** (wide), one at a time or all three with one click.
- **Undo / redo** — Ctrl+Z / Ctrl+Shift+Z, or the buttons in the header.
- **Fully offline** — plain static files, no libraries, no network requests,
  no tracking. Your photos never leave your machine.

## Try it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `app/index.html` directly from the folder — the app has no build step
and no server dependency. It needs a desktop browser with canvas support.

## Screenshots

| Shot | What it shows |
| --- | --- |
| `screenshots/1-cover.jpg` | Exported cover, pier sample, “Sunset Heist” |
| `screenshots/2-editor.jpg` | The editor with a photo loaded |
| `screenshots/3-cover.jpg` | Exported cover, trio layout, Neon Night grade (story size) |
| `screenshots/4-cover.jpg` | Exported cover, four-grid layout, Teal Gold grade |

Screenshot scenes are driven by the query string (see `app/src/shots.js`):
`?shot=cover&photo=pier&caption=Sunset%20Heist` renders a full-bleed cover;
`?shot=editor&photo=boulevard&caption=Boulevard%20Queen` opens the editor
with a photo loaded. `&layout=` and `&grade=` pick the layout and grade.

## How it is built

- `app/index.html` + `app/style.css` — the editor page and its dark studio UI.
- `app/src/cover.js` — the renderer: layouts, grades, lettering, grain,
  vignette, and the export path. Pure canvas, no dependencies.
- `app/src/main.js` — state, history, photo tray, controls, pointer
  interaction (drag to pan, scroll to zoom), and the export downloads.
- `app/src/shots.js` — the `?shot=` scenes used for screenshots.
- `app/samples/` — two sample photos made for make.fun with an image model,
  free to use.
- `main.ts` — the hand-in program (Node 22+, standard library only): copies
  `app/` and `screenshots/` to `/output` and writes `/output/dossier.json`
  with the vendored make.fun library.
- `serve.ts` — a tiny static server for local development only.

## License

MIT — see [LICENSE](LICENSE).
