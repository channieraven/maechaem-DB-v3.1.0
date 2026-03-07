# Mae Chaem Agroforestry GIS Dashboard — v3.1.0

> **Interactive Web GIS dashboard for visualising agroforestry plots in Mae Chaem, Thailand.**
> 100 % Cloudflare-native stack — no Next.js, no OpenNext, no compatibility shims.

---

## Why this stack?

| Problem (v2.x Next.js) | Solution (v3.x Hono + React) |
|---|---|
| `node:*` polyfill errors from Next.js internals | Hono uses zero Node.js APIs — runs natively on the V8 edge |
| OpenNext adapter fragility on new CF Workers runtime | Direct `export default app` — CF Pages picks it up as `_worker.js` |
| Large server bundle (>1 MB) | Hono server is ~12 KB gzipped |
| Complex `next.config.js` Cloudflare workarounds | Single `vite.config.ts` + `wrangler.json` |

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | [Hono](https://hono.dev) + React (Vite) | Edge-first HTTP framework; smallest bundle; best DX on CF Pages |
| **Frontend** | React 18, Tailwind CSS, [MapLibre GL JS](https://maplibre.org) | Fast interactive maps; renders COG from R2 |
| **Backend/API** | Hono API (Pages `_worker.js`) | Runs in the same CF Pages deployment as the SPA |
| **Database** | [Drizzle ORM](https://orm.drizzle.team) + [Neon PostgreSQL](https://neon.tech) | Type-safe SQL; Neon is serverless-friendly |
| **DB Pooling** | [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/) | Eliminates cold-start latency; caches reads at the edge |
| **Object Storage** | Cloudflare R2 | Hosts Cloud-Optimised GeoTIFF (COG) raster tiles |
| **Auth** | [Clerk](https://clerk.com) (`@clerk/backend`) | Edge-compatible JWT verification; no Node.js crypto |

---

## Project Structure

```
maechaem-DB-v3.1.0/
├── src/
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Root component + Clerk auth guard
│   ├── styles/
│   │   └── global.css            # Tailwind directives + MapLibre overrides
│   ├── client/
│   │   ├── components/
│   │   │   ├── Map.tsx           # MapLibre GL JS map + COG/R2 raster layer
│   │   │   └── Sidebar.tsx       # Selected-plot detail panel
│   │   └── pages/
│   │       └── Dashboard.tsx     # Main GIS dashboard page
│   ├── worker/
│   │   ├── index.ts              # Hono app → Cloudflare Pages _worker.js
│   │   ├── routes/
│   │   │   └── plots.ts          # GET /api/plots, GET /api/plots/:id
│   │   └── middleware/
│   │       └── clerk.ts          # Clerk edge auth middleware
│   ├── db/
│   │   ├── schema.ts             # Drizzle ORM table definitions
│   │   └── db.ts                 # createDb() — Hyperdrive (prod) / direct URL (dev)
│   └── shared/
│       └── types.ts              # Shared TypeScript types (API contracts)
├── drizzle/
│   └── migrations/               # Generated SQL migration files
├── public/                       # Static assets
├── index.html                    # Vite HTML entry
├── vite.config.ts                # Vite build config (React + code-splitting)
├── wrangler.json                 # CF Pages config: Hyperdrive + R2 bindings
├── drizzle.config.ts             # Drizzle Kit migration config
├── tailwind.config.ts
├── postcss.config.ts
├── tsconfig.json
├── .env.example                  # Environment variable template
└── .dev.vars.example             # Wrangler local secrets template
```

---

## Prerequisites

- [Node.js](https://nodejs.org) ≥ 20
- [npm](https://npmjs.com) ≥ 10
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- A [Neon PostgreSQL](https://neon.tech) database
- A [Clerk](https://clerk.com) application
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler`)

---

## Getting Started

### 1. Clone & install dependencies

```bash
git clone https://github.com/channieraven/maechaem-DB-v3.1.0.git
cd maechaem-DB-v3.1.0
npm install
```

### 2. Configure environment variables

```bash
# For Vite dev server (React client)
cp .env.example .env

# For Wrangler Pages dev (Hono worker)
cp .dev.vars.example .dev.vars
```

Edit both files and fill in:
- `DATABASE_URL` — your Neon PostgreSQL connection string
- `CLERK_PUBLISHABLE_KEY` / `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

### 3. Set up Cloudflare Hyperdrive

```bash
# Create a Hyperdrive config pointing at your Neon database
wrangler hyperdrive create maechaem-hyperdrive \
  --connection-string="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# The command outputs a Hyperdrive ID — copy it into wrangler.json:
# "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "YOUR_HYPERDRIVE_ID" }]
```

### 4. Set up Cloudflare R2

```bash
# Create the R2 bucket for COG tiles
wrangler r2 bucket create maechaem-cog-tiles

# Upload your COG file
wrangler r2 object put maechaem-cog-tiles/landcover/maechaem_landcover_2024.tif \
  --file /path/to/your/landcover.tif
```

### 5. Run database migrations

```bash
# Generate SQL migration files from schema
npm run db:generate

# Apply migrations to Neon
npm run db:migrate

# (Optional) Open Drizzle Studio to browse data
npm run db:studio
```

### 6. Run locally

```bash
# Option A: Vite dev server only (React SPA + proxied API calls)
npm run dev
# → http://localhost:5173

# Option B: Full Cloudflare Pages simulation (Hono worker + Vite SPA)
npm run build
npm run cf:dev
# → http://localhost:8788
```

**Option B** is recommended for testing worker code (Hono routes, Hyperdrive,
R2, Clerk middleware) because it uses the real Cloudflare Workers runtime via
Miniflare under the hood.

### 7. Deploy to Cloudflare Pages

```bash
# First deployment (creates the Pages project)
npm run deploy

# Subsequent deployments
npm run deploy

# Set production secrets
wrangler pages secret put CLERK_SECRET_KEY
wrangler pages secret put DATABASE_URL   # only needed if Hyperdrive is not configured
```

---

## API Reference

All endpoints return `{ ok: true, data: ... }` on success and
`{ ok: false, error: "...", status: N }` on failure.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | None | Health check |
| `GET` | `/api/plots` | None | GeoJSON FeatureCollection of all plots |
| `GET` | `/api/plots/:id` | None | Full detail for a single plot |
| `GET` | `/api/r2/tiles/:key` | None | Proxy COG tiles from R2 (supports HTTP Range) |
| `GET` | `/api/protected/me` | Clerk | Returns authenticated user ID |

---

## How the Database Connection Works

```
Local dev                          Production (Cloudflare Pages)
─────────────────────────────      ──────────────────────────────────────────
.dev.vars → DATABASE_URL           Hyperdrive binding → connectionString
      │                                    │
      ▼                                    ▼
postgres("postgresql://...")    postgres(env.HYPERDRIVE.connectionString)
      │                                    │
      └────────────── Drizzle ORM ─────────┘
```

`createDb(env)` in `src/db/db.ts` automatically selects the correct connection:
```ts
const connectionString =
  env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;
```

Hyperdrive provides **connection pooling** and **read caching** at the edge,
so your worker never opens a raw TCP connection to Neon on every request.

---

## Resolving "Next.js on Cloudflare" Build Errors

The classic errors (`Error: Cannot find module 'node:crypto'`,
`ReferenceError: process is not defined`, etc.) occur because Next.js's
server runtime imports Node.js built-in modules that don't exist in the
Cloudflare Workers runtime.

This stack avoids them entirely:

| Root Cause | How We Avoid It |
|---|---|
| Next.js uses `node:crypto`, `node:stream`, etc. | Hono uses only Web Standard APIs (`Request`, `Response`, `Headers`) |
| OpenNext patches Next.js internals — fragile | No adapter needed; Hono exports a standard `fetch` handler |
| Next.js server bundle > 1 MB triggers CF size limits | Hono server is ~12 KB; well within the 25 MB limit |
| `next.config.js` edge runtime overrides break SSR | No SSR — pure SPA + edge API; no runtime conflicts |

---

## Development Commands

```bash
npm run dev          # Vite dev server (React SPA)
npm run build        # Production build → dist/
npm run preview      # Preview production build locally
npm run cf:dev       # Full CF Pages simulation (Wrangler)
npm run deploy       # Build + deploy to CF Pages
npm run db:generate  # Generate Drizzle migration files
npm run db:migrate   # Apply migrations to the database
npm run db:studio    # Open Drizzle Studio
npm run type-check   # TypeScript type checking (no emit)
```

---

## Folder Conventions

- `src/worker/` — Hono server code. **No browser APIs** (no `window`, `document`).
- `src/client/` — React components. **No Cloudflare bindings** (no `env.HYPERDRIVE`).
- `src/db/` — Drizzle schema + connection factory. Imported by the worker only.
- `src/shared/` — Types imported by both client and worker (API contracts).

This separation ensures the worker bundle is lean and tree-shakes cleanly.

---

## License

MIT © Mae Chaem Agroforestry Project