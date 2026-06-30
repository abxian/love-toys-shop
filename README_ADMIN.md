# LOVE Site Admin

This folder contains the static website plus a lightweight Node.js admin server.

## Start Locally

```bash
node server.js
```

Default URLs:

- Frontend: http://127.0.0.1:4173/
- Admin: http://127.0.0.1:4173/admin

Default password:

```text
admin123456
```

## Production Start

Set a stronger admin password before starting:

```bash
ADMIN_PASSWORD="change-this-password" HOST="0.0.0.0" PORT="4173" node server.js
```

The server has no external npm dependencies. Node.js 18+ is enough.

## Data Files

Admin data is stored in `admin-data/`:

- `settings.json`: Pixel code, WhatsApp link, tracking switch
- `pages.json`: Page enable/disable and SEO title/description
- `products.json`: Product metadata and product-level WhatsApp links
- `images.json`: Image replacement rules from the admin panel
- `blocks.json`: Page text block overrides from the visual editor
- `events.ndjson`: Page view and WhatsApp click events

Back up `admin-data/` before moving servers.

## What The Server Does

- Serves the existing static HTML, CSS, JS, images, fonts, and videos.
- **Strips LELO residue at request time** (see below) so the public site no longer
  loads the original brand's trackers or links back to lelo.com.
- Injects configured Pixel code into the HTML at request time.
- Injects lightweight tracking for page views and WhatsApp clicks.
- Rewrites WhatsApp buttons to the URL configured in the admin panel.
- Lets the admin panel manage pages, products, Pixel code, WhatsApp settings, and event logs.
- Lets the admin panel replace images by page, using either uploaded images or image URLs.
- Lets the admin panel edit detected page text blocks with a live preview iframe.
- Product management is organized as category -> subcategory -> product. Product editing controls the selected product page's own images, description, SKU, price, WhatsApp link, and specifications table.

Existing video files and video scripts are not rewritten by the admin system.

## LELO Residue Cleanup (automatic)

The pages were scraped from the original LELO (Drupal) site. `sanitizeLeloResidue()`
in `server.js` runs on every HTML response and:

- Removes third-party tracker `<script>` / `<iframe>` / `<link>` blocks
  (`measure.lelo.com`, Google Tag Manager + Analytics, Noibu, RequestMetrics,
  Omniconvert, BazaarVoice, Facebook pixel).
- Rewrites `www.lelo.com` links: those with a local equivalent (e.g. `/sex-toys-men`)
  point to the matching local page; the rest become `#` so visitors are never sent
  to the original brand site.
- Replaces the visible brand word `LELO` with the configured `siteName` (text only —
  asset filenames like `LELO_WEB_...webp` are left untouched).

Image CDN URLs (`assets.lelo.com`) are intentionally left in place so existing
product images keep rendering; replace them per product/page in the admin if needed.
The rule lists live at the top of the `// LELO residue cleanup` section in `server.js`.

## Product Detail Buy Box

The original product pages rendered their gallery/price/color swatches/buy button via
LELO's React app, which needed LELO's backend (`/jsonapi/...`) — so on this site the
swatches never switched the image and the React mounts were broken. `injectProductBuyBox()`
hides those broken React mounts and the dead "related products" carousel, and renders our
own buy box from admin data: image gallery + thumbnails, price, **color swatches that
switch the main image** (pure client-side, no backend), and a WhatsApp CTA.

## Currency

`settings.currency` (default **OMR**, Omani Rial) sets the currency for every price on the
site — category cards, Quick View, the product buy box, and the homepage showcase. Change
it in the admin **WhatsApp** tab. `formatMoney()` in `server.js` maps the code to a symbol
(OMR/AED/SAR/USD/EUR/…). Only the displayed currency changes; price *amounts* are the values
stored per product (edit them in 商品管理 / 展示管理).

## 展示管理 (Merchandising) Tab

A dedicated admin tab for controlling how products are displayed, without editing HTML:

- **Drag to reorder** (or use ↑/↓). Order is saved as each product's `sortOrder` and
  controls the card order on category pages.
- **★ 置顶 / pin**: featured products sort to the front of their category.
- **Bulk actions**: select products, then bulk enable/disable (上架/下架),
  bulk price change, or bulk category change.
- **首页展示位 / Homepage showcase**: pick and order products shown in a "Featured"
  grid injected above the homepage footer. It is **off until enabled** here, so the
  homepage is unchanged by default. With no products picked it falls back to pinned
  products.
