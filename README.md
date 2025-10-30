# SPW Trigger Set Formatter

A standalone web page that ingests JSON exported from Shopify Product Widgets (SPW) and turns trigger sets into filterable tables with CSV export.

## Running locally

No build tooling is required. Open `index.html` directly in any modern browser:

```bash
# macOS
open index.html

# Windows
start index.html

# Linux (GNOME)
xdg-open index.html
```

You can also serve the folder with any static HTTP server (for example `python -m http.server`) and browse to `http://localhost:8000`.

## Deploying

Because the project is a static bundle (HTML + CSS + JS), you can deploy it by uploading the repository contents to any static host. Two popular options:

### GitHub Pages

1. Push this repository to GitHub.
2. In the repository settings, open **Pages**.
3. Choose the `main` branch and the `/ (root)` folder, then save.
4. GitHub will publish the site at `https://<your-username>.github.io/<repository-name>/`.

### Netlify / Vercel / Cloudflare Pages

1. Create a new site and connect it to your Git provider.
2. Select this repository. No build command is required.
3. Set the publish directory to the repository root.
4. Trigger a deploy from the provider’s dashboard.

Once hosted, share the URL provided by your platform to grant access to the formatter.

## Project structure

```
├── App.jsx        # React component rendered via Babel at runtime
├── index.html     # Entry HTML file (loads React from CDN)
├── styles.css     # Global styles for the UI
└── README.md
```

Key logic lives in `App.jsx`. Styles are declared globally in `styles.css` and automatically loaded by `index.html`.
