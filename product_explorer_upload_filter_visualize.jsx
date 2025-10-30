import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Download, Filter, Upload, Settings2, Search, ScatterChart as ScatterChartIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ---------- Helper types ----------
interface Variant {
  variant_id?: string | number;
  variant_title?: string;
  variant_available?: boolean;
  variant_price?: string | number;
  inventory_quantity?: number;
}

interface ProductRow {
  source: "trigger" | "upsell" | "raw";
  product_id?: string | number;
  product_title?: string;
  product_description?: string;
  product_handle?: string;
  product_vendor?: string;
  product_tags?: string[] | string;
  product_collections?: any[];
  product_url?: string;
  product_image?: string;
  product_variants?: Variant[];
  // derived
  price_min?: number | null;
  price_max?: number | null;
  inventory_total?: number | null;
  available?: boolean | null;
}

// ---------- Utilities ----------
const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(file);
  });

// Very lightweight RTF → text stripper. Good enough for extracting embedded JSON.
const rtfToText = (rtf: string) => rtf
  .replace(/\\par[d]?/g, "\n")
  .replace(/\\'[0-9a-fA-F]{2}/g, " ")
  .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
  .replace(/[{}]/g, "")
  .replace(/\n\n+/g, "\n")
  .trim();

// Attempt to extract JSON from an arbitrary blob of text by finding the first JSON array/object substring
const extractJSON = (text: string): any | null => {
  // Try a straight parse first
  try { return JSON.parse(text); } catch {}
  // Find first JSON-looking block
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");
  const start = (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) ? objStart : arrStart;
  if (start === -1) return null;
  // Heuristic: find matching closing bracket by counting
  const openChar = text[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === openChar) depth++;
    if (ch === closeChar) depth--;
    if (depth === 0) {
      const candidate = text.slice(start, i + 1);
      try {
        return JSON.parse(candidate);
      } catch {}
    }
  }
  return null;
};

const asNumber = (v: any): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const deriveProductRow = (p: any, source: ProductRow["source"]): ProductRow => {
  const variants: Variant[] = Array.isArray(p.product_variants) ? p.product_variants : [];
  const prices = variants.map(v => asNumber(v.variant_price)).filter((v): v is number => v !== null);
  const inv = variants.map(v => asNumber(v.inventory_quantity)).filter((v): v is number => v !== null);
  const price_min = prices.length ? Math.min(...prices) : null;
  const price_max = prices.length ? Math.max(...prices) : null;
  const inventory_total = inv.length ? inv.reduce((a, b) => a + b, 0) : null;
  const available = variants.length ? variants.some(v => Boolean(v.variant_available)) : null;
  return {
    source,
    product_id: p.product_id,
    product_title: p.product_title,
    product_description: p.product_description,
    product_handle: p.product_handle,
    product_vendor: p.product_vendor,
    product_tags: p.product_tags,
    product_collections: p.product_collections,
    product_url: p.product_url,
    product_image: p.product_image,
    product_variants: variants,
    price_min,
    price_max,
    inventory_total,
    available,
  };
};

// Understand the A7 trigger JSON structure and flatten to rows
const flattenA7TriggerJSON = (data: any): ProductRow[] => {
  // The uploaded structure shows an array at root: [{ triggerProduct, triggerUpsell } ...]
  // Sometimes it's wrapped: { id, name, trigger_set: [ ... ] }
  const triggerSets = Array.isArray(data) ? data : (Array.isArray(data?.trigger_set) ? data.trigger_set : []);
  const rows: ProductRow[] = [];
  for (const set of triggerSets) {
    const t = set?.triggerProduct?.selectedTriggerProducts || [];
    const u = set?.triggerUpsell?.selectedUpsellProducts || [];
    for (const p of t) rows.push(deriveProductRow(p, "trigger"));
    for (const p of u) rows.push(deriveProductRow(p, "upsell"));
  }
  if (!rows.length && typeof data === "object") {
    // Maybe the object itself is a product
    rows.push(deriveProductRow(data, "raw"));
  }
  return rows;
};

