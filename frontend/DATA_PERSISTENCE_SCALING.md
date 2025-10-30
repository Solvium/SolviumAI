## Data Persistence & Scaling Implementation Plan

### Goals

- Enable HA-ready Postgres with pooled connections for serverless Next.js
- Add Redis caching for hot, non-critical reads (leaderboards, puzzles, prices)
- Prepare for read/write split (primary + read replicas)
- Outline sharding approach for future 5M+ MAU scale

### 1) Prisma Connection Pooling (PgBouncer or Prisma Accelerate)

- Option A: PgBouncer
  - Provision PgBouncer in front of Postgres (managed or self-hosted)
  - Add `DIRECT_URL` (for migrations) and use pooled `DATABASE_URL` for runtime
  - Configure minimum/maximum pool size per deployment size
  - Verify transaction mode compatibility (prefer transaction pooling)
- Option B: Prisma Accelerate
  - Enable Accelerate in Prisma Console and obtain `PRISMA_ACCELERATE_URL`
  - Update Prisma client initialization to use Accelerate for serverless
  - Keep `DIRECT_URL` for migrations

Env (example)

- DATABASE_URL: pooled (PgBouncer) or Accelerate URL
- DIRECT_URL: direct Postgres for migrations
- WALLET_DATABASE_URL: optional separate pool for wallet cache if needed

Operational checks

- Verify connection counts during load tests
- Ensure cold start safety in serverless

### 2) Redis Caching Layer

- Provider: Upstash Redis or managed Redis (low-latency, serverless friendly)
- Namespaces/keys
  - `leaderboard:top50:v1` (TTL 30–120s)
  - `puzzle:defs:v1:<level>` (TTL 1–10m, or daily key for daily words)
  - `price:near_usd:v1` (TTL 15–60s)
- Patterns
  - Cache-aside for GET endpoints; invalidate/update on writes where relevant
  - Serialize minimal payloads (JSON), version keys for schema changes
- Failure mode
  - On Redis failure: gracefully fall back to DB/API

### 3) Read/Write Split with Replicas

- Infra: Configure Postgres streaming replication (primary + read replicas)
- App
  - Writes (transactions, score updates) → primary
  - Reads (leaderboards, history) → read replicas
- Implementation options
  - Use separate Prisma clients (primary vs replica) with different URLs
  - Or a database proxy (e.g., pgbouncer/pgpool/Neon read replicas) that routes reads
- Consistency
  - Accept eventual consistency for leaderboard views
  - For immediately consistent flows, bypass cache and read from primary

### 4) Sharding (Future)

- Target tables: `WeeklyScore`, `wallet_cache`
- Strategy
  - Hash by `userId` (or `telegramUserId` for wallet cache)
  - N shards initially (e.g., 4–16), power-of-two for growth
  - Application routing layer picks shard based on hash
- Migration plan
  - Dual-write during cutover, background backfill, then flip reads
  - Maintain shard map in config or service discovery

### 5) Observability

- Metrics: DB connections, query latency, cache hit/miss, replica lag
- Logs: structured logs across API, Prisma, cache
- Dashboards and alerts (p95/p99 latency, error rates, saturation)

### 6) Rollout Steps

1. Introduce pooler (PgBouncer or Accelerate); add `DIRECT_URL`; smoke tests
2. Add Redis client + keys; cache leaderboard/price endpoints; validate TTLs
3. Add read replica URLs and route read-heavy endpoints; validate consistency
4. Load test; tune pool sizes and TTLs
5. Draft shard map and routing library (no-op until needed)

### Acceptance Criteria

- Pooled Prisma connections verified under load without exhaustion
- Leaderboard and price endpoints demonstrate >80% cache hit after warm-up
- Read-heavy endpoints use replicas with acceptable lag
- Sharding plan documented with clear cutover procedure

### Current Progress — Mini App (Frontend & API)

- Framework
  - Next.js 14 + TypeScript set up with App Router; Tailwind configured. Status: ~90%.
- Data/ORM
  - Prisma schema and migrations are extensive and current; Prisma Client integrated. Pooling strategy documented here; production pooler not confirmed in code. Status: ~70%.
- API Routes
  - ~27 API route files present under `src/app/api`. Core endpoints exist; read replica routing/caching not yet wired. Status: ~70%.
