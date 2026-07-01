const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "admin-data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const PAGES_FILE = path.join(DATA_DIR, "pages.json");
const PRODUCTS_FILE = path.join(DATA_DIR, "products.json");
const CATEGORIES_FILE = path.join(DATA_DIR, "categories.json");
const IMAGES_FILE = path.join(DATA_DIR, "images.json");
const BLOCKS_FILE = path.join(DATA_DIR, "blocks.json");
const EVENTS_FILE = path.join(DATA_DIR, "events.ndjson");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");
const UPLOAD_DIR = path.join(ROOT, "assets", "admin-uploads");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

// Admin password: a hash stored in admin-data/auth.json (set via the admin panel)
// overrides the ADMIN_PASSWORD env default, so the password can be changed at runtime.
function verifyAdminPassword(input) {
  input = String(input || "");
  const auth = readJson(AUTH_FILE, null);
  if (auth && auth.salt && auth.hash) {
    const test = crypto.scryptSync(input, auth.salt, 64).toString("hex");
    const a = Buffer.from(test, "hex");
    const b = Buffer.from(auth.hash, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  return input === ADMIN_PASSWORD;
}
function setAdminPassword(next) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(next), salt, 64).toString("hex");
  writeJson(AUTH_FILE, { salt, hash, updatedAt: new Date().toISOString() });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
};

function ensureData() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, "", "utf8");
  if (!fs.existsSync(SETTINGS_FILE)) {
    writeJson(SETTINGS_FILE, {
      siteName: "LOVE",
      currency: "OMR",
      whatsappUrl: "https://wa.me/8613333333333",
      whatsappNumber: "+86 133 3333 3333",
      pixelHead: "",
      pixelBodyEnd: "",
      trackingEnabled: true,
      updatedAt: new Date().toISOString(),
    });
  }
  if (!fs.existsSync(PAGES_FILE)) writeJson(PAGES_FILE, discoverPages());
  if (!fs.existsSync(PRODUCTS_FILE)) writeJson(PRODUCTS_FILE, discoverProducts());
  if (!fs.existsSync(CATEGORIES_FILE)) writeJson(CATEGORIES_FILE, DEFAULT_CATEGORY_NAV);
  if (!fs.existsSync(IMAGES_FILE)) writeJson(IMAGES_FILE, []);
  if (!fs.existsSync(BLOCKS_FILE)) writeJson(BLOCKS_FILE, []);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function htmlFiles() {
  return fs.readdirSync(ROOT)
    .filter((name) => name.endsWith(".html"))
    .sort((a, b) => a.localeCompare(b));
}