const unique = <T,>(arr: T[]) => Array.from(new Set(arr));

const csvEscape = (s: any) => {
  if (s === null || s === undefined) return "";
  const str = typeof s === "string" ? s : JSON.stringify(s);
  if (/[,"\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
};

const toCSV = (rows: any[], fields: string[]) => {
  const header = fields.join(",");
  const body = rows.map(r => fields.map(f => csvEscape(r[f])).join(",")).join("\n");
  return header + "\n" + body;
};

// ---------- Main UI ----------
export default function ProductExplorer() {
  const [rawObjects, setRawObjects] = useState<any[]>([]);
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterText, setFilterText] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>("");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("");
  const [priceMin, setPriceMin] = useState<string>("");
  const [priceMax, setPriceMax] = useState<string>("");
  const [selectedFields, setSelectedFields] = useState<string[]>(["product_title", "product_vendor", "price_min", "price_max", "inventory_total", "available"]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allFields = useMemo(() => {
    const base = new Set<string>();
    rows.forEach(r => Object.keys(r).forEach(k => base.add(k)));
    return Array.from(base).sort();
  }, [rows]);

  const vendors = useMemo(() => unique(rows.map(r => r.product_vendor).filter(Boolean) as string[]), [rows]);

  const filteredRows = useMemo(() => {
    const t = filterText.toLowerCase();
    const min = asNumber(priceMin);
    const max = asNumber(priceMax);
    return rows.filter(r => {
      const matchesText = !t || JSON.stringify(r).toLowerCase().includes(t);
      const matchesVendor = !vendorFilter || r.product_vendor === vendorFilter;
      const matchesAvail = !availabilityFilter || String(r.available) === availabilityFilter;
      const priceOK = (
        (min === null || (r.price_min ?? r.price_max ?? 0) >= min) &&
        (max === null || (r.price_max ?? r.price_min ?? 0) <= max)
      );
      return matchesText && matchesVendor && matchesAvail && priceOK;
    });
  }, [rows, filterText, vendorFilter, availabilityFilter, priceMin, priceMax]);

  const chartData = useMemo(() => filteredRows.map(r => ({
    name: r.product_title?.slice(0, 24) || String(r.product_id || ""),
    inventory: r.inventory_total ?? 0,
  })), [filteredRows]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setError(null);
    const gathered: any[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let text = await readFileAsText(file);

      if (ext === "rtf") text = rtfToText(text);
      if (ext === "pdf") {
        // Lazy import pdfjs only when needed
        const pdfjsLib = await import("pdfjs-dist/build/pdf");
        // @ts-ignore
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        const pdfData = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        let full = "";
        for (let p = 1; p <= pdf.numPages; p++) {
          const page = await pdf.getPage(p);
          const content = await page.getTextContent();
          const strings = content.items.map((it: any) => it.str);
          full += strings.join(" ") + "\n";
        }
        text = full;
      }

      const parsed = extractJSON(text);
      if (!parsed) {
        gathered.push({ __rawText: text });
      } else {
        gathered.push(parsed);
      }
    }

    setRawObjects(gathered);
    // Flatten all gathered objects into rows
    const allRows: ProductRow[] = [];
    for (const obj of gathered) {
      if (obj?.__rawText) {
        // try one more time in case there is a JSON-looking block later
        const again = extractJSON(obj.__rawText);
        if (again) allRows.push(...flattenA7TriggerJSON(again));
      } else {
        allRows.push(...flattenA7TriggerJSON(obj));
      }
    }
    setRows(allRows);
  };

  const handleDownload = () => {
    const csv = toCSV(filteredRows, selectedFields);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto p-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Product Explorer</h1>
            <p className="text-gray-600">Upload .txt / .json / .rtf / .pdf → filter, pick fields, visualize, export.</p>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl shadow bg-white border hover:bg-gray-100"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" /> Upload files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.json,.rtf,.pdf"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl shadow bg-white border hover:bg-gray-100"
              onClick={handleDownload}
              disabled={!filteredRows.length}
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </header>

        {/* Controls */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="col-span-2">
            <label className="text-sm text-gray-700">Search</label>
            <div className="flex items-center gap-2 bg-white rounded-2xl border px-3 py-2 shadow-sm">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Find by title, tag, id, ..."
                className="w-full outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-700">Vendor</label>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full bg-white rounded-2xl border px-3 py-2 shadow-sm"
            >
              <option value="">All</option>
              {vendors.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-700">Availability</label>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value)}
              className="w-full bg-white rounded-2xl border px-3 py-2 shadow-sm"
            >
              <option value="">All</option>
              <option value="true">Available</option>
              <option value="false">Unavailable</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-700">Min Price</label>
            <input
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
              placeholder="e.g. 20"
              className="w-full bg-white rounded-2xl border px-3 py-2 shadow-sm"
            />
          </div>
          <div>
            <label className="text-sm text-gray-700">Max Price</label>
            <input
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
              placeholder="e.g. 100"
              className="w-full bg-white rounded-2xl border px-3 py-2 shadow-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-gray-700 flex items-center gap-2"><Settings2 className="w-4 h-4"/> Fields to show</label>
            <div className="bg-white rounded-2xl border p-2 shadow-sm max-h-40 overflow-auto grid grid-cols-2 gap-1">
              {allFields.map(f => (
                <label key={f} className="text-sm flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(f)}
                    onChange={(e) => {
                      setSelectedFields(prev => e.target.checked ? unique([...prev, f]) : prev.filter(x => x !== f));
                    }}
                  />
                  <span>{f}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Chart */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <ScatterChartIcon className="w-4 h-4"/>
            <h2 className="text-xl font-semibold">Inventory by product</h2>
          </div>
          <div className="bg-white rounded-2xl border p-4 shadow-sm">
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" interval={0} angle={-30} textAnchor="end" height={60} tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="inventory" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* Table */}
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-4 h-4" />
            <h2 className="text-xl font-semibold">{filteredRows.length} products</h2>
          </div>
          <div className="overflow-auto rounded-2xl border bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  {selectedFields.map(f => (
                    <th key={f} className="text-left px-3 py-2 font-medium border-b whitespace-nowrap">{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {selectedFields.map(f => (
                      <td key={f} className="px-3 py-2 border-b align-top">
                        {f === "product_image" && r.product_image ? (
                          <img src={r.product_image} alt={r.product_title || "image"} className="w-12 h-12 object-cover rounded" />
                        ) : f === "product_url" && r.product_url ? (
                          <a className="text-blue-600 underline" target="_blank" href={r.product_url} rel="noreferrer">link</a>
                        ) : f === "product_tags" && Array.isArray(r.product_tags) ? (
                          <div className="flex flex-wrap gap-1">
                            {r.product_tags.slice(0, 8).map((t: any, i: number) => (
                              <span key={i} className="px-2 py-0.5 bg-gray-100 rounded-full">{String(t)}</span>
                            ))}
                            {Array.isArray(r.product_tags) && r.product_tags.length > 8 && (
                              <span className="text-gray-500">+{r.product_tags.length - 8} more</span>
                            )}
                          </div>
                        ) : typeof (r as any)[f] === "boolean" ? (
                          <span className={String((r as any)[f]) === "true" ? "text-green-700" : "text-red-700"}>
                            {String((r as any)[f])}
                          </span>
                        ) : (
                          <span>{typeof (r as any)[f] === "object" ? JSON.stringify((r as any)[f]) : String((r as any)[f] ?? "")}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {!filteredRows.length && (
                  <tr>
                    <td colSpan={selectedFields.length} className="px-3 py-6 text-center text-gray-500">
                      No products loaded yet. Click <strong>Upload files</strong> above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-3 rounded-2xl bg-red-50 text-red-800 border">
            {error}
          </motion.div>
        )}

        {/* Footer */}
        <footer className="text-center text-xs text-gray-500 mt-8">
          Built client-side. Your files never leave the browser.
        </footer>
      </div>
    </div>
  );
}
