const { useEffect, useMemo, useState } = React;

/**
 * Format numbers as currency-like strings.
 * @param {unknown} n
 * @returns {string}
 */
function currency(n) {
  if (n === null || n === undefined || n === "") return "—";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Download a text blob as a file in the browser.
 * @param {string} filename
 * @param {string} text
 */
function downloadTextFile(filename, text) {
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
}

/**
 * Try to parse a user provided string that may contain a single JSON object,
 * an array of objects or newline separated JSON (NDJSON).
 * @param {string} raw
 * @returns {Array<Record<string, unknown>>}
 */
function parsePossiblyMany(raw) {
  if (!raw || !raw.trim()) return [];
  const txt = raw.trim();
  try {
    const obj = JSON.parse(txt);
    if (Array.isArray(obj)) return obj;
    return [obj];
  } catch (err) {
    // Fall through to NDJSON parsing.
  }

  const lines = txt
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const out = [];
  let buffer = "";

  const flush = () => {
    const snippet = buffer.trim();
    if (!snippet) return;
    try {
      const parsed = JSON.parse(snippet);
      out.push(parsed);
    } catch (err) {
      // Ignore invalid chunk and continue reading.
    }
    buffer = "";
  };

  for (const line of lines) {
    buffer += (buffer ? "\n" : "") + line;
    const open = (buffer.match(/[\{\[]/g) || []).length;
    const close = (buffer.match(/[\}\]]/g) || []).length;
    if (open > 0 && open === close) flush();
  }

  flush();
  return out;
}

const tinyExample = [
  {
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
  },
];

const tests = [
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
      const ndjson = [tinyExample[0], tinyExample[0], tinyExample[0]].map((o) => JSON.stringify(o)).join("\n");
      const got = parsePossiblyMany(ndjson);
      return Array.isArray(got) && got.length === 3;
    },
  },
  {
    name: "Gracefully ignores malformed chunk",
    run: () => {
      const ndjson = `${JSON.stringify(tinyExample[0])}\n{not json}\n${JSON.stringify(tinyExample[0])}`;
      const got = parsePossiblyMany(ndjson);
      return got.length === 2;
    },
  },
];

function useTestResults() {
  const [results, setResults] = useState([]);
  useEffect(() => {
    const r = tests.map((t) => ({ name: t.name, pass: Boolean(t.run()) }));
    setResults(r);
  }, []);
  return results;
}

function flattenByProduct(rows) {
  const byId = new Map();
  rows.forEach((row) => {
    const key = row.product_id || row.product_handle || row.product_title;
    if (!byId.has(key)) {
      byId.set(key, { product: row, rows: [] });
    }
    byId.get(key).rows.push(row);
  });
  return Array.from(byId.values());
}

function groupByProduct(pairs) {
  return pairs.map(({ product, rows }) => ({ product, rows }));
}