function readTextSafe(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function textBetween(html, re) {
  const m = html.match(re);
  return m ? decodeHtml(m[1].replace(/<[^>]+>/g, "").trim()) : "";
}

function parseJsonText(value) {
  try {
    return JSON.parse(String(value || "").trim());
  } catch {
    return null;
  }
}

function schemaProductFromHtml(html) {
  const m = html.match(/<script[^>]*id=["']schema_product["'][^>]*>([\s\S]*?)<\/script>/i);
  return m ? parseJsonText(m[1]) : null;
}

function dataLayerItemFromHtml(html) {
  const item = {};
  for (const key of ["item_category", "item_category2", "item_category3", "item_category4", "item_category5", "item_variant"]) {
    const re = new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, "i");
    const m = html.match(re);
    if (m) item[key] = decodeHtml(m[1]);
  }
  return item;
}

function inferredCatalogCategory(slug) {
  const rules = [
    { page: "rabbit-vibrators.html", category: "Sex Toys for Women", subcategory: "Rabbit Vibrators" },
    { page: "clitoral-vibrators.html", category: "Sex Toys for Women", subcategory: "Clitoral Vibrators" },
    { page: "g-spot-vibrators.html", category: "Sex Toys for Women", subcategory: "G-Spot Vibrators" },
    { page: "sex-toys-for-couples.html", category: "Sex Toys for Couples", subcategory: "Couples Sex Toys" },
    { page: "sex-toys-for-men.html", category: "Sex Toys for Men", subcategory: "Sex Toys for Men" },
    { page: "sex-toys-for-women.html", category: "Sex Toys for Women", subcategory: "Sex Toys for Women" },
    { page: "bestsellers.html", category: "Bestsellers", subcategory: "Bestsellers" },
  ];
  for (const rule of rules) {
    const html = readTextSafe(path.join(ROOT, rule.page));
    if (html.includes(`${slug}.html`)) return { category: rule.category, subcategory: rule.subcategory };
  }
  return null;
}

function isPromotionalCategory(value) {
  return /prime|off|deal|promotion|celebrate|perfect catch/i.test(String(value || ""));
}

function productDefaultsFromFile(file) {
  const html = readTextSafe(path.join(ROOT, file));
  if (!/id=["']schema_product["']|view_item|currentPath["']?:["']product\//i.test(html)) return null;
  const schema = schemaProductFromHtml(html) || {};
  const item = dataLayerItemFromHtml(html);
  const inferred = inferredCatalogCategory(file.replace(/\.html$/i, ""));
  const title = textBetween(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || schema.name || textBetween(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const priceMatch = html.match(/"price"\s*:\s*"?([0-9.]+)"?/i);
  const skuMatch = html.match(/"sku"\s*:\s*"([^"]+)"/i) || html.match(/"item_id"\s*:\s*"([^"]+)"/i);
  const about = discoverProductText(file);
  return {
    slug: file.replace(/\.html$/i, ""),
    page: file,
    enabled: true,
    category: inferred?.category || item.item_category2 || "Uncategorized",
    subcategory: inferred?.subcategory || item.item_category3 || item.item_category || "General",
    name: title || file.replace(/\.html$/i, ""),
    cardImage: schema.image || "",
    heroSubtitle: about.heroSubtitle || "",
    descriptionTitle: about.descriptionTitle || "",
    description: about.description || schema.description || "",
    sku: skuMatch ? skuMatch[1] : (schema.sku || ""),
    price: priceMatch ? priceMatch[1] : (schema.offers?.price || ""),
    currency: "USD",
    whatsappUrl: "",
    notes: "",
    updatedAt: new Date().toISOString(),
  };
}

function discoverPages() {
  return htmlFiles().map((file) => {
    const html = readTextSafe(path.join(ROOT, file));
    return {
      slug: file,
      enabled: true,
      title: textBetween(html, /<title[^>]*>([\s\S]*?)<\/title>/i) || file,
      metaDescription: textBetween(html, /<meta\s+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i),
      navLabel: file === "index.html" ? "Home" : file.replace(/\.html$/i, ""),
      updatedAt: new Date().toISOString(),
    };
  });
}

function discoverProducts() {
  const products = htmlFiles().map(productDefaultsFromFile).filter(Boolean);
  return products.sort((a, b) => a.name.localeCompare(b.name));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSessionCookie() {
  const payload = JSON.stringify({ t: Date.now(), r: crypto.randomBytes(8).toString("hex") });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function parseCookies(req) {
  const cookies = {};
  for (const pair of String(req.headers.cookie || "").split(";")) {
    const idx = pair.indexOf("=");
    if (idx > -1) cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return cookies;
}

function isAuthed(req) {
  const token = parseCookies(req).admin_session;
  if (!token || !token.includes(".")) return false;
  const [encoded, mac] = token.split(".");
  if (mac !== sign(encoded)) return false;
  try {
    const data = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return Date.now() - Number(data.t || 0) < 1000 * 60 * 60 * 24 * 7;
  } catch {
    return false;
  }
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, data, extraHeaders = {}) {
  send(res, status, JSON.stringify(data), {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  });
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

async function readJsonBody(req, limit) {
  const raw = await readBody(req, limit);
  if (!raw) return {};
  return JSON.parse(raw);
}

function pageForPath(urlPath) {
  if (urlPath === "/" || urlPath === "") return "index.html";
  const clean = decodeURIComponent(urlPath.replace(/^\/+/, ""));
  if (!clean || clean.includes("\0")) return null;
  if (clean.endsWith("/")) return path.join(clean, "index.html");
  return clean;
}

function safeFilePath(urlPath) {
  const rel = pageForPath(urlPath);
  if (!rel) return null;
  const full = path.resolve(ROOT, rel);
  if (!full.startsWith(ROOT)) return null;
  return full;
}

function getPageConfig(file) {
  return readJson(PAGES_FILE, []).find((p) => p.slug === file);
}

function getProductForPage(file) {
  return productList().find((p) => p.page === file);
}

function productList() {
  const discovered = discoverProducts();
  const saved = readJson(PRODUCTS_FILE, []);
  const bySlug = new Map(saved.map((p) => [p.slug || String(p.page || "").replace(/\.html$/i, ""), p]));
  const merged = discovered.map((base) => {
    const saved = bySlug.get(base.slug) || {};
    return {
      ...base,
      ...saved,
      category: (!isPromotionalCategory(saved.category) && saved.category) || base.category || "Uncategorized",
      subcategory: (!isPromotionalCategory(saved.subcategory) && saved.subcategory) || base.subcategory || "General",
      featured: saved.featured === true,
      sortOrder: Number.isFinite(Number(saved.sortOrder)) ? Number(saved.sortOrder) : 9999,
    };
  });
  const discoveredSlugs = new Set(discovered.map((p) => p.slug));
  for (const item of saved) {
    const slug = item.slug || String(item.page || "").replace(/\.html$/i, "");
    if (!slug || discoveredSlugs.has(slug)) continue;
    merged.push({
      slug,
      page: item.page || `${slug}.html`,
      enabled: item.enabled !== false,
      category: !isPromotionalCategory(item.category) && item.category ? item.category : "Uncategorized",
      subcategory: !isPromotionalCategory(item.subcategory) && item.subcategory ? item.subcategory : "General",
      name: item.name || slug,
      cardImage: item.cardImage || "",
      heroSubtitle: item.heroSubtitle || "",
      descriptionTitle: item.descriptionTitle || "",
      description: item.description || "",
      sku: item.sku || "",
      price: item.price || "",
      currency: item.currency || "USD",
      whatsappUrl: item.whatsappUrl || "",
      notes: item.notes || "",
      featured: item.featured === true,
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : 9999,
      images: Array.isArray(item.images) ? item.images : [],
      specs: Array.isArray(item.specs) ? item.specs : [],
      variants: Array.isArray(item.variants) ? item.variants : [],
      updatedAt: item.updatedAt || new Date().toISOString(),
    });
  }
  return merged.sort((a, b) => `${a.category} ${a.subcategory} ${a.name}`.localeCompare(`${b.category} ${b.subcategory} ${b.name}`));
}

function productHierarchy() {
  const tree = {};
  for (const p of productList()) {
    const cat = p.category || "Uncategorized";
    const sub = p.subcategory || "General";
    tree[cat] = tree[cat] || {};
    tree[cat][sub] = tree[cat][sub] || [];
    tree[cat][sub].push({ slug: p.slug, page: p.page, name: p.name, enabled: p.enabled !== false });
  }
  return tree;
}

const DEFAULT_CATEGORY_NAV = [
  {
    label: "Best Selling Sex Toys",
    href: "bestsellers.html",
    children: [],
  },
  {
    label: "Sex Toys for Women",
    href: "sex-toys-for-women.html",
    children: [
      { label: "Clitoral Vibrators", href: "clitoral-vibrators.html" },
      { label: "Rabbit Vibrators", href: "rabbit-vibrators.html" },
      { label: "G-Spot Vibrators", href: "g-spot-vibrators.html" },
    ],
  },
  {
    label: "Sex Toys for Men",
    href: "sex-toys-for-men.html",
    children: [],
  },
  {
    label: "Sex Toys for Couples",
    href: "sex-toys-for-couples.html",
    children: [],
  },
];

function categoryNav() {
  const saved = readJson(CATEGORIES_FILE, null);
  const source = Array.isArray(saved) && saved.length ? saved : DEFAULT_CATEGORY_NAV;
  return source.map((cat) => ({
    label: String(cat.label || ""),
    href: String(cat.href || slugify(cat.label || "category") + ".html"),
    children: Array.isArray(cat.children) ? cat.children.map((child) => ({
      label: String(child.label || ""),
      href: String(child.href || slugify(child.label || "subcategory") + ".html"),
    })).filter((child) => child.label && child.href) : [],
  })).filter((cat) => cat.label && cat.href);
}

function isCategoryPage(file) {
  return categoryNav().some((cat) => cat.href === file || cat.children.some((child) => child.href === file));
}

function currentCategoryTitle(file) {
  for (const cat of categoryNav()) {
    if (cat.href === file) return cat.label;
    const child = cat.children.find((item) => item.href === file);
    if (child) return child.label;
  }
  return "Products";
}

function currentCategoryParent(file) {
  for (const cat of categoryNav()) {
    if (cat.href === file) return cat.label;
    if (cat.children.some((item) => item.href === file)) return cat.label;
  }
  return "Products";
}

function categoryProductsForPage(file) {
  const title = currentCategoryTitle(file);
  const parent = currentCategoryParent(file);
  let products = productList().filter((product) => {
    if (file === "bestsellers.html") return true;
    if (product.subcategory === title) return true;
    if (product.category === title) return true;
    if (product.category === parent && title === parent) return true;
    return false;
  });
  if (products.length) return merchandiseSort(products.filter((product) => product.enabled !== false));
  const html = readTextSafe(path.join(ROOT, file));
  products = productList().filter((product) => html.includes(`href="${product.page}"`) || html.includes(`href='${product.page}'`));
  return merchandiseSort(products.filter((product) => product.enabled !== false));
}

const PRODUCT_VARIANT_PRESETS = {
  "ina-thrust": [
    { name: "Black", color: "#000000", image: "assets/pdp-ina-thrust-0.webp" },
    { name: "Purple Twilight", color: "#756784", image: "assets/pdp-ina-thrust-1.webp" },
  ],
  "enigma-double-sonic": [
    { name: "Cyber Purple", color: "#77678A", image: "assets/pdp-enigma-double-sonic-0.webp" },
    { name: "Black", color: "#000000", image: "assets/pdp-enigma-double-sonic-1.webp" },
  ],
  "f1s-v3": [
    { name: "Default", color: "#f1f1f1", image: "assets/pdp-f1s-v3-0.webp" },
    { name: "Option 2", color: "#d8d8d8", image: "assets/pdp-f1s-v3-1.webp" },
    { name: "Option 3", color: "#1f1f1f", image: "assets/pdp-f1s-v3-2.webp" },
    { name: "Option 4", color: "#9f9f9f", image: "assets/pdp-f1s-v3-3.webp" },
  ],
  "soraya-wave": [
    { name: "Deep Rose", color: "#9F1888", image: "assets/pdp-soraya-wave-0.webp" },
    { name: "Black", color: "#000000", image: "assets/pdp-soraya-wave-1.webp" },
    { name: "Midnight Blue", color: "#34348E", image: "assets/pdp-soraya-wave-2.webp" },
    { name: "Purple", color: "#7949A4", image: "assets/pdp-soraya-wave-3.webp" },
    { name: "Soft Pink", color: "#E9CDDC", image: "assets/pdp-soraya-wave-4.webp" },
  ],
  "sona-2-cruise": [
    { name: "Cerise", color: "#DE1C85", image: "assets/pdp-sona-2-cruise-0.webp" },
    { name: "Black", color: "#000000", image: "assets/pdp-sona-2-cruise-1.webp" },
    { name: "Purple", color: "#7949A4", image: "assets/pdp-sona-2-cruise-2.webp" },
  ],
  "smart-wand-2-large": [
    { name: "Deep Rose", color: "#9F1888", image: "assets/pdp-smart-wand-2-large-0.webp" },
    { name: "Aqua", color: "#78D5E1", image: "assets/pdp-smart-wand-2-large-1.webp" },
    { name: "Black", color: "#000000", image: "assets/pdp-smart-wand-2-large-2.webp" },
  ],
  "tor-3": [
    { name: "Violet Dusk", color: "#9B87AA", image: "assets/pdp-tor-3-0.webp" },
    { name: "Black", color: "#000000", image: "assets/pdp-tor-3-1.webp" },
    { name: "Base Blue", color: "#344974", image: "assets/pdp-tor-3-2.webp" },
  ],
  "tiani-3": [
    { name: "Deep Rose", color: "#9F1888", image: "assets/pdp-tiani-3-0.webp" },
    { name: "Black", color: "#000000", image: "assets/pdp-tiani-3-1.webp" },
    { name: "Cerise", color: "#DE1C85", image: "assets/pdp-tiani-3-2.webp" },
  ],
};

function productCardImage(product) {
  const saved = Array.isArray(product.images) ? product.images.find((img) => img.enabled !== false && img.replacement) : null;
  if (saved) return saved.replacement;
  // Prefer the local grid thumbnail over the original LELO CDN cardImage so the site
  // serves its own images and never hotlinks assets.lelo.com.
  if (product.slug) {
    const localGrid = `assets/grid-${product.slug}.webp`;
    if (fs.existsSync(path.join(ROOT, localGrid))) return localGrid;
  }
  if (product.cardImage && !/lelo\.com/i.test(product.cardImage)) return product.cardImage;
  const discovered = discoverProductImages(product.page);
  const hero = discovered.find((img) => /hero|主图/i.test(img.group || "")) || discovered[0];
  return hero?.preview || "assets/love-logo.svg";
}

function productVariants(product) {
  const baseImage = productCardImage(product);
  const saved = Array.isArray(product.variants) ? product.variants : [];
  const source = saved.length ? saved : (PRODUCT_VARIANT_PRESETS[product.slug] || []);
  return source.map((variant, index) => ({
    name: String(variant.name || variant.label || `Option ${index + 1}`),
    type: String(variant.type || ""),
    color: String(variant.color || variant.hex || "#d8d8d8"),
    image: String(variant.image || variant.url || baseImage),
    enabled: variant.enabled !== false,
  })).filter((variant) => variant.enabled && (variant.name || variant.image || variant.color)).slice(0, 8);
}

function truncateText(value, length = 150) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

function renderCategoryNav(file) {
  return `<aside class="dlz-category-nav" aria-label="Product categories">
    <a class="dlz-catch-link" href="bestsellers.html"><span>◆</span> THE PERFECT CATCH</a>
    ${categoryNav().map((cat) => {
      const active = cat.href === file || cat.children.some((child) => child.href === file);
      return `<div class="dlz-category-group">
        <a class="dlz-category-link ${cat.href === file ? "is-current" : active ? "is-active" : ""}" href="${escapeAttr(cat.href)}"><span>${cat.children.length ? "−" : "+"}</span>${escapeHtml(cat.label)}</a>
        ${cat.children.length ? `<div class="dlz-subcategory-list"><a class="dlz-subcategory-link ${cat.href === file ? "is-current" : ""}" href="${escapeAttr(cat.href)}">VIEW ALL PRODUCTS</a>${cat.children.map((child) => (
          `<a class="dlz-subcategory-link ${child.href === file ? "is-current" : ""}" href="${escapeAttr(child.href)}">${escapeHtml(child.label)}</a>`
        )).join("")}</div>` : ""}
      </div>`;
    }).join("")}
  </aside>`;
}

function renderCategoryCatalog(file) {
  const products = categoryProductsForPage(file);
  const title = currentCategoryTitle(file);
  const parent = currentCategoryParent(file);
  const quickViewData = products.map((product) => ({
    slug: product.slug,
    name: product.name,
    page: product.page,
    category: product.subcategory || product.category || "",
    price: product.price || "",
    sku: product.sku || "",
    image: productCardImage(product),
    description: product.description || product.notes || product.heroSubtitle || "",
    specs: Array.isArray(product.specs) ? product.specs.filter((spec) => spec.enabled !== false).slice(0, 8) : discoverProductSpecs(product.page).slice(0, 8),
  }));
  const cards = products.map((product) => {
    const image = productCardImage(product);
    const price = product.price ? `<div class="dlz-product-price">$${escapeHtml(product.price)}</div>` : "";
    const badge = /new|thrust|v3/i.test(product.name || "") ? "NEW" : "BESTSELLER";
    return `<article class="dlz-product-card" data-product-card="${escapeAttr(product.slug)}">
      <div class="dlz-product-badge">${badge}</div>
      <a class="dlz-product-image-link" href="${escapeAttr(product.page)}" aria-label="${escapeAttr(product.name)}">
        <img src="${escapeAttr(image)}" alt="${escapeAttr(product.name)}" loading="lazy">
      </a>
      <div class="dlz-product-copy">
        <h2><a href="${escapeAttr(product.page)}">${escapeHtml(product.name)}</a></h2>
        <div class="dlz-product-meta">${escapeHtml(product.subcategory || product.category || "")}</div>
        ${price}
        <div class="dlz-product-actions">
          <button class="dlz-quick-view" type="button" data-quick-view="${escapeAttr(product.slug)}">QUICK VIEW</button>
        </div>
      </div>
    </article>`;
  }).join("");
  return `<section class="dlz-catalog" data-dlz-product-count="${products.length}" aria-label="${escapeAttr(title)} products">
    <style>
      .product-container{background:#fff;min-height:0!important;padding:0!important}
      .dlz-catalog{background:#fff;color:#050505;padding:34px clamp(18px,3vw,54px) 48px;font-family:Arial,"Microsoft YaHei",sans-serif}
      .dlz-catalog__layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:34px;max-width:1780px;margin:0 auto;align-items:start}
      .dlz-category-nav{position:sticky;top:22px;padding-right:28px}
      .dlz-catch-link,.dlz-category-link{display:flex;align-items:center;gap:14px;color:#050505;text-decoration:none;font-size:16px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;line-height:1.2}
      .dlz-catch-link{padding:0 0 28px}
      .dlz-catch-link span{font-size:13px}
      .dlz-category-group{border-top:1px solid #151515;padding:26px 0}
      .dlz-category-link span{font-size:20px;width:14px;display:inline-block;font-weight:600}
      .dlz-subcategory-list{display:grid;gap:22px;margin:28px 0 0 28px}
      .dlz-subcategory-link{display:block;color:#050505;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;line-height:1.15}
      .dlz-subcategory-link.is-current{text-decoration:underline;text-underline-offset:4px}
      .dlz-results-head{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:end;border-bottom:3px solid #111;padding-bottom:18px;margin-bottom:14px}
      .dlz-eyebrow{font-size:17px;font-weight:800;letter-spacing:.28em;text-transform:uppercase;margin-bottom:18px}
      .dlz-results-head h2{font-size:clamp(40px,4.2vw,62px);line-height:.98;margin:0;font-weight:800;letter-spacing:0}
      .dlz-catalog__count{font-size:17px;font-weight:800;white-space:nowrap;margin-bottom:6px}
      .dlz-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;font-size:16px}
      .dlz-filter{display:inline-flex;align-items:center;gap:11px;font-weight:700;text-decoration:underline;text-underline-offset:4px}
      .dlz-filter-icon{font-size:22px;line-height:1}
      .dlz-sort{display:inline-flex;align-items:center;gap:16px;color:#555}
      .dlz-sort strong{color:#333}
      .dlz-sort span{font-size:18px;color:#111}
      .dlz-product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:52px 40px}
      .dlz-product-card{border:1px solid #707070;background:#fff;display:flex;flex-direction:column;min-height:405px;position:relative;padding:20px 16px 18px}
      .dlz-product-badge{font-size:13px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;min-height:18px}
      .dlz-product-image-link{display:grid;place-items:center;height:205px;margin-top:14px}
      .dlz-product-image-link img{width:100%;height:100%;object-fit:contain}
      .dlz-product-copy{display:grid;gap:7px;flex:1;margin-top:14px;position:relative}
      .dlz-product-meta{font-size:13px;color:#17191d;letter-spacing:.18em;font-weight:700;line-height:1.15}
      .dlz-product-copy h2{font-size:14px;line-height:1.15;margin:0;letter-spacing:.26em;text-transform:uppercase;font-weight:800;max-width:190px}
      .dlz-product-copy h2 a{color:#17191d;text-decoration:none}
      .dlz-product-price{font-size:15px;font-weight:800;letter-spacing:.12em;margin-top:18px}
      .dlz-product-actions{margin-top:auto;opacity:0;transform:translateY(8px);transition:opacity .18s ease,transform .18s ease}
      .dlz-product-card:hover .dlz-product-actions,.dlz-product-card:focus-within .dlz-product-actions{opacity:1;transform:translateY(0)}
      .dlz-quick-view{width:100%;border:0;background:#050505;color:#fff;padding:12px 13px;font-size:13px;font-weight:800;letter-spacing:.28em;min-height:39px;text-align:center;cursor:pointer}
      .dlz-quick-view:hover{background:#333}
      .dlz-qv-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.58);padding:22px}
      .dlz-qv-modal.open{display:flex}
      .dlz-qv-dialog{background:#fff;color:#111;width:min(960px,100%);max-height:88vh;overflow:auto;display:grid;grid-template-columns:minmax(260px,420px) 1fr;position:relative}
      .dlz-qv-close{position:absolute;right:12px;top:10px;border:0;background:transparent;font-size:30px;line-height:1;cursor:pointer;color:#111}
      .dlz-qv-image{display:grid;place-items:center;background:#f6f6f6;min-height:430px;padding:28px}
      .dlz-qv-image img{width:100%;height:100%;max-height:430px;object-fit:contain}
      .dlz-qv-copy{padding:42px 34px;display:grid;gap:14px;align-content:start}
      .dlz-qv-copy h3{font-size:34px;line-height:1.05;margin:0;letter-spacing:0}
      .dlz-qv-meta{font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#555}
      .dlz-qv-price{font-size:20px;font-weight:800;letter-spacing:.08em}
      .dlz-qv-desc{font-size:15px;line-height:1.55;color:#444;margin:0}
      .dlz-qv-specs{display:grid;gap:7px;margin-top:6px}
      .dlz-qv-spec{display:grid;grid-template-columns:120px 1fr;gap:12px;font-size:13px;border-top:1px solid #ececec;padding-top:7px}
      .dlz-qv-spec strong{font-weight:800}
      .dlz-qv-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
      .dlz-qv-actions a{display:inline-flex;align-items:center;justify-content:center;background:#050505;color:#fff;text-decoration:none;padding:13px 18px;font-size:13px;font-weight:800;letter-spacing:.16em;min-height:42px}
      .dlz-qv-actions a.secondary{background:#e9e9e9;color:#111}
      .dlz-empty{border:1px dashed #aaa;padding:28px;color:#555;background:#fafafa}
      @media(max-width:1200px){.dlz-catalog__layout{grid-template-columns:250px minmax(0,1fr);gap:30px}.dlz-product-grid{grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:28px 22px}}
      @media(max-width:900px){.dlz-catalog{padding:34px 16px 46px}.dlz-catalog__layout{grid-template-columns:1fr;gap:24px}.dlz-category-nav{position:static;padding-right:0}.dlz-category-group{padding:18px 0}.dlz-subcategory-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0 0}.dlz-results-head{grid-template-columns:1fr}.dlz-results-head h2{font-size:34px}.dlz-toolbar{margin-bottom:26px}.dlz-product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.dlz-product-card{min-height:340px;padding:14px 12px}.dlz-product-image-link{height:145px}.dlz-product-copy h2{font-size:12px}.dlz-product-meta{font-size:12px;letter-spacing:.1em}.dlz-product-actions{opacity:1;transform:none}.dlz-quick-view{letter-spacing:.14em;font-size:12px}.dlz-qv-dialog{grid-template-columns:1fr}.dlz-qv-image{min-height:260px}.dlz-qv-copy{padding:28px 20px}.dlz-qv-copy h3{font-size:28px}.dlz-qv-spec{grid-template-columns:1fr}}
    </style>
    <div class="dlz-catalog__layout">
      ${renderCategoryNav(file)}
      <div class="dlz-results">
        <div class="dlz-results-head">
          <div>
            <div class="dlz-eyebrow">${escapeHtml(parent)}</div>
            <h2>${escapeHtml(title)}</h2>
          </div>
          <div class="dlz-catalog__count">${products.length} results</div>
        </div>
        <div class="dlz-toolbar">
          <div class="dlz-filter"><span class="dlz-filter-icon">☷</span> Filters</div>
          <div class="dlz-sort">Sort by: <strong>Default</strong> <span>⌄</span></div>
        </div>
        <div class="dlz-product-grid">
          ${cards || `<div class="dlz-empty">No products are connected to this category yet.</div>`}
        </div>
      </div>
    </div>
    <div class="dlz-qv-modal" id="dlzQuickViewModal" aria-hidden="true">
      <div class="dlz-qv-dialog" role="dialog" aria-modal="true" aria-label="Product quick view">
        <button class="dlz-qv-close" type="button" aria-label="Close">×</button>
        <div class="dlz-qv-image"><img alt=""></div>
        <div class="dlz-qv-copy">
          <div class="dlz-qv-meta"></div>
          <h3></h3>
          <div class="dlz-qv-price"></div>
          <p class="dlz-qv-desc"></p>
          <div class="dlz-qv-specs"></div>
          <div class="dlz-qv-actions">
            <a class="dlz-qv-detail" href="#">VIEW DETAILS</a>
            <a class="dlz-qv-whatsapp secondary" href="#" target="_blank" rel="noopener">WHATSAPP</a>
          </div>
        </div>
      </div>
    </div>
    <script>
    (function(){
      var products = ${JSON.stringify(quickViewData).replace(/</g, "\\u003c")};
      var bySlug = {};
      products.forEach(function(product){ bySlug[product.slug] = product; });
      var modal = document.getElementById('dlzQuickViewModal');
      if (!modal) return;
      var closeBtn = modal.querySelector('.dlz-qv-close');
      function text(selector, value){ var el = modal.querySelector(selector); if (el) el.textContent = value || ''; }
      function openQuickView(slug, selectedImage) {
        var product = bySlug[slug];
        if (!product) return;
        var img = modal.querySelector('.dlz-qv-image img');
        if (img) { img.src = selectedImage || product.image || ''; img.alt = product.name || ''; }
        text('.dlz-qv-meta', product.category || '');
        text('.dlz-qv-copy h3', product.name || '');
        text('.dlz-qv-price', product.priceText || '');
        text('.dlz-qv-desc', product.description || '');
        var specs = modal.querySelector('.dlz-qv-specs');
        if (specs) {
          specs.innerHTML = (product.specs || []).map(function(spec){
            return '<div class="dlz-qv-spec"><strong>' + escapeHtml(spec.key || '') + '</strong><span>' + escapeHtml(spec.value || '') + '</span></div>';
          }).join('');
        }
        var detail = modal.querySelector('.dlz-qv-detail');
        if (detail) detail.href = product.page || '#';
        var whatsapp = modal.querySelector('.dlz-qv-whatsapp');
        var cfg = window.__ADMIN_TRACKING__ || {};
        if (whatsapp) whatsapp.href = cfg.whatsappUrl || 'https://wa.me/';
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }
      function closeQuickView() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }
      function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
          return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch];
        });
      }
      document.addEventListener('click', function(event){
        var quick = event.target.closest && event.target.closest('[data-quick-view]');
        if (quick) {
          event.preventDefault();
          openQuickView(quick.getAttribute('data-quick-view'));
          return;
        }
        if (event.target === modal || (event.target.closest && event.target.closest('.dlz-qv-close'))) closeQuickView();
      });
      document.addEventListener('keydown', function(event){ if (event.key === 'Escape') closeQuickView(); });
      closeBtn && closeBtn.addEventListener('click', closeQuickView);
    })();
    </script>
  </section>`;
}

function categoryQuickViewData(file) {
  const settings = readJson(SETTINGS_FILE, {});
  return categoryProductsForPage(file).map((product) => ({
    slug: product.slug,
    name: product.name,
    page: product.page,
    category: product.subcategory || product.category || "",
    price: product.price || "",
    priceText: formatMoney(product.price, settings),
    sku: product.sku || "",
    image: productCardImage(product),
    variants: productVariants(product),
    description: product.description || product.notes || product.heroSubtitle || "",
    specs: Array.isArray(product.specs) ? product.specs.filter((spec) => spec.enabled !== false).slice(0, 8) : discoverProductSpecs(product.page).slice(0, 8),
  }));
}

function renderNativeCategoryStart(file) {
  const products = categoryProductsForPage(file);
  const title = currentCategoryTitle(file);
  const parent = currentCategoryParent(file);
  return `<section class="dlz-catalog" data-dlz-product-count="${products.length}" aria-label="${escapeAttr(title)} products">
    <style>
      .product-container{background:#fff;min-height:0!important;padding:0!important}
      .dlz-catalog{background:#fff;color:#050505;padding:24px clamp(18px,3vw,54px) 46px;font-family:Arial,"Microsoft YaHei",sans-serif}
      .dlz-catalog__layout{display:grid;grid-template-columns:minmax(200px,252px) minmax(0,1fr);gap:34px;max-width:1720px;margin:0 auto;align-items:start}
      .dlz-category-nav{position:sticky;top:22px;padding-right:18px}
      .dlz-catch-link,.dlz-category-link{display:flex;align-items:center;gap:14px;color:#050505;text-decoration:none;font-size:16px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;line-height:1.2}
      .dlz-catch-link{padding:0 0 28px}
      .dlz-catch-link span{font-size:13px}
      .dlz-category-group{border-top:1px solid #151515;padding:26px 0}
      .dlz-category-link span{font-size:20px;width:14px;display:inline-block;font-weight:600}
      .dlz-subcategory-list{display:grid;gap:22px;margin:28px 0 0 28px}
      .dlz-subcategory-link{display:block;color:#050505;text-decoration:none;font-size:13px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;line-height:1.15}
      .dlz-subcategory-link.is-current{text-decoration:underline;text-underline-offset:4px}
      .dlz-results-head{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:end;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:12px}
      .dlz-eyebrow{font-size:14px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;margin-bottom:10px}
      .dlz-results-head h2{font-size:clamp(30px,3vw,44px);line-height:1;margin:0;font-weight:800;letter-spacing:0}
      .dlz-catalog__count{font-size:17px;font-weight:800;white-space:nowrap;margin-bottom:6px}
      .dlz-toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;font-size:15px}
      .dlz-filter{display:inline-flex;align-items:center;gap:11px;font-weight:700;text-decoration:underline;text-underline-offset:4px}
      .dlz-filter-icon{font-size:22px;line-height:1}
      .dlz-sort{display:inline-flex;align-items:center;gap:16px;color:#555}
      .dlz-sort strong{color:#333}
      .dlz-sort span{font-size:18px;color:#111}
      .dlz-native-product-wrap{min-height:0!important;position:relative}
      #dlz-products{width:100%;height:auto!important;min-height:0!important}
      #dlz-products[data-dlz-loading="1"]{min-height:310px!important}
      #dlz-products[data-dlz-loading="1"]::before{content:"";display:block;width:100%;height:310px;border-radius:8px;background:linear-gradient(100deg,#f4f4f4 8%,#ffffff 18%,#eeeeee 33%);background-size:220% 100%;animation:dlzProductSkeleton 1.1s ease-in-out infinite}
      #dlz-products[data-dlz-ready="1"]{animation:dlzProductsIn .32s ease both}
      @keyframes dlzProductSkeleton{0%{background-position:120% 0}100%{background-position:-120% 0}}
      @keyframes dlzProductsIn{from{opacity:.35;transform:translateY(10px)}to{opacity:1;transform:none}}
      @keyframes dlzCardIn{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
      #dlz-products .views-row{animation:dlzCardIn .5s cubic-bezier(.22,.61,.36,1) both}
      #dlz-products .views-row:nth-child(2){animation-delay:.05s}
      #dlz-products .views-row:nth-child(3){animation-delay:.1s}
      #dlz-products .views-row:nth-child(4){animation-delay:.15s}
      #dlz-products .views-row:nth-child(5){animation-delay:.2s}
      #dlz-products .views-row:nth-child(6){animation-delay:.25s}
      #dlz-products .views-row:nth-child(7){animation-delay:.3s}
      #dlz-products .views-row:nth-child(n+8){animation-delay:.35s}
      #dlz-products [data-dlz-product-card]{position:relative}
      #dlz-products .dlz-native-quick{display:flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box;border:0;border-radius:12px;background:#050505;color:#fff;font-size:12px;font-weight:800;letter-spacing:.18em;text-align:center;cursor:pointer;opacity:0;max-height:0;margin-top:0;padding:0 14px;overflow:hidden;box-shadow:0 8px 22px rgba(0,0,0,.16);transition:max-height .34s cubic-bezier(.22,.61,.36,1),margin-top .34s cubic-bezier(.22,.61,.36,1),padding .34s cubic-bezier(.22,.61,.36,1),opacity .26s ease;align-self:end}
      #dlz-products .dlz-native-quick:hover{background:#222}
      #dlz-products [data-dlz-product-card]:hover .dlz-native-quick,#dlz-products [data-dlz-product-card]:focus-within .dlz-native-quick,#dlz-products [data-dlz-product-card].is-hovered .dlz-native-quick{opacity:1;max-height:60px;margin-top:16px;padding:13px 14px}
      #dlz-products .field_products_view,
      #dlz-products .views-element-container,
      #dlz-products .views-element-container>div{height:auto!important;min-height:0!important;margin-top:0!important;padding-top:0!important}
      #dlz-products .field_products_view .views-element-container>div{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),270px))!important;gap:34px 24px!important;align-items:start;justify-content:start;width:100%!important}
      .dlz-catalog[data-dlz-product-count="1"] #dlz-products .field_products_view .views-element-container>div{grid-template-columns:minmax(min(100%,240px),300px)!important}
      #dlz-products .views-row{border:1px solid #707070;border-radius:0;background:#fff;min-height:430px;position:relative;padding:20px 20px 20px;display:grid!important;grid-template-rows:auto minmax(0,1fr) auto auto auto;width:auto!important;min-width:0!important;max-width:270px!important;flex:initial!important;box-shadow:none;overflow:visible;opacity:1!important;visibility:visible!important}
      #dlz-products .views-row:hover{box-shadow:0 12px 30px rgba(0,0,0,.08)}
      #dlz-products .views-row::before{content:"NEW";display:block;min-height:18px;font-size:12px;font-weight:900;letter-spacing:.04em;color:#111;text-transform:uppercase}
      #dlz-products .views-row a{color:#17191d;text-decoration:none;font-size:14px;line-height:1.16;letter-spacing:.2em;text-transform:uppercase;font-weight:900}
      #dlz-products .dlz-legacy-link{display:grid!important;grid-template-rows:minmax(0,1fr) auto;min-height:0}
      #dlz-products .dlz-legacy-image{display:grid;place-items:center;aspect-ratio:1/1;height:auto;min-height:0;margin:18px 0 22px}
      #dlz-products .dlz-legacy-image img{width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain}
      #dlz-products .dlz-legacy-title{min-height:38px;max-width:340px}
      #dlz-products .dlz-legacy-meta{font-size:13px;color:#17191d;letter-spacing:.04em;font-weight:600;text-transform:none;line-height:1.2;min-height:18px;margin-top:2px}
      #dlz-products .dlz-legacy-price{font-size:14px;font-weight:900;letter-spacing:.12em;margin-top:14px;min-height:18px}
      #dlz-products .dlz-variant-row{display:flex;align-items:center;gap:9px;min-height:30px;margin-top:12px;flex-wrap:wrap}
      #dlz-products .dlz-variant-swatch{width:22px;height:22px;border-radius:50%;border:1px solid #cfcfcf;background:#ddd;box-shadow:inset 0 0 0 2px #fff;cursor:pointer;padding:0;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease}
      #dlz-products .dlz-variant-swatch:hover,#dlz-products .dlz-variant-swatch.is-active{border-color:#050505;box-shadow:inset 0 0 0 2px #fff,0 0 0 1px #050505;transform:translateY(-1px)}
      #dlz-products .dlz-variant-swatch[style*="#000000"],#dlz-products .dlz-variant-swatch[style*="rgb(0"]{border-color:#888}
      #dlz-products .dlz-variant-name{font-size:11px;color:#555;line-height:1.1;min-width:0;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #dlz-products .dlz-legacy-price + .dlz-native-quick,#dlz-products .views-row .dlz-native-quick{margin-top:18px}
      .dlz-qv-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.58);padding:22px}
      .dlz-qv-modal.open{display:flex}
      .dlz-qv-dialog{background:#fff;color:#111;width:min(960px,100%);max-height:88vh;overflow:auto;display:grid;grid-template-columns:minmax(260px,420px) 1fr;position:relative}
      .dlz-qv-close{position:absolute;right:12px;top:10px;border:0;background:transparent;font-size:30px;line-height:1;cursor:pointer;color:#111}
      .dlz-qv-image{display:grid;place-items:center;background:#f6f6f6;min-height:430px;padding:28px}
      .dlz-qv-image img{width:100%;height:100%;max-height:430px;object-fit:contain}
      .dlz-qv-copy{padding:42px 34px;display:grid;gap:14px;align-content:start}
      .dlz-qv-copy h3{font-size:34px;line-height:1.05;margin:0;letter-spacing:0}
      .dlz-qv-meta{font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#555}
      .dlz-qv-price{font-size:20px;font-weight:800;letter-spacing:.08em}
      .dlz-qv-desc{font-size:15px;line-height:1.55;color:#444;margin:0}
      .dlz-qv-specs{display:grid;gap:7px;margin-top:6px}
      .dlz-qv-spec{display:grid;grid-template-columns:120px 1fr;gap:12px;font-size:13px;border-top:1px solid #ececec;padding-top:7px}
      .dlz-qv-spec strong{font-weight:800}
      .dlz-qv-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:8px}
      .dlz-qv-actions a{display:inline-flex;align-items:center;justify-content:center;background:#050505;color:#fff;text-decoration:none;padding:13px 18px;font-size:13px;font-weight:800;letter-spacing:.16em;min-height:42px}
      .dlz-qv-actions a.secondary{background:#e9e9e9;color:#111}
      @media(max-width:1200px){.dlz-catalog__layout{grid-template-columns:minmax(180px,224px) minmax(0,1fr);gap:28px}#dlz-products .field_products_view .views-element-container>div{grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),250px))!important;gap:30px 20px!important}#dlz-products .views-row{min-height:405px;max-width:250px!important}}
      @media(max-width:900px){.dlz-catalog{padding:28px 14px 38px}.dlz-catalog__layout{grid-template-columns:1fr;gap:22px}.dlz-category-nav{position:static;padding-right:0}.dlz-category-group{padding:18px 0}.dlz-subcategory-list{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:18px 0 0}.dlz-results-head{grid-template-columns:1fr}.dlz-results-head h2{font-size:34px}.dlz-toolbar{margin-bottom:18px}#dlz-products .field_products_view .views-element-container>div,.dlz-catalog[data-dlz-product-count] #dlz-products .field_products_view .views-element-container>div{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:18px 14px!important}#dlz-products .views-row{min-height:392px;max-width:none!important;padding:13px 11px 0}#dlz-products .dlz-legacy-image{margin:12px 0 16px}#dlz-products .views-row a{font-size:12px;letter-spacing:.1em}#dlz-products .dlz-variant-row{gap:7px;margin-top:10px}#dlz-products .dlz-variant-swatch{width:20px;height:20px}#dlz-products .dlz-variant-name{display:none}#dlz-products .dlz-native-quick{letter-spacing:.12em;font-size:11px;min-height:40px;width:100%;margin:0!important}.dlz-qv-dialog{grid-template-columns:1fr}.dlz-qv-image{min-height:260px}.dlz-qv-copy{padding:28px 20px}.dlz-qv-copy h3{font-size:28px}.dlz-qv-spec{grid-template-columns:1fr}}
      @media(max-width:520px){#dlz-products .field_products_view .views-element-container>div,.dlz-catalog[data-dlz-product-count] #dlz-products .field_products_view .views-element-container>div{grid-template-columns:1fr!important}#dlz-products .views-row{min-height:390px;max-width:none!important}#dlz-products .dlz-legacy-image{aspect-ratio:auto;height:210px}}
    </style>
    <div class="dlz-catalog__layout">
      ${renderCategoryNav(file)}
      <div class="dlz-results">
        <div class="dlz-results-head">
          <div>
            <div class="dlz-eyebrow">${escapeHtml(parent)}</div>
            <h2>${escapeHtml(title)}</h2>
          </div>
          <div class="dlz-catalog__count">${products.length} results</div>
        </div>
        <div class="dlz-toolbar">
          <div class="dlz-filter"><span class="dlz-filter-icon">+</span> Filters</div>
          <div class="dlz-sort">Sort by: <strong>Default</strong> <span>v</span></div>
        </div>
        <div class="dlz-native-product-wrap">`;
}

function renderNativeCategoryEnd(file) {
  const quickViewData = categoryQuickViewData(file);
  return `</div>
      </div>
    </div>
    <div class="dlz-qv-modal" id="dlzQuickViewModal" aria-hidden="true">
      <div class="dlz-qv-dialog" role="dialog" aria-modal="true" aria-label="Product quick view">
        <button class="dlz-qv-close" type="button" aria-label="Close">x</button>
        <div class="dlz-qv-image"><img alt=""></div>
        <div class="dlz-qv-copy">
          <div class="dlz-qv-meta"></div>
          <h3></h3>
          <div class="dlz-qv-price"></div>
          <p class="dlz-qv-desc"></p>
          <div class="dlz-qv-specs"></div>
          <div class="dlz-qv-actions">
            <a class="dlz-qv-detail" href="#">VIEW DETAILS</a>
            <a class="dlz-qv-whatsapp secondary" href="#" target="_blank" rel="noopener">WHATSAPP</a>
          </div>
        </div>
      </div>
    </div>
    <script>
    (function(){
      var products = ${JSON.stringify(quickViewData).replace(/</g, "\\u003c")};
      var bySlug = {};
      var byAlias = {};
      function normalize(value) {
        return String(value || '').toLowerCase().replace(/™|&trade;|®|&reg;/g, '').replace(/[^a-z0-9]+/g, '');
      }
      function addAlias(key, product) {
        key = normalize(key);
        if (key && !byAlias[key]) byAlias[key] = product;
      }
      products.forEach(function(product){
        bySlug[product.slug] = product;
        addAlias(product.slug, product);
        addAlias(product.page, product);
        addAlias(String(product.page || '').replace(/\\.html$/i, ''), product);
        addAlias(product.name, product);
      });
      products.forEach(function(product){
        var parts = String(product.slug || '').split('-');
        while (parts.length > 1) {
          parts.pop();
          addAlias(parts.join('-'), product);
        }
      });
      var modal = document.getElementById('dlzQuickViewModal');
      if (!modal) return;
      var closeBtn = modal.querySelector('.dlz-qv-close');
      function text(selector, value){ var el = modal.querySelector(selector); if (el) el.textContent = value || ''; }
      function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch){
          return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch];
        });
      }
      function openQuickView(slug) {
        var product = bySlug[slug];
        if (!product) return;
        var img = modal.querySelector('.dlz-qv-image img');
        if (img) { img.src = product.image || ''; img.alt = product.name || ''; }
        text('.dlz-qv-meta', product.category || '');
        text('.dlz-qv-copy h3', product.name || '');
        text('.dlz-qv-price', product.priceText || '');
        text('.dlz-qv-desc', product.description || '');
        var specs = modal.querySelector('.dlz-qv-specs');
        if (specs) {
          specs.innerHTML = (product.specs || []).map(function(spec){
            return '<div class="dlz-qv-spec"><strong>' + escapeHtml(spec.key || '') + '</strong><span>' + escapeHtml(spec.value || '') + '</span></div>';
          }).join('');
        }
        var detail = modal.querySelector('.dlz-qv-detail');
        if (detail) detail.href = product.page || '#';
        var whatsapp = modal.querySelector('.dlz-qv-whatsapp');
        var cfg = window.__ADMIN_TRACKING__ || {};
        if (whatsapp) whatsapp.href = cfg.whatsappUrl || 'https://wa.me/';
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
      }
      function closeQuickView() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
      }
      function productForLink(link) {
        if (!link) return null;
        var href = link.getAttribute('href') || '';
        var last = href.split('?')[0].split('#')[0].split('/').filter(Boolean).pop() || '';
        var key = last.replace(/\\.html$/i, '');
        return byAlias[normalize(key)] || byAlias[normalize(link.textContent)] || null;
      }
      function addQuickButton(card, product) {
        if (!card || !product) return;
        card.setAttribute('data-dlz-product-card', product.slug);
        if (card.getAttribute('data-dlz-hover-bound') !== '1') {
          card.setAttribute('data-dlz-hover-bound', '1');
          card.addEventListener('mouseenter', function(){ card.classList.add('is-hovered'); });
          card.addEventListener('mouseleave', function(){ card.classList.remove('is-hovered'); });
        }
        if (card.querySelector('.dlz-native-quick')) return;
        var button = document.createElement('button');
        button.className = 'dlz-native-quick';
        button.type = 'button';
        button.setAttribute('data-quick-view', product.slug);
        button.textContent = 'QUICK VIEW';
        card.appendChild(button);
      }
      function variantHtml(product) {
        var variants = (product && product.variants) || [];
        if (!variants.length) return '';
        return '<div class="dlz-variant-row" role="group" aria-label="Select color or type">' + variants.map(function(variant, index){
          return '<button class="dlz-variant-swatch' + (index === 0 ? ' is-active' : '') + '" type="button" data-variant-image="' + escapeHtml(variant.image || product.image || '') + '" data-variant-name="' + escapeHtml(variant.name || '') + '" aria-label="' + escapeHtml(variant.name || 'Option') + '" style="background:' + escapeHtml(variant.color || '#d8d8d8') + '"></button>';
        }).join('') + '<span class="dlz-variant-name">' + escapeHtml(variants[0].name || '') + '</span></div>';
      }
      function addVariantButtons(card, product) {
        if (!card || !product || !product.variants || !product.variants.length) return;
        if (!card.getAttribute('data-dlz-selected-image')) card.setAttribute('data-dlz-selected-image', product.image || '');
        if (card.querySelector('.dlz-variant-row')) return;
        var quick = card.querySelector('.dlz-native-quick');
        var wrap = document.createElement('div');
        wrap.innerHTML = variantHtml(product);
        var row = wrap.firstChild;
        if (!row) return;
        if (quick) card.insertBefore(row, quick);
        else card.appendChild(row);
      }
      function enhanceLegacyRow(row, product, link) {
        if (!row || !product || row.getAttribute('data-dlz-enhanced') === '1') return;
        row.setAttribute('data-dlz-enhanced', '1');
        if (!row.querySelector('img')) {
          row.innerHTML = '<a class="dlz-legacy-link" href="' + escapeHtml(product.page || '#') + '"><div class="dlz-legacy-image"><img src="' + escapeHtml(product.image || '') + '" alt="' + escapeHtml(product.name || '') + '" loading="lazy"></div><div class="dlz-legacy-title">' + escapeHtml(product.name || (link && link.textContent) || '') + '</div></a><div class="dlz-legacy-meta">' + escapeHtml(product.category || '') + '</div>' + (product.priceText ? '<div class="dlz-legacy-price">' + escapeHtml(product.priceText) + '</div>' : '') + variantHtml(product);
        }
      }
      function renderFallback(root) {
        if (!root || root.getAttribute('data-dlz-fallback') === '1') return;
        // Products were already rendered on the server: keep them, just mark ready.
        if (root.querySelector('[data-dlz-product-card]')) {
          root.setAttribute('data-dlz-fallback', '1');
          root.removeAttribute('data-dlz-loading');
          root.setAttribute('data-dlz-ready', '1');
          return;
        }
        root.setAttribute('data-dlz-fallback', '1');
        root.removeAttribute('data-dlz-loading');
        root.setAttribute('data-dlz-ready', '1');
        root.innerHTML = '<div class="field_products_view"><div class="views-element-container"><div>' + products.map(function(product){
          return '<div class="views-row" data-dlz-product-card="' + escapeHtml(product.slug || '') + '" data-dlz-selected-image="' + escapeHtml(product.image || '') + '"><a class="dlz-legacy-link" href="' + escapeHtml(product.page || '#') + '"><div class="dlz-legacy-image"><img src="' + escapeHtml(product.image || '') + '" alt="' + escapeHtml(product.name || '') + '" loading="lazy"></div><div class="dlz-legacy-title">' + escapeHtml(product.name || '') + '</div></a><div class="dlz-legacy-meta">' + escapeHtml(product.category || '') + '</div>' + (product.priceText ? '<div class="dlz-legacy-price">' + escapeHtml(product.priceText) + '</div>' : '') + variantHtml(product) + '<button class="dlz-native-quick" type="button" data-quick-view="' + escapeHtml(product.slug || '') + '">QUICK VIEW</button></div>';
        }).join('') + '</div></div></div>';
      }
      function enhanceProducts() {
        var root = document.getElementById('dlz-products');
        if (!root) return;
        if (!root.querySelector('a, img, [data-dlz-product-card]')) root.setAttribute('data-dlz-loading', '1');
        root.querySelectorAll('a').forEach(function(link){
          if (link.closest('.dlz-qv-modal')) return;
          var product = productForLink(link);
          if (!product) return;
          link.setAttribute('href', product.page || '#');
          var card = link.closest('.views-row') || link.closest('article') || link.closest('li') || link.closest('[class*="product"]') || link.parentElement;
          enhanceLegacyRow(card && card.classList && card.classList.contains('views-row') ? card : null, product, link);
          addVariantButtons(card, product);
          addQuickButton(card, product);
        });
        if (root.querySelector('a, img, [data-dlz-product-card]')) {
          root.removeAttribute('data-dlz-loading');
          root.setAttribute('data-dlz-ready', '1');
        }
      }
      renderFallback(document.getElementById('dlz-products'));
      enhanceProducts();
      setTimeout(function(){
        var root = document.getElementById('dlz-products');
        renderFallback(root);
        enhanceProducts();
      }, 1200);
      var root = document.getElementById('dlz-products');
      if (root && window.MutationObserver) {
        var timer = null;
        new MutationObserver(function(){
          clearTimeout(timer);
          timer = setTimeout(enhanceProducts, 80);
        }).observe(root, { childList: true, subtree: true });
      }
      document.addEventListener('click', function(event){
        var swatch = event.target.closest && event.target.closest('.dlz-variant-swatch');
        if (swatch) {
          event.preventDefault();
          event.stopPropagation();
          var card = swatch.closest('[data-dlz-product-card]');
          var image = swatch.getAttribute('data-variant-image') || '';
          if (card && image) {
            card.setAttribute('data-dlz-selected-image', image);
            var img = card.querySelector('img');
            if (img) img.src = image;
          }
          var row = swatch.closest('.dlz-variant-row');
          if (row) {
            row.querySelectorAll('.dlz-variant-swatch').forEach(function(item){ item.classList.remove('is-active'); });
            swatch.classList.add('is-active');
            var label = row.querySelector('.dlz-variant-name');
            if (label) label.textContent = swatch.getAttribute('data-variant-name') || '';
          }
          return;
        }
        var quick = event.target.closest && event.target.closest('[data-quick-view]');
        if (quick) {
          event.preventDefault();
          var card = quick.closest('[data-dlz-product-card]');
          openQuickView(quick.getAttribute('data-quick-view'), card && card.getAttribute('data-dlz-selected-image'));
          return;
        }
        if (event.target === modal || (event.target.closest && event.target.closest('.dlz-qv-close'))) closeQuickView();
      });
      document.addEventListener('keydown', function(event){ if (event.key === 'Escape') closeQuickView(); });
      closeBtn && closeBtn.addEventListener('click', closeQuickView);
    })();
    </script>
  </section>`;
}

// Server-render product cards as the legacy ".views-row" markup the catalog CSS/JS
// expects, so the grid is fully populated on first paint with no loading state and
// no dependency on the original LELO React bundle.
function renderCategoryVariantRow(variants, fallbackImage) {
  if (!Array.isArray(variants) || !variants.length) return "";
  const swatches = variants.map((variant, index) => {
    const image = escapeAttr(variant.image || fallbackImage || "");
    const name = escapeAttr(variant.name || "");
    const color = escapeAttr(variant.color || "#d8d8d8");
    return `<button class="dlz-variant-swatch${index === 0 ? " is-active" : ""}" type="button" data-variant-image="${image}" data-variant-name="${name}" aria-label="${name || "Option"}" style="background:${color}"></button>`;
  }).join("");
  return `<div class="dlz-variant-row" role="group" aria-label="Select color or type">${swatches}<span class="dlz-variant-name">${escapeHtml(variants[0].name || "")}</span></div>`;
}

function renderCategoryRows(file) {
  const products = categoryQuickViewData(file);
  if (!products.length) return "";
  const rows = products.map((product) => {
    const image = escapeAttr(product.image || "");
    const name = escapeHtml(product.name || "");
    const price = product.priceText ? `<div class="dlz-legacy-price">${escapeHtml(product.priceText)}</div>` : "";
    return `<div class="views-row" data-dlz-product-card="${escapeAttr(product.slug || "")}" data-dlz-selected-image="${image}">`
      + `<a class="dlz-legacy-link" href="${escapeAttr(product.page || "#")}"><div class="dlz-legacy-image"><img src="${image}" alt="${escapeAttr(product.name || "")}" loading="lazy"></div><div class="dlz-legacy-title">${name}</div></a>`
      + `<div class="dlz-legacy-meta">${escapeHtml(product.category || "")}</div>`
      + price
      + renderCategoryVariantRow(product.variants, product.image)
      + `<button class="dlz-native-quick" type="button" data-quick-view="${escapeAttr(product.slug || "")}">QUICK VIEW</button>`
      + `</div>`;
  }).join("");
  return `<div class="field_products_view"><div class="views-element-container"><div>${rows}</div></div></div>`;
}

function injectCategoryCatalog(file, html) {
  if (!isCategoryPage(file)) return html;
  html = html
    .replace(/<link[^>]+href=["'][^"']*assets\/catalog\.css[^"']*["'][^>]*>\s*/gi, "")
    .replace(/<script[^>]+src=["'][^"']*assets\/catalog\.js[^"']*["'][^>]*>\s*<\/script>\s*/gi, "");
  const serverGrid = `<div id="dlz-products" data-dlz-ready="1">${renderCategoryRows(file)}</div>`;
  if (/<div class="product-container">/i.test(html) && /<div class="sex-toy-quiz-categories">/i.test(html)) {
    html = html.replace(/<div class="product-container">/i, () => `<div class="product-container">${renderNativeCategoryStart(file)}`);
    // Replace LELO's React container with our server-rendered grid; the original
    // markup is moved into a hidden div (its closing </div> closes the hidden div),
    // and the "react-categories" id is removed so the React bundle can't mount and
    // wipe our products.
    if (/<div\s+id=["']dlz-products["'][^>]*>/i.test(html) || /<div\s+id=["']react-categories["'][^>]*>/i.test(html)) {
      html = html.replace(/<div\s+id=["'](?:react-categories|dlz-products)["'][^>]*>/i, () => `${serverGrid}<div id="dlz-legacy-products" hidden>`);
    } else {
      html = html.replace(/(<div class="dlz-native-product-wrap">)/i, (m) => `${m}${serverGrid}`);
    }
    return html.replace(/<div class="sex-toy-quiz-categories">/i, () => `${renderNativeCategoryEnd(file)}</div>\n    <div class="sex-toy-quiz-categories">`);
  }
  const catalog = `<div class="product-container">${renderNativeCategoryStart(file)}${serverGrid}${renderNativeCategoryEnd(file)}</div>`;
  return html.replace(/(<div class="block interactive-banner-block"><\/div>)/i, (match) => `${match}\n${catalog}`);
}

function adminPageFile(value) {
  const file = path.basename(String(value || ""));
  if (!file.endsWith(".html")) return "index.html";
  return htmlFiles().includes(file) ? file : "index.html";
}

function stripTags(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function shortHash(value) {
  return crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 14);
}

function imageId(page, attr, value, index) {
  return shortHash(`${page}|${attr}|${value}|${index}`);
}

function blockId(page, tag, text, index) {
  return shortHash(`${page}|${tag}|${text}|${index}`);
}

function isImageUrl(value) {
  const url = String(value || "").split("#")[0].split("?")[0].toLowerCase();
  return /\.(jpg|jpeg|png|webp|gif|svg|avif)$/i.test(url) || /^data:image\//i.test(value);
}

function isVideoUrl(value) {
  const url = String(value || "").split("#")[0].split("?")[0].toLowerCase();
  return /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(url) || /^data:video\//i.test(value);
}

function isVideoEmbedUrl(value) {
  return /youtube\.com|youtu\.be|vimeo\.com|wistia\.com|fast\.wistia\.com/i.test(String(value || ""));
}

function isMediaUrl(value) {
  return isImageUrl(value) || isVideoUrl(value) || isVideoEmbedUrl(value);
}

function discoverImagesForPage(file) {
  const html = readTextSafe(path.join(ROOT, file));
  const items = [];
  let index = 0;
  html.replace(/<(img|video|source|iframe)\b([^>]*)>/gi, (match, tag, attrs) => {
    attrs.replace(/\b(src|data-src|srcset|poster)\s*=\s*["']([^"']+)["']/gi, (attrMatch, attr, value) => {
      const firstUrl = String(value).split(",")[0].trim().split(/\s+/)[0];
      if (!isMediaUrl(firstUrl)) return attrMatch;
      const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
      const kind = (isVideoUrl(firstUrl) || isVideoEmbedUrl(firstUrl) || tag.toLowerCase() === "iframe") ? "video" : "image";
      items.push({
        id: imageId(file, attr.toLowerCase(), value, index++),
        page: file,
        tag: tag.toLowerCase(),
        attr: attr.toLowerCase(),
        mediaKind: kind,
        group: kind === "video" ? "video" : "",
        original: value,
        preview: firstUrl,
        alt: altMatch ? decodeHtml(altMatch[1]) : "",
      });
      return attrMatch;
    });
    return match;
  });
  html.replace(/\bdata-video-embed-field-lazy\s*=\s*"([^"]*?src=&quot;([^"&]+)[^"]*)"/gi, (match, encoded, src) => {
    if (!isVideoEmbedUrl(src) && !isVideoUrl(src)) return match;
    items.push({
      id: imageId(file, "data-video-embed-field-lazy", src, index++),
      page: file,
      tag: "video-embed",
      attr: "data-video-embed-field-lazy",
      mediaKind: "video",
      group: "video",
      original: decodeHtml(src),
      preview: decodeHtml(src),
      alt: "embedded video",
    });
    return match;
  });
  html.replace(/url\((['"]?)([^'")]+)\1\)/gi, (match, quote, value) => {
    if (!isMediaUrl(value)) return match;
    items.push({
      id: imageId(file, "style-url", value, index++),
      page: file,
      tag: "style",
      attr: "style-url",
      original: value,
      preview: value,
      alt: "background image",
    });
    return match;
  });
  return items;
}

function discoverBlocksForPage(file) {
  const html = readTextSafe(path.join(ROOT, file)).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
  const blocks = [];
  let index = 0;
  const re = /<(h[1-6]|p|a|button|li|span|strong|em|small|label)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  html.replace(re, (match, tag, attrs, inner) => {
    const text = stripTags(inner);
    if (text.length < 2 || text.length > 420) return match;
    if (/^[\d\s.,:%+-]+$/.test(text)) return match;
    if (text.includes("{") && text.includes("}")) return match;
    blocks.push({
      id: blockId(file, tag.toLowerCase(), text, index++),
      page: file,
      tag: tag.toLowerCase(),
      original: text,
      value: text,
      enabled: true,
    });
    return match;
  });
  return blocks.slice(0, 240);
}

function productBounds(html) {
  const start = Math.max(0, html.search(/<main[^>]*product_page/i));
  const markers = [
    html.indexOf("related-products", start + 1),
    html.indexOf("field_newsletter_title", start + 1),
    html.indexOf("layout-container-footer", start + 1),
    html.indexOf("block-company-menu", start + 1),
  ].filter((x) => x > start);
  return { start, end: markers.length ? Math.min(...markers) : html.length };
}

function productSectionLabel(context) {
  const c = String(context || "").toLowerCase();
  if (c.includes("hero-block-product-page")) return "主图 / Hero";
  if (c.includes("product-technologies")) return "卖点 / Highlights";
  if (c.includes("how-to-use")) return "使用步骤 / How to use";
  if (c.includes("specifications-block")) return "规格图 / Product details";
  if (c.includes("lifestyle-block")) return "场景图 / Lifestyle";
  if (c.includes("qr-code-redirect")) return "App / 连接说明";
  if (c.includes("features_block")) return "功能 / Features";
  return "商品内容";
}

function isProductImageCandidate(value, context) {
  const url = String(value || "").split(",")[0].trim().split(/\s+/)[0].split("?")[0].toLowerCase();
  if (!/\.(jpg|jpeg|png|webp|gif|avif)$/i.test(url)) return false;
  const c = String(context || "").toLowerCase();
  if (c.includes("related-products") || c.includes("newsletter") || c.includes("payment") || c.includes("wechat") || c.includes("bazaarvoice")) return false;
  if (c.includes("features-item-icon") || c.includes("field_product_technologies__icon")) return false;
  return true;
}

function productImageId(page, attr, value, index) {
  return shortHash(`${page}|product-image|${attr}|${value}|${index}`);
}

function discoverProductImages(file) {
  const html = readTextSafe(path.join(ROOT, file));
  const bounds = productBounds(html);
  const items = [];
  let index = 0;
  const re = /<(img|source)\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const offset = m.index;
    if (offset < bounds.start || offset > bounds.end) continue;
    const tag = m[1].toLowerCase();
    const attrs = m[2];
    const context = html.slice(Math.max(bounds.start, offset - 1200), offset);
    attrs.replace(/\b(src|data-src|srcset)\s*=\s*["']([^"']+)["']/gi, (attrMatch, attr, value) => {
      if (!isProductImageCandidate(value, context)) return attrMatch;
      const firstUrl = String(value).split(",")[0].trim().split(/\s+/)[0];
      const altMatch = attrs.match(/\balt\s*=\s*["']([^"']*)["']/i);
      items.push({
        id: productImageId(file, attr.toLowerCase(), value, index++),
        page: file,
        tag,
        attr: attr.toLowerCase(),
        group: productSectionLabel(context),
        original: value,
        preview: firstUrl,
        alt: altMatch ? decodeHtml(altMatch[1]) : "",
        enabled: true,
      });
      return attrMatch;
    });
  }
  return items;
}

function discoverProductText(file) {
  const html = readTextSafe(path.join(ROOT, file));
  return {
    heroSubtitle: textBetween(html, /class=["']field_hero_subtitle["'][\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i),
    descriptionTitle: textBetween(html, /class=["']field_heading_block_title["'][^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/i),
    description: textBetween(html, /class=["']field_heading_block_title["'][^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i),
  };
}

function discoverProductSpecs(file) {
  const html = readTextSafe(path.join(ROOT, file));
  const specsBlock = html.match(/<div class=["']field_accordion_title["']\s*><p>Specifications<\/p><\/div>[\s\S]*?<table><tbody>([\s\S]*?)<\/tbody><\/table>/i);
  if (!specsBlock) return [];
  const specs = [];
  specsBlock[1].replace(/<tr>\s*<td>\s*<p>([\s\S]*?)<\/p>\s*<\/td>\s*<td>\s*<p>([\s\S]*?)<\/p>\s*<\/td>\s*<\/tr>/gi, (match, key, value) => {
    specs.push({ key: stripTags(key), value: stripTags(value), enabled: true });
    return match;
  });
  return specs;
}

function baseProductSpecs(product = {}) {
  return [
    { key: "SKU", value: product.sku || "", enabled: true },
    { key: "Category", value: product.category || "", enabled: true },
    { key: "Subcategory", value: product.subcategory || "", enabled: true },
    { key: "Material", value: "", enabled: true },
    { key: "Waterproof", value: "", enabled: true },
    { key: "Charging", value: "", enabled: true },
    { key: "Warranty", value: "", enabled: true },
  ];
}

function productEditorData(slug) {
  const products = productList();
  const product = products.find((p) => p.slug === slug) || products[0];
  if (!product) return { product: null, images: [], specs: [], hierarchy: {} };
  const discoveredImages = discoverProductImages(product.page);
  const savedImages = Array.isArray(product.images) ? product.images : [];
  const images = discoveredImages.map((img) => ({ ...img, ...(savedImages.find((x) => x.id === img.id) || {}) }));
  const discoveredSpecs = discoverProductSpecs(product.page);
  const savedSpecs = Array.isArray(product.specs) ? product.specs : [];
  const specSource = savedSpecs.length ? savedSpecs : (discoveredSpecs.length ? discoveredSpecs : baseProductSpecs(product));
  const specs = specSource.map((spec, i) => ({ ...spec, ...(savedSpecs[i] || {}) }));
  const variants = productVariants(product).map((variant) => ({ ...variant }));
  return { product: { ...product, images, specs, variants }, images, specs, hierarchy: productHierarchy() };
}

function saveProductEditor(body) {
  const product = body && body.product ? body.product : body;
  if (!product || !product.slug) return null;
  const products = productList();
  const idx = products.findIndex((p) => p.slug === product.slug);
  const cleanImages = Array.isArray(product.images) ? product.images.map((img) => ({
    id: String(img.id || ""),
    page: String(img.page || product.page || ""),
    attr: String(img.attr || ""),
    mediaKind: String(img.mediaKind || ""),
    group: String(img.group || ""),
    original: String(img.original || ""),
    preview: String(img.preview || ""),
    replacement: String(img.replacement || ""),
    enabled: img.enabled !== false,
  })).filter((img) => img.id) : [];
  const cleanSpecs = Array.isArray(product.specs) ? product.specs.map((spec) => ({
    key: String(spec.key || ""),
    value: String(spec.value || ""),
    enabled: spec.enabled !== false,
  })).filter((spec) => spec.key || spec.value) : [];
  const cleanVariants = Array.isArray(product.variants) ? product.variants.map((variant) => ({
    name: String(variant.name || variant.label || ""),
    type: String(variant.type || ""),
    color: String(variant.color || variant.hex || "#d8d8d8"),
    image: String(variant.image || variant.url || ""),
    enabled: variant.enabled !== false,
  })).filter((variant) => variant.name || variant.image || variant.color) : [];
  const saved = {
    ...(idx >= 0 ? products[idx] : {}),
    ...product,
    images: cleanImages,
    specs: cleanSpecs,
    variants: cleanVariants,
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) products[idx] = saved;
  else products.push(saved);
  writeJson(PRODUCTS_FILE, products);
  return saved;
}

function slugify(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return slug || `product-${Date.now().toString(36)}`;
}

function uniqueProductSlug(value) {
  const base = slugify(value);
  const used = new Set([
    ...productList().map((p) => p.slug),
    ...htmlFiles().map((file) => file.replace(/\.html$/i, "")),
  ]);
  let slug = base;
  let index = 2;
  while (used.has(slug) || fs.existsSync(path.join(ROOT, `${slug}.html`))) {
    slug = `${base}-${index++}`;
  }
  return slug;
}

function minimalProductHtml(product) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku || "",
    description: product.description || "",
    image: product.cardImage || "",
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency || "USD",
      price: product.price || "",
    },
  };
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(product.name)} | LOVE</title>
  <script id="schema_product" type="application/ld+json">${JSON.stringify(schema)}</script>
  <style>
    body{margin:0;font-family:Arial,"Microsoft YaHei",sans-serif;color:#111;background:#fff}
    a{color:inherit}.product-page{max-width:1180px;margin:0 auto;padding:38px 18px 72px}
    .product-hero{display:grid;grid-template-columns:minmax(280px,520px) 1fr;gap:42px;align-items:start}
    .product-media{display:grid;place-items:center;background:#f6f6f6;min-height:520px}
    .product-media img{max-width:88%;max-height:460px;object-fit:contain}
    h1{font-size:clamp(34px,4vw,58px);line-height:1;margin:0 0 14px}
    .field_hero_subtitle h2{font-size:20px;line-height:1.45;font-weight:400;color:#555;margin:0 0 22px}
    .price{font-size:24px;font-weight:800;margin:18px 0}.wa{display:inline-flex;background:#050505;color:#fff;text-decoration:none;padding:14px 22px;font-weight:800;letter-spacing:.12em}
    .field_heading_block_title{margin-top:46px}.field_heading_block_title h3{font-size:28px;margin:0 0 12px}.field_heading_block_title p{font-size:16px;line-height:1.65;color:#444}
    .field_accordion_title{margin-top:44px;border-top:1px solid #ddd;padding-top:24px;font-weight:800}
    table{width:100%;border-collapse:collapse;margin-top:12px}td{border-top:1px solid #ececec;padding:12px}td:first-child{font-weight:800;width:36%}
    @media(max-width:760px){.product-hero{grid-template-columns:1fr}.product-media{min-height:320px}}
  </style>
</head>
<body>
  <main class="product-page">
    <section class="product-hero">
      <div class="product-media"><img src="${escapeAttr(product.cardImage || "assets/love-logo.svg")}" alt="${escapeAttr(product.name)}"></div>
      <div>
        <h1>${escapeHtml(product.name)}</h1>
        <div class="field_hero_subtitle"><h2>${escapeHtml(product.heroSubtitle || "Edit this subtitle in the admin visual editor.")}</h2></div>
        <div class="price">${escapeHtml(product.currency || "USD")} ${escapeHtml(product.price || "")}</div>
        <a class="wa" href="#">WHATSAPP</a>
        <div class="field_heading_block_title"><h3><strong>${escapeHtml(product.descriptionTitle || "Product Details")}</strong></h3><p>${escapeHtml(product.description || "Edit this description in the admin visual editor.")}</p></div>
        <div class="field_accordion_title"><p>Specifications</p></div>
        <table><tbody><tr><td><p>SKU</p></td><td><p>${escapeHtml(product.sku || "")}</p></td></tr></tbody></table>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function createProductPageFile(product, templatePage) {
  const target = path.join(ROOT, product.page);
  if (fs.existsSync(target)) return;
  const template = adminPageFile(templatePage || "enigma-double-sonic.html");
  const templatePath = path.join(ROOT, template);
  let html = fs.existsSync(templatePath) ? readTextSafe(templatePath) : minimalProductHtml(product);
  if (!html.trim()) html = minimalProductHtml(product);
  html = replaceTitle(html, `${product.name} | LOVE`);
  html = replaceFirstH1(html, product.name);
  html = replaceSchemaProduct(html, product);
  fs.writeFileSync(target, html, "utf8");
}

function createProduct(body) {
  const name = String(body?.name || "New Product").trim() || "New Product";
  const category = String(body?.category || "Sex Toys for Women").trim() || "Sex Toys for Women";
  const subcategory = String(body?.subcategory || "General").trim() || "General";
  const slug = uniqueProductSlug(body?.slug || name);
  const product = {
    slug,
    page: `${slug}.html`,
    enabled: true,
    name,
    category,
    subcategory,
    heroSubtitle: String(body?.heroSubtitle || ""),
    descriptionTitle: String(body?.descriptionTitle || "Product Details"),
    description: String(body?.description || ""),
    sku: String(body?.sku || ""),
    price: String(body?.price || ""),
    currency: String(body?.currency || "USD"),
    whatsappUrl: String(body?.whatsappUrl || ""),
    notes: "",
    featured: false,
    sortOrder: 9999,
    images: [],
    specs: [],
    variants: [],
    updatedAt: new Date().toISOString(),
  };
  product.specs = baseProductSpecs(product);
  createProductPageFile(product, body?.templatePage);
  const products = readJson(PRODUCTS_FILE, []);
  products.push(product);
  writeJson(PRODUCTS_FILE, products);
  const pages = readJson(PAGES_FILE, []);
  if (!pages.some((page) => page.slug === product.page)) {
    pages.push({
      slug: product.page,
      enabled: true,
      title: `${product.name} | LOVE`,
      metaDescription: product.description || "",
      navLabel: product.name,
      updatedAt: new Date().toISOString(),
    });
    writeJson(PAGES_FILE, pages);
  }
  return productEditorData(slug);
}

function productTemplates() {
  return productList().map((product) => ({
    slug: product.slug,
    page: product.page,
    name: product.name,
    category: product.category,
    subcategory: product.subcategory,
  })).filter((product) => product.page && fs.existsSync(path.join(ROOT, product.page)));
}

function deleteProduct(slug) {
  slug = String(slug || "");
  if (!slug) return null;
  const product = productList().find((p) => p.slug === slug);
  if (!product) return null;
  const products = readJson(PRODUCTS_FILE, []);
  writeJson(PRODUCTS_FILE, products.filter((p) => (p.slug || String(p.page || "").replace(/\.html$/i, "")) !== slug));
  const pages = readJson(PAGES_FILE, []);
  writeJson(PAGES_FILE, pages.filter((p) => p.slug !== product.page));
  const src = path.join(ROOT, product.page || "");
  if (product.page && fs.existsSync(src) && path.resolve(src).startsWith(ROOT)) {
    const deletedDir = path.join(ROOT, "_deleted_products");
    fs.mkdirSync(deletedDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.renameSync(src, path.join(deletedDir, `${stamp}-${path.basename(product.page)}`));
  }
  return product;
}

function saveCategories(body) {
  const previous = categoryNav();
  const incoming = Array.isArray(body?.categories) ? body.categories : (Array.isArray(body) ? body : []);
  const categories = incoming.map((cat) => ({
    label: String(cat.label || "").trim(),
    href: String(cat.href || slugify(cat.label || "category") + ".html").trim(),
    children: Array.isArray(cat.children) ? cat.children.map((child) => ({
      label: String(child.label || "").trim(),
      href: String(child.href || slugify(child.label || "subcategory") + ".html").trim(),
    })).filter((child) => child.label && child.href) : [],
  })).filter((cat) => cat.label && cat.href);
  writeJson(CATEGORIES_FILE, categories.length ? categories : DEFAULT_CATEGORY_NAV);
  const next = categoryNav();
  const removed = [];
  for (const oldCat of previous) {
    const nextCat = next.find((cat) => cat.label === oldCat.label);
    if (!nextCat) continue;
    const nextChildren = new Set(nextCat.children.map((child) => child.label));
    for (const child of oldCat.children) {
      if (!nextChildren.has(child.label)) {
        removed.push({ category: oldCat.label, subcategory: child.label, fallback: nextCat.children[0]?.label || oldCat.label });
      }
    }
  }
  if (removed.length) {
    const products = productList().map((product) => {
      const hit = removed.find((item) => item.category === product.category && item.subcategory === product.subcategory);
      return hit ? { ...product, subcategory: hit.fallback, updatedAt: new Date().toISOString() } : product;
    });
    writeJson(PRODUCTS_FILE, products);
  }
  return categoryNav();
}

function editorDataForPage(file) {
  const page = adminPageFile(file);
  const imageOverrides = readJson(IMAGES_FILE, []).filter((item) => item.page === page);
  const blockOverrides = readJson(BLOCKS_FILE, []).filter((item) => item.page === page);
  const images = discoverImagesForPage(page).map((item) => ({
    ...item,
    ...(imageOverrides.find((x) => x.id === item.id) || {}),
  }));
  const blocks = discoverBlocksForPage(page).map((item) => ({
    ...item,
    ...(blockOverrides.find((x) => x.id === item.id) || {}),
  }));
  return { page, images, blocks };
}

function mergePageItems(file, items, incoming) {
  const page = adminPageFile(file);
  const keep = items.filter((item) => item.page !== page);
  const cleaned = Array.isArray(incoming) ? incoming
    .filter((item) => item && item.id)
    .map((item) => ({
      id: String(item.id),
      page,
      tag: String(item.tag || ""),
      attr: String(item.attr || ""),
      mediaKind: String(item.mediaKind || ""),
      group: String(item.group || ""),
      original: String(item.original || ""),
      preview: String(item.preview || ""),
      alt: String(item.alt || ""),
      replacement: String(item.replacement || ""),
      value: String(item.value || ""),
      enabled: item.enabled !== false,
      updatedAt: new Date().toISOString(),
    })) : [];
  return keep.concat(cleaned);
}

function saveUploadedImage(body) {
  const dataUrl = String(body.dataUrl || "");
  const match = dataUrl.match(/^data:((?:image\/(?:png|jpeg|webp|gif))|(?:video\/(?:mp4|webm|ogg)));base64,([a-z0-9+/=]+)$/i);
  if (!match) throw new Error("Only PNG, JPG, WEBP, GIF, MP4, WEBM and OGG files are supported");
  const mime = match[1].toLowerCase();
  const ext = mime === "image/jpeg" ? ".jpg" : `.${mime.split("/")[1]}`;
  const rawName = String(body.fileName || "image").replace(/\.[a-z0-9]+$/i, "");
  const safeName = rawName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "image";
  const bytes = Buffer.from(match[2], "base64");
  const maxBytes = mime.startsWith("video/") ? 80 * 1024 * 1024 : 8 * 1024 * 1024;
  if (bytes.length > maxBytes) throw new Error(mime.startsWith("video/") ? "Video is larger than 80MB" : "Image is larger than 8MB");
  const fileName = `${Date.now()}-${safeName}${ext}`;
  const full = path.join(UPLOAD_DIR, fileName);
  fs.writeFileSync(full, bytes);
  return `/assets/admin-uploads/${fileName}`;
}

function applyImageOverrides(file, html) {
  const overrides = readJson(IMAGES_FILE, []).filter((item) => item.page === file && item.enabled !== false && item.replacement);
  if (!overrides.length) return html;
  const map = new Map(overrides.map((item) => [item.id, item]));
  let index = 0;
  html = html.replace(/<(img|video|source|iframe)\b([^>]*)>/gi, (match, tag, attrs) => {
    return match.replace(/\b(src|data-src|srcset|poster)\s*=\s*(["'])([^"']+)\2/gi, (attrMatch, attr, quote, value) => {
      const firstUrl = String(value).split(",")[0].trim().split(/\s+/)[0];
      if (!isMediaUrl(value) && !isMediaUrl(firstUrl)) return attrMatch;
      const id = imageId(file, attr.toLowerCase(), value, index++);
      const item = map.get(id);
      return item ? `${attr}=${quote}${escapeAttr(item.replacement)}${quote}` : attrMatch;
    });
  });
  html = html.replace(/\bdata-video-embed-field-lazy\s*=\s*"([^"]*?src=&quot;)([^"&]+)([^"]*)"/gi, (match, before, src, after) => {
    if (!isVideoEmbedUrl(src) && !isVideoUrl(src)) return match;
    const id = imageId(file, "data-video-embed-field-lazy", src, index++);
    const item = map.get(id);
    return item ? `data-video-embed-field-lazy="${before}${escapeAttr(item.replacement)}${after}"` : match;
  });
  html = html.replace(/url\((['"]?)([^'")]+)\1\)/gi, (match, quote, value) => {
    if (!isMediaUrl(value)) return match;
    const id = imageId(file, "style-url", value, index++);
    const item = map.get(id);
    return item ? `url(${quote}${escapeAttr(item.replacement)}${quote})` : match;
  });
  return html;
}

function applyBlockOverrides(file, html) {
  const overrides = readJson(BLOCKS_FILE, []).filter((item) => item.page === file && item.enabled !== false && item.value);
  if (!overrides.length) return html;
  const map = new Map(overrides.map((item) => [item.id, item]));
  let index = 0;
  const re = /<(h[1-6]|p|a|button|li|span|strong|em|small|label)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  return html.replace(re, (match, tag, attrs, inner) => {
    const text = stripTags(inner);
    if (text.length < 2 || text.length > 420 || /^[\d\s.,:%+-]+$/.test(text) || (text.includes("{") && text.includes("}"))) return match;
    const id = blockId(file, tag.toLowerCase(), text, index++);
    const item = map.get(id);
    if (!item || item.value === item.original) return match;
    return `<${tag}${attrs}>${escapeHtml(item.value)}</${tag}>`;
  });
}

function replaceTitle(html, title) {
  if (!title) return html;
  if (/<title[^>]*>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  }
  return html.replace(/<\/head>/i, `<title>${escapeHtml(title)}</title>\n</head>`);
}

function replaceMetaDescription(html, description) {
  if (!description) return html;
  const tag = `<meta name="description" content="${escapeAttr(description)}" />`;
  if (/<meta\s+name=["']description["'][^>]*>/i.test(html)) {
    return html.replace(/<meta\s+name=["']description["'][^>]*>/i, tag);
  }
  return html.replace(/<\/head>/i, `${tag}\n</head>`);
}

function replaceFirstH1(html, text) {
  if (!text) return html;
  return html.replace(/<h1([^>]*)>([\s\S]*?)<\/h1>/i, `<h1$1><strong>${escapeHtml(text)}</strong></h1>`);
}

function replaceSchemaProduct(html, product) {
  if (!product) return html;
  return html.replace(/(<script[^>]*id=["']schema_product["'][^>]*>)([\s\S]*?)(<\/script>)/i, (match, open, json, close) => {
    const schema = parseJsonText(json);
    if (!schema) return match;
    if (product.name) schema.name = product.name;
    if (product.description) schema.description = product.description;
    if (product.sku) schema.sku = product.sku;
    if (product.price && schema.offers) schema.offers.price = product.price;
    const mainImage = Array.isArray(product.images) ? product.images.find((img) => img.enabled !== false && img.replacement) : null;
    // Always use a local image for schema (never hotlink lelo.com).
    schema.image = mainImage ? mainImage.replacement : productCardImage(product);
    return `${open}${JSON.stringify(schema).replace(/</g, "\\u003c")}${close}`;
  });
}

function applyProductTextOverrides(html, product) {
  if (!product) return html;
  if (product.heroSubtitle) {
    html = html.replace(/(<div class=["']field_hero_subtitle["'][^>]*>\s*<h2([^>]*)>)([\s\S]*?)(<\/h2>\s*<\/div>)/i, `$1${escapeHtml(product.heroSubtitle)}$4`);
  }
  if (product.descriptionTitle || product.description) {
    html = html.replace(/<div class=["']field_heading_block_title["'][^>]*>\s*<h3[^>]*>[\s\S]*?<\/h3>\s*<p[^>]*>[\s\S]*?<\/p>\s*<\/div>/i, () => {
      const title = escapeHtml(product.descriptionTitle || "");
      const desc = escapeHtml(product.description || "");
      return `<div class="field_heading_block_title"><h3><strong>${title}</strong></h3><p>${desc}</p></div>`;
    });
  }
  return replaceSchemaProduct(html, product);
}

function applyProductSpecOverrides(html, product) {
  if (!product || !Array.isArray(product.specs) || !product.specs.length) return html;
  const rows = product.specs.filter((s) => s.enabled !== false && (s.key || s.value)).map((s) => (
    `<tr><td><p>${escapeHtml(s.key || "")}</p></td><td><p>${escapeHtml(s.value || "")}</p></td></tr>`
  )).join("");
  if (!rows) return html;
  return html.replace(/(<div class=["']field_accordion_title["']\s*><p>Specifications<\/p><\/div>[\s\S]*?<table><tbody>)([\s\S]*?)(<\/tbody><\/table>)/i, `$1${rows}$3`);
}

function applyProductImageOverrides(html, product) {
  if (!product || !Array.isArray(product.images) || !product.images.length) return html;
  const overrides = new Map(product.images.filter((img) => img.enabled !== false && img.replacement).map((img) => [img.id, img]));
  if (!overrides.size) return html;
  const bounds = productBounds(html);
  let index = 0;
  return html.replace(/<(img|video|source)\b([^>]*)>/gi, (match, tag, attrs, offset) => {
    if (offset < bounds.start || offset > bounds.end) return match;
    const context = html.slice(Math.max(bounds.start, offset - 1200), offset);
    return match.replace(/\b(src|data-src|srcset|poster)\s*=\s*(["'])([^"']+)\2/gi, (attrMatch, attr, quote, value) => {
      if (!isProductImageCandidate(value, context) && !isVideoUrl(value)) return attrMatch;
      const id = productImageId(product.page, attr.toLowerCase(), value, index++);
      const item = overrides.get(id);
      return item ? `${attr}=${quote}${escapeAttr(item.replacement)}${quote}` : attrMatch;
    });
  });
}

function applyProductOverrides(html, product) {
  html = applyProductTextOverrides(html, product);
  html = applyProductSpecOverrides(html, product);
  html = applyProductImageOverrides(html, product);
  return html;
}

function injectBefore(html, marker, snippet) {
  if (!snippet) return html;
  const re = new RegExp(marker, "i");
  if (re.test(html)) return html.replace(re, `${snippet}\n$&`);
  return `${html}\n${snippet}`;
}

// --- LELO residue cleanup (applied at request time) ---------------------------
// Markers identifying third-party tracker / analytics blocks left over from the
// original LELO (Drupal) site. Any <script> or <link> referencing one of these is
// dropped so the page no longer phones home to LELO or third parties.
const TRACKER_MARKERS = [
  "measure.lelo.com",
  "googletagmanager.com",
  "google-analytics.com",
  "cdn.noibu.com",
  "collect-core.js",
  "cdn.requestmetrics.com",
  "RM.install",
  "cdn.omniconvert.com",
  "app.omniconvert.com",
  "_mktz",
  "bazaarvoice",
  "connect.facebook.net",
  "fbq(",
  "gtag(",
  "noibu",
];
const TRACKER_LINK_RE = /googletagmanager|google-analytics|cdn\.noibu|omniconvert|requestmetrics|bazaarvoice|measure\.lelo/i;

function leloLinkMap() {
  const map = new Map();
  for (const cat of categoryNav()) {
    map.set(`/${cat.href.replace(/\.html$/i, "")}`, cat.href);
    for (const child of cat.children) map.set(`/${child.href.replace(/\.html$/i, "")}`, child.href);
  }
  // Common LELO URL slugs that have a local equivalent.
  const aliases = {
    "/sex-toys-men": "sex-toys-for-men.html",
    "/sex-toys-women": "sex-toys-for-women.html",
    "/sex-toys-couples": "sex-toys-for-couples.html",
    "/couples": "sex-toys-for-couples.html",
    "/best-selling-sex-toys": "bestsellers.html",
    "/bestsellers": "bestsellers.html",
    "/enigma": "enigma-double-sonic.html",
  };
  for (const [k, v] of Object.entries(aliases)) if (!map.has(k)) map.set(k, v);
  for (const product of productList()) {
    if (product.page) map.set(`/${product.slug}`, product.page);
  }
  return map;
}

function mapLeloPath(rawPath, linkMap) {
  let p = String(rawPath || "/").split("#")[0].split("?")[0];
  if (!p || p === "/") return "/";
  p = p.replace(/\/+$/, "").toLowerCase();
  return linkMap.get(p) || "#";
}

function sanitizeLeloResidue(file, html, settings) {
  const siteName = String(settings.siteName || "LOVE");
  // 1) Drop third-party tracker <script> blocks (inline or external src).
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (block) =>
    TRACKER_MARKERS.some((marker) => block.includes(marker)) ? "" : block);
  // 2) Drop tracker <noscript> fallbacks (e.g. GTM iframe).
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/gi, (block) =>
    TRACKER_LINK_RE.test(block) ? "" : block);
  // 2b) Drop tracker <iframe> tags (e.g. GTM measure.lelo.com iframe).
  html = html.replace(/<iframe\b[^>]*>(?:[\s\S]*?<\/iframe>)?/gi, (tag) =>
    TRACKER_LINK_RE.test(tag) ? "" : tag);
  // 3) Drop preconnect / dns-prefetch / script-src <link> tags to tracker hosts.
  html = html.replace(/<link\b[^>]*>/gi, (tag) => (TRACKER_LINK_RE.test(tag) ? "" : tag));
  // 4) Drop any <link> still pointing at lelo.com (manifest, hreflang alternates, ...).
  html = html.replace(/<link\b[^>]*href=["']https?:\/\/(?:www\.)?lelo\.com[^"']*["'][^>]*>/gi, "");
  // 4b) Remove LELO's multi-language switcher (this is a single-language store, and its
  //     option labels are in Chinese/Japanese/Korean/etc.).
  html = html.replace(/<div[^>]*class="[^"]*language-switcher-language-url[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
  // 5) Rewrite remaining www.lelo.com / lelo.com URLs to a local page or disable them.
  const linkMap = leloLinkMap();
  html = html.replace(/https?:\/\/(?:www\.)?lelo\.com(\/[^"'\s)]*)?/gi, (match, p) => mapLeloPath(p, linkMap));
  // 5b) Neutralize escaped JSON URLs (https:\/\/...lelo.com…) the main pass missed,
  //     for any subdomain (assets./retailer./www./bare).
  html = html.replace(/https?:\\?\/\\?\/(?:[a-z0-9-]+\.)?lelo\.com[^"'\s\\)]*/gi, "#");
  // 5c) Neutralize leftover third-party review/widget links (BazaarVoice trustmark, etc.).
  html = html.replace(/https?:\/\/(?:www\.)?bazaarvoice\.com[^"'\s)]*/gi, "#");
  // 5d) Any remaining *.lelo.com URL (assets.lelo.com CDN images, retailer.lelo.com, og:image,
  //     schema image, hidden related-products thumbs): images -> local logo, others -> #.
  //     The site must not hotlink LELO's servers.
  html = html.replace(/https?:\/\/[a-z0-9-]+\.lelo\.com\/[^"'\s)]*/gi, (m) => (isImageUrl(m) ? "assets/love-logo.svg" : "#"));
  // 6) Replace the visible "LELO" brand word with the configured site name (text only,
  //    never inside attributes/URLs, so asset filenames like LELO_WEB_... stay intact).
  if (siteName !== "LELO") {
    html = html.replace(/>([^<]+)</g, (m, text) =>
      text.indexOf("LELO") > -1 ? `>${text.replace(/LELO/g, siteName)}<` : m);
  }
  return html;
}

// Order products for display: pinned (featured) first, then by manual sortOrder,
// then alphabetically as a stable fallback.
function merchandiseSort(products) {
  return products.slice().sort((a, b) => {
    const fa = a.featured ? 0 : 1;
    const fb = b.featured ? 0 : 1;
    if (fa !== fb) return fa - fb;
    const sa = Number.isFinite(Number(a.sortOrder)) ? Number(a.sortOrder) : 9999;
    const sb = Number.isFinite(Number(b.sortOrder)) ? Number(b.sortOrder) : 9999;
    if (sa !== sb) return sa - sb;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

function homeShowcaseProducts(settings) {
  const all = productList().filter((p) => p.enabled !== false);
  const slugs = Array.isArray(settings.homeShowcase) ? settings.homeShowcase : [];
  if (slugs.length) {
    const bySlug = new Map(all.map((p) => [p.slug, p]));
    const picked = slugs.map((slug) => bySlug.get(slug)).filter(Boolean);
    if (picked.length) return picked;
  }
  // Fallback: pinned products, otherwise the first few in merchandise order.
  const featured = merchandiseSort(all.filter((p) => p.featured));
  return (featured.length ? featured : merchandiseSort(all)).slice(0, 8);
}

// Product cards with Quick View (like the category pages) for the homepage bestsellers,
// centered, animated and spaced, rendered server-side from the chosen recommendations.
function renderHomeShowcaseCatalog(products, settings) {
  const qv = products.map((p) => ({
    slug: p.slug,
    name: p.name,
    page: p.page,
    category: p.subcategory || p.category || "",
    priceText: formatMoney(p.price, settings),
    image: productCardImage(p),
    variants: productVariants(p),
    description: p.description || p.notes || p.heroSubtitle || "",
  }));
  const cards = qv.map((p, idx) => {
    const badge = /new|thrust|v3/i.test(p.name || "") ? "NEW" : "BESTSELLER";
    const swatches = (p.variants || []).slice(0, 6).map((v, i) =>
      `<button type="button" class="dlz-hs-swatch${i === 0 ? " is-active" : ""}" data-hs-image="${escapeAttr(v.image || p.image)}" style="background:${escapeAttr(v.color || "#d8d8d8")}" aria-label="${escapeAttr(v.name || "Option")}"></button>`
    ).join("");
    const price = p.priceText ? `<div class="dlz-hs-price">${escapeHtml(p.priceText)}</div>` : "";
    return `<article class="dlz-hs-card" data-hs-card="${escapeAttr(p.slug)}" data-hs-img="${escapeAttr(p.image)}" style="animation-delay:${Math.min(idx * 60, 420)}ms">
      <div class="dlz-hs-badge">${badge}</div>
      <a class="dlz-hs-imgwrap" href="${escapeAttr(p.page)}" aria-label="${escapeAttr(p.name)}"><img class="dlz-hs-img" src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}" loading="lazy"></a>
      <div class="dlz-hs-body">
        <a class="dlz-hs-name" href="${escapeAttr(p.page)}">${escapeHtml(p.name)}</a>
        <div class="dlz-hs-meta">${escapeHtml(p.category)}</div>
        ${swatches ? `<div class="dlz-hs-swatches">${swatches}</div>` : ""}
        ${price}
        <button type="button" class="dlz-hs-quick" data-hs-quick="${escapeAttr(p.slug)}">QUICK VIEW</button>
      </div>
    </article>`;
  }).join("");
  const style = `<style>
    .dlz-hs-wrap{margin-top:28px}
    .dlz-hs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,268px));gap:42px 34px;justify-content:center;max-width:1440px;margin:0 auto;padding:0 clamp(12px,3vw,44px);font-family:Arial,"Microsoft YaHei",sans-serif}
    @keyframes dlzHsIn{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
    .dlz-hs-card{position:relative;display:flex;flex-direction:column;background:#fff;color:#0a0a0a;border-radius:8px;padding:18px 16px 16px;min-height:440px;opacity:0;animation:dlzHsIn .55s cubic-bezier(.22,.61,.36,1) both;transition:transform .2s ease,box-shadow .2s ease}
    .dlz-hs-card:hover{transform:translateY(-4px);box-shadow:0 22px 48px rgba(0,0,0,.45)}
    .dlz-hs-badge{font-size:12px;font-weight:900;letter-spacing:.04em;text-transform:uppercase;color:#111;min-height:16px}
    .dlz-hs-imgwrap{display:grid;place-items:center;height:210px;margin-top:6px}
    .dlz-hs-img{max-width:92%;max-height:92%;object-fit:contain;transition:opacity .2s ease}
    .dlz-hs-body{display:flex;flex-direction:column;flex:1;margin-top:16px}
    .dlz-hs-name{font-size:13px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;line-height:1.2;color:#111;text-decoration:none}
    .dlz-hs-meta{font-size:12px;color:#666;margin-top:6px;letter-spacing:.04em}
    .dlz-hs-swatches{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
    .dlz-hs-swatch{width:20px;height:20px;border-radius:50%;border:1px solid #cfcfcf;box-shadow:inset 0 0 0 2px #fff;cursor:pointer;padding:0;transition:box-shadow .15s ease,transform .15s ease}
    .dlz-hs-swatch:hover,.dlz-hs-swatch.is-active{box-shadow:inset 0 0 0 2px #fff,0 0 0 1px #050505;transform:translateY(-1px)}
    .dlz-hs-price{margin-top:12px;font-size:15px;font-weight:800}
    .dlz-hs-quick{margin-top:auto;border:0;background:#0a0a0a;color:#fff;padding:12px 14px;font-size:12px;font-weight:800;letter-spacing:.2em;cursor:pointer;border-radius:6px}
    .dlz-hs-quick:hover{background:#333}
    .dlz-qv-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.58);padding:22px}
    .dlz-qv-modal.open{display:flex}
    .dlz-qv-dialog{background:#fff;color:#111;width:min(940px,100%);max-height:88vh;overflow:auto;display:grid;grid-template-columns:minmax(260px,420px) 1fr;position:relative;border-radius:8px}
    .dlz-qv-close{position:absolute;right:12px;top:10px;border:0;background:transparent;font-size:30px;line-height:1;cursor:pointer;color:#111}
    .dlz-qv-image{display:grid;place-items:center;background:#f6f6f6;min-height:420px;padding:28px}
    .dlz-qv-image img{max-width:100%;max-height:420px;object-fit:contain}
    .dlz-qv-copy{padding:40px 32px;display:grid;gap:14px;align-content:start}
    .dlz-qv-copy h3{font-size:30px;margin:0;line-height:1.05}
    .dlz-qv-meta{font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#555}
    .dlz-qv-price{font-size:20px;font-weight:800}
    .dlz-qv-desc{font-size:14px;line-height:1.55;color:#444;margin:0}
    .dlz-qv-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px}
    .dlz-qv-actions a{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;padding:13px 20px;font-size:13px;font-weight:800;letter-spacing:.12em;border-radius:6px}
    .dlz-qv-actions .wa{background:#25D366;color:#fff}
    .dlz-qv-actions .detail{background:#0a0a0a;color:#fff}
    @media(max-width:760px){.dlz-hs-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:22px 14px}.dlz-hs-imgwrap{height:150px}.dlz-hs-card{min-height:370px}.dlz-qv-dialog{grid-template-columns:1fr}.dlz-qv-image{min-height:260px}.dlz-qv-copy{padding:26px 20px}}
  </style>`;
  const modal = `<div class="dlz-qv-modal" id="dlzHsModal" aria-hidden="true"><div class="dlz-qv-dialog" role="dialog" aria-modal="true" aria-label="Product quick view"><button class="dlz-qv-close" type="button" aria-label="Close">×</button><div class="dlz-qv-image"><img alt=""></div><div class="dlz-qv-copy"><div class="dlz-qv-meta"></div><h3></h3><div class="dlz-qv-price"></div><p class="dlz-qv-desc"></p><div class="dlz-qv-actions"><a class="detail" href="#">VIEW DETAILS</a><a class="wa" href="#" target="_blank" rel="noopener">WHATSAPP</a></div></div></div></div>`;
  const script = `<script>(function(){
    var products = ${JSON.stringify(qv).replace(/</g, "\\u003c")};
    var bySlug = {}; products.forEach(function(p){ bySlug[p.slug] = p; });
    var modal = document.getElementById('dlzHsModal'); if (!modal) return;
    function q(s){ return modal.querySelector(s); }
    function openQV(slug, img){
      var p = bySlug[slug]; if (!p) return;
      var im = q('.dlz-qv-image img'); if (im){ im.src = img || p.image || ''; im.alt = p.name || ''; }
      q('.dlz-qv-meta').textContent = p.category || '';
      q('.dlz-qv-copy h3').textContent = p.name || '';
      q('.dlz-qv-price').textContent = p.priceText || '';
      q('.dlz-qv-desc').textContent = p.description || '';
      var d = q('.dlz-qv-actions .detail'); if (d) d.href = p.page || '#';
      var wa = q('.dlz-qv-actions .wa'); var cfg = window.__ADMIN_TRACKING__ || {}; if (wa) wa.href = cfg.whatsappUrl || '#';
      modal.classList.add('open'); modal.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden';
    }
    function closeQV(){ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; }
    document.addEventListener('click', function(e){
      var sw = e.target.closest && e.target.closest('.dlz-hs-swatch');
      if (sw){ var card = sw.closest('.dlz-hs-card'); var img = sw.getAttribute('data-hs-image'); if (card && img){ card.setAttribute('data-hs-img', img); var ci = card.querySelector('.dlz-hs-img'); if (ci) ci.src = img; } var row = sw.closest('.dlz-hs-swatches'); if (row){ row.querySelectorAll('.dlz-hs-swatch').forEach(function(x){ x.classList.remove('is-active'); }); sw.classList.add('is-active'); } return; }
      var qb = e.target.closest && e.target.closest('[data-hs-quick]');
      if (qb){ e.preventDefault(); var card = qb.closest('.dlz-hs-card'); openQV(qb.getAttribute('data-hs-quick'), card && card.getAttribute('data-hs-img')); return; }
      if (e.target === modal || (e.target.closest && e.target.closest('.dlz-qv-close'))) closeQV();
    });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeQV(); });
  })();</script>`;
  return `<div class="dlz-hs-wrap">${style}<div class="dlz-hs-grid">${cards}</div>${modal}${script}</div>`;
}

function injectHomeShowcase(file, html, settings) {
  if (file !== "index.html") return html;
  if (settings.homeShowcaseEnabled === false) return html; // on by default; admin can disable
  const products = homeShowcaseProducts(settings);
  if (!products.length) return html;
  const grid = renderHomeShowcaseCatalog(products, settings);
  // Replace the homepage "BESTSELLERS" React block entirely (drop its id/class so LELO's
  // React bundle can't mount and overwrite our recommended products).
  const blockRe = /<div[^>]*class="[^"]*promotion-view-block[^"]*"[^>]*>\s*<\/div>/i;
  if (blockRe.test(html)) return html.replace(blockRe, () => grid);
  const section = `<section class="dlz-home-showcase" style="padding:48px 0">${grid}</section>`;
  if (/<footer\b/i.test(html)) return html.replace(/<footer\b/i, `${section}\n<footer`);
  return injectBefore(html, "</body>", section);
}

const CURRENCY_SYMBOLS = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥", AUD: "A$", CAD: "C$", OMR: "OMR ", AED: "AED ", SAR: "SAR ", QAR: "QAR ", KWD: "KWD " };

// Site currency: a single setting (default OMR / Omani Rial) overrides per-product
// currency so every price on the site shows the same currency.
function siteCurrency(settings) {
  return String((settings && settings.currency) || "OMR").toUpperCase();
}

function currencySymbol(cur) {
  const c = String(cur || "").toUpperCase();
  return CURRENCY_SYMBOLS[c] || (c ? `${c} ` : "$");
}

function formatMoney(price, settings) {
  const p = String(price == null ? "" : price).trim();
  if (!p) return "";
  return `${currencySymbol(siteCurrency(settings))}${p}`;
}

// A "more products" grid shown in the lower area of every product page (all other
// products, in merchandise order) so visitors can keep browsing.
function renderMoreProductsSection(current, settings) {
  const products = merchandiseSort(productList().filter((p) => p.enabled !== false && p.slug !== current.slug));
  if (!products.length) return "";
  const cards = products.map((p) => {
    const img = escapeAttr(productCardImage(p));
    const price = p.price ? `<div class="dlz-more__price">${escapeHtml(formatMoney(p.price, settings))}</div>` : "";
    return `<a class="dlz-more__card" href="${escapeAttr(p.page)}">
      <div class="dlz-more__img"><img src="${img}" alt="${escapeAttr(p.name)}" loading="lazy"></div>
      <div class="dlz-more__name">${escapeHtml(p.name)}</div>
      <div class="dlz-more__meta">${escapeHtml(p.subcategory || p.category || "")}</div>
      ${price}
    </a>`;
  }).join("");
  return `<section class="dlz-more" aria-label="More products">
    <style>
      .dlz-more{display:block;width:100%;max-width:100%;flex:1 0 100%;align-self:stretch;box-sizing:border-box;background:transparent;color:#fff;padding:48px clamp(16px,4vw,72px) 64px;font-family:Arial,"Microsoft YaHei",sans-serif;border-top:1px solid rgba(255,255,255,.14)}
      .dlz-more h2{font-size:clamp(22px,2.4vw,32px);font-weight:800;letter-spacing:.14em;text-transform:uppercase;text-align:center;margin:0 0 34px;color:#fff}
      .dlz-more__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:32px 24px;max-width:1320px;margin:0 auto}
      .dlz-more__card{display:flex;flex-direction:column;text-decoration:none;color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:10px;padding:18px 16px 20px;background:rgba(255,255,255,.04);transition:box-shadow .2s ease,transform .2s ease,border-color .2s ease,background .2s ease}
      .dlz-more__card:hover{box-shadow:0 16px 36px rgba(0,0,0,.45);transform:translateY(-2px);border-color:rgba(255,255,255,.42);background:rgba(255,255,255,.08)}
      .dlz-more__img{display:grid;place-items:center;height:200px}
      .dlz-more__img img{max-width:100%;max-height:100%;object-fit:contain}
      .dlz-more__name{margin-top:16px;font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;line-height:1.2;color:#fff}
      .dlz-more__meta{font-size:12px;color:#bcbcbc;margin-top:6px;letter-spacing:.06em}
      .dlz-more__price{margin-top:10px;font-size:15px;font-weight:800;color:#fff}
      @media(max-width:700px){.dlz-more__grid{grid-template-columns:repeat(2,1fr);gap:18px 14px}.dlz-more__img{height:140px}}
    </style>
    <h2>More Products</h2>
    <div class="dlz-more__grid">${cards}</div>
  </section>`;
}

// The product detail "buy box" (gallery + price + color swatches + WhatsApp) was
// rendered by LELO's React app against a backend that no longer exists, so the
// swatches never switched the image. We render our own working buy box from admin
// data and hide the broken React mounts.
function injectProductBuyBox(file, html, product, settings) {
  if (!product) return html;
  // Only product detail pages (have the LELO commerce/product page shell).
  if (!/class="[^"]*commerce-product|class="[^"]*product_page/i.test(html)) return html;
  const variants = productVariants(product);
  const galleryFromImages = discoverProductImages(product.page)
    .filter((img) => /hero|主图|specification|规格|lifestyle|场景/i.test(img.group || ""))
    .map((img) => img.preview);
  const gallery = [];
  for (const url of [...variants.map((v) => v.image), productCardImage(product), ...galleryFromImages]) {
    if (url && !gallery.includes(url)) gallery.push(url);
  }
  const mainImage = gallery[0] || "assets/love-logo.svg";
  const price = formatMoney(product.price, settings);
  const swatches = variants.map((variant, index) => {
    const image = escapeAttr(variant.image || mainImage);
    const name = escapeAttr(variant.name || `Option ${index + 1}`);
    const color = escapeAttr(variant.color || "#d8d8d8");
    return `<button type="button" class="dlz-pdp-swatch${index === 0 ? " is-active" : ""}" data-dlz-pdp-image="${image}" data-dlz-pdp-name="${name}" aria-label="${name}" style="background:${color}"></button>`;
  }).join("");
  const thumbs = gallery.slice(0, 6).map((url, index) =>
    `<button type="button" class="dlz-pdp-thumb${index === 0 ? " is-active" : ""}" data-dlz-pdp-image="${escapeAttr(url)}"><img src="${escapeAttr(url)}" alt="" loading="lazy"></button>`
  ).join("");
  const buyBox = `<section class="dlz-pdp" aria-label="${escapeAttr(product.name)}">
    <style>
      #react-google,#block-reactcart,#hil-age-verification-block,#commerce-section{display:none!important}
      .related-products,.commerce-related-products,.qr-code-redirect{display:none!important}
      /* hide non-functional LELO controls (no backend) */
      .block-hil-wishlist,.block-commerce-cart,.block-react_google,#block-react-google,.wishlist-icon,.add-to-wishlist{display:none!important}
      .dlz-pdp{display:block;width:100%;max-width:100%;flex:1 0 100%;align-self:stretch;box-sizing:border-box;background:#fff;color:#0a0a0a;padding:36px clamp(16px,4vw,72px) 52px;font-family:Arial,"Microsoft YaHei",sans-serif}
      @keyframes dlzPdpIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
      .dlz-pdp__wrap{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(330px,1fr);gap:clamp(24px,4vw,64px);max-width:1320px;margin:0 auto;align-items:start;animation:dlzPdpIn .55s cubic-bezier(.22,.61,.36,1) both}
      .dlz-pdp__gallery{display:grid;grid-template-columns:74px minmax(0,1fr);gap:16px;align-items:start;position:sticky;top:18px}
      .dlz-pdp__thumbs{display:flex;flex-direction:column;gap:12px}
      .dlz-pdp-thumb{width:74px;height:74px;border:1px solid #e0e0e0;background:#fff;padding:6px;cursor:pointer;border-radius:8px;transition:border-color .2s ease}
      .dlz-pdp-thumb.is-active{border-color:#0a0a0a}
      .dlz-pdp-thumb img{width:100%;height:100%;object-fit:contain}
      .dlz-pdp__main{display:grid;place-items:center;background:#f5f5f5;min-height:520px;border-radius:10px;padding:32px}
      .dlz-pdp__main img{max-width:100%;max-height:460px;object-fit:contain;transition:opacity .25s ease}
      .dlz-pdp__info{display:grid;gap:20px;align-content:start;padding-top:6px}
      .dlz-pdp__head{display:grid;gap:8px}
      .dlz-pdp__name{font-size:clamp(24px,2.4vw,34px);font-weight:800;letter-spacing:.14em;text-transform:uppercase;margin:0;line-height:1.12}
      .dlz-pdp__cat{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#555}
      .dlz-pdp__rating{color:#0a0a0a;font-size:18px;letter-spacing:3px}
      .dlz-pdp__rating span{color:#cfcfcf}
      .dlz-pdp__price{font-size:22px;font-weight:800;letter-spacing:.02em}
      .dlz-pdp__variants{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
      .dlz-pdp__swatches{display:flex;gap:12px}
      .dlz-pdp-swatch{width:30px;height:30px;border-radius:50%;border:1px solid #cfcfcf;box-shadow:inset 0 0 0 3px #fff;cursor:pointer;padding:0;transition:box-shadow .15s ease,transform .15s ease}
      .dlz-pdp-swatch:hover,.dlz-pdp-swatch.is-active{box-shadow:inset 0 0 0 3px #fff,0 0 0 2px #0a0a0a;transform:translateY(-1px)}
      .dlz-pdp__vname{font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
      .dlz-pdp__buy{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:#0a0a0a;color:#fff;text-decoration:none;padding:17px 30px;font-size:14px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;border-radius:999px;transition:background .2s ease;width:fit-content;min-width:240px}
      .dlz-pdp__buy:hover{background:#333}
      .dlz-pdp__divider{height:1px;background:#e6e6e6;margin:4px 0}
      .dlz-pdp__desc{font-size:14px;line-height:1.6;color:#444;margin:0;display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
      .dlz-pdp__desc span{color:#999;flex:none;font-size:18px;line-height:1}
      .dlz-pdp__assure{display:flex;gap:28px;flex-wrap:wrap;border-top:1px solid #e6e6e6;padding-top:18px;margin-top:2px}
      .dlz-pdp__assure div{font-size:11px;color:#666;letter-spacing:.03em}
      .dlz-pdp__assure b{display:block;font-size:11px;color:#0a0a0a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:3px}
      @media(max-width:900px){.dlz-pdp__wrap{grid-template-columns:1fr;gap:28px}.dlz-pdp__gallery{position:static}.dlz-pdp__main{min-height:340px}.dlz-pdp__buy{width:100%}}
      @media(max-width:560px){.dlz-pdp__gallery{grid-template-columns:1fr}.dlz-pdp__thumbs{flex-direction:row;flex-wrap:wrap;order:2}}
    </style>
    <div class="dlz-pdp__wrap">
      <div class="dlz-pdp__gallery">
        ${thumbs ? `<div class="dlz-pdp__thumbs">${thumbs}</div>` : "<div></div>"}
        <div class="dlz-pdp__main"><img id="dlzPdpMain" src="${escapeAttr(mainImage)}" alt="${escapeAttr(product.name)}"></div>
      </div>
      <div class="dlz-pdp__info">
        <div class="dlz-pdp__head">
          <h1 class="dlz-pdp__name">${escapeHtml(product.name)}</h1>
          ${(product.subcategory || product.category) ? `<div class="dlz-pdp__cat">${escapeHtml(product.subcategory || product.category)}</div>` : ""}
        </div>
        ${price ? `<div class="dlz-pdp__price">${escapeHtml(price)}</div>` : ""}
        ${swatches ? `<div class="dlz-pdp__variants"><div class="dlz-pdp__swatches">${swatches}</div><span class="dlz-pdp__vname" id="dlzPdpVariantName">${escapeHtml(variants[0].name || "")}</span></div>` : ""}
        <a class="dlz-pdp__buy dlz-wa-cta" href="${escapeAttr(product.whatsappUrl || settings.whatsappUrl || "#")}" target="_blank" rel="noopener">Chat on WhatsApp</a>
        <div class="dlz-pdp__divider"></div>
        ${product.description ? `<p class="dlz-pdp__desc">${escapeHtml(truncateText(product.description, 240))}<span>⌄</span></p>` : ""}
        <div class="dlz-pdp__assure">
          <div><b>Warranty</b>2-year warranty</div>
          <div><b>Safe shopping</b>100% secure payment</div>
          <div><b>Worldwide delivery</b>in a discreet box</div>
        </div>
      </div>
    </div>
    <script>
    (function(){
      var root = document.currentScript && document.currentScript.closest('.dlz-pdp');
      if (!root) return;
      var main = root.querySelector('#dlzPdpMain');
      var label = root.querySelector('#dlzPdpVariantName');
      root.addEventListener('click', function(event){
        var btn = event.target.closest && event.target.closest('[data-dlz-pdp-image]');
        if (!btn) return;
        event.preventDefault();
        var image = btn.getAttribute('data-dlz-pdp-image');
        if (main && image) main.src = image;
        var name = btn.getAttribute('data-dlz-pdp-name');
        if (label && name) label.textContent = name;
        var group = btn.classList.contains('dlz-pdp-swatch') ? 'dlz-pdp-swatch' : 'dlz-pdp-thumb';
        root.querySelectorAll('.' + group).forEach(function(el){ el.classList.remove('is-active'); });
        btn.classList.add('is-active');
        if (group === 'dlz-pdp-swatch') {
          root.querySelectorAll('.dlz-pdp-thumb').forEach(function(t){ t.classList.toggle('is-active', t.getAttribute('data-dlz-pdp-image') === image); });
        }
      });
    })();
    </script>
  </section>`;
  // 1) Buy box goes right after the specifications section, at the FIRST top-level
  //    (full-width) section that follows it — #commerce-section — so it is NOT nested
  //    inside the narrow specs/accordion column. The empty LELO promo blocks
  //    (#commerce-section, .qr-code-redirect) are hidden via the CSS above, so the
  //    buy box cleanly occupies that empty space. Same on every product page.
  if (/<div[^>]*id="commerce-section"[^>]*>/i.test(html)) {
    html = html.replace(/(<div[^>]*id="commerce-section"[^>]*>)/i, (m) => `${buyBox}\n${m}`);
  } else if (/<div[^>]*class="[^"]*qr-code-redirect[^"]*"[^>]*>/i.test(html)) {
    html = html.replace(/<div[^>]*class="[^"]*qr-code-redirect[^"]*"[^>]*>/i, (m) => `${buyBox}\n${m}`);
  } else if (/<div\s+id="about"/i.test(html)) {
    html = html.replace(/<div\s+id="about"/i, (m) => `${buyBox}\n${m}`);
  } else {
    html = injectBefore(html, "</body>", buyBox);
  }
  // 2) "More products" grid in the lower area (replacing the hidden related-products).
  const moreGrid = renderMoreProductsSection(product, settings);
  if (moreGrid) {
    const relatedRe = /<div[^>]*class="[^"]*related-products[^"]*"[^>]*>/i;
    if (relatedRe.test(html)) html = html.replace(relatedRe, (m) => `${moreGrid}\n${m}`);
    else if (/<footer\b/i.test(html)) html = html.replace(/<footer\b/i, `${moreGrid}\n<footer`);
    else html = injectBefore(html, "</body>", moreGrid);
  }
  return html;
}

function renderHtml(file, html) {
  const settings = readJson(SETTINGS_FILE, {});
  const page = getPageConfig(file);
  const product = getProductForPage(file);
  if (page?.enabled === false || product?.enabled === false) return null;

  html = sanitizeLeloResidue(file, html, settings);

  const title = page?.title || (product?.name ? `${product.name} | ${settings.siteName || "LOVE"}` : "");
  html = replaceTitle(html, title);
  html = replaceMetaDescription(html, page?.metaDescription);
  if (product?.name) html = replaceFirstH1(html, product.name);
  if (product) html = applyProductOverrides(html, product);
  if (product) html = injectProductBuyBox(file, html, product, settings);
  html = injectCategoryCatalog(file, html);
  html = injectHomeShowcase(file, html, settings);
  html = applyImageOverrides(file, html);
  html = applyBlockOverrides(file, html);

  const effectiveWhatsapp = product?.whatsappUrl || settings.whatsappUrl || "";
  const headSnippet = [
    // Hide non-functional LELO controls (cart/account/wishlist need a backend we don't have) on every page.
    `<style>.block-hil-wishlist,.block-commerce-cart,.block-react_google,#block-react-google,.add-to-wishlist,.wishlist-icon{display:none!important}</style>`,
    settings.pixelHead || "",
    `<script>window.__ADMIN_TRACKING__=${JSON.stringify({
      enabled: settings.trackingEnabled !== false,
      whatsappUrl: effectiveWhatsapp,
      whatsappNumber: settings.whatsappNumber || "",
      product: product ? { slug: product.slug, name: product.name, sku: product.sku } : null,
      page: file,
    }).replace(/</g, "\\u003c")};</script>`,
  ].filter(Boolean).join("\n");

  const bodySnippet = `${settings.pixelBodyEnd || ""}\n${trackingScript()}`;
  html = injectBefore(html, "</head>", headSnippet);
  html = injectBefore(html, "</body>", bodySnippet);
  return html;
}

function trackingScript() {
  return `<script>
(function(){
  var cfg = window.__ADMIN_TRACKING__ || {};
  if (cfg.enabled === false) return;
  function send(type, details) {
    try {
      var payload = JSON.stringify({
        type: type,
        path: location.pathname,
        query: location.search,
        title: document.title,
        referrer: document.referrer || "",
        product: cfg.product || null,
        details: details || {},
        screen: {w: window.innerWidth || 0, h: window.innerHeight || 0, lang: navigator.language || ''},
        at: new Date().toISOString()
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([payload], {type:'application/json'}));
      } else {
        fetch('/api/track', {method:'POST', headers:{'content-type':'application/json'}, body:payload, keepalive:true});
      }
    } catch (e) {}
  }
  function isWhatsAppLink(a) {
    if (!a) return false;
    var href = String(a.getAttribute('href') || '').toLowerCase();
    var text = String(a.textContent || a.getAttribute('aria-label') || '').toLowerCase();
    return href.indexOf('wa.me') > -1 || href.indexOf('whatsapp') > -1 || text.indexOf('whatsapp') > -1;
  }
  function applyWhatsappUrl() {
    if (!cfg.whatsappUrl) return;
    document.querySelectorAll('a').forEach(function(a){
      if (isWhatsAppLink(a) || a.classList.contains('dlz-wa-float') || a.classList.contains('dlz-wa-cta')) {
        a.setAttribute('href', cfg.whatsappUrl);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener');
      }
    });
  }
  document.addEventListener('click', function(e){
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (isWhatsAppLink(a)) {
      send('whatsapp_click', {href:a.getAttribute('href') || '', text:(a.textContent || '').trim().slice(0,120)});
      return;
    }
    if (a) {
      var href = a.getAttribute('href') || '';
      if (/\\.html(?:[?#].*)?$/i.test(href) || /^\\/[^#?]+\\.html/i.test(href)) {
        send('product_click', {href:href, text:(a.textContent || '').trim().slice(0,120)});
      }
    }
  }, true);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyWhatsappUrl);
  else applyWhatsappUrl();
  var count = 0, timer = setInterval(function(){ applyWhatsappUrl(); if (++count > 20) clearInterval(timer); }, 500);
  send('page_view', {});
})();
</script>`;
}

function appendEvent(req, event) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  const ipText = String(ip).split(",")[0].trim();
  const ua = req.headers["user-agent"] || "";
  const visitorId = crypto.createHash("sha256").update(`${ipText}|${ua}`).digest("hex").slice(0, 16);
  const row = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    type: String(event.type || "event").slice(0, 60),
    path: String(event.path || "").slice(0, 240),
    query: String(event.query || "").slice(0, 240),
    title: String(event.title || "").slice(0, 240),
    referrer: String(event.referrer || "").slice(0, 500),
    product: event.product || null,
    details: event.details || {},
    screen: event.screen || null,
    ip: ipText.slice(0, 80),
    ipHash: crypto.createHash("sha256").update(String(ipText)).digest("hex").slice(0, 16),
    visitorId,
    ua: String(ua).slice(0, 500),
  };
  fs.appendFileSync(EVENTS_FILE, `${JSON.stringify(row)}\n`, "utf8");
  return row;
}

function readEvents(limit = 1000) {
  if (!fs.existsSync(EVENTS_FILE)) return [];
  const lines = fs.readFileSync(EVENTS_FILE, "utf8").trim().split(/\n+/).filter(Boolean);
  const slice = lines.slice(Math.max(0, lines.length - limit));
  return slice.map((line) => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean).reverse();
}

function statsSummary() {
  const events = readEvents(5000);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const dayMap = {};
  const pageMap = {};
  const productMap = {};
  const productClickMap = {};
  const productStats = {}; // slug -> { views, wa }
  const bumpProduct = (slug, key) => { if (!slug) return; productStats[slug] = productStats[slug] || { views: 0, wa: 0 }; productStats[slug][key]++; };
  const visitorSet = new Set();
  const todayVisitorSet = new Set();
  let pageViews = 0;
  let whatsappClicks = 0;
  let productClicks = 0;
  let todayViews = 0;
  let todayWhatsapp = 0;
  for (const e of events) {
    const day = String(e.at || "").slice(0, 10);
    const visitor = e.visitorId || e.ipHash || "";
    dayMap[day] = dayMap[day] || { day, page_view: 0, visitors: 0, whatsapp_click: 0, product_click: 0, visitorSet: new Set() };
    if (visitor) {
      visitorSet.add(visitor);
      dayMap[day].visitorSet.add(visitor);
      if (day === todayKey) todayVisitorSet.add(visitor);
    }
    if (e.type === "page_view") {
      pageViews++;
      dayMap[day].page_view++;
      if (day === todayKey) todayViews++;
      pageMap[e.path] = (pageMap[e.path] || 0) + 1;
      if (e.product?.name) productMap[e.product.name] = (productMap[e.product.name] || 0) + 1;
      if (e.product?.slug) bumpProduct(e.product.slug, "views");
    }
    if (e.type === "product_click") {
      productClicks++;
      dayMap[day].product_click++;
      const key = e.product?.name || e.details?.text || e.details?.href || e.path || "Unknown";
      productClickMap[key] = (productClickMap[key] || 0) + 1;
    }
    if (e.type === "whatsapp_click") {
      whatsappClicks++;
      dayMap[day].whatsapp_click++;
      if (day === todayKey) todayWhatsapp++;
      if (e.product?.slug) bumpProduct(e.product.slug, "wa");
    }
  }
  const days = Object.values(dayMap).map((day) => ({
    day: day.day,
    page_view: day.page_view,
    visitors: day.visitorSet.size,
    whatsapp_click: day.whatsapp_click,
    product_click: day.product_click,
  })).sort((a, b) => a.day.localeCompare(b.day));
  return {
    pageViews,
    totalVisitors: visitorSet.size,
    whatsappClicks,
    productClicks,
    todayViews,
    todayVisitors: todayVisitorSet.size,
    todayWhatsapp,
    conversionRate: pageViews ? Math.round((whatsappClicks / pageViews) * 10000) / 100 : 0,
    days: days.slice(-30),
    last14Days: days.slice(-14),
    topPages: Object.entries(pageMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, count]) => ({ path, count })),
    topProducts: Object.entries(productMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
    topProductClicks: Object.entries(productClickMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
    productStats,
  };
}

function adminHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LOVE Admin</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:Arial,"Microsoft YaHei",sans-serif;background:#f5f6f8;color:#17191d}
    .login{min-height:100vh;display:grid;place-items:center;padding:24px}.login form{width:min(420px,100%);background:#fff;border:1px solid #e2e5ea;border-radius:8px;padding:28px;box-shadow:0 10px 40px rgba(0,0,0,.08)}
    h1,h2,h3{margin:0}.app{display:grid;grid-template-columns:240px 1fr;min-height:100vh}.side{background:#111317;color:#fff;padding:22px 16px;position:sticky;top:0;height:100vh}
    .brand{font-size:22px;letter-spacing:4px;margin-bottom:28px}.nav button{width:100%;border:0;background:transparent;color:#d7dce5;text-align:left;padding:12px;border-radius:6px;cursor:pointer;font-size:15px}
    .nav button.active,.nav button:hover{background:#252a32;color:#fff}.main{padding:24px 30px}.top{display:flex;justify-content:space-between;align-items:center;margin-bottom:24px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:14px}.card{background:#fff;border:1px solid #e2e5ea;border-radius:8px;padding:16px}.metric{font-size:30px;font-weight:700;margin-top:8px}
    table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e5ea;border-radius:8px;overflow:hidden}th,td{padding:10px 12px;border-bottom:1px solid #edf0f4;text-align:left;vertical-align:top}th{font-size:13px;background:#fafbfc}
    input,textarea,select{width:100%;border:1px solid #d6dbe3;border-radius:6px;padding:9px 10px;font:inherit;background:#fff}textarea{min-height:90px;resize:vertical}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.row{display:grid;gap:6px;margin-bottom:12px}.btn{border:0;background:#111317;color:#fff;border-radius:6px;padding:10px 14px;cursor:pointer}.btn.secondary{background:#e9edf3;color:#17191d}.btn.danger{background:#c93535}
    .section{display:none}.section.active{display:block}.toolbar{display:flex;gap:10px;align-items:center;margin:12px 0;flex-wrap:wrap}.muted{color:#6f7785;font-size:13px}.pill{display:inline-block;padding:3px 8px;border-radius:999px;background:#edf0f4;font-size:12px}.ok{color:#138a36}.bad{color:#b42318}
    .image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}.thumb{width:100%;height:150px;object-fit:contain;background:#f1f3f6;border:1px solid #e2e5ea;border-radius:6px}.mini{font-size:12px;word-break:break-all;color:#6f7785}.editor-layout{display:grid;grid-template-columns:minmax(360px,520px) 1fr;gap:14px;align-items:start}.block-list{display:grid;gap:10px;max-height:72vh;overflow:auto;padding-right:4px}.block-item{background:#fff;border:1px solid #e2e5ea;border-radius:8px;padding:12px}.preview-frame{width:100%;height:72vh;border:1px solid #d6dbe3;border-radius:8px;background:#fff}
    .product-shell{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px;align-items:start}.product-picker{position:sticky;top:18px}.product-main{min-width:0}.product-context{background:#fff;border:1px solid #e2e5ea;border-radius:8px;padding:12px 14px;margin-bottom:12px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}.product-context strong{font-size:14px}.product-context span{color:#6f7785;font-size:13px}.product-tabs{display:flex;gap:8px;margin:12px 0;flex-wrap:wrap}.product-tabs button{background:#e9edf3;color:#17191d}.product-tabs button.active{background:#111317;color:#fff}.product-panel{display:none}.product-panel.active{display:block}.spec-row{display:grid;grid-template-columns:42px 1fr 1.4fr 82px;gap:8px;align-items:start;margin-bottom:8px}.variant-edit-row{display:grid;grid-template-columns:70px 1fr 110px 1.5fr 150px 82px;gap:8px;align-items:start;margin-bottom:10px}.variant-dot{width:28px;height:28px;border-radius:50%;border:1px solid #d6dbe3;box-shadow:inset 0 0 0 3px #fff}
    .visual-layout{display:grid;grid-template-columns:minmax(420px,1fr) 300px;gap:14px;align-items:start}.visual-preview-wrap{background:#fff;border:1px solid #e2e5ea;border-radius:8px;overflow:hidden}.visual-preview-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border-bottom:1px solid #edf0f4}.visual-preview-frame{width:100%;height:70vh;border:0;background:#fff}.visual-side{display:grid;gap:12px}.visual-list{display:grid;gap:8px;max-height:220px;overflow:auto}.visual-item{border:1px solid #e2e5ea;background:#fff;border-radius:8px;padding:10px;text-align:left;cursor:pointer}.visual-item.active{border-color:#111317;box-shadow:0 0 0 1px #111317}.visual-item strong{display:block;font-size:12px;margin-bottom:4px}.visual-item span{display:block;color:#6f7785;font-size:12px;line-height:1.3;max-height:34px;overflow:hidden}.visual-thumb{width:100%;height:92px;object-fit:contain;background:#f1f3f6;border:1px solid #e2e5ea;border-radius:6px}.visual-modal{position:fixed;inset:0;z-index:100000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.48);padding:20px}.visual-modal.open{display:flex}.visual-dialog{width:min(560px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:8px;border:1px solid #d6dbe3;box-shadow:0 20px 70px rgba(0,0,0,.28)}.visual-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #edf0f4}.visual-dialog-body{padding:16px}.visual-close{border:0;background:#e9edf3;color:#111317;border-radius:6px;width:34px;height:34px;cursor:pointer;font-size:20px}.new-product-form{display:grid;gap:10px}.product-actions{display:grid;gap:8px}.product-actions .btn{width:100%}
    @media(max-width:900px){.app{grid-template-columns:1fr}.side{height:auto;position:static}.cards,.grid,.editor-layout,.product-shell,.visual-layout{grid-template-columns:1fr}.main{padding:18px}.nav{display:grid;grid-template-columns:1fr 1fr;gap:6px}.preview-frame,.visual-preview-frame{height:520px}.product-picker{position:static}.spec-row,.variant-edit-row{grid-template-columns:1fr}}
  </style>
</head>
<body>
<div id="root"></div>
<script>
const root=document.getElementById('root');
let state=null, current='dashboard';
function el(s){return document.querySelector(s)}
async function api(url,opt={}){const r=await fetch(url,{headers:{'content-type':'application/json'},...opt});if(!r.ok)throw new Error(await r.text());return r.json()}
async function boot(){try{await api('/api/admin/session'); await load(); renderApp()}catch{renderLogin()}}
function renderLogin(){root.innerHTML='<div class="login"><form id="login"><h1>LOVE Admin</h1><p class="muted">请输入后台密码</p><div class="row"><label>密码</label><input type="password" name="password" autofocus></div><button class="btn" type="submit">登录</button><p class="muted">默认密码：admin123456，可用环境变量 ADMIN_PASSWORD 修改。</p></form></div>';el('#login').onsubmit=async e=>{e.preventDefault();try{await api('/admin/login',{method:'POST',body:JSON.stringify({password:e.target.password.value})});await load();renderApp()}catch{alert('密码错误')}}}
async function load(){state=await api('/api/admin/state')}
function renderApp(){root.innerHTML=\`
<div class="app"><aside class="side"><div class="brand">LOVE</div><div class="nav">
\${[['dashboard','仪表盘'],['pages','页面管理'],['products','商品管理'],['images','图片替换'],['blocks','区块编辑'],['pixels','Pixel 像素'],['whatsapp','WhatsApp'],['events','访问记录']].map(x=>\`<button data-tab="\${x[0]}">\${x[1]}</button>\`).join('')}
</div></aside><main class="main"><div class="top"><div><h1 id="title"></h1><div class="muted">前台和后台同一个服务器，统计实时写入本地数据文件。</div></div><button class="btn secondary" id="logout">退出</button></div><div id="view"></div></main></div>\`;
document.querySelectorAll('.nav button').forEach(b=>{b.onclick=()=>{current=b.dataset.tab;renderView()}});el('#logout').onclick=async()=>{await api('/admin/logout',{method:'POST'});renderLogin()};renderView()}
function setActive(){document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===current))}
function renderView(){setActive(); const titles={dashboard:'仪表盘',pages:'页面管理',products:'商品管理',images:'图片替换',blocks:'页面区块编辑',pixels:'Pixel 像素代码',whatsapp:'WhatsApp 设置',events:'访问记录'}; el('#title').textContent=titles[current]; ({dashboard,pages,products,images,blocks,pixels,whatsapp,events})[current]()}
function dashboard(){const s=state.summary;el('#view').innerHTML=\`
<div class="cards"><div class="card">总访问<div class="metric">\${s.pageViews}</div></div><div class="card">今日访问<div class="metric">\${s.todayViews}</div></div><div class="card">WhatsApp 点击<div class="metric">\${s.whatsappClicks}</div></div><div class="card">点击率<div class="metric">\${s.conversionRate}%</div></div></div>
<div class="grid" style="margin-top:16px"><div class="card"><h3>热门页面</h3><table><tbody>\${s.topPages.map(p=>\`<tr><td>\${p.path}</td><td>\${p.count}</td></tr>\`).join('')||'<tr><td class="muted">暂无数据</td></tr>'}</tbody></table></div><div class="card"><h3>最近 30 天</h3><table><tbody>\${s.days.map(d=>\`<tr><td>\${d.day}</td><td>访问 \${d.page_view}</td><td>WhatsApp \${d.whatsapp_click}</td></tr>\`).join('')||'<tr><td class="muted">暂无数据</td></tr>'}</tbody></table></div></div>\`}
function pages(){el('#view').innerHTML=\`<div class="toolbar"><button class="btn" id="save">保存页面</button><a class="btn secondary" href="/" target="_blank">打开前台</a></div><table><thead><tr><th>启用</th><th>文件</th><th>标题</th><th>Meta 描述</th></tr></thead><tbody>\${state.pages.map((p,i)=>\`<tr><td><input type="checkbox" data-k="enabled" data-i="\${i}" \${p.enabled!==false?'checked':''}></td><td><a href="/\${p.slug}" target="_blank">\${p.slug}</a></td><td><input data-k="title" data-i="\${i}" value="\${esc(p.title)}"></td><td><textarea data-k="metaDescription" data-i="\${i}">\${esc(p.metaDescription||'')}</textarea></td></tr>\`).join('')}</tbody></table>\`;bindEdit(state.pages);el('#save').onclick=savePages}
function products(){el('#view').innerHTML=\`<div class="toolbar"><button class="btn" id="save">保存商品</button></div><table><thead><tr><th>启用</th><th>商品</th><th>页面</th><th>SKU</th><th>价格</th><th>专属 WhatsApp</th><th>备注</th></tr></thead><tbody>\${state.products.map((p,i)=>\`<tr><td><input type="checkbox" data-k="enabled" data-i="\${i}" \${p.enabled!==false?'checked':''}></td><td><input data-k="name" data-i="\${i}" value="\${esc(p.name)}"></td><td><a href="/\${p.page}" target="_blank">\${p.page}</a></td><td><input data-k="sku" data-i="\${i}" value="\${esc(p.sku||'')}"></td><td><input data-k="price" data-i="\${i}" value="\${esc(p.price||'')}"></td><td><input data-k="whatsappUrl" data-i="\${i}" placeholder="留空使用全站设置" value="\${esc(p.whatsappUrl||'')}"></td><td><textarea data-k="notes" data-i="\${i}">\${esc(p.notes||'')}</textarea></td></tr>\`).join('')}</tbody></table>\`;bindEdit(state.products);el('#save').onclick=saveProducts}
function productTree(){const tree={};(state.products||[]).forEach(p=>{const c=p.category||'Uncategorized';const s=p.subcategory||'General';tree[c]=tree[c]||{};tree[c][s]=tree[c][s]||[];tree[c][s].push(p)});return tree}
function optionHtml(list,selected,labeler=x=>x){return list.map(x=>\`<option value="\${esc(x)}" \${x===selected?'selected':''}>\${esc(labeler(x))}</option>\`).join('')}
function products(){const tree=productTree();const cats=Object.keys(tree);state.productCategory=state.productCategory&&tree[state.productCategory]?state.productCategory:cats[0];const subs=Object.keys(tree[state.productCategory]||{});state.productSubcategory=state.productSubcategory&&tree[state.productCategory]?.[state.productSubcategory]?state.productSubcategory:subs[0];const plist=tree[state.productCategory]?.[state.productSubcategory]||[];state.productSlug=state.productSlug&&plist.find(p=>p.slug===state.productSlug)?state.productSlug:(plist[0]?.slug||'');el('#view').innerHTML=\`<div class="product-shell"><div class="card product-picker"><div class="row"><label>分类</label><select id="productCat">\${optionHtml(cats,state.productCategory)}</select></div><div class="row"><label>子分类</label><select id="productSub">\${optionHtml(subs,state.productSubcategory)}</select></div><div class="row"><label>商品</label><select id="productSlug">\${plist.map(p=>\`<option value="\${esc(p.slug)}" \${p.slug===state.productSlug?'selected':''}>\${esc(p.name)}</option>\`).join('')}</select></div><div class="toolbar"><button class="btn" id="saveProductDetail">保存商品</button><a class="btn secondary" id="openProductPage" href="#" target="_blank">打开商品页</a></div><p class="muted">这里按分类、子分类、商品来编辑。前台分类页的商品卡片、Quick View 弹窗、商品详情页都使用这套商品数据。</p></div><div class="product-main"><div class="product-context"><strong>当前编辑：\${esc(plist.find(p=>p.slug===state.productSlug)?.name||'')}</strong><span>修改名称、价格、图片、描述和参数后，保存即可同步到前台。</span></div><div class="product-tabs"><button class="btn active" data-product-tab="base">基础/描述</button><button class="btn" data-product-tab="photos">商品图片</button><button class="btn" data-product-tab="specs">商品参数</button></div><div id="productDetail" class="card">正在加载商品...</div></div></div>\`;el('#productCat').onchange=e=>{state.productCategory=e.target.value;state.productSubcategory='';state.productSlug='';products()};el('#productSub').onchange=e=>{state.productSubcategory=e.target.value;state.productSlug='';products()};el('#productSlug').onchange=e=>{state.productSlug=e.target.value;loadProductDetail(e.target.value)};document.querySelectorAll('[data-product-tab]').forEach(b=>b.onclick=()=>setProductTab(b.dataset.productTab));loadProductDetail(state.productSlug)}
function setProductTab(tab){document.querySelectorAll('[data-product-tab]').forEach(b=>b.classList.toggle('active',b.dataset.productTab===tab));document.querySelectorAll('.product-panel').forEach(p=>p.classList.toggle('active',p.dataset.panel===tab))}
async function loadProductDetail(slug){if(!slug){el('#productDetail').innerHTML='<p class="muted">没有商品。</p>';return}const data=await api('/api/admin/product-editor?slug='+encodeURIComponent(slug));state.productEditor=data.product;drawProductDetail()}
function drawProductDetail(){const p=state.productEditor;el('#openProductPage').href='/'+p.page;el('#productDetail').innerHTML=\`<div class="product-panel active" data-panel="base"><div class="grid"><div><div class="row"><label><input type="checkbox" id="prodEnabled" \${p.enabled!==false?'checked':''}> 启用商品页</label></div><div class="row"><label>分类</label><input id="prodCategory" value="\${esc(p.category||'')}"></div><div class="row"><label>子分类</label><input id="prodSubcategory" value="\${esc(p.subcategory||'')}"></div><div class="row"><label>商品名称</label><input id="prodName" value="\${esc(p.name||'')}"></div><div class="row"><label>商品副标题</label><input id="prodHeroSubtitle" value="\${esc(p.heroSubtitle||'')}"></div><div class="grid"><div class="row"><label>SKU</label><input id="prodSku" value="\${esc(p.sku||'')}"></div><div class="row"><label>价格</label><input id="prodPrice" value="\${esc(p.price||'')}"></div></div><div class="row"><label>专属 WhatsApp</label><input id="prodWhatsapp" value="\${esc(p.whatsappUrl||'')}" placeholder="留空使用全站设置"></div></div><div><div class="row"><label>描述标题</label><input id="prodDescriptionTitle" value="\${esc(p.descriptionTitle||'')}"></div><div class="row"><label>商品描述</label><textarea id="prodDescription" style="min-height:210px">\${esc(p.description||'')}</textarea></div><div class="row"><label>备注</label><textarea id="prodNotes">\${esc(p.notes||'')}</textarea></div></div></div></div><div class="product-panel" data-panel="photos"><div id="productImages" class="image-grid"></div></div><div class="product-panel" data-panel="specs"><div class="toolbar"><button class="btn secondary" id="addSpec">添加参数</button></div><div id="productSpecs"></div></div>\`;drawProductImages();drawProductSpecs();el('#saveProductDetail').onclick=saveProductDetail;el('#addSpec').onclick=()=>{p.specs=p.specs||[];p.specs.push({key:'',value:'',enabled:true});drawProductSpecs()}}
function drawProductImages(){const p=state.productEditor;const items=p.images||[];el('#productImages').innerHTML=items.map((img,i)=>\`<div class="card"><img class="thumb" src="\${esc(img.replacement||img.preview)}" alt=""><div class="toolbar"><span class="pill">\${esc(img.group||'商品图片')}</span></div><div class="row"><label><input type="checkbox" data-prod-img-enabled="\${i}" \${img.enabled!==false?'checked':''}> 启用替换</label></div><div class="row"><label>替换图片 URL</label><input data-prod-img-url="\${i}" value="\${esc(img.replacement||'')}" placeholder="/assets/admin-uploads/product.webp"></div><div class="row"><label>上传商品图片</label><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-prod-img-file="\${i}"></div><div class="mini">原图：\${esc(img.original)}</div><div class="toolbar"><button class="btn secondary" data-prod-img-clear="\${i}">清除</button></div></div>\`).join('')||'<p class="muted">这个商品页没有识别到商品正文图片。</p>';document.querySelectorAll('[data-prod-img-url]').forEach(input=>input.oninput=()=>{items[Number(input.dataset.prodImgUrl)].replacement=input.value});document.querySelectorAll('[data-prod-img-enabled]').forEach(input=>input.onchange=()=>{items[Number(input.dataset.prodImgEnabled)].enabled=input.checked});document.querySelectorAll('[data-prod-img-clear]').forEach(btn=>btn.onclick=()=>{items[Number(btn.dataset.prodImgClear)].replacement='';drawProductImages()});document.querySelectorAll('[data-prod-img-file]').forEach(input=>input.onchange=async()=>{if(!input.files||!input.files[0])return;input.disabled=true;try{items[Number(input.dataset.prodImgFile)].replacement=await uploadImage(input.files[0]);drawProductImages()}catch(e){alert(e.message||'上传失败')}finally{input.disabled=false}})}
function drawProductSpecs(){const p=state.productEditor;p.specs=p.specs||[];el('#productSpecs').innerHTML=p.specs.map((s,i)=>\`<div class="spec-row"><label><input type="checkbox" data-spec-enabled="\${i}" \${s.enabled!==false?'checked':''}> 启用</label><input data-spec-key="\${i}" value="\${esc(s.key||'')}" placeholder="参数名"><input data-spec-value="\${i}" value="\${esc(s.value||'')}" placeholder="参数值"><button class="btn secondary" data-spec-remove="\${i}">删除</button></div>\`).join('')||'<p class="muted">没有参数，可以点击添加参数。</p>';document.querySelectorAll('[data-spec-key]').forEach(input=>input.oninput=()=>{p.specs[Number(input.dataset.specKey)].key=input.value});document.querySelectorAll('[data-spec-value]').forEach(input=>input.oninput=()=>{p.specs[Number(input.dataset.specValue)].value=input.value});document.querySelectorAll('[data-spec-enabled]').forEach(input=>input.onchange=()=>{p.specs[Number(input.dataset.specEnabled)].enabled=input.checked});document.querySelectorAll('[data-spec-remove]').forEach(btn=>btn.onclick=()=>{p.specs.splice(Number(btn.dataset.specRemove),1);drawProductSpecs()})}
async function saveProductDetail(){const p=state.productEditor;p.enabled=el('#prodEnabled').checked;p.category=el('#prodCategory').value;p.subcategory=el('#prodSubcategory').value;p.name=el('#prodName').value;p.heroSubtitle=el('#prodHeroSubtitle').value;p.sku=el('#prodSku').value;p.price=el('#prodPrice').value;p.whatsappUrl=el('#prodWhatsapp').value;p.descriptionTitle=el('#prodDescriptionTitle').value;p.description=el('#prodDescription').value;p.notes=el('#prodNotes').value;await api('/api/admin/product-editor',{method:'PUT',body:JSON.stringify({product:p})});await load();state.productCategory=p.category;state.productSubcategory=p.subcategory;state.productSlug=p.slug;products();alert('商品已保存')}
function pageOptions(selected){return state.pages.map(p=>\`<option value="\${esc(p.slug)}" \${p.slug===selected?'selected':''}>\${esc(p.slug)}</option>\`).join('')}
async function readFileAsDataUrl(file){return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
async function uploadImage(file){const dataUrl=await readFileAsDataUrl(file);const res=await api('/api/admin/upload-image',{method:'POST',body:JSON.stringify({fileName:file.name,dataUrl})});return res.url}
async function images(){const page=state.editorPage||'index.html';el('#view').innerHTML=\`<div class="toolbar"><select id="editorPage">\${pageOptions(page)}</select><button class="btn" id="saveImages">保存图片</button><a class="btn secondary" id="openImagePage" href="/\${page}" target="_blank">打开当前页</a></div><div id="imageList" class="image-grid"></div>\`;el('#editorPage').onchange=async e=>{state.editorPage=e.target.value;await images()};await loadImages(page)}
async function loadImages(page){const data=await api('/api/admin/editor?page='+encodeURIComponent(page));state.editor=data;el('#openImagePage').href='/'+data.page;drawImageInputs();el('#saveImages').onclick=saveImages}
function drawImageInputs(){const items=state.editor.images;el('#imageList').innerHTML=items.map((img,i)=>\`<div class="card"><img class="thumb" src="\${esc(img.replacement||img.preview)}" alt=""><div class="row"><label><input type="checkbox" data-img-enabled="\${i}" \${img.enabled!==false?'checked':''}> 启用替换</label></div><div class="row"><label>替换图片 URL</label><input data-img-url="\${i}" value="\${esc(img.replacement||'')}" placeholder="/assets/admin-uploads/example.webp 或 https://..."></div><div class="row"><label>上传新图片</label><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-img-file="\${i}"></div><div class="mini">原图：\${esc(img.original)}</div><div class="toolbar"><button class="btn secondary" data-img-clear="\${i}">清除替换</button></div></div>\`).join('')||'<div class="card muted">这个页面没有识别到可替换图片。</div>';document.querySelectorAll('[data-img-url]').forEach(input=>input.oninput=()=>{state.editor.images[Number(input.dataset.imgUrl)].replacement=input.value});document.querySelectorAll('[data-img-enabled]').forEach(input=>input.onchange=()=>{state.editor.images[Number(input.dataset.imgEnabled)].enabled=input.checked});document.querySelectorAll('[data-img-clear]').forEach(btn=>btn.onclick=()=>{state.editor.images[Number(btn.dataset.imgClear)].replacement='';drawImageInputs()});document.querySelectorAll('[data-img-file]').forEach(input=>input.onchange=async()=>{if(!input.files||!input.files[0])return;input.disabled=true;try{const url=await uploadImage(input.files[0]);state.editor.images[Number(input.dataset.imgFile)].replacement=url;drawImageInputs()}catch(e){alert(e.message||'上传失败')}finally{input.disabled=false}})}
async function saveImages(){await api('/api/admin/images?page='+encodeURIComponent(state.editor.page),{method:'PUT',body:JSON.stringify(state.editor.images)});await load();alert('图片替换已保存')}
async function blocks(){const page=state.editorPage||'index.html';el('#view').innerHTML=\`<div class="toolbar"><select id="editorPage">\${pageOptions(page)}</select><button class="btn" id="saveBlocks">保存区块</button><a class="btn secondary" id="openBlockPage" href="/\${page}" target="_blank">打开当前页</a></div><div class="editor-layout"><div class="block-list" id="blockList"></div><iframe class="preview-frame" id="blockPreview" src="/\${page}?adminPreview=\${Date.now()}"></iframe></div>\`;el('#editorPage').onchange=async e=>{state.editorPage=e.target.value;await blocks()};await loadBlocks(page)}
async function loadBlocks(page){const data=await api('/api/admin/editor?page='+encodeURIComponent(page));state.editor=data;el('#openBlockPage').href='/'+data.page;el('#blockPreview').src='/'+data.page+'?adminPreview='+Date.now();el('#blockList').innerHTML=data.blocks.map((b,i)=>\`<div class="block-item"><div class="toolbar"><span class="pill">\${esc(b.tag)}</span><label><input type="checkbox" data-block-enabled="\${i}" \${b.enabled!==false?'checked':''}> 启用</label></div><div class="row"><label>当前文字</label><textarea data-block-value="\${i}">\${esc(b.value||b.original)}</textarea></div><div class="mini">原文：\${esc(b.original)}</div></div>\`).join('')||'<div class="card muted">这个页面没有识别到可编辑文字区块。</div>';document.querySelectorAll('[data-block-value]').forEach(input=>input.oninput=()=>{state.editor.blocks[Number(input.dataset.blockValue)].value=input.value});document.querySelectorAll('[data-block-enabled]').forEach(input=>input.onchange=()=>{state.editor.blocks[Number(input.dataset.blockEnabled)].enabled=input.checked});el('#saveBlocks').onclick=saveBlocks}
async function saveBlocks(){await api('/api/admin/blocks?page='+encodeURIComponent(state.editor.page),{method:'PUT',body:JSON.stringify(state.editor.blocks)});await load();alert('区块内容已保存');await loadBlocks(state.editor.page)}
function pixels(){const x=state.settings;el('#view').innerHTML=\`<div class="grid"><div class="card"><h3>Head Pixel</h3><p class="muted">例如 Meta Pixel、TikTok Pixel、Google Tag。会插入到 &lt;/head&gt; 前。</p><textarea id="pixelHead">\${esc(x.pixelHead||'')}</textarea></div><div class="card"><h3>Body 底部代码</h3><p class="muted">需要放在页面底部的统计或聊天代码。</p><textarea id="pixelBodyEnd">\${esc(x.pixelBodyEnd||'')}</textarea></div></div><div class="toolbar"><button class="btn" id="save">保存 Pixel</button><label><input type="checkbox" id="tracking" \${x.trackingEnabled!==false?'checked':''}> 启用内置访问统计</label></div>\`;el('#save').onclick=async()=>{state.settings.pixelHead=el('#pixelHead').value;state.settings.pixelBodyEnd=el('#pixelBodyEnd').value;state.settings.trackingEnabled=el('#tracking').checked;await saveSettings()}}
function whatsapp(){const x=state.settings;const curs=['OMR','AED','SAR','QAR','KWD','USD','EUR','GBP','CNY','JPY'];const cur=(x.currency||'OMR').toUpperCase();el('#view').innerHTML=\`<div class="card"><div class="grid"><div class="row"><label>全站 WhatsApp 链接</label><input id="waUrl" value="\${esc(x.whatsappUrl||'')}" placeholder="https://wa.me/8613..."></div><div class="row"><label>显示号码</label><input id="waNum" value="\${esc(x.whatsappNumber||'')}"></div></div><p class="muted">前台所有 WhatsApp 按钮会自动改为这里的链接，并记录点击事件。商品里填写专属链接时，商品页优先使用商品链接。</p><button class="btn" id="save">保存 WhatsApp</button></div><div class="card" style="margin-top:14px"><h3>货币</h3><div class="row"><label>全站货币</label><select id="siteCurrency">\${curs.map(c=>\`<option value="\${c}" \${c===cur?'selected':''}>\${c}</option>\`).join('')}</select></div><p class="muted">分类页、Quick View、商品详情页、首页展示位的价格都会用这个货币显示（默认 OMR 阿曼里亚尔）。价格数字在“商品管理/展示管理”里维护。</p><button class="btn" id="saveCur">保存货币</button></div><div class="card" style="margin-top:14px"><h3>修改后台密码</h3><div class="grid"><div class="row"><label>当前密码</label><input type="password" id="pwCur"></div><div class="row"><label>新密码（至少 6 位）</label><input type="password" id="pwNew"></div><div class="row"><label>确认新密码</label><input type="password" id="pwNew2"></div></div><p class="muted">修改后立即生效，新密码会加密保存到 admin-data/auth.json（覆盖环境变量默认密码）。</p><button class="btn" id="savePw">修改密码</button></div>\`;el('#save').onclick=async()=>{state.settings.whatsappUrl=el('#waUrl').value;state.settings.whatsappNumber=el('#waNum').value;await saveSettings()};el('#saveCur').onclick=async()=>{state.settings.currency=el('#siteCurrency').value;await saveSettings()};el('#savePw').onclick=async()=>{const cur=el('#pwCur').value,n1=el('#pwNew').value,n2=el('#pwNew2').value;if(n1.length<6){alert('新密码至少 6 位');return}if(n1!==n2){alert('两次新密码不一致');return}try{await api('/api/admin/password',{method:'PUT',body:JSON.stringify({current:cur,next:n1})});alert('密码已修改，下次登录请使用新密码');el('#pwCur').value=el('#pwNew').value=el('#pwNew2').value=''}catch(e){alert(e.message||'修改失败：当前密码可能不正确')}}}
function events(){el('#view').innerHTML=\`<div class="toolbar"><button class="btn secondary" id="refresh">刷新</button><button class="btn danger" id="clear">清空记录</button></div><table><thead><tr><th>时间</th><th>类型</th><th>页面</th><th>商品</th><th>详情</th></tr></thead><tbody>\${state.events.map(e=>\`<tr><td>\${new Date(e.at).toLocaleString()}</td><td><span class="pill">\${e.type}</span></td><td>\${esc(e.path||'')}</td><td>\${esc(e.product?.name||'')}</td><td><code>\${esc(JSON.stringify(e.details||{}))}</code></td></tr>\`).join('')||'<tr><td class="muted">暂无记录</td></tr>'}</tbody></table>\`;el('#refresh').onclick=async()=>{await load();events()};el('#clear').onclick=async()=>{if(confirm('确定清空统计记录？')){await api('/api/admin/events',{method:'DELETE'});await load();events()}}}
function bindEdit(arr){document.querySelectorAll('[data-k]').forEach(input=>{input.oninput=input.onchange=()=>{const item=arr[Number(input.dataset.i)];item[input.dataset.k]=input.type==='checkbox'?input.checked:input.value}})}
async function savePages(){await api('/api/admin/pages',{method:'PUT',body:JSON.stringify(state.pages)});await load();alert('页面已保存')}
async function saveProducts(){await api('/api/admin/products',{method:'PUT',body:JSON.stringify(state.products)});await load();alert('商品已保存')}
async function saveSettings(){await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(state.settings)});await load();alert('设置已保存')}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function renderApp(){root.innerHTML=\`
<div class="app"><aside class="side"><div class="brand">LOVE</div><div class="nav">
\${[['dashboard','仪表盘'],['products','商品管理'],['merchandising','展示管理'],['categories','分类管理'],['pages','页面管理'],['pageedit','页面编辑'],['images','图片替换'],['blocks','区块编辑'],['pixels','Pixel 像素'],['whatsapp','WhatsApp'],['events','访问记录']].map(x=>\`<button data-tab="\${x[0]}">\${x[1]}</button>\`).join('')}
</div></aside><main class="main"><div class="top"><div><h1 id="title"></h1><div class="muted">前台和后台使用同一套商品、分类、页面和统计数据。</div></div><button class="btn secondary" id="logout">退出</button></div><div id="view"></div></main></div>\`;
document.querySelectorAll('.nav button').forEach(b=>{b.onclick=()=>{current=b.dataset.tab;renderView()}});
el('#logout').onclick=async()=>{await api('/admin/logout',{method:'POST'});renderLogin()};
renderView()}
function renderView(){setActive();const views={dashboard,pages,products,merchandising,categories,pageedit:pageeditor,images,blocks,pixels,whatsapp,events};const titles={dashboard:'仪表盘',pages:'页面管理',products:'商品管理',merchandising:'展示管理',categories:'分类管理',pageedit:'页面可视化编辑',images:'图片替换',blocks:'页面区块编辑',pixels:'Pixel 像素代码',whatsapp:'WhatsApp 设置',events:'访问记录'};el('#title').textContent=titles[current]||'';(views[current]||dashboard)()}
function dashboard(){const s=state.summary||{};const days=s.last14Days||[];el('#view').innerHTML=\`
<div class="cards"><div class="card">总浏览量<div class="metric">\${s.pageViews||0}</div></div><div class="card">总访客<div class="metric">\${s.totalVisitors||0}</div></div><div class="card">今日浏览量<div class="metric">\${s.todayViews||0}</div></div><div class="card">今日访客<div class="metric">\${s.todayVisitors||0}</div></div></div>
<div class="cards" style="margin-top:14px"><div class="card">WhatsApp 点击<div class="metric">\${s.whatsappClicks||0}</div></div><div class="card">商品点击<div class="metric">\${s.productClicks||0}</div></div><div class="card">今日 WhatsApp<div class="metric">\${s.todayWhatsapp||0}</div></div><div class="card">转化率<div class="metric">\${s.conversionRate||0}%</div></div></div>
<div class="grid" style="margin-top:16px"><div class="card"><h3>最近 14 天</h3><table><thead><tr><th>日期</th><th>浏览</th><th>访客</th><th>商品点击</th><th>WhatsApp</th></tr></thead><tbody>\${days.map(d=>\`<tr><td>\${esc(d.day)}</td><td>\${d.page_view}</td><td>\${d.visitors}</td><td>\${d.product_click||0}</td><td>\${d.whatsapp_click||0}</td></tr>\`).join('')||'<tr><td class="muted">暂无数据</td></tr>'}</tbody></table></div><div class="card"><h3>热门页面</h3><table><tbody>\${(s.topPages||[]).map(p=>\`<tr><td>\${esc(p.path)}</td><td>\${p.count}</td></tr>\`).join('')||'<tr><td class="muted">暂无数据</td></tr>'}</tbody></table><h3 style="margin-top:16px">热门商品点击</h3><table><tbody>\${(s.topProductClicks||[]).map(p=>\`<tr><td>\${esc(p.name)}</td><td>\${p.count}</td></tr>\`).join('')||'<tr><td class="muted">暂无数据</td></tr>'}</tbody></table></div></div>\`}
function events(){const rows=state.events||[];el('#view').innerHTML=\`<div class="toolbar"><button class="btn secondary" id="refresh">刷新</button><button class="btn danger" id="clear">清空记录</button></div><table><thead><tr><th>时间</th><th>类型</th><th>访问页面</th><th>IP</th><th>访客</th><th>商品</th><th>来源/详情</th></tr></thead><tbody>\${rows.map(e=>\`<tr><td>\${new Date(e.at).toLocaleString()}</td><td><span class="pill">\${esc(e.type)}</span></td><td>\${esc((e.path||'')+(e.query||''))}<div class="mini">\${esc(e.title||'')}</div></td><td>\${esc(e.ip||e.ipHash||'')}</td><td>\${esc(e.visitorId||'')}</td><td>\${esc(e.product?.name||'')}</td><td><div class="mini">ref: \${esc(e.referrer||'')}</div><code>\${esc(JSON.stringify(e.details||{}))}</code><div class="mini">\${esc(e.ua||'')}</div></td></tr>\`).join('')||'<tr><td class="muted">暂无记录</td></tr>'}</tbody></table>\`;el('#refresh').onclick=async()=>{await load();events()};el('#clear').onclick=async()=>{if(confirm('确定清空统计记录？')){await api('/api/admin/events',{method:'DELETE'});await load();events()}}}
function categories(){const cats=JSON.parse(JSON.stringify(state.categories||[]));el('#view').innerHTML=\`<div class="toolbar"><button class="btn" id="saveCategories">保存分类</button><button class="btn secondary" id="addCategory">添加大分类</button></div><div id="categoryList"></div>\`;function draw(){el('#categoryList').innerHTML=cats.map((cat,ci)=>\`<div class="card" style="margin-bottom:12px"><div class="grid"><div class="row"><label>大分类名称</label><input data-cat-label="\${ci}" value="\${esc(cat.label)}"></div><div class="row"><label>大分类页面</label><input data-cat-href="\${ci}" value="\${esc(cat.href)}"></div></div><div class="toolbar"><button class="btn secondary" data-add-sub="\${ci}">添加子分类</button><button class="btn danger" data-remove-cat="\${ci}">删除大分类</button></div><div>\${(cat.children||[]).map((sub,si)=>\`<div class="spec-row"><span class="pill">子分类</span><input data-sub-label="\${ci}:\${si}" value="\${esc(sub.label)}"><input data-sub-href="\${ci}:\${si}" value="\${esc(sub.href)}"><button class="btn danger" data-remove-sub="\${ci}:\${si}">删除</button></div>\`).join('')||'<p class="muted">暂无子分类。</p>'}</div></div>\`).join('')||'<div class="card muted">暂无分类。</div>';bind()}function bind(){document.querySelectorAll('[data-cat-label]').forEach(i=>i.oninput=()=>{cats[+i.dataset.catLabel].label=i.value});document.querySelectorAll('[data-cat-href]').forEach(i=>i.oninput=()=>{cats[+i.dataset.catHref].href=i.value});document.querySelectorAll('[data-sub-label]').forEach(i=>i.oninput=()=>{const [c,s]=i.dataset.subLabel.split(':').map(Number);cats[c].children[s].label=i.value});document.querySelectorAll('[data-sub-href]').forEach(i=>i.oninput=()=>{const [c,s]=i.dataset.subHref.split(':').map(Number);cats[c].children[s].href=i.value});document.querySelectorAll('[data-add-sub]').forEach(b=>b.onclick=()=>{const c=+b.dataset.addSub;cats[c].children=cats[c].children||[];cats[c].children.push({label:'New Subcategory',href:'new-subcategory.html'});draw()});document.querySelectorAll('[data-remove-sub]').forEach(b=>b.onclick=()=>{const [c,s]=b.dataset.removeSub.split(':').map(Number);if(confirm('删除这个子分类？该子分类下商品会移动到当前大分类的默认子分类。')){cats[c].children.splice(s,1);draw()}});document.querySelectorAll('[data-remove-cat]').forEach(b=>b.onclick=()=>{if(confirm('删除这个大分类？')){cats.splice(+b.dataset.removeCat,1);draw()}})}draw();el('#addCategory').onclick=()=>{cats.push({label:'New Category',href:'new-category.html',children:[]});draw()};el('#saveCategories').onclick=async()=>{await api('/api/admin/categories',{method:'PUT',body:JSON.stringify({categories:cats})});await load();alert('分类已保存');categories()}}
function normalizeTextForEdit(s){return String(s||'').replace(/\\s+/g,' ').trim()}
function products(){
  const tree=productTree();
  const cats=Object.keys(tree);
  if(!cats.length){
    el('#view').innerHTML='<div class="card"><h3>暂无商品</h3><p class="muted">点击下面按钮新增第一个商品，系统会自动创建商品详情页。</p><button class="btn" id="newProduct">新增商品</button></div>';
    el('#newProduct').onclick=createNewProduct;
    return;
  }
  state.productCategory=state.productCategory&&tree[state.productCategory]?state.productCategory:cats[0];
  const subs=Object.keys(tree[state.productCategory]||{});
  state.productSubcategory=state.productSubcategory&&tree[state.productCategory]?.[state.productSubcategory]?state.productSubcategory:subs[0];
  const plist=tree[state.productCategory]?.[state.productSubcategory]||[];
  state.productSlug=state.productSlug&&plist.find(p=>p.slug===state.productSlug)?state.productSlug:(plist[0]?.slug||'');
  let html='<div class="product-shell"><div class="card product-picker">';
  html+='<div class="row"><label>分类</label><select id="productCat">'+optionHtml(cats,state.productCategory)+'</select></div>';
  html+='<div class="row"><label>子分类</label><select id="productSub">'+optionHtml(subs,state.productSubcategory)+'</select></div>';
  html+='<div class="row"><label>商品</label><select id="productSlug">'+plist.map(p=>'<option value="'+esc(p.slug)+'" '+(p.slug===state.productSlug?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div>';
  html+='<div class="product-actions"><button class="btn" id="saveProductDetail">保存全部</button><button class="btn secondary" id="newProduct">新增商品和页面</button><a class="btn secondary" id="openProductPage" href="#" target="_blank">打开前台商品页</a></div>';
  html+='<p class="muted">商品从这里统一管理：分类页商品卡片、Quick View、商品详情页、图片、文字和参数都会同步到前台。</p></div>';
  html+='<div class="product-main"><div class="product-context"><strong id="productContextName">当前编辑</strong><span>在“前端编辑”里可以直接点预览中的文字或图片进行修改。</span></div>';
  html+='<div class="product-tabs"><button class="btn active" data-product-tab="visual">前端编辑</button><button class="btn" data-product-tab="base">基础资料</button><button class="btn" data-product-tab="photos">商品图片</button><button class="btn" data-product-tab="variants">颜色型号</button><button class="btn" data-product-tab="specs">商品参数</button></div>';
  html+='<div id="productDetail" class="card">正在加载商品...</div></div></div>';
  el('#view').innerHTML=html;
  el('#productCat').onchange=e=>{state.productCategory=e.target.value;state.productSubcategory='';state.productSlug='';products()};
  el('#productSub').onchange=e=>{state.productSubcategory=e.target.value;state.productSlug='';products()};
  el('#productSlug').onchange=e=>{state.productSlug=e.target.value;loadProductDetail(e.target.value)};
  el('#newProduct').onclick=createNewProduct;
  document.querySelectorAll('[data-product-tab]').forEach(b=>b.onclick=()=>setProductTab(b.dataset.productTab));
  loadProductDetail(state.productSlug);
}
async function createNewProduct(){
  const name=prompt('请输入新商品名称');
  if(!name||!name.trim())return;
  const body={name:name.trim(),category:state.productCategory||'Sex Toys for Women',subcategory:state.productSubcategory||'General',templatePage:state.productEditor?.page||'enigma-double-sonic.html'};
  const data=await api('/api/admin/products',{method:'POST',body:JSON.stringify(body)});
  await load();
  state.productCategory=data.product.category;
  state.productSubcategory=data.product.subcategory;
  state.productSlug=data.product.slug;
  products();
  alert('新商品和详情页已创建');
}
async function loadProductDetail(slug){
  if(!slug){el('#productDetail').innerHTML='<p class="muted">没有商品。</p>';return}
  const data=await api('/api/admin/product-editor?slug='+encodeURIComponent(slug));
  state.productEditor=data.product;
  state.productPageEditor=null;
  state.visualType='block';
  state.visualIndex=0;
  drawProductDetail();
  await loadProductPageEditor(state.productEditor.page);
}
function refreshProductStatusUI(){
  const p=state.productEditor;if(!p)return;
  const on=p.enabled!==false;
  const badge=el('#prodStatusBadge');
  if(badge){badge.textContent=on?'已上架':'已下架';badge.style.background=on?'#138a36':'#c93535';badge.style.color='#fff';}
  const pub=el('#btnPublish'),un=el('#btnUnpublish');
  if(pub)pub.disabled=on;if(un)un.disabled=!on;
}
async function setProductPublished(flag){
  const p=state.productEditor;if(!p)return;
  p.enabled=flag;
  await api('/api/admin/product-editor',{method:'PUT',body:JSON.stringify({product:p})});
  await load();
  refreshProductStatusUI();
  const en=el('#prodEnabled');if(en)en.checked=flag;
  alert(flag?'商品已上架':'商品已下架');
}
function drawProductDetail(){
  const p=state.productEditor;
  el('#openProductPage').href='/'+p.page;
  el('#productContextName').textContent='当前编辑：'+(p.name||p.slug);
  refreshProductStatusUI();
  const pub=el('#btnPublish'),un=el('#btnUnpublish');
  if(pub)pub.onclick=()=>setProductPublished(true);
  if(un)un.onclick=()=>setProductPublished(false);
  let html='';
  html+='<div class="product-panel active" data-panel="visual"><div class="visual-layout"><div class="visual-preview-wrap"><div class="visual-preview-head"><strong>前台商品页预览</strong><a class="btn secondary" href="/'+esc(p.page)+'" target="_blank">新窗口打开</a></div><iframe class="visual-preview-frame" id="productPreview" src="/'+esc(p.page)+'?adminPreview='+Date.now()+'"></iframe></div><div class="visual-side"><div class="card" id="visualSelected"><h3>点选元素编辑</h3><p class="muted">在左侧预览中点击文字、图片或视频，会弹出编辑窗口。视频支持填写链接或上传本地 MP4/WEBM/OGG。</p></div><details class="card"><summary>高级：查看识别到的文字</summary><div class="visual-list" id="visualBlockList"></div></details><details class="card"><summary>高级：查看图片/视频</summary><div class="visual-list" id="visualImageList"></div></details></div></div><div class="visual-modal" id="visualModal"><div class="visual-dialog"><div class="visual-dialog-head"><h3 id="visualModalTitle">编辑元素</h3><button class="visual-close" type="button" id="visualModalClose">×</button></div><div class="visual-dialog-body" id="visualModalBody"></div></div></div></div>';
  html+='<div class="product-panel" data-panel="base"><div class="grid"><div><div class="row"><label><input type="checkbox" id="prodEnabled" '+(p.enabled!==false?'checked':'')+'> 启用商品页</label></div><div class="row"><label>分类</label><input id="prodCategory" value="'+esc(p.category||'')+'"></div><div class="row"><label>子分类</label><input id="prodSubcategory" value="'+esc(p.subcategory||'')+'"></div><div class="row"><label>商品名称</label><input id="prodName" value="'+esc(p.name||'')+'"></div><div class="row"><label>商品副标题</label><input id="prodHeroSubtitle" value="'+esc(p.heroSubtitle||'')+'"></div><div class="grid"><div class="row"><label>SKU</label><input id="prodSku" value="'+esc(p.sku||'')+'"></div><div class="row"><label>价格</label><input id="prodPrice" value="'+esc(p.price||'')+'"></div></div><div class="row"><label>专属 WhatsApp</label><input id="prodWhatsapp" value="'+esc(p.whatsappUrl||'')+'" placeholder="留空使用全站设置"></div></div><div><div class="row"><label>描述标题</label><input id="prodDescriptionTitle" value="'+esc(p.descriptionTitle||'')+'"></div><div class="row"><label>商品描述</label><textarea id="prodDescription" style="min-height:210px">'+esc(p.description||'')+'</textarea></div><div class="row"><label>备注</label><textarea id="prodNotes">'+esc(p.notes||'')+'</textarea></div></div></div></div>';
  html+='<div class="product-panel" data-panel="photos"><div id="productImages" class="image-grid"></div></div>';
  html+='<div class="product-panel" data-panel="variants"><div class="toolbar"><button class="btn secondary" id="addVariant">添加颜色/型号</button></div><div id="productVariants"></div></div>';
  html+='<div class="product-panel" data-panel="specs"><div class="toolbar"><button class="btn secondary" id="addSpec">添加参数</button></div><div id="productSpecs"></div></div>';
  el('#productDetail').innerHTML=html;
  drawProductImages();
  drawProductVariants();
  drawProductSpecs();
  el('#saveProductDetail').onclick=saveProductDetail;
  el('#addSpec').onclick=()=>{p.specs=p.specs||[];p.specs.push({key:'',value:'',enabled:true});drawProductSpecs()};
  el('#addVariant').onclick=()=>{p.variants=p.variants||[];p.variants.push({name:'New option',color:'#d8d8d8',image:'',enabled:true});drawProductVariants()};
  el('#visualModalClose').onclick=closeVisualModal;
  el('#visualModal').onclick=e=>{if(e.target.id==='visualModal')closeVisualModal()};
}
async function loadProductPageEditor(page){
  const data=await api('/api/admin/editor?page='+encodeURIComponent(page));
  state.productPageEditor=data;
  state.visualType='block';
  state.visualIndex=0;
  drawVisualEditor();
  bindProductPreview();
}
function drawVisualEditor(){
  const editor=state.productPageEditor;
  if(!editor)return;
  const blocks=editor.blocks||[];
  const images=editor.images||[];
  if(el('#visualSelected'))el('#visualSelected').innerHTML='<h3>点选元素编辑</h3><p class="muted">在左侧预览中点击文字、图片或视频，会弹出编辑窗口。已识别 '+blocks.length+' 个文字元素、'+images.length+' 个媒体元素。</p>';
  el('#visualBlockList').innerHTML=blocks.slice(0,60).map((b,i)=>'<button class="visual-item '+(state.visualType==='block'&&state.visualIndex===i?'active':'')+'" data-vblock="'+i+'"><strong>'+esc(b.tag||'text')+'</strong><span>'+esc(b.value||b.original||'')+'</span></button>').join('')||'<p class="muted">没有识别到可编辑文字。</p>';
  el('#visualImageList').innerHTML=images.slice(0,60).map((img,i)=>'<button class="visual-item '+(state.visualType==='image'&&state.visualIndex===i?'active':'')+'" data-vimage="'+i+'">'+mediaThumbHtml(img)+'<span>'+esc(mediaLabel(img))+'</span></button>').join('')||'<p class="muted">没有识别到可编辑图片或视频。</p>';
  document.querySelectorAll('[data-vblock]').forEach(b=>b.onclick=()=>selectVisual('block',Number(b.dataset.vblock)));
  document.querySelectorAll('[data-vimage]').forEach(b=>b.onclick=()=>selectVisual('image',Number(b.dataset.vimage)));
}
function mediaLabel(item){return (item&&item.mediaKind==='video')?'视频':((item&&item.attr==='poster')?'视频封面':'图片')}
function mediaThumbHtml(item){
  const src=esc(item.replacement||item.preview||'');
  if(item&&item.mediaKind==='video')return '<video class="visual-thumb" src="'+src+'" muted controls playsinline></video>';
  return '<img class="visual-thumb" src="'+src+'" alt="">';
}
function selectVisual(type,index){
  state.visualType=type;
  state.visualIndex=index;
  drawVisualEditor();
  drawVisualSelected();
  openVisualModal();
}
function openVisualModal(){const m=el('#visualModal');if(m)m.classList.add('open')}
function closeVisualModal(){const m=el('#visualModal');if(m)m.classList.remove('open')}
function drawVisualSelected(){
  const editor=state.productPageEditor;
  if(!editor)return;
  if(state.visualType==='image'){
    const img=(editor.images||[])[state.visualIndex];
    if(!img){el('#visualModalBody').innerHTML='<p class="muted">请选择图片或视频。</p>';return}
    const isVideo=img.mediaKind==='video'||/\\.(mp4|webm|ogg|ogv|mov|m4v)(\\?|#|$)/i.test(img.preview||img.original||'');
    el('#visualModalTitle').textContent=isVideo?'编辑视频':'编辑图片';
    el('#visualModalBody').innerHTML=mediaThumbHtml(img)+'<div class="row"><label><input type="checkbox" id="visualImageEnabled" '+(img.enabled!==false?'checked':'')+'> 启用替换</label></div><div class="row"><label>'+(isVideo?'视频链接':'图片链接')+'</label><input id="visualImageUrl" value="'+esc(img.replacement||'')+'" placeholder="'+(isVideo?'https://.../video.mp4 或 /assets/admin-uploads/video.mp4':'/assets/admin-uploads/product.webp 或 https://...')+'"></div><div class="row"><label>'+(isVideo?'上传本地视频':'上传本地图片')+'</label><input type="file" id="visualImageFile" accept="'+(isVideo?'video/mp4,video/webm,video/ogg':'image/png,image/jpeg,image/webp,image/gif')+'"></div><div class="mini">原文件：'+esc(img.original)+'</div><div class="toolbar"><button class="btn" id="saveVisual">保存修改</button><button class="btn secondary" id="clearVisualImage">清除替换</button></div>';
    el('#visualImageUrl').oninput=e=>{img.replacement=e.target.value};
    el('#visualImageEnabled').onchange=e=>{img.enabled=e.target.checked};
    el('#clearVisualImage').onclick=()=>{img.replacement='';drawVisualSelected()};
    el('#visualImageFile').onchange=async e=>{if(!e.target.files||!e.target.files[0])return;img.replacement=await uploadImage(e.target.files[0]);drawVisualEditor();drawVisualSelected()};
    el('#saveVisual').onclick=saveVisualEditor;
    return;
  }
  const block=(editor.blocks||[])[state.visualIndex];
  if(!block){el('#visualModalBody').innerHTML='<p class="muted">请选择文字。</p>';return}
  el('#visualModalTitle').textContent='替换文字';
  el('#visualModalBody').innerHTML='<div class="toolbar"><span class="pill">'+esc(block.tag||'text')+'</span><label><input type="checkbox" id="visualBlockEnabled" '+(block.enabled!==false?'checked':'')+'> 启用替换</label></div><div class="row"><label>替换成</label><textarea id="visualBlockText" style="min-height:170px">'+esc(block.value||block.original||'')+'</textarea></div><div class="mini">原文：'+esc(block.original||'')+'</div><div class="toolbar"><button class="btn" id="saveVisual">保存修改</button><button class="btn secondary" id="resetVisualBlock">恢复原文</button></div>';
  el('#visualBlockText').oninput=e=>{block.value=e.target.value};
  el('#visualBlockEnabled').onchange=e=>{block.enabled=e.target.checked};
  el('#resetVisualBlock').onclick=()=>{block.value=block.original||'';drawVisualSelected()};
  el('#saveVisual').onclick=saveVisualEditor;
}
async function saveVisualEditor(){
  const editor=state.productPageEditor;
  if(!editor)return;
  await api('/api/admin/blocks?page='+encodeURIComponent(editor.page),{method:'PUT',body:JSON.stringify(editor.blocks||[])});
  await api('/api/admin/images?page='+encodeURIComponent(editor.page),{method:'PUT',body:JSON.stringify(editor.images||[])});
  await loadProductPageEditor(editor.page);
  const frame=el('#productPreview');
  if(frame)frame.src='/'+editor.page+'?adminPreview='+Date.now();
  closeVisualModal();
  alert('页面元素已保存');
}
function bindProductPreview(){
  const frame=el('#productPreview');
  if(!frame)return;
  frame.onload=function(){
    try{
      const doc=frame.contentDocument;
      if(!doc)return;
      const style=doc.createElement('style');
      style.textContent='[data-admin-editable]{outline:1px dashed rgba(17,19,23,.35);outline-offset:3px;cursor:pointer}[data-admin-editable]:hover{outline:2px solid #111317!important;background:rgba(255,235,160,.18)}';
      doc.head.appendChild(style);
      const textSel='h1,h2,h3,h4,h5,h6,p,a,button,li,span,strong,em,small,label';
      doc.querySelectorAll(textSel).forEach(n=>{if(normalizeTextForEdit(n.textContent).length>1)n.setAttribute('data-admin-editable','text')});
      doc.querySelectorAll('img').forEach(n=>n.setAttribute('data-admin-editable','image'));
      doc.querySelectorAll('video').forEach(n=>n.setAttribute('data-admin-editable','video'));
      doc.querySelectorAll('.video-block,.video-field,.video-embed-field-lazy,[data-video-embed-field-lazy]').forEach(n=>n.setAttribute('data-admin-editable','video'));
      doc.addEventListener('click',function(ev){
        const videoBox=ev.target.closest&&ev.target.closest('.video-block,.video-field,.video-embed-field-lazy,[data-video-embed-field-lazy]');
        const video=ev.target.closest&&ev.target.closest('video');
        const img=ev.target.closest&&ev.target.closest('img');
        const text=ev.target.closest&&ev.target.closest(textSel);
        if(!videoBox&&!video&&!img&&!text)return;
        ev.preventDefault();
        ev.stopPropagation();
        if(videoBox){const idx=matchVisualVideoEmbed(videoBox);if(idx>-1)selectVisual('image',idx);return}
        if(video){const idx=matchVisualImage(video);if(idx>-1)selectVisual('image',idx);return}
        if(img){const idx=matchVisualImage(img);if(idx>-1)selectVisual('image',idx);return}
        const idx=matchVisualBlock(text);
        if(idx>-1)selectVisual('block',idx);
      },true);
    }catch(e){}
  };
}
function matchVisualBlock(node){
  const text=normalizeTextForEdit(node&&node.textContent);
  const blocks=(state.productPageEditor&&state.productPageEditor.blocks)||[];
  let idx=blocks.findIndex(b=>normalizeTextForEdit(b.value||b.original)===text||normalizeTextForEdit(b.original)===text);
  if(idx<0)idx=blocks.findIndex(b=>text&&normalizeTextForEdit(b.original).indexOf(text)>-1);
  return idx;
}
function matchVisualImage(node){
  const src=String(node.currentSrc||node.src||node.getAttribute('src')||'').split('?')[0];
  const tail=src.split('/').slice(-2).join('/');
  const images=(state.productPageEditor&&state.productPageEditor.images)||[];
  return images.findIndex(img=>{
    const vals=[img.replacement,img.preview,img.original].map(v=>String(v||'').split('?')[0]);
    return vals.some(v=>v&&((src&&src.endsWith(v.replace(/^\\//,'')))||(tail&&v.endsWith(tail))||v===src));
  });
}
function matchVisualVideoEmbed(node){
  const holder=node&&((node.matches&&node.matches('[data-video-embed-field-lazy]'))?node:node.querySelector&&node.querySelector('[data-video-embed-field-lazy]'));
  const raw=holder?String(holder.getAttribute('data-video-embed-field-lazy')||''):'';
  const m=raw.match(/src=&quot;([^"&]+)/i)||raw.match(/src=["']([^"']+)/i);
  const src=m?m[1]:'';
  const images=(state.productPageEditor&&state.productPageEditor.images)||[];
  return images.findIndex(img=>img.mediaKind==='video'&&src&&(String(img.original||'').includes(src)||String(img.preview||'').includes(src)||String(img.replacement||'').includes(src)));
}
function drawProductVariants(){
  const p=state.productEditor;
  p.variants=p.variants||[];
  el('#productVariants').innerHTML=p.variants.map((v,i)=>'<div class="variant-edit-row"><label><input type="checkbox" data-var-enabled="'+i+'" '+(v.enabled!==false?'checked':'')+'> 启用</label><input data-var-name="'+i+'" value="'+esc(v.name||'')+'" placeholder="颜色/型号名称"><input type="color" data-var-color="'+i+'" value="'+esc(v.color||'#d8d8d8')+'"><input data-var-image="'+i+'" value="'+esc(v.image||'')+'" placeholder="型号图片 URL"><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-var-file="'+i+'"><button class="btn secondary" data-var-remove="'+i+'">删除</button></div>').join('')||'<p class="muted">还没有颜色/型号，可以点击添加。</p>';
  document.querySelectorAll('[data-var-enabled]').forEach(input=>input.onchange=()=>{p.variants[Number(input.dataset.varEnabled)].enabled=input.checked});
  document.querySelectorAll('[data-var-name]').forEach(input=>input.oninput=()=>{p.variants[Number(input.dataset.varName)].name=input.value});
  document.querySelectorAll('[data-var-color]').forEach(input=>input.oninput=()=>{p.variants[Number(input.dataset.varColor)].color=input.value});
  document.querySelectorAll('[data-var-image]').forEach(input=>input.oninput=()=>{p.variants[Number(input.dataset.varImage)].image=input.value});
  document.querySelectorAll('[data-var-remove]').forEach(btn=>btn.onclick=()=>{p.variants.splice(Number(btn.dataset.varRemove),1);drawProductVariants()});
  document.querySelectorAll('[data-var-file]').forEach(input=>input.onchange=async()=>{if(!input.files||!input.files[0])return;p.variants[Number(input.dataset.varFile)].image=await uploadImage(input.files[0]);drawProductVariants()});
}
function updateProductFromForm(){
  const p=state.productEditor;
  if(!p)return;
  if(el('#prodEnabled'))p.enabled=el('#prodEnabled').checked;
  if(el('#prodCategory'))p.category=el('#prodCategory').value;
  if(el('#prodSubcategory'))p.subcategory=el('#prodSubcategory').value;
  if(el('#prodName'))p.name=el('#prodName').value;
  if(el('#prodHeroSubtitle'))p.heroSubtitle=el('#prodHeroSubtitle').value;
  if(el('#prodSku'))p.sku=el('#prodSku').value;
  if(el('#prodPrice'))p.price=el('#prodPrice').value;
  if(el('#prodWhatsapp'))p.whatsappUrl=el('#prodWhatsapp').value;
  if(el('#prodDescriptionTitle'))p.descriptionTitle=el('#prodDescriptionTitle').value;
  if(el('#prodDescription'))p.description=el('#prodDescription').value;
  if(el('#prodNotes'))p.notes=el('#prodNotes').value;
}
async function saveProductDetail(){
  updateProductFromForm();
  const p=state.productEditor;
  await api('/api/admin/product-editor',{method:'PUT',body:JSON.stringify({product:p})});
  if(state.productPageEditor){
    await api('/api/admin/blocks?page='+encodeURIComponent(state.productPageEditor.page),{method:'PUT',body:JSON.stringify(state.productPageEditor.blocks||[])});
    await api('/api/admin/images?page='+encodeURIComponent(state.productPageEditor.page),{method:'PUT',body:JSON.stringify(state.productPageEditor.images||[])});
  }
  await load();
  state.productCategory=p.category;
  state.productSubcategory=p.subcategory;
  state.productSlug=p.slug;
  products();
  alert('商品和页面元素已保存');
}
function products(){
  const tree=productTree();
  const cats=Object.keys(tree);
  state.productCategory=state.productCategory&&tree[state.productCategory]?state.productCategory:(cats[0]||'Sex Toys for Women');
  const subs=Object.keys(tree[state.productCategory]||{});
  state.productSubcategory=state.productSubcategory&&tree[state.productCategory]?.[state.productSubcategory]?state.productSubcategory:(subs[0]||'General');
  const plist=tree[state.productCategory]?.[state.productSubcategory]||[];
  state.productSlug=state.productSlug&&plist.find(p=>p.slug===state.productSlug)?state.productSlug:(plist[0]?.slug||'');
  let html='<div class="product-shell"><div class="card product-picker">';
  html+='<div class="row"><label>分类</label><select id="productCat">'+optionHtml(cats,state.productCategory)+'</select></div>';
  html+='<div class="row"><label>子分类</label><select id="productSub">'+optionHtml(subs,state.productSubcategory)+'</select></div>';
  html+='<div class="row"><label>商品</label><select id="productSlug">'+plist.map(p=>'<option value="'+esc(p.slug)+'" '+(p.slug===state.productSlug?'selected':'')+'>'+(p.enabled===false?'[下架] ':'')+esc(p.name)+'</option>').join('')+'</select></div>';
  html+='<div class="product-actions"><button class="btn" id="saveProductDetail">保存全部</button><button class="btn secondary" id="newProduct">新增商品和页面</button><button class="btn danger" id="deleteProduct">删除商品页</button><a class="btn secondary" id="openProductPage" href="#" target="_blank">打开前台商品页</a></div>';
  html+='<p class="muted">新增商品时可以选择一个现有商品详情页作为基础模板。删除商品页会备份 HTML 到 _deleted_products。</p></div>';
  html+='<div class="product-main"><div class="product-context"><div><strong id="productContextName">当前编辑</strong> <span id="prodStatusBadge" class="pill">—</span></div><div class="toolbar"><button class="btn" id="btnPublish">上架</button><button class="btn danger" id="btnUnpublish">下架</button></div></div>';
  html+='<div class="product-tabs"><button class="btn active" data-product-tab="visual">前端编辑</button><button class="btn" data-product-tab="base">基础资料</button><button class="btn" data-product-tab="photos">商品图片</button><button class="btn" data-product-tab="variants">颜色型号</button><button class="btn" data-product-tab="specs">商品参数</button></div>';
  html+='<div id="productDetail" class="card">正在加载商品...</div></div></div>';
  el('#view').innerHTML=html;
  el('#productCat').onchange=e=>{state.productCategory=e.target.value;state.productSubcategory='';state.productSlug='';products()};
  el('#productSub').onchange=e=>{state.productSubcategory=e.target.value;state.productSlug='';products()};
  el('#productSlug').onchange=e=>{state.productSlug=e.target.value;loadProductDetail(e.target.value)};
  el('#newProduct').onclick=createNewProduct;
  el('#deleteProduct').onclick=deleteCurrentProduct;
  document.querySelectorAll('[data-product-tab]').forEach(b=>b.onclick=()=>setProductTab(b.dataset.productTab));
  if(state.productSlug)loadProductDetail(state.productSlug);else el('#productDetail').innerHTML='<p class="muted">当前分类没有商品，可以新增一个。</p>';
}
function templateOptions(){return (state.productTemplates||state.products||[]).map(p=>'<option value="'+esc(p.page)+'">'+esc((p.name||p.page)+' - '+p.page)+'</option>').join('')}
async function createNewProduct(){
  const wrap=document.createElement('div');
  wrap.className='visual-modal open';
  wrap.innerHTML='<div class="visual-dialog"><div class="visual-dialog-head"><h3>新增商品和页面</h3><button class="visual-close" type="button">×</button></div><div class="visual-dialog-body"><div class="row"><label>商品名称</label><input id="newProdName" autofocus></div><div class="grid"><div class="row"><label>分类</label><input id="newProdCat" value="'+esc(state.productCategory||'Sex Toys for Women')+'"></div><div class="row"><label>子分类</label><input id="newProdSub" value="'+esc(state.productSubcategory||'General')+'"></div></div><div class="row"><label>基础模板</label><select id="newProdTpl">'+templateOptions()+'</select></div><div class="toolbar"><button class="btn" id="createProdNow">创建</button><button class="btn secondary" id="cancelCreateProd">取消</button></div></div></div>';
  document.body.appendChild(wrap);
  wrap.querySelector('.visual-close').onclick=()=>wrap.remove();
  wrap.querySelector('#cancelCreateProd').onclick=()=>wrap.remove();
  wrap.querySelector('#createProdNow').onclick=async()=>{
    const name=wrap.querySelector('#newProdName').value.trim();
    if(!name){alert('请输入商品名称');return}
    const body={name,category:wrap.querySelector('#newProdCat').value,subcategory:wrap.querySelector('#newProdSub').value,templatePage:wrap.querySelector('#newProdTpl').value};
    const data=await api('/api/admin/products',{method:'POST',body:JSON.stringify(body)});
    wrap.remove();
    await load();
    state.productCategory=data.product.category;
    state.productSubcategory=data.product.subcategory;
    state.productSlug=data.product.slug;
    products();
    alert('新商品和详情页已创建');
  };
}
async function deleteCurrentProduct(){
  const p=state.productEditor;
  if(!p||!p.slug){alert('请选择商品');return}
  if(!confirm('确定删除这个商品页？HTML 会移动到 _deleted_products 备份目录。'))return;
  await api('/api/admin/products?slug='+encodeURIComponent(p.slug),{method:'DELETE'});
  await load();
  state.productSlug='';
  products();
  alert('商品页已删除并备份');
}
function drawProductVariants(){
  const p=state.productEditor;p.variants=p.variants||[];
  const imageOptions=(p.images||[]).map(img=>'<option value="'+esc(img.replacement||img.preview||img.original)+'">'+esc((img.group||img.mediaKind||img.attr||'image')+' - '+(img.preview||img.original||'').slice(0,60))+'</option>').join('');
  el('#productVariants').innerHTML=p.variants.map((v,i)=>'<div class="card"><div class="variant-edit-row"><label><input type="checkbox" data-var-enabled="'+i+'" '+(v.enabled!==false?'checked':'')+'> 启用</label><input data-var-name="'+i+'" value="'+esc(v.name||'')+'" placeholder="颜色/型号名称"><input type="color" data-var-color="'+i+'" value="'+esc(v.color||'#d8d8d8')+'"><select data-var-pick="'+i+'"><option value="">自选图片...</option>'+imageOptions+'</select><button class="btn secondary" data-var-remove="'+i+'">删除</button></div><div class="row"><label>型号图片 URL</label><input data-var-image="'+i+'" value="'+esc(v.image||'')+'" placeholder="选择上方图片、上传，或填写链接"></div><div class="row"><label>上传型号图片</label><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-var-file="'+i+'"></div></div>').join('')||'<p class="muted">还没有颜色/型号，可以点击添加。</p>';
  document.querySelectorAll('[data-var-enabled]').forEach(input=>input.onchange=()=>{p.variants[Number(input.dataset.varEnabled)].enabled=input.checked});
  document.querySelectorAll('[data-var-name]').forEach(input=>input.oninput=()=>{p.variants[Number(input.dataset.varName)].name=input.value});
  document.querySelectorAll('[data-var-color]').forEach(input=>input.oninput=()=>{p.variants[Number(input.dataset.varColor)].color=input.value});
  document.querySelectorAll('[data-var-image]').forEach(input=>input.oninput=()=>{p.variants[Number(input.dataset.varImage)].image=input.value});
  document.querySelectorAll('[data-var-pick]').forEach(sel=>sel.onchange=()=>{const i=Number(sel.dataset.varPick);if(sel.value){p.variants[i].image=sel.value;drawProductVariants()}});
  document.querySelectorAll('[data-var-remove]').forEach(btn=>btn.onclick=()=>{p.variants.splice(Number(btn.dataset.varRemove),1);drawProductVariants()});
  document.querySelectorAll('[data-var-file]').forEach(input=>input.onchange=async()=>{if(!input.files||!input.files[0])return;p.variants[Number(input.dataset.varFile)].image=await uploadImage(input.files[0]);drawProductVariants()});
}
function drawProductSpecs(){
  const p=state.productEditor;p.specs=p.specs&&p.specs.length?p.specs:[{key:'SKU',value:p.sku||'',enabled:true},{key:'Category',value:p.category||'',enabled:true},{key:'Subcategory',value:p.subcategory||'',enabled:true},{key:'Material',value:'',enabled:true},{key:'Waterproof',value:'',enabled:true},{key:'Charging',value:'',enabled:true},{key:'Warranty',value:'',enabled:true}];
  if(el('#addSpec'))el('#addSpec').style.display='none';
  el('#productSpecs').innerHTML=p.specs.map((s,i)=>'<div class="spec-row"><label><input type="checkbox" data-spec-enabled="'+i+'" '+(s.enabled!==false?'checked':'')+'> 启用</label><input data-spec-key="'+i+'" value="'+esc(s.key||'')+'" placeholder="参数名"><input data-spec-value="'+i+'" value="'+esc(s.value||'')+'" placeholder="参数值"><span class="pill">基础参数</span></div>').join('');
  document.querySelectorAll('[data-spec-key]').forEach(input=>input.oninput=()=>{p.specs[Number(input.dataset.specKey)].key=input.value});
  document.querySelectorAll('[data-spec-value]').forEach(input=>input.oninput=()=>{p.specs[Number(input.dataset.specValue)].value=input.value});
  document.querySelectorAll('[data-spec-enabled]').forEach(input=>input.onchange=()=>{p.specs[Number(input.dataset.specEnabled)].enabled=input.checked});
}
function merchandising(){
  state.merch=(state.products||[]).map(function(p){return {slug:p.slug,name:p.name,page:p.page,category:p.category||'Uncategorized',subcategory:p.subcategory||'General',price:p.price||'',enabled:p.enabled!==false,featured:p.featured===true,cardImage:p.cardImage||(p.images&&p.images[0]&&(p.images[0].replacement||p.images[0].preview))||''}});
  state.merchSel=new Set();
  state.showSel=new Set((state.settings&&state.settings.homeShowcase)||[]);
  var html='<style>.merch-row{display:grid;grid-template-columns:24px 24px 54px 1fr auto auto 92px auto auto;gap:10px;align-items:center;background:#fff;border:1px solid #e2e5ea;border-radius:8px;padding:8px 12px;margin-bottom:8px}.merch-handle{cursor:grab;color:#9aa3af;font-size:18px;text-align:center}.merch-thumb{width:54px;height:54px;object-fit:contain;background:#f1f3f6;border-radius:6px}.merch-info{display:flex;flex-direction:column;min-width:0}.merch-info strong{font-size:13px}.merch-info span{font-size:12px}.merch-star{border:0;background:#eee;color:#bbb;width:34px;height:34px;border-radius:6px;cursor:pointer;font-size:16px}.merch-star.on{background:#ffd34d;color:#7a5a00}.merch-price{width:92px}.merch-en{font-size:12px;white-space:nowrap}.merch-toggle{border:0;border-radius:999px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;min-width:68px;transition:filter .15s ease}.merch-toggle:hover{filter:brightness(.96)}.merch-toggle.on{background:#e6f6ec;color:#138a36;box-shadow:inset 0 0 0 1px #99d8b0}.merch-toggle.off{background:#fdeaea;color:#c93535;box-shadow:inset 0 0 0 1px #e9a8a8}.merch-views{font-size:11px;color:#8a93a0;margin-top:3px;display:inline-flex;gap:10px}.merch-views b{color:#3a4250;font-weight:700}.merch-ud button{border:1px solid #d6dbe3;background:#fff;width:26px;height:26px;border-radius:5px;cursor:pointer}.merch-show-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}.merch-show-item{display:flex;gap:8px;align-items:center;font-size:13px;border:1px solid #e2e5ea;border-radius:6px;padding:8px}@media(max-width:900px){.merch-row{grid-template-columns:24px 1fr;row-gap:6px}}</style>';
  html+='<div class="toolbar"><button class="btn" id="merchSave">保存排序与状态</button><button class="btn secondary" id="merchSelectAll">全选/取消</button><button class="btn secondary" id="merchEnable">上架选中</button><button class="btn secondary" id="merchDisable">下架选中</button><button class="btn secondary" id="merchPrice">批量改价</button><button class="btn secondary" id="merchCat">批量改分类</button></div>';
  html+='<p class="muted">拖动每行左侧 ⠿ 手柄或用 ↑↓ 调整顺序；★ 置顶让商品排在分类页最前。顺序、置顶、上下架、价格保存后立即同步到前台分类页。</p>';
  html+='<div id="merchList"></div>';
  html+='<div class="card" style="margin-top:18px"><h3>首页 Bestsellers 推荐商品</h3><div class="row"><label><input type="checkbox" id="showEnabled" '+((state.settings&&state.settings.homeShowcaseEnabled!==false)?'checked':'')+'> 在首页 Bestsellers 区显示推荐商品（默认开启）</label></div><p class="muted">勾选下方商品作为首页 Bestsellers 推荐（按上方排序顺序展示）。不勾选任何商品则自动展示置顶/前几个商品。取消上面的开关可隐藏整个区块。</p><div id="showList"></div><div class="toolbar"><button class="btn" id="showSave">保存首页推荐</button></div></div>';
  el('#view').innerHTML=html;
  drawMerchList();drawShowList();
  el('#merchSave').onclick=saveMerch;
  el('#merchSelectAll').onclick=function(){if(state.merchSel.size===state.merch.length)state.merchSel.clear();else state.merch.forEach(function(p){state.merchSel.add(p.slug)});drawMerchList()};
  el('#merchEnable').onclick=function(){bulkSetMerch('enabled',true)};
  el('#merchDisable').onclick=function(){bulkSetMerch('enabled',false)};
  el('#merchPrice').onclick=function(){if(!state.merchSel.size){alert('请先勾选商品');return}var v=prompt('把选中商品价格统一改为（留空取消）：');if(v===null||v==='')return;state.merch.forEach(function(p){if(state.merchSel.has(p.slug))p.price=v.trim()});drawMerchList()};
  el('#merchCat').onclick=function(){if(!state.merchSel.size){alert('请先勾选商品');return}var c=prompt('分类 category（留空不改）');if(c===null)return;var s=prompt('子分类 subcategory（留空不改）');if(s===null)return;state.merch.forEach(function(p){if(state.merchSel.has(p.slug)){if(c)p.category=c;if(s)p.subcategory=s}});drawMerchList()};
  el('#showEnabled').onchange=function(e){if(state.settings)state.settings.homeShowcaseEnabled=e.target.checked};
  el('#showSave').onclick=saveShowcase;
}
function bulkSetMerch(key,val){if(!state.merchSel.size){alert('请先勾选商品');return}state.merch.forEach(function(p){if(state.merchSel.has(p.slug))p[key]=val});drawMerchList()}
function drawMerchList(){
  var stats=(state.summary&&state.summary.productStats)||{};
  el('#merchList').innerHTML=state.merch.map(function(p,i){var st=stats[p.slug]||{views:0,wa:0};return '<div class="merch-row" draggable="true" data-merch-i="'+i+'">'
    +'<span class="merch-handle" title="拖动排序">⠿</span>'
    +'<input type="checkbox" data-merch-sel="'+esc(p.slug)+'" '+(state.merchSel.has(p.slug)?'checked':'')+'>'
    +'<img class="merch-thumb" src="'+esc(p.cardImage||'assets/love-logo.svg')+'" alt="">'
    +'<div class="merch-info"><strong>'+esc(p.name)+'</strong><span class="muted">'+esc(p.category+' / '+p.subcategory)+'</span><span class="merch-views"><span>👁 浏览 <b>'+(st.views||0)+'</b></span><span>💬 WhatsApp <b>'+(st.wa||0)+'</b></span></span></div>'
    +'<button class="merch-star'+(p.featured?' on':'')+'" data-merch-star="'+i+'" title="置顶/取消置顶">★</button>'
    +'<button type="button" class="merch-toggle '+(p.enabled?'on':'off')+'" data-merch-toggle="'+i+'" title="点击切换上架/下架">'+(p.enabled?'已上架':'已下架')+'</button>'
    +'<input class="merch-price" data-merch-price="'+i+'" value="'+esc(p.price)+'" placeholder="价格">'
    +'<span class="merch-ud"><button type="button" data-merch-up="'+i+'">↑</button><button type="button" data-merch-down="'+i+'">↓</button></span>'
    +'<a class="btn secondary" href="/'+esc(p.page)+'" target="_blank">预览</a>'
    +'</div>';}).join('')||'<div class="card muted">暂无商品。</div>';
  document.querySelectorAll('[data-merch-sel]').forEach(function(c){c.onchange=function(){if(c.checked)state.merchSel.add(c.dataset.merchSel);else state.merchSel.delete(c.dataset.merchSel)}});
  document.querySelectorAll('[data-merch-star]').forEach(function(b){b.onclick=function(){var i=+b.dataset.merchStar;state.merch[i].featured=!state.merch[i].featured;drawMerchList()}});
  document.querySelectorAll('[data-merch-toggle]').forEach(function(b){b.onclick=function(){var i=+b.dataset.merchToggle;state.merch[i].enabled=!state.merch[i].enabled;drawMerchList()}});
  document.querySelectorAll('[data-merch-price]').forEach(function(inp){inp.oninput=function(){state.merch[+inp.dataset.merchPrice].price=inp.value}});
  document.querySelectorAll('[data-merch-up]').forEach(function(b){b.onclick=function(){moveMerch(+b.dataset.merchUp,-1)}});
  document.querySelectorAll('[data-merch-down]').forEach(function(b){b.onclick=function(){moveMerch(+b.dataset.merchDown,1)}});
  bindMerchDrag();
}
function moveMerch(i,dir){var j=i+dir;if(j<0||j>=state.merch.length)return;var a=state.merch;var t=a[i];a[i]=a[j];a[j]=t;drawMerchList()}
function bindMerchDrag(){
  var dragI=null;
  document.querySelectorAll('.merch-row').forEach(function(row){
    row.addEventListener('dragstart',function(){dragI=+row.dataset.merchI;row.style.opacity='.4'});
    row.addEventListener('dragend',function(){row.style.opacity='';dragI=null});
    row.addEventListener('dragover',function(e){e.preventDefault()});
    row.addEventListener('drop',function(e){e.preventDefault();var to=+row.dataset.merchI;if(dragI===null||dragI===to)return;var a=state.merch;var item=a.splice(dragI,1)[0];a.splice(to,0,item);drawMerchList()});
  });
}
function drawShowList(){
  el('#showList').innerHTML='<div class="merch-show-grid">'+state.merch.map(function(p){return '<label class="merch-show-item"><input type="checkbox" data-show-sel="'+esc(p.slug)+'" '+(state.showSel.has(p.slug)?'checked':'')+'> '+esc(p.name)+'</label>';}).join('')+'</div>';
  document.querySelectorAll('[data-show-sel]').forEach(function(c){c.onchange=function(){if(c.checked)state.showSel.add(c.dataset.showSel);else state.showSel.delete(c.dataset.showSel)}});
}
async function saveMerch(){
  state.merch.forEach(function(p,i){p.sortOrder=i});
  var bySlug={};state.merch.forEach(function(p){bySlug[p.slug]=p});
  (state.products||[]).forEach(function(p){var m=bySlug[p.slug];if(m){p.sortOrder=m.sortOrder;p.featured=m.featured;p.enabled=m.enabled;p.price=m.price;p.category=m.category;p.subcategory=m.subcategory}});
  await api('/api/admin/products',{method:'PUT',body:JSON.stringify(state.products)});
  await load();alert('排序与状态已保存');merchandising();
}
async function saveShowcase(){
  var ordered=state.merch.map(function(p){return p.slug}).filter(function(s){return state.showSel.has(s)});
  state.settings.homeShowcase=ordered;
  state.settings.homeShowcaseEnabled=el('#showEnabled').checked;
  await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(state.settings)});
  await load();alert('首页推荐已保存');
}
function pageeditor(){
  var page=(state.pageEditPage&&(state.pages||[]).some(function(p){return p.slug===state.pageEditPage}))?state.pageEditPage:'index.html';
  state.pageEditPage=page;
  el('#view').innerHTML='<div class="toolbar"><select id="pgPage">'+pageOptions(page)+'</select><a class="btn secondary" id="pgOpen" href="/'+page+'" target="_blank">新窗口打开</a><button class="btn secondary" id="pgReload">刷新预览</button><span class="muted">在左侧预览里直接点「文字 / 图片 / 视频」即可弹窗编辑并替换</span></div>'
    +'<div class="visual-layout"><div class="visual-preview-wrap"><div class="visual-preview-head"><strong>页面预览（点选编辑）</strong></div><iframe class="visual-preview-frame" id="pgPreview" src="/'+page+'?adminPreview='+Date.now()+'"></iframe></div>'
    +'<div class="visual-side"><div class="card"><h3>点选元素编辑</h3><p class="muted">点左侧预览中的文字/图片/视频会弹出编辑框；也可展开下面的列表逐项编辑。保存后预览自动刷新，前台即时生效。</p></div><details class="card"><summary>全部文字</summary><div class="visual-list" id="pgBlockList"></div></details><details class="card"><summary>全部图片 / 视频</summary><div class="visual-list" id="pgImageList"></div></details></div></div>'
    +'<div class="visual-modal" id="pgModal"><div class="visual-dialog"><div class="visual-dialog-head"><h3 id="pgModalTitle">编辑元素</h3><button class="visual-close" type="button" id="pgModalClose">×</button></div><div class="visual-dialog-body" id="pgModalBody"></div></div></div>';
  el('#pgPage').onchange=function(e){state.pageEditPage=e.target.value;pageeditor()};
  el('#pgReload').onclick=function(){var f=el('#pgPreview');if(f)f.src='/'+state.pageEditPage+'?adminPreview='+Date.now()};
  el('#pgModalClose').onclick=closePgModal;
  el('#pgModal').onclick=function(e){if(e.target.id==='pgModal')closePgModal()};
  loadPageEditorData(page);
}
function closePgModal(){var m=el('#pgModal');if(m)m.classList.remove('open')}
async function loadPageEditorData(page){
  var data=await api('/api/admin/editor?page='+encodeURIComponent(page));
  state.pgEditor=data;drawPgLists();bindPgPreview();
}
function drawPgLists(){
  var ed=state.pgEditor;if(!ed)return;
  var blocks=ed.blocks||[],images=ed.images||[];
  el('#pgBlockList').innerHTML=blocks.slice(0,80).map(function(b,i){return '<button class="visual-item" data-pgblock="'+i+'"><strong>'+esc(b.tag||'text')+'</strong><span>'+esc(b.value||b.original||'')+'</span></button>'}).join('')||'<p class="muted">无文字</p>';
  el('#pgImageList').innerHTML=images.slice(0,80).map(function(img,i){return '<button class="visual-item" data-pgimage="'+i+'">'+mediaThumbHtml(img)+'<span>'+esc(mediaLabel(img))+'</span></button>'}).join('')||'<p class="muted">无图片</p>';
  document.querySelectorAll('[data-pgblock]').forEach(function(b){b.onclick=function(){selectPg('block',+b.dataset.pgblock)}});
  document.querySelectorAll('[data-pgimage]').forEach(function(b){b.onclick=function(){selectPg('image',+b.dataset.pgimage)}});
}
function bindPgPreview(){
  var frame=el('#pgPreview');if(!frame)return;
  frame.onload=function(){
    try{
      var doc=frame.contentDocument;if(!doc)return;
      var style=doc.createElement('style');
      style.textContent='[data-admin-editable]{outline:1px dashed rgba(17,19,23,.35);outline-offset:3px;cursor:pointer}[data-admin-editable]:hover{outline:2px solid #111317!important;background:rgba(255,235,160,.18)}';
      doc.head.appendChild(style);
      var textSel='h1,h2,h3,h4,h5,h6,p,a,button,li,span,strong,em,small,label';
      doc.querySelectorAll(textSel).forEach(function(n){if(normalizeTextForEdit(n.textContent).length>1)n.setAttribute('data-admin-editable','text')});
      doc.querySelectorAll('img').forEach(function(n){n.setAttribute('data-admin-editable','image')});
      doc.querySelectorAll('video,[data-video-embed-field-lazy]').forEach(function(n){n.setAttribute('data-admin-editable','video')});
      doc.addEventListener('click',function(ev){
        var img=ev.target.closest&&ev.target.closest('img');
        var video=ev.target.closest&&ev.target.closest('video,[data-video-embed-field-lazy]');
        var text=ev.target.closest&&ev.target.closest(textSel);
        if(!img&&!video&&!text)return;
        ev.preventDefault();ev.stopPropagation();
        if(img){var i1=matchPgImage(img);if(i1>-1)selectPg('image',i1);return}
        if(video){var i2=matchPgImage(video);if(i2>-1)selectPg('image',i2);return}
        var i3=matchPgBlock(text);if(i3>-1)selectPg('block',i3);
      },true);
    }catch(e){}
  };
}
function matchPgBlock(node){
  var t=normalizeTextForEdit(node&&node.textContent);
  var blocks=(state.pgEditor&&state.pgEditor.blocks)||[];
  var idx=blocks.findIndex(function(b){return normalizeTextForEdit(b.value||b.original)===t||normalizeTextForEdit(b.original)===t});
  if(idx<0)idx=blocks.findIndex(function(b){return t&&normalizeTextForEdit(b.original).indexOf(t)>-1});
  return idx;
}
function matchPgImage(node){
  var src=String((node.currentSrc||node.src||(node.getAttribute&&node.getAttribute('src'))||'')).split('?')[0];
  var tail=src.split('/').slice(-2).join('/');
  var images=(state.pgEditor&&state.pgEditor.images)||[];
  return images.findIndex(function(img){var vals=[img.replacement,img.preview,img.original].map(function(v){return String(v||'').split('?')[0]});return vals.some(function(v){return v&&((src&&src.endsWith(v.replace(/^\\//,'')))||(tail&&v.endsWith(tail))||v===src)})});
}
function selectPg(type,index){state.pgType=type;state.pgIndex=index;drawPgSelected();var m=el('#pgModal');if(m)m.classList.add('open')}
function drawPgSelected(){
  var ed=state.pgEditor;if(!ed)return;
  if(state.pgType==='image'){
    var img=(ed.images||[])[state.pgIndex];if(!img){el('#pgModalBody').innerHTML='<p class="muted">请选择图片</p>';return}
    var isVideo=img.mediaKind==='video'||/\\.(mp4|webm|ogg|ogv|mov|m4v)(\\?|#|$)/i.test(img.preview||img.original||'');
    el('#pgModalTitle').textContent=isVideo?'编辑视频':'编辑图片';
    el('#pgModalBody').innerHTML=mediaThumbHtml(img)+'<div class="row"><label><input type="checkbox" id="pgImgEn" '+(img.enabled!==false?'checked':'')+'> 启用替换</label></div><div class="row"><label>'+(isVideo?'视频链接':'图片链接')+'</label><input id="pgImgUrl" value="'+esc(img.replacement||'')+'" placeholder="/assets/admin-uploads/... 或 https://..."></div><div class="row"><label>上传本地'+(isVideo?'视频':'图片')+'</label><input type="file" id="pgImgFile" accept="'+(isVideo?'video/mp4,video/webm,video/ogg':'image/png,image/jpeg,image/webp,image/gif')+'"></div><div class="mini">原文件：'+esc(img.original)+'</div><div class="toolbar"><button class="btn" id="pgSave">保存</button><button class="btn secondary" id="pgClear">清除替换</button></div>';
    el('#pgImgUrl').oninput=function(e){img.replacement=e.target.value};
    el('#pgImgEn').onchange=function(e){img.enabled=e.target.checked};
    el('#pgClear').onclick=function(){img.replacement='';drawPgSelected()};
    el('#pgImgFile').onchange=async function(e){if(!e.target.files||!e.target.files[0])return;try{img.replacement=await uploadImage(e.target.files[0]);drawPgSelected()}catch(x){alert(x.message||'上传失败')}};
    el('#pgSave').onclick=savePgEditor;
    return;
  }
  var b=(ed.blocks||[])[state.pgIndex];if(!b){el('#pgModalBody').innerHTML='<p class="muted">请选择文字</p>';return}
  el('#pgModalTitle').textContent='替换文字';
  el('#pgModalBody').innerHTML='<div class="toolbar"><span class="pill">'+esc(b.tag||'text')+'</span><label><input type="checkbox" id="pgBlkEn" '+(b.enabled!==false?'checked':'')+'> 启用替换</label></div><div class="row"><label>替换成</label><textarea id="pgBlkText" style="min-height:170px">'+esc(b.value||b.original||'')+'</textarea></div><div class="mini">原文：'+esc(b.original||'')+'</div><div class="toolbar"><button class="btn" id="pgSave">保存</button><button class="btn secondary" id="pgReset">恢复原文</button></div>';
  el('#pgBlkText').oninput=function(e){b.value=e.target.value};
  el('#pgBlkEn').onchange=function(e){b.enabled=e.target.checked};
  el('#pgReset').onclick=function(){b.value=b.original||'';drawPgSelected()};
  el('#pgSave').onclick=savePgEditor;
}
async function savePgEditor(){
  var ed=state.pgEditor;if(!ed)return;
  await api('/api/admin/blocks?page='+encodeURIComponent(ed.page),{method:'PUT',body:JSON.stringify(ed.blocks||[])});
  await api('/api/admin/images?page='+encodeURIComponent(ed.page),{method:'PUT',body:JSON.stringify(ed.images||[])});
  closePgModal();
  var f=el('#pgPreview');if(f)f.src='/'+ed.page+'?adminPreview='+Date.now();
  drawPgLists();
  alert('已保存，预览已刷新，前台即时生效');
}
boot();
</script>
</body></html>`;
}

async function handleAdmin(req, res, url) {
  if (url.pathname === "/admin/login" && req.method === "POST") {
    const body = await readJsonBody(req);
    if (!verifyAdminPassword(body.password)) return sendJson(res, 401, { error: "Invalid password" });
    return sendJson(res, 200, { ok: true }, {
      "set-cookie": `admin_session=${encodeURIComponent(createSessionCookie())}; Path=/; HttpOnly; SameSite=Lax`,
    });
  }
  if (url.pathname === "/admin/logout" && req.method === "POST") {
    return sendJson(res, 200, { ok: true }, { "set-cookie": "admin_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" });
  }
  if (url.pathname === "/api/admin/session") {
    if (!isAuthed(req)) return sendJson(res, 401, { error: "Unauthorized" });
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === "/admin") {
    return send(res, 200, adminHtml(), { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  }
  if (!isAuthed(req)) return sendJson(res, 401, { error: "Unauthorized" });
  if (url.pathname === "/api/admin/password" && req.method === "PUT") {
    const body = await readJsonBody(req);
    if (!verifyAdminPassword(body.current)) return sendJson(res, 400, { error: "当前密码不正确" });
    const next = String(body.next || "");
    if (next.length < 6) return sendJson(res, 400, { error: "新密码至少 6 位" });
    setAdminPassword(next);
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === "/api/admin/state" && req.method === "GET") {
    return sendJson(res, 200, {
      settings: readJson(SETTINGS_FILE, {}),
      pages: readJson(PAGES_FILE, []),
      products: productList(),
      productHierarchy: productHierarchy(),
      categories: categoryNav(),
      productTemplates: productTemplates(),
      summary: statsSummary(),
      events: readEvents(500),
    });
  }
  if (url.pathname === "/api/admin/settings" && req.method === "PUT") {
    const body = await readJsonBody(req);
    body.updatedAt = new Date().toISOString();
    writeJson(SETTINGS_FILE, body);
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === "/api/admin/pages" && req.method === "PUT") {
    const body = await readJsonBody(req);
    writeJson(PAGES_FILE, Array.isArray(body) ? body : []);
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === "/api/admin/products" && req.method === "PUT") {
    const body = await readJsonBody(req);
    writeJson(PRODUCTS_FILE, Array.isArray(body) ? body : []);
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === "/api/admin/products" && req.method === "POST") {
    try {
      const body = await readJsonBody(req, 2 * 1024 * 1024);
      return sendJson(res, 200, { ok: true, ...createProduct(body) });
    } catch (err) {
      return sendJson(res, 400, { error: err.message || "Create product failed" });
    }
  }
  if (url.pathname === "/api/admin/products" && req.method === "DELETE") {
    const deleted = deleteProduct(url.searchParams.get("slug"));
    if (!deleted) return sendJson(res, 404, { error: "Product not found" });
    return sendJson(res, 200, { ok: true, product: deleted });
  }
  if (url.pathname === "/api/admin/categories" && req.method === "PUT") {
    const body = await readJsonBody(req, 2 * 1024 * 1024);
    return sendJson(res, 200, { ok: true, categories: saveCategories(body) });
  }
  if (url.pathname === "/api/admin/product-editor" && req.method === "GET") {
    return sendJson(res, 200, productEditorData(url.searchParams.get("slug")));
  }
  if (url.pathname === "/api/admin/product-editor" && req.method === "PUT") {
    const body = await readJsonBody(req, 5 * 1024 * 1024);
    const saved = saveProductEditor(body);
    if (!saved) return sendJson(res, 400, { error: "Invalid product" });
    return sendJson(res, 200, { ok: true, product: saved });
  }
  if (url.pathname === "/api/admin/editor" && req.method === "GET") {
    return sendJson(res, 200, editorDataForPage(url.searchParams.get("page")));
  }
  if (url.pathname === "/api/admin/images" && req.method === "PUT") {
    const page = adminPageFile(url.searchParams.get("page"));
    const body = await readJsonBody(req, 3 * 1024 * 1024);
    const current = readJson(IMAGES_FILE, []);
    writeJson(IMAGES_FILE, mergePageItems(page, current, body));
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === "/api/admin/blocks" && req.method === "PUT") {
    const page = adminPageFile(url.searchParams.get("page"));
    const body = await readJsonBody(req, 3 * 1024 * 1024);
    const current = readJson(BLOCKS_FILE, []);
    writeJson(BLOCKS_FILE, mergePageItems(page, current, body));
    return sendJson(res, 200, { ok: true });
  }
  if (url.pathname === "/api/admin/upload-image" && req.method === "POST") {
    try {
      const body = await readJsonBody(req, 120 * 1024 * 1024);
      return sendJson(res, 200, { ok: true, url: saveUploadedImage(body) });
    } catch (err) {
      return sendJson(res, 400, { error: err.message || "Upload failed" });
    }
  }
  if (url.pathname === "/api/admin/events" && req.method === "DELETE") {
    fs.writeFileSync(EVENTS_FILE, "", "utf8");
    return sendJson(res, 200, { ok: true });
  }
  return sendJson(res, 404, { error: "Not found" });
}

function serveStatic(req, res, url) {
  const filePath = safeFilePath(url.pathname);
  if (!filePath) return send(res, 400, "Bad request");
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return send(res, 404, "Not found");
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html" || filePath.endsWith("index.html")) {
    const file = path.basename(filePath);
    const html = renderHtml(file, fs.readFileSync(filePath, "utf8"));
    if (html == null) return send(res, 404, "Page disabled");
    return send(res, 200, html, { "content-type": MIME[".html"], "cache-control": "no-store" });
  }
  const headers = { "content-type": MIME[ext] || "application/octet-stream" };
  if ([".webp", ".jpg", ".jpeg", ".png", ".svg", ".css", ".js", ".woff", ".woff2"].includes(ext)) {
    headers["cache-control"] = "public, max-age=3600";
  }
  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
}

async function route(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname === "/api/track" && req.method === "POST") {
      const body = await readJsonBody(req).catch(() => ({}));
      appendEvent(req, body);
      return sendJson(res, 200, { ok: true });
    }
    if (url.pathname === "/admin" || url.pathname.startsWith("/api/admin/") || url.pathname.startsWith("/admin/")) {
      return await handleAdmin(req, res, url);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed");
    return serveStatic(req, res, url);
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: "Server error" });
  }
}

ensureData();
http.createServer(route).listen(PORT, HOST, () => {
  console.log(`LOVE site server: http://${HOST}:${PORT}/`);
  console.log(`Admin panel:       http://${HOST}:${PORT}/admin`);
  console.log(`Admin password:    ${ADMIN_PASSWORD}`);
});
