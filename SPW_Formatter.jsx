# Create a minimal Next.js + TypeScript + Tailwind project ready for Vercel,
# and drop the user's component (as a client component) into it.

import os, json, textwrap, zipfile, pathlib

root = "/mnt/data/spw-formatter-vercel"
os.makedirs(root, exist_ok=True)

# package.json
package_json = {
  "name": "spw-formatter",
  "private": True,
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.10",
    "react": "18.2.0",
    "react-dom": "18.2.0"
  },
  "devDependencies": {
    "typescript": "5.5.4",
    "@types/node": "20.14.9",
    "@types/react": "18.2.66",
    "@types/react-dom": "18.2.22",
    "tailwindcss": "3.4.10",
    "postcss": "8.4.41",
    "autoprefixer": "10.4.20"
  }
}
os.makedirs(f"{root}", exist_ok=True)
with open(f"{root}/package.json","w") as f:
    json.dump(package_json, f, indent=2)

# next.config.ts (optional, minimal)
next_config = """import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
"""
with open(f"{root}/next.config.ts","w") as f:
    f.write(next_config)

# tsconfig.json
tsconfig = {
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": False,
    "skipLibCheck": True,
    "strict": False,
    "noEmit": True,
    "esModuleInterop": True,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": True,
    "isolatedModules": True,
    "jsx": "preserve",
    "plugins": [{"name": "next"}],
    "incremental": True
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
with open(f"{root}/tsconfig.json","w") as f:
    json.dump(tsconfig, f, indent=2)

# postcss.config.js
postcss_cfg = """module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
"""
with open(f"{root}/postcss.config.js","w") as f:
    f.write(postcss_cfg)

# tailwind.config.ts
tailwind_cfg = """import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
"""
with open(f"{root}/tailwind.config.ts","w") as f:
    f.write(tailwind_cfg)

# app directory
os.makedirs(f"{root}/app", exist_ok=True)

layout_tsx = """export const metadata = {
  title: "SPW Formatter",
  description: "Bulk trigger-set parser for migration",
};

import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
"""
with open(f"{root}/app/layout.tsx","w") as f:
    f.write(layout_tsx)

# globals.css
os.makedirs(f"{root}/app", exist_ok=True)
globals_css = """@tailwind base;
@tailwind components;
@tailwind utilities;

html, body {
  height: 100%;
}
"""
with open(f"{root}/app/globals.css","w") as f:
    f.write(globals_css)

# components directory
os.makedirs(f"{root}/components", exist_ok=True)

# User's component as client component
component_tsx = """\"use client\";

import React, { useEffect, useMemo, useState } from "react";

/**
 * SPW Formatter — bulk trigger-set support (fixed)
 *
 * Fixes:
 *  - Unterminated RegExp in parsePossiblyMany (now uses /\\n+/ correctly)
 *  - Literal newlines accidentally inserted into strings ("\\n" now escaped)
 *  - CSV export newline and toCSV escaping are corrected
 *
 * Enhancements:
 *  - Lightweight in-app tests for parsePossiblyMany so regressions are visible
 *  - Same features as previous version (filters, sorting, CSV, upload, etc.)
 */

// ---------- Small utilities ----------
const currency = (n: any) => {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const downloadTextFile = (filename: string, text: string) => {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Try to parse many formats: single object, array of objects, NDJSON (one JSON per line)
export function parsePossiblyMany(raw: string) {
  if (!raw || !raw.trim()) return [] as any[];
  const txt = raw.trim();
  // Try array or single object
  try {
    const obj = JSON.parse(txt);
    if (Array.isArray(obj)) return obj;
    return [obj];
  } catch {}
  // Try NDJSON (loose): split by lines and rebuild by balanced braces
  const lines = txt.split(/\\n+/).map((l) => l.trim()).filter(Boolean);
  const out: any[] = [];
  let buffer = "";
  const flush = () => {
    const s = buffer.trim();
    if (!s) return;
    try {
      const o = JSON.parse(s);
      out.push(o);
    } catch {}
    buffer = "";
  };
  for (const line of lines) {
    buffer += (buffer ? "\\n" : "") + line;
    // Heuristic: if braces appear balanced, attempt parse
    const open = (buffer.match(/[\\{\\[]/g) || []).length;
    const close = (buffer.match(/[\\}\\]]/g) || []).length;
    if (open > 0 && open === close) flush();
  }
  flush();
  return out;
}

// ---------- Types (lightweight JSDoc) ----------
/** @typedef {{ id:string, title:string }} Collection */
/** @typedef {{ variant_id:string, variant_title:string, variant_available:boolean, variant_price:string|number, compare_at_price?:string|number, inventory_policy?:string, inventory_quantity?:number }} Variant */
/** @typedef {{ product_id:string, product_title:string, product_description?:string, product_handle?:string, product_image?:string, product_vendor?:string, product_collections?:Collection[], product_tags?:string[], product_url?:string, product_variants?:Variant[], product_options?:any[] }} Product */

// ---------- Tiny example (for quick demo) ----------
const tinyExample = [{
  triggerProduct: {
    type: "products",
    selectedTriggerProducts: [
      {
        product_id: "123",
        product_title: "Sample Product",
        product_description: "Short description",
        product_handle: "sample-product",
        product_image: "https://via.placeholder.com/400x300.png?text=Image",
        product_vendor: "Vendor",
        product_collections: [
          { id: "gid://shopify/Collection/1", title: "Collection A" },
          { id: "gid://shopify/Collection/2", title: "Collection B" },
        ],
        product_tags: ["tag-one", "tag-two"],
        product_url: "https://example.com/products/sample-product",
        product_variants: [
          { variant_id: "v1", variant_title: "Small", variant_available: true, variant_price: "19.99", inventory_quantity: 12 },
          { variant_id: "v2", variant_title: "Large", variant_available: false, variant_price: "24.99", inventory_quantity: 0 },
        ],
      },
    ],
  },
  triggerUpsell: {
    type: "products",
    selectedUpsellProducts: [
      {
        product_id: "u1",
        product_title: "Upsell Sample",
        product_variants: [
          { variant_id: "uv1", variant_title: "One Size", variant_available: true, variant_price: "9.99", inventory_quantity: 100 },
        ],
      },
    ],
  },
}];

// ---------- Runtime tests (minimal) ----------
type Test = { name: string; run: () => boolean };
const tests: Test[] = [
  {
    name: "Parses single object",
    run: () => Array.isArray(parsePossiblyMany(JSON.stringify(tinyExample[0]))) && parsePossiblyMany(JSON.stringify(tinyExample[0])).length === 1,
  },
  {
    name: "Parses array of objects",
    run: () => parsePossiblyMany(JSON.stringify([tinyExample[0], tinyExample[0]])).length === 2,
  },
  {
    name: "Parses NDJSON (3 lines)",
    run: () => {
      const ndjson = [tinyExample[0], tinyExample[0], tinyExample[0]].map((o) => JSON.stringify(o)).join("\\n");
      const got = parsePossiblyMany(ndjson);
      return Array.isArray(got) && got.length === 3;
    },
  },
  {
    name: "Gracefully ignores malformed chunk",
    run: () => {
      const ndjson = `${JSON.stringify(tinyExample[0])}\\n{not json}\\n${JSON.stringify(tinyExample[0])}`;
      const got = parsePossiblyMany(ndjson);
      return got.length === 2; // bad line is skipped
    },
  },
];

function useTestResults() {
  const [results, setResults] = useState<{ name: string; pass: boolean }[]>([]);
  useEffect(() => {
    const r = tests.map((t) => ({ name: t.name, pass: !!t.run() }));
    setResults(r);
  }, []);
  return results;
}

// ---------- Root component ----------
export default function SPWFormatter() {
  const [raw, setRaw] = useState("");
  const [sets, setSets] = useState<any[]>([]); // array of trigger sets
  const [error, setError] = useState("");
  const testResults = useTestResults();

  // File upload parsing
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setError("");
    const texts = await Promise.all(Array.from(files).map((f) => f.text()));
    const parsedChunks = texts.flatMap((t) => parsePossiblyMany(t));
    if (!parsedChunks.length) {
      setError("No valid JSON objects found in selected files.");
      return;
    }
    setSets((prev) => [...prev, ...parsedChunks]);
  };

  const handleParse = () => {
    setError("");
    try {
      const chunks = raw.trim() ? parsePossiblyMany(raw) : tinyExample;
      if (!chunks.length) throw new Error("Could not parse any JSON objects.");
      setSets(chunks);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  };

  // Filters
  const [q, setQ] = useState("");
  const [collection, setCollection] = useState("");
  const [tag, setTag] = useState("");
  const [availability, setAvailability] = useState("any"); // any | in | out
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minInv, setMinInv] = useState("");
  const [maxInv, setMaxInv] = useState("");
  const [optionFilter, setOptionFilter] = useState(""); // matches in variant_title
  const [sortBy, setSortBy] = useState("title"); // title | price | inventory
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [triggerType, setTriggerType] = useState("any"); // any | product | upsell
  const [setIndex, setSetIndex] = useState("any"); // any | 0..N-1
  const pageSize = 15;

  // Flatten all products/variants with context of trigger type + set index
  const flatVariants = useMemo(() => {
    const rows: any[] = [];
    sets.forEach((setObj, idx) => {
      const add = (arr: any[], type: 'product' | 'upsell') => {
        (arr || []).forEach((p: any) => {
          (p.product_variants || []).forEach((v: any) => {
            rows.push({
              set_index: idx,
              trigger_type: type, // 'product' | 'upsell'
              product_id: p.product_id,
              product_title: p.product_title,
              product_vendor: p.product_vendor,
              product_url: p.product_url,
              product_handle: p.product_handle,
              product_image: p.product_image,
              product_collections: p.product_collections || [],
              product_tags: p.product_tags || [],
              product_description: p.product_description || "",
              ...v,
            });
          });
        });
      };
      add(setObj?.triggerProduct?.selectedTriggerProducts, "product");
      add(setObj?.triggerUpsell?.selectedUpsellProducts, "upsell");
    });
    return rows;
  }, [sets]);

  // Distinct filters
  const allCollections = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of flatVariants) (r.product_collections || []).forEach((c: any) => set.set(c.id, c.title));
    return Array.from(set, ([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [flatVariants]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of flatVariants) (r.product_tags || []).forEach((t: string) => set.add(t));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [flatVariants]);

  const setIndices = useMemo(() => Array.from(new Set(flatVariants.map((r: any) => r.set_index))).sort((a: number,b: number)=>a-b), [flatVariants]);

  // Apply filters
  const filtered = useMemo(() => {
    let rows = flatVariants as any[];
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((r) =>
        [
          r.product_title,
          r.product_vendor,
          r.product_handle,
          r.variant_title,
          r.product_description,
          ...(r.product_tags || []),
          ...(r.product_collections || []).map((c: any) => c.title),
        ]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(needle))
      );
    }
    if (collection) rows = rows.filter((r) => (r.product_collections || []).some((c: any) => c.id === collection));
    if (tag) rows = rows.filter((r) => (r.product_tags || []).includes(tag));
    if (triggerType !== "any") rows = rows.filter((r) => r.trigger_type === triggerType);
    if (setIndex !== "any") rows = rows.filter((r) => String(r.set_index) === String(setIndex));

    if (availability !== "any") {
      const want = availability === "in";
      rows = rows.filter((r) => Boolean(r.variant_available) === want);
    }
    if (optionFilter.trim()) {
      const needle = optionFilter.toLowerCase();
      rows = rows.filter((r) => String(r.variant_title || "").toLowerCase().includes(needle));
    }
    const toNum = (x: any) => (x === null || x === undefined || x === "" ? NaN : Number(x));
    if (minPrice !== "") rows = rows.filter((r) => toNum(r.variant_price) >= Number(minPrice));
    if (maxPrice !== "") rows = rows.filter((r) => toNum(r.variant_price) <= Number(maxPrice));
    if (minInv !== "") rows = rows.filter((r) => Number(r.inventory_quantity || 0) >= Number(minInv));
    if (maxInv !== "") rows = rows.filter((r) => Number(r.inventory_quantity || 0) <= Number(maxInv));

    // sorting
    rows = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "title") return dir * String(a.product_title + a.variant_title).localeCompare(String(b.product_title + b.variant_title));
      if (sortBy === "price") return dir * (Number(a.variant_price) - Number(b.variant_price));
      if (sortBy === "inventory") return dir * ((a.inventory_quantity || 0) - (b.inventory_quantity || 0));
      return 0;
    });

    return rows;
  }, [flatVariants, q, collection, tag, availability, optionFilter, minPrice, maxPrice, minInv, maxInv, sortBy, sortDir, triggerType, setIndex]);

  const totalInventory = useMemo(() => filtered.reduce((sum, r) => sum + Number(r.inventory_quantity || 0), 0), [filtered]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportCSV = () => {
    const cols = [
      "set_index",
      "trigger_type",
      "product_id",
      "product_title",
      "product_vendor",
      "product_handle",
      "product_url",
      "variant_id",
      "variant_title",
      "variant_available",
      "variant_price",
      "compare_at_price",
      "inventory_quantity",
      "inventory_policy",
      "collections",
      "tags",
    ];
    const toCSV = (val: any) => {
      if (val === null || val === undefined) return "";
      const s = String(val).replaceAll('"', '""');
      if (s.includes(",") || s.includes("\\n") || s.includes('"')) return `\"${s}\"`;
      return s;
    };
    const lines = [cols.join(",")];
    for (const r of filtered) {
      const row = [
        r.set_index,
        r.trigger_type,
        r.product_id,
        r.product_title,
        r.product_vendor,
        r.product_handle,
        r.product_url,
        r.variant_id,
        r.variant_title,
        r.variant_available,
        r.variant_price,
        r.compare_at_price ?? "",
        r.inventory_quantity ?? "",
        r.inventory_policy ?? "",
        (r.product_collections || []).map((c: any) => c.title).join("; "),
        (r.product_tags || []).join("; "),
      ].map(toCSV);
      lines.push(row.join(","));
    }
    downloadTextFile("spw-visible-variants.csv", lines.join("\\n"));
  };

  const resetFilters = () => {
    setQ(""); setCollection(""); setTag(""); setAvailability("any"); setOptionFilter("");
    setMinPrice(""); setMaxPrice(""); setMinInv(""); setMaxInv(""); setSortBy("title"); setSortDir("asc");
    setTriggerType("any"); setSetIndex("any"); setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="font-semibold text-lg">SPW Formatter</div>
          <div className="text-xs text-slate-500">Bulk trigger-set parser for migration.</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Ingest */}
        <section className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="block text-sm font-medium">Paste JSON (single object, array of sets, or NDJSON one per line)</label>
            <textarea
              className="w-full h-48 font-mono text-sm p-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={raw}
              placeholder={JSON.stringify(tinyExample, null, 2)}
              onChange={(e) => setRaw(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={handleParse} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm shadow hover:bg-indigo-700">Parse</button>
              <label className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-900 text-sm cursor-pointer">
                <input type="file" accept=".json,application/json" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
                Upload .json files
              </label>
              <button onClick={() => { setRaw(JSON.stringify(tinyExample, null, 2)); setSets([]); setError(""); }} className="px-3 py-1.5 rounded-lg bg-slate-200 text-slate-900 text-sm">Load tiny example</button>
              {flatVariants.length > 0 && (
                <button onClick={exportCSV} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm shadow hover:bg-emerald-700">Export visible CSV</button>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          {/* Summary & Tests */}
          <div className="md:col-span-1">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="text-sm text-slate-500">Summary</div>
              <div className="text-2xl font-semibold">{flatVariants.length}</div>
              <div className="text-xs text-slate-500">total variants across {sets.length || 0} set(s)</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-slate-100 p-2">
                  <div className="text-xs text-slate-500">Distinct products</div>
                  <div className="font-semibold">{new Set(flatVariants.map(r=>r.product_id)).size}</div>
                </div>
                <div className="rounded-lg bg-slate-100 p-2">
                  <div className="text-xs text-slate-500">Inventory</div>
                  <div className="font-semibold">{totalInventory}</div>
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-2">Includes trigger products and upsells.</div>
              <div className="mt-4">
                <div className="text-sm font-medium mb-1">Self-tests</div>
                <ul className="space-y-1">
                  {testResults.map((tr, i) => (
                    <li key={i} className={`text-xs ${tr.pass ? 'text-emerald-700' : 'text-rose-700'}`}>• {tr.pass ? 'PASS' : 'FAIL'} — {tr.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="grid md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1">Search</label>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="title, handle, tags, collections, variant title" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Collection</label>
              <select value={collection} onChange={(e) => setCollection(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">All</option>
                {allCollections.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Tag</label>
              <select value={tag} onChange={(e) => setTag(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="">All</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Availability</label>
              <select value={availability} onChange={(e) => setAvailability(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="any">Any</option>
                <option value="in">In stock</option>
                <option value="out">Out of stock</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Variant option contains</label>
              <input value={optionFilter} onChange={(e) => setOptionFilter(e.target.value)} placeholder="e.g., Mens XL, Flexi / 77 cm" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid md:grid-cols-6 gap-3 items-end mt-3">
            <div>
              <label className="block text-xs font-medium mb-1">Trigger type</label>
              <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="any">Any</option>
                <option value="product">Product</option>
                <option value="upsell">Upsell</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Set index</label>
              <select value={setIndex} onChange={(e) => setSetIndex(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <option value="any">Any</option>
                {setIndices.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Min price</label>
              <input type="number" step="0.01" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Max price</label>
              <input type="number" step="0.01" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Min inventory</label>
              <input type="number" value={minInv} onChange={(e) => setMinInv(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Max inventory</label>
              <input type="number" value={maxInv} onChange={(e) => setMaxInv(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="grid md:grid-cols-6 gap-3 items-end mt-3">
            <div>
              <label className="block text-xs font-medium mb-1">Sort by</label>
              <div className="flex gap-2">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="title">Title</option>
                  <option value="price">Price</option>
                  <option value="inventory">Inventory</option>
                </select>
                <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="asc">Asc</option>
                  <option value="desc">Desc</option>
                </select>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={resetFilters} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-900 text-sm">Reset</button>
            </div>
          </div>
        </section>

        {/* Results */}
        <section className="space-y-4">
          {groupByProduct(flattenByProduct(pageRows)).map(({ product, rows }) => (
            <ProductCard key={product.product_id + String(rows?.[0]?.set_index)} product={product} rows={rows} />
          ))}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-slate-600">Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} variants</div>
            <div className="flex gap-2">
              <button disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className={`px-3 py-1.5 rounded-lg border text-sm ${currentPage <= 1 ? "opacity-40 cursor-not-allowed" : "bg-white hover:bg-slate-50"}`}>Prev</button>
              <div className="px-3 py-1.5 text-sm">Page {currentPage} / {totalPages}</div>
              <button disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className={`px-3 py-1.5 rounded-lg border text-sm ${currentPage >= totalPages ? "opacity-40 cursor-not-allowed" : "bg-white hover:bg-slate-50"}`}>Next</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function flattenByProduct(rows: any[]) {
  const byId = new Map<string, { product: any; rows: any[] }>();
  for (const r of rows) {
    const key = r.product_id || r.product_handle || r.product_title;
    if (!byId.has(key)) byId.set(key, { product: r, rows: [] });
    byId.get(key)!.rows.push(r);
  }
  return Array.from(byId.values());
}

function groupByProduct(pairs: any[]) {
  return pairs.map(({ product, rows }) => ({ product, rows }));
}

function ProductCard({ product, rows }: { product: any; rows: any[] }) {
  const [showDesc, setShowDesc] = useState(false);
  const collections = product.product_collections || [];
  const tags = product.product_tags || [];
  const image = product.product_image || "https://via.placeholder.com/200x150.png?text=No+Image";

  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4`}>
      <div className="flex gap-4">
        <img src={image} alt={product.product_title} className="w-40 h-32 object-cover rounded-lg border" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">{product.product_title}</h2>
              <div className="text-sm text-slate-600">{product.product_vendor || "—"}</div>
              <div className="text-xs text-slate-500 truncate">{product.product_handle}</div>
              {product.product_url && (
                <a href={product.product_url} target="_blank" rel="noreferrer" className="inline-block mt-1 text-indigo-600 text-sm underline">View product</a>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Collections</div>
              <div className="flex flex-wrap gap-1 justify-end max-w-[360px]">
                {collections.slice(0, 8).map((c: any) => (
                  <span key={c.id} className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs border">{c.title}</span>
                ))}
                {collections.length > 8 && <span className="text-xs text-slate-500">+{collections.length - 8} more</span>}
              </div>
            </div>
          </div>

          {product.product_description && (
            <button onClick={() => setShowDesc((v) => !v)} className="mt-2 text-xs text-slate-600 underline">{showDesc ? "Hide" : "Show"} description</button>
          )}
          {showDesc && (
            <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap max-h-40 overflow-auto">{product.product_description}</p>
          )}

          <div className="mt-2 flex flex-wrap gap-1">
            {tags.slice(0, 10).map((t: string) => (
              <span key={t} className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs border border-emerald-200">#{t}</span>
            ))}
            {tags.length > 10 && <span className="text-xs text-slate-500">+{tags.length - 10} more</span>}
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="py-2 pr-3">Set</th>
              <th className="py-2 pr-3">Type</th>
              <th className="py-2 pr-3">Variant</th>
              <th className="py-2 pr-3">Available</th>
              <th className="py-2 pr-3">Price</th>
              <th className="py-2 pr-3">Compare @</th>
              <th className="py-2 pr-3">Inventory</th>
              <th className="py-2 pr-3">Policy</th>
              <th className="py-2 pr-3">Variant ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-slate-400">No variants match the current filters.</td>
              </tr>
            ) : (
              rows.map((v: any) => (
                <tr key={v.variant_id+\"-\"+v.set_index+\"-\"+v.trigger_type} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{v.set_index}</td>
                  <td className="py-2 pr-3">{v.trigger_type === 'upsell' ? <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Upsell</span> : <span className="inline-block px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">Product</span>}</td>
                  <td className="py-2 pr-3 font-medium">{v.variant_title || "—"}</td>
                  <td className="py-2 pr-3">{v.variant_available ? <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">In stock</span> : <span className="inline-block px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">Out</span>}</td>
                  <td className="py-2 pr-3">${currency(v.variant_price)}</td>
                  <td className="py-2 pr-3">{v.compare_at_price ? `$${currency(v.compare_at_price)}` : "—"}</td>
                  <td className="py-2 pr-3">{v.inventory_quantity ?? "—"}</td>
                  <td className="py-2 pr-3">{v.inventory_policy || "—"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{v.variant_id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
"""
with open(f"{root}/components/SPWFormatter.tsx","w") as f:
    f.write(component_tsx)

# app/page.tsx that renders the component
page_tsx = """import SPWFormatter from "@/components/SPWFormatter";

export default function Page() {
  return <SPWFormatter />;
}
"""
with open(f"{root}/app/page.tsx","w") as f:
    f.write(page_tsx)

# next-env.d.ts
with open(f"{root}/next-env.d.ts","w") as f:
    f.write("/// <reference types=\"next\" />\n/// <reference types=\"next/image-types/global\" />\n\n// NOTE: This file should not be edited\n// see https://nextjs.org/docs/basic-features/typescript for more information.\n")

# README.md
readme = """# SPW Formatter (Vercel-ready)

A minimal Next.js 14 + TypeScript + Tailwind app that hosts your **SPW Formatter** tool.

## Local dev

```bash
pnpm i    # or npm i / yarn
pnpm dev  # or npm run dev