function ProductCard({ product, rows }) {
  const [showDesc, setShowDesc] = useState(false);
  const collections = product.product_collections || [];
  const tags = product.product_tags || [];
  const image = product.product_image || "https://via.placeholder.com/200x150.png?text=No+Image";

  return (
    <div className="product-card card">
      <div className="product-card__top">
        <img src={image} alt={product.product_title} className="product-card__image" />
        <div className="product-card__details">
          <div className="product-card__title-row">
            <div>
              <h2 className="product-card__title">{product.product_title}</h2>
              <div className="product-card__vendor">{product.product_vendor || "—"}</div>
              <div className="product-card__handle">{product.product_handle}</div>
              {product.product_url && (
                <a href={product.product_url} target="_blank" rel="noreferrer" className="product-card__link">
                  View product
                </a>
              )}
            </div>
            <div className="product-card__collections">
              <div className="label">Collections</div>
              <div className="chips">
                {collections.slice(0, 8).map((c) => (
                  <span key={c.id} className="chip">
                    {c.title}
                  </span>
                ))}
                {collections.length > 8 && <span className="chip chip--muted">+{collections.length - 8} more</span>}
              </div>
            </div>
          </div>

          {product.product_description && (
            <button type="button" className="link-button" onClick={() => setShowDesc((v) => !v)}>
              {showDesc ? "Hide" : "Show"} description
            </button>
          )}
          {showDesc && <p className="product-card__description">{product.product_description}</p>}

          <div className="chips chips--tags">
            {tags.slice(0, 10).map((tag) => (
              <span key={tag} className="chip chip--tag">
                #{tag}
              </span>
            ))}
            {tags.length > 10 && <span className="chip chip--muted">+{tags.length - 10} more</span>}
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Set</th>
              <th>Type</th>
              <th>Variant</th>
              <th>Available</th>
              <th>Price</th>
              <th>Compare @</th>
              <th>Inventory</th>
              <th>Policy</th>
              <th>Variant ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="table__empty">
                  No variants match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((variant) => (
                <tr key={`${variant.variant_id}-${variant.set_index}-${variant.trigger_type}`}>
                  <td className="mono">{variant.set_index}</td>
                  <td>
                    {variant.trigger_type === "upsell" ? <span className="badge badge--warning">Upsell</span> : <span className="badge badge--info">Product</span>}
                  </td>
                  <td className="table__variant">{variant.variant_title || "—"}</td>
                  <td>
                    {variant.variant_available ? <span className="badge badge--success">In stock</span> : <span className="badge badge--danger">Out</span>}
                  </td>
                  <td>${currency(variant.variant_price)}</td>
                  <td>{variant.compare_at_price ? `$${currency(variant.compare_at_price)}` : "—"}</td>
                  <td>{variant.inventory_quantity ?? "—"}</td>
                  <td>{variant.inventory_policy || "—"}</td>
                  <td className="mono">{variant.variant_id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function App() {
  const [raw, setRaw] = useState("");
  const [sets, setSets] = useState([]);
  const [error, setError] = useState("");
  const testResults = useTestResults();

  const onFiles = async (files) => {
    if (!files) return;
    setError("");
    const texts = await Promise.all(Array.from(files).map((file) => file.text()));
    const parsedChunks = texts.flatMap((text) => parsePossiblyMany(text));
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
      if (!chunks.length) {
        throw new Error("Could not parse any JSON objects.");
      }
      setSets(chunks);
    } catch (err) {
      const message = err && typeof err === "object" && "message" in err ? err.message : String(err);
      setError(message);
    }
  };

  const [q, setQ] = useState("");
  const [collection, setCollection] = useState("");
  const [tag, setTag] = useState("");
  const [availability, setAvailability] = useState("any");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minInv, setMinInv] = useState("");
  const [maxInv, setMaxInv] = useState("");
  const [optionFilter, setOptionFilter] = useState("");
  const [sortBy, setSortBy] = useState("title");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(1);
  const [triggerType, setTriggerType] = useState("any");
  const [setIndex, setSetIndex] = useState("any");
  const pageSize = 15;

  const flatVariants = useMemo(() => {
    const rows = [];
    sets.forEach((setObj, idx) => {
      const add = (arr, type) => {
        (arr || []).forEach((product) => {
          (product.product_variants || []).forEach((variant) => {
            rows.push({
              set_index: idx,
              trigger_type: type,
              product_id: product.product_id,
              product_title: product.product_title,
              product_vendor: product.product_vendor,
              product_url: product.product_url,
              product_handle: product.product_handle,
              product_image: product.product_image,
              product_collections: product.product_collections || [],
              product_tags: product.product_tags || [],
              product_description: product.product_description || "",
              ...variant,
            });
          });
        });
      };

      add(setObj?.triggerProduct?.selectedTriggerProducts, "product");
      add(setObj?.triggerUpsell?.selectedUpsellProducts, "upsell");
    });
    return rows;
  }, [sets]);

  const allCollections = useMemo(() => {
    const map = new Map();
    flatVariants.forEach((variant) => {
      (variant.product_collections || []).forEach((c) => {
        map.set(c.id, c.title);
      });
    });
    return Array.from(map, ([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [flatVariants]);

  const allTags = useMemo(() => {
    const setTagValues = new Set();
    flatVariants.forEach((variant) => {
      (variant.product_tags || []).forEach((t) => {
        setTagValues.add(t);
      });
    });
    return Array.from(setTagValues).sort((a, b) => a.localeCompare(b));
  }, [flatVariants]);

  const setIndices = useMemo(() => Array.from(new Set(flatVariants.map((r) => r.set_index))).sort((a, b) => a - b), [flatVariants]);

  const filtered = useMemo(() => {
    let rows = flatVariants;
    if (q.trim()) {
      const needle = q.toLowerCase();
      rows = rows.filter((row) =>
        [
          row.product_title,
          row.product_vendor,
          row.product_handle,
          row.variant_title,
          row.product_description,
          ...(row.product_tags || []),
          ...(row.product_collections || []).map((c) => c.title),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle)),
      );
    }
    if (collection) {
      rows = rows.filter((row) => (row.product_collections || []).some((c) => c.id === collection));
    }
    if (tag) {
      rows = rows.filter((row) => (row.product_tags || []).includes(tag));
    }
    if (triggerType !== "any") {
      rows = rows.filter((row) => row.trigger_type === triggerType);
    }
    if (setIndex !== "any") {
      rows = rows.filter((row) => String(row.set_index) === String(setIndex));
    }
    if (availability !== "any") {
      const wantAvailable = availability === "in";
      rows = rows.filter((row) => Boolean(row.variant_available) === wantAvailable);
    }
    if (optionFilter.trim()) {
      const needle = optionFilter.toLowerCase();
      rows = rows.filter((row) => String(row.variant_title || "").toLowerCase().includes(needle));
    }
    const toNum = (value) => (value === null || value === undefined || value === "" ? NaN : Number(value));
    if (minPrice !== "") rows = rows.filter((row) => toNum(row.variant_price) >= Number(minPrice));
    if (maxPrice !== "") rows = rows.filter((row) => toNum(row.variant_price) <= Number(maxPrice));
    if (minInv !== "") rows = rows.filter((row) => Number(row.inventory_quantity || 0) >= Number(minInv));
    if (maxInv !== "") rows = rows.filter((row) => Number(row.inventory_quantity || 0) <= Number(maxInv));

    const sorted = [...rows].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortBy === "title") {
        const left = `${a.product_title || ""}${a.variant_title || ""}`;
        const right = `${b.product_title || ""}${b.variant_title || ""}`;
        return dir * left.localeCompare(right);
      }
      if (sortBy === "price") {
        return dir * (Number(a.variant_price) - Number(b.variant_price));
      }
      if (sortBy === "inventory") {
        return dir * ((a.inventory_quantity || 0) - (b.inventory_quantity || 0));
      }
      return 0;
    });

    return sorted;
  }, [flatVariants, q, collection, tag, availability, optionFilter, minPrice, maxPrice, minInv, maxInv, sortBy, sortDir, triggerType, setIndex]);

  const totalInventory = useMemo(() => filtered.reduce((sum, row) => sum + Number(row.inventory_quantity || 0), 0), [filtered]);

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

    const toCSV = (val) => {
      if (val === null || val === undefined) return "";
      const str = String(val).replaceAll('"', '""');
      if (str.includes(",") || str.includes("\n") || str.includes('"')) return `"${str}"`;
      return str;
    };

    const lines = [cols.join(",")];
    filtered.forEach((row) => {
      const record = [
        row.set_index,
        row.trigger_type,
        row.product_id,
        row.product_title,
        row.product_vendor,
        row.product_handle,
        row.product_url,
        row.variant_id,
        row.variant_title,
        row.variant_available,
        row.variant_price,
        row.compare_at_price ?? "",
        row.inventory_quantity ?? "",
        row.inventory_policy ?? "",
        (row.product_collections || []).map((c) => c.title).join("; "),
        (row.product_tags || []).join("; "),
      ].map(toCSV);
      lines.push(record.join(","));
    });

    downloadTextFile("spw-visible-variants.csv", lines.join("\n"));
  };

  const resetFilters = () => {
    setQ("");
    setCollection("");
    setTag("");
    setAvailability("any");
    setOptionFilter("");
    setMinPrice("");
    setMaxPrice("");
    setMinInv("");
    setMaxInv("");
    setSortBy("title");
    setSortDir("asc");
    setTriggerType("any");
    setSetIndex("any");
    setPage(1);
  };

  return (
    <div className="app">
      <header className="app__header">
        <div className="container app__header-content">
          <div>
            <h1 className="app__title">SPW Formatter</h1>
            <p className="app__subtitle">Bulk trigger-set parser for migration.</p>
          </div>
        </div>
      </header>

      <main className="container app__main">
        <section className="ingest">
          <div className="ingest__primary card">
            <label className="input-label" htmlFor="json-input">
              Paste JSON (single object, array of sets, or NDJSON one per line)
            </label>
            <textarea
              id="json-input"
              className="textarea"
              value={raw}
              placeholder={JSON.stringify(tinyExample, null, 2)}
              onChange={(event) => setRaw(event.target.value)}
            />
            <div className="button-row">
              <button type="button" className="btn btn--primary" onClick={handleParse}>
                Parse
              </button>
              <label className="btn btn--secondary file-input">
                <input type="file" accept=".json,application/json" multiple onChange={(event) => onFiles(event.target.files)} />
                Upload .json files
              </label>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setRaw(JSON.stringify(tinyExample, null, 2));
                  setSets([]);
                  setError("");
                }}
              >
                Load tiny example
              </button>
              {flatVariants.length > 0 && (
                <button type="button" className="btn btn--success" onClick={exportCSV}>
                  Export visible CSV
                </button>
              )}
            </div>
            {error && <p className="form-error">{error}</p>}
          </div>

          <div className="summary card">
            <div className="summary__title">Summary</div>
            <div className="summary__stat">
              <span className="summary__value">{flatVariants.length}</span>
              <span className="summary__label">total variants across {sets.length || 0} set(s)</span>
            </div>
            <div className="summary__grid">
              <div>
                <div className="summary__label">Distinct products</div>
                <div className="summary__value">{
                  new Set(flatVariants.map((row) => row.product_id || row.product_handle || row.product_title)).size
                }</div>
              </div>
              <div>
                <div className="summary__label">Inventory</div>
                <div className="summary__value">{totalInventory}</div>
              </div>
            </div>
            <div className="summary__tests">
              <div className="summary__tests-title">Self-tests</div>
              <ul>
                {testResults.map((result, index) => (
                  <li key={index} className={result.pass ? "summary__test summary__test--pass" : "summary__test summary__test--fail"}>
                    {result.pass ? "PASS" : "FAIL"} — {result.name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="card filters">
          <div className="filters__grid">
            <div>
              <label className="input-label" htmlFor="search">Search</label>
              <input id="search" className="input" value={q} onChange={(event) => setQ(event.target.value)} placeholder="title, handle, tags, collections, variant title" />
            </div>
            <div>
              <label className="input-label" htmlFor="collection">Collection</label>
              <select id="collection" className="input" value={collection} onChange={(event) => setCollection(event.target.value)}>
                <option value="">All</option>
                {allCollections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="tag">Tag</label>
              <select id="tag" className="input" value={tag} onChange={(event) => setTag(event.target.value)}>
                <option value="">All</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="availability">Availability</label>
              <select id="availability" className="input" value={availability} onChange={(event) => setAvailability(event.target.value)}>
                <option value="any">Any</option>
                <option value="in">In stock</option>
                <option value="out">Out of stock</option>
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="trigger-type">Trigger type</label>
              <select id="trigger-type" className="input" value={triggerType} onChange={(event) => setTriggerType(event.target.value)}>
                <option value="any">Any</option>
                <option value="product">Trigger product</option>
                <option value="upsell">Upsell</option>
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="set-index">Set index</label>
              <select id="set-index" className="input" value={setIndex} onChange={(event) => setSetIndex(event.target.value)}>
                <option value="any">Any</option>
                {setIndices.map((idx) => (
                  <option key={idx} value={idx}>
                    {idx}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="option-filter">Variant title contains</label>
              <input id="option-filter" className="input" value={optionFilter} onChange={(event) => setOptionFilter(event.target.value)} />
            </div>
            <div>
              <label className="input-label">Price between</label>
              <div className="input-inline">
                <input className="input" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="min" />
                <span>and</span>
                <input className="input" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="max" />
              </div>
            </div>
            <div>
              <label className="input-label">Inventory between</label>
              <div className="input-inline">
                <input className="input" value={minInv} onChange={(event) => setMinInv(event.target.value)} placeholder="min" />
                <span>and</span>
                <input className="input" value={maxInv} onChange={(event) => setMaxInv(event.target.value)} placeholder="max" />
              </div>
            </div>
            <div>
              <label className="input-label" htmlFor="sort-by">Sort by</label>
              <select id="sort-by" className="input" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="title">Title</option>
                <option value="price">Price</option>
                <option value="inventory">Inventory</option>
              </select>
            </div>
            <div>
              <label className="input-label" htmlFor="sort-dir">Sort direction</label>
              <select id="sort-dir" className="input" value={sortDir} onChange={(event) => setSortDir(event.target.value)}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
          <div className="filters__actions">
            <button type="button" className="btn" onClick={resetFilters}>
              Reset filters
            </button>
          </div>
        </section>

        <section className="card results">
          <div className="results__header">
            <h2 className="results__title">Visible products</h2>
            <div className="results__pagination">
              <button
                type="button"
                className="btn"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Prev
              </button>
              <div className="results__page">Page {currentPage} / {totalPages}</div>
              <button
                type="button"
                className="btn"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
              </button>
            </div>
          </div>

          <div className="results__list">
            {groupByProduct(flattenByProduct(pageRows)).map(({ product, rows }, index) => (
              <ProductCard
                key={`${product.product_id || product.product_handle || product.product_title || "product"}-${index}`}
                product={product}
                rows={rows}
              />
            ))}
            {pageRows.length === 0 && <p className="results__empty">No variants match the current filters.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}

window.App = App;
window.parsePossiblyMany = parsePossiblyMany;
