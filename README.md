# Base Cabinet Cut List

A millimetre cut-list calculator for melamine base cabinets. Enter a cabinet
width and it returns the full parts list (sides, bottom, rails, back, shelves,
doors), a scaled front-elevation drawing, combined material totals across
multiple cabinets, and a downloadable PDF.

> The PDF download works on the deployed site and in local dev. It only failed
> inside the Claude artifact because of that sandbox — there's no sandbox here.

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

The whole app is one component: `src/CabinetProject.jsx`.

- Construction maths live in `buildCutList()` near the top.
- Default dimensions (thickness, side height/depth, setbacks, reveals) are in
  the `DEFAULTS` object — change those to change the starting values.
- The drawing is the `Elevation` component (plain SVG).

Edit, commit, push — the site rebuilds on its own.
