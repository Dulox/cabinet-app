# Base Cabinet Cut List

A millimetre cut-list calculator for melamine cabinets. Pick a cabinet type
and width and it generates the full parts list (sides, bottom, rails, back,
shelves, doors/drawer fronts), scaled shop drawings, combined material and
hardware totals across a whole project, and export-ready cut sheets.

## What it does

- **Cabinet types**: base, base w/ drawers, wall, sink, stove, blind corner,
  custom-depth wall, and standalone filler strips.
- **Cut list per cabinet**: sides, bottom, back (full melamine or grooved-in
  thin hardboard), rails, shelves, doors/drawer fronts/false fronts, with
  fabrication notes (edge banding, back groove, shelf-pin drilling).
- **Drawings**: front elevation, top view, side view, a true 30° isometric
  SVG, and a rotatable/zoomable 3D preview (Three.js, loaded on demand) with
  a grain-direction overlay toggle — all pure SVG/WebGL, no drawing library.
- **Grain direction (vetas)**: each cabinet is set to **Vertical** or
  **Horizontal** grain as seen from the front, and every part of that
  cabinet follows it — sides, doors, back, rails and strips all run the same
  way. Flat parts (bottom, shelves) run front-to-back for Vertical and
  left-to-right for Horizontal. An "Apply grain to all" control sets the
  whole project at once. The choice shows up everywhere: a "Grain:" line
  and a part diagram with grain arrow on each part in the cabinet card, the
  All-views table and its part diagrams, grain arrows on the door/drawer
  fronts in the front elevation, grain lines on the side and top views shown
  next to it in the cabinet card, grain lines in the top, side and isometric views
  and the 3D preview (Show/Hide vetas toggles in
  All views and the 3D preview),
  the Desglose, every export, and board nesting.
- **Material & hardware totals**: combined sheet area, piece counts, a
  grain-aware board-count estimate, and hardware tallies (shelf pins,
  hinges, drawer slides, handles). Board grain is taken to run along the
  board's first dimension ("Board width", 2800 mm by default): Vertical-grain
  parts are laid with their height along it, Horizontal-grain parts turned
  90°, and grain-locked parts are never rotated to fit.
- **Desglose sheet**: an editable shop cut-and-edge-band form per project —
  material, grain direction (vetas) with a "Pieza" diagram showing a red
  arrow along the grain, back-panel groove (ranura), hinge boring (bisagra),
  and edge banding, auto-marked from the cut list and hand-adjustable per
  row (the arrow follows hand-edited V/H). Rows are only merged when size,
  material and grain all match. Saveable/loadable, multiple sheets per
  browser.
- **Exports**: PDF cut sheet, shop drawing PDF and project PDF (each with a
  small part outline + grain arrow per part; the shop drawing elevation also
  marks each door/drawer front with a grain arrow and a "veta" label), Excel (a "full" copy and a
  "production" copy with the internal-only columns dropped; a "Pieza"
  column shows ↔ for grain along the Largo, ↕ across it), and a DXF nesting
  layout for CNC/CAM software (part outlines + shelf-pin holes on real 32mm
  spacing, rotated with the part).
- **Material-saving suggestions**: a depth-comparison card tries small
  uniform depth cuts (5-30mm) across every cabinet and shows a before/after
  board count and utilization % whenever one would save a whole board, with
  a one-click "apply to all cabinets".
- **Assembly guide**: a per-cabinet, step-by-step build sequence generated
  from that cabinet's own cut list and hardware tally (real panel sizes,
  real shelf-pin/hinge/handle counts — not invented specs), with checkboxes
  whose progress persists per project+cabinet.
- **Direct manipulation**: shelves and drawer-front dividers can be dragged
  up/down right in the elevation preview, not just set by number field.
- **Undo/redo** (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) across cabinet edits, with
  rapid edits (typing, quick clicks) coalesced into one undo step.
- **Shareable project links**: copy a link that encodes a project's full
  cabinet list; opening it drops the cabinets into a new project for
  whoever opens it (they still need their own approved login — see
  Projects & accounts below).
- **Projects & accounts**: multi-project save/load backed by Supabase
  (email/password login, owner-approved signups, an admin panel, and a PIN
  lock for shared devices).
- **English / Spanish** UI throughout.

## Tech stack

- **React 18** (function components, hooks) — the whole app is one file,
  `src/CabinetProject.jsx`.
- **Vite** for dev server and build.
- **Plain SVG** for every 2D drawing (elevation, top, side, isometric,
  part diagrams) — no charting/drawing library.
- **Three.js**, dynamically `import()`ed only when the 3D preview is opened,
  so it never touches the main bundle otherwise.
- **PDF export**: a small hand-written, dependency-free PDF writer
  (`MiniPDF` in `CabinetProject.jsx`) that mimics the handful of jsPDF
  methods the app calls — there is no jsPDF (or any PDF library) dependency.
