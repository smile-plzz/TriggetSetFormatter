# SPW Trigger Set Formatter

A single-page React app that ingests JSON exported from Shopify Product Widgets (SPW) and turns trigger sets into filterable tables with CSV export.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173 to use the formatter locally. Paste JSON, drop `.json` files, or load the included tiny example to explore the UI.

## Building for production

```bash
npm run build
```

The optimized assets will be created in `dist/`. You can deploy that folder to any static host such as Netlify, Vercel, Cloudflare Pages, or GitHub Pages. For previewing the production build locally run:

```bash
npm run preview
```

## Deployment tips

1. Push this repository to a Git host (GitHub, GitLab, Bitbucket).
2. Connect the repo to your hosting provider.
3. Configure the build command (`npm run build`) and publish directory (`dist`).
4. Each push to the default branch will build and deploy the latest version.

## Project structure

```
├── index.html
├── package.json
├── vite.config.js
└── src
    ├── App.jsx
    ├── index.css
    └── main.jsx
```

The parsing logic lives in `src/App.jsx`. Styles are maintained in `src/index.css` and loaded globally.