- Games
  - Wheel of Fortune: implemented via dynamic import of `react-custom-roulette`; functional UI. Status: ~70%.
  - Wordle: UI and guess feedback logic implemented; daily word served via `/api/words/get-word`. Status: ~70%.
  - PicturePuzzle: Canvas-based Headbreaker implementation is the active renderer; alternate SVG path generator exists. Status: ~60%.
  - Quiz: Component uses local question set; AI-backed question fetch integration pending. Status: ~40%.
- Wallet/Blockchain
  - `near-api` usage present; `PrivateKeyWalletContext` and `WalletPage` implemented for keypair and signing flows. Multi-provider RPC failover is not wired on the frontend. Status: ~60%.
- Caching
  - Redis strategy defined in this doc; frontend/API usage for leaderboards/puzzle defs not yet implemented. Status: ~20%.
- Testing/QA
  - Jest config and test setup present; Playwright config and initial e2e smoke spec added. Coverage targets not enforced yet. Status: ~35%.
- Observability
  - No frontend tracing/metrics wiring documented; basic logging only. Status: ~10%.
- Performance
  - Tailwind and dynamic imports used; no bundle budget/CDN tuning documented. Status: ~20%.
- Security
  - Context-based auth/wallet flows exist; CSP/security headers and key handling hardening not documented here. Status: ~30%.
- CI/CD
  - Frontend-specific pipelines not documented in this file; status unknown. Status: ~20%.

### 2.1 Deployment Strategy — MINI APP (Frontend)

- Framework & Runtime

  - Next.js 14 (App Router) + TypeScript with Tailwind.
  - Dev server runs on port 6001 (`npm run dev`); production uses `next start`.
  - Webpack: SVG via SVGR; chunk splitting with a shared `commons` chunk.
  - `staticPageGenerationTimeout: 120`.

- HTTP Security & CORS

  - Global headers from `next.config.mjs`:
    - CSP: `default-src 'self'`; Google/Telegram allowed for scripts/styles; `img-src` includes `data:`/`blob:`.
    - CORS: `Access-Control-Allow-Origin: *`; methods `GET, POST, PUT, DELETE, OPTIONS`; headers `Content-Type, Authorization`.
  - Cookies use `secure` in production in auth routes.

- Environment Variables (from code usage)

  - Database/Prisma: `DATABASE_URL`, `DIRECT_URL`, `PRISMA_ACCELERATE_URL`, `WALLET_DATABASE_URL`.
  - Auth/JWT: `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.
  - Google: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
  - Telegram: `NEXT_PUBLIC_TELEGRAM_BOT_TOKEN`, `NEXT_PUBLIC_TELEGRAM_CHAT_ID`, `TG_BOT_TOKEN`, `PROD_URL`, `TEST_URL`.
  - NEAR: `NEXT_PUBLIC_CONTRACT_ID`, `NEXT_PUBLIC_NEAR_NETWORK_ID`, `NEXT_PUBLIC_NEARBLOCKS_API_KEY`, `NEARBLOCKS_API_KEY`.
  - Solana: `SOLANA_RPC_URL`, `WALLET_KEY`.
  - AI/External APIs: `GEMINI_API_KEY`, `SOLVIUM_API_KEY`, `NEXT_PUBLIC_API_NINJAS_KEY`, `NEXT_PUBLIC_WORDNIK_KEY`.
  - Wordle: `WORDLE_HARD_MODE`, `WORDLE_WORD_LEN`, `WORDLE_SECRET`.

- Build & Start

  - Build: `npm run build` → `prisma generate && next build`.
  - Start: `npm run start` → `next start`.
  - Prisma Client selects `PRISMA_ACCELERATE_URL` or `DATABASE_URL` at runtime; `DIRECT_URL` is defined in Prisma datasource.

- Testing/QA

  - Unit/integration: Jest + Testing Library; setup at `test/setupTests.ts`.
  - E2E: Playwright with `webServer` auto-starting dev server on `http://localhost:6001` and Chromium/WebKit projects.

- Database

  - Prisma models target PostgreSQL; `datasource db` configured with `DATABASE_URL` and `DIRECT_URL`.
  - Wallet cache stored in `wallet_cache` table; game and profile models are extensive (leaderboards, wordle, multiplayer).