- **Excel export**: [SheetJS](https://sheetjs.com) (`xlsx`), loaded from a
  CDN `<script>` tag at click time, not an npm dependency.
- **Supabase JS client**, also loaded from a CDN `<script>` tag at runtime,
  for auth and project storage.
- **localStorage** for saved Desglose sheets, the last-opened project name,
  and color theme — no backend needed for that part.
- File downloads use a plain `Blob` + temporary `<a download>` click; no
  file-saving library.

None of `three`, `xlsx`/SheetJS, or `@supabase/supabase-js` need to be
installed as npm packages except `three` (it's in `package.json` because the
dynamic `import()` needs it resolvable at build time); the other two are
CDN-only.

## Run it locally

You need [Node.js](https://nodejs.org) 18+ installed.

```bash
npm install
npm run dev
```

Open the URL it prints (usually http://localhost:5173).

To make a production build:

```bash
npm run build      # output goes to dist/
npm run preview    # preview the build locally
```

### Supabase

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `ADMIN_EMAIL` are hardcoded near the
top of `src/CabinetProject.jsx` (not environment variables) and point at the
project owner's own Supabase instance. The anon key is a public/publishable
key, safe to ship client-side, but if you fork this repo to run your own
copy you'll want to swap in your own Supabase project and admin email so you
control who can sign up and approve access.

## Put it on GitHub

```bash
git init
git add .
git commit -m "Cabinet cut list app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Deploy

### Option A — GitHub Pages (workflow included, free)

1. Push the project (above). The included workflow at
   `.github/workflows/deploy.yml` builds and deploys automatically.
2. In your repo: **Settings -> Pages -> Build and deployment -> Source ->
   "GitHub Actions"**.
3. Every push to `main` redeploys. Your site appears at
   `https://<your-username>.github.io/<your-repo>/`.

The workflow sets the correct base path for you, so you don't have to edit
anything.

### Option B — Vercel or Netlify (one click, custom domain friendly)

1. Push to GitHub (above).
2. On [Vercel](https://vercel.com) or [Netlify](https://netlify.com), choose
   "Import / Add new project" and pick the repo.
3. They auto-detect Vite. Build command `npm run build`, output `dist`. Deploy.

No base-path change is needed for Vercel/Netlify (it stays `/`).

## Develop further

The whole app is one component file: `src/CabinetProject.jsx`. It's large;
the pieces worth knowing about:

- `buildCutList()` — the actual construction math (dimensions, part list,
  fabrication notes, hardware counts) for one cabinet.
- `DEFAULTS` — starting dimensions (panel thickness, side height/depth,
  reveals, board size, kerf, etc.) — change those to change the defaults.
- `Elevation`, `TopView`, `SideView`, `IsoView` — the SVG drawings.
- `Cabinet3DModal` — the Three.js 3D preview.
- `DesgloseSheet` — the editable cut-and-edge-band sheet, its Excel export,
  and the vetas/ranura/bisagra auto-marking logic (`vetaAxis`, `ranuraSide`).
- Grain helpers: `cabGrain(cab)` is the single source of a cabinet's grain
  ("V"/"H"; older saved values like "auto" read as V). `vAxisFor(part)`
  says which Desglose edge (Largo/Ancho) a V grain runs along for a part,
  and `grainAlongLargo(row)` turns that into the arrow direction used by
  `GrainDiagram` (Desglose), the Excel "Pieza" column and `pdfGrainGlyph`
  (PDFs). Bisagra deliberately uses the geometric `vetaAxis()` — the hinge
  edge is the door's height edge whatever the grain choice.
- `nestItem()` — a part's board footprint for nesting, turned according to
  the cabinet's grain.
- `estimateBoards()` / `packBoardsWithLayout()` — the board-count estimate
  and the layout-tracking version that feeds the DXF export.
- `buildNestingDxf()` — the DXF writer.
- `itemsForCabsWithDepthDelta()` — re-runs the board estimate with every
  cabinet's depth cut by N mm; the depth-comparison suggestion picks the
  smallest N that saves a board.
- `buildAssemblySteps()` — turns one cabinet's cut list + hardware tally
  into an ordered build sequence (`AssemblyGuideModal` renders it).
- `evenShelfPositions()` — the default (evenly spaced) shelf Y-positions;
  `cab.shelfPositions` overrides them once a shelf's been dragged in
  `Elevation`. Drawer-front dividers reuse the existing `drawerHeights`.
- `setCabs()` — not `useState`'s raw setter: it's a small undo/redo history
  wrapper (`pastRef`/`futureRef`) around it, so every existing call site
  gets undo for free. Project switch/load/create call `resetCabs()`
  instead, which clears the history so one project's undo stack can't leak
  into another's.
- `encodeSharedConfig()` / `decodeSharedConfig()` — the base64 project
  config behind shareable links.

Edit, commit, push — a Pages/Vercel/Netlify deploy rebuilds on its own.

## Known issues / limitations

- **PDF export inside a sandboxed preview.** The PDF download works on the
  deployed site and in local dev. It's only failed inside a sandboxed
  artifact/preview environment (e.g. an AI tool's iframe preview) because
  that sandbox blocks the download — not a bug in the app itself.
- **Board-count and DXF nesting are estimates**, not a true optimal nester.
  Both use the same MaxRects bin-packing heuristic; the app itself flags
  this ("Layout estimate — real nesting varies. Buy at least one spare
  board for offcuts and mistakes.").
- **Board grain is assumed to run along "Board width"** (the first board
  dimension). If you enter a board whose grain runs along the other side,
  swap the two numbers or Vertical/Horizontal parts will nest the wrong way.
- **DXF export has no hinge or cam-lock hole boring**, only part outlines
  and shelf-pin holes. The app doesn't commit to exact hinge-system specs
  (cup diameter, edge inset) anywhere else, so it doesn't guess at them for
  CNC output.
- **Supabase credentials are hardcoded in source**, not environment
  variables — see the Supabase section above if you're forking this.
- **Assembly-guide checkbox progress is `localStorage`-only**, per
  project+cabinet — unlike the cabinet data itself, it isn't synced to
  Supabase, so it won't follow you to a different browser or device.
