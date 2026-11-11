# College Exploration Platform Task Tracker

Legend: `[ ]` not started, `[~]` in progress, `[x]` complete.

## V1: Production-Quality MVP

- [x] V1.1 Repo foundation and documentation
  - Monorepo directories, foundation docs, root agent instructions, environment example, and CI skeleton are in place.
  - Validation is limited to manual structure checks because no app runtime exists yet.
- [x] V1.2 Database schema and seed data
  - Added Docker Compose PostgreSQL, Alembic initial schema, search indexes, deterministic synthetic seed data, seed loader, and data dictionary.
  - Local execution depends on Docker and Python tooling being available.
- [x] V1.3 FastAPI foundation
  - Added FastAPI app factory, health/readiness endpoints, Pydantic settings, SQLAlchemy session wiring, ORM models, schemas, repository/service placeholders, structured logging, error handlers, and pytest health coverage.
- [x] V1.4 Structured search API
  - Added `/schools/search` with typed filters, range validation, sorting, pagination, SQLAlchemy repository query, query timing logs, response placeholders for future ranking, and endpoint tests.
  - Runtime validation and `.venv` creation still need a shell with Python available on PATH.
- [x] V1.5 School profile API
  - Added `/schools/{id}` full profile responses composed from core, academic, cost, outcome, and campus-life tables.
  - Added explicit missing-data metadata, completeness confidence scoring, 404 handling, tests, and API/README documentation.
- [x] V1.6 Next.js frontend foundation
  - Added a Next.js App Router TypeScript app, Tailwind styling foundation, route metadata/loading/error states, shadcn-compatible UI primitives, typed API client, and landing page.
  - Frontend validation uses `npm run lint` and `npm run build` from `apps/web`.
- [x] V1.7 Search UI
  - Added `/search` with URL-synced filters, sort controls, active chips, API-backed school cards, pagination, loading/empty/error states, local save/compare actions, and a compare tray.
  - Added a Playwright smoke test that loads search, applies a state filter, and verifies updated results.
- [x] V1.8 Onboarding and preference profile
  - Added `/onboarding` multi-step preference capture for academic, cost, career, location, campus, admissions, and category-weight inputs.
  - Stores a typed local `PreferenceProfile`, computes completeness, forwards supported filters to `/search`, and documents the backend/ranking integration gap.
- [x] V1.9 Deterministic ranking engine
  - Added backend deterministic ranking service, weighted category scoring, confidence, hard constraints, reason-code explanations, `POST /rankings`, tests, and scoring/API documentation.
- [x] V1.10 School profile frontend
  - Added `/schools/[id]` with typed profile fetching, metadata, loading/error states, profile sections, explicit unavailable-data handling, local save/compare integration, and Playwright smoke coverage.
- [x] V1.11 Saved schools and comparison MVP
  - Added typed browser-local saved school state with statuses, dashboard grouping, quick status updates, removal, duplicate prevention, and profile links.
  - Added typed browser-local compare state, sticky cross-page tray, 5-school limit, `/compare` workspace, deterministic metric summaries, category winners, and tradeoff summaries.
  - Persistence remains localStorage-only until auth-backed V2/V3 user persistence exists.
- [x] V1.12 Redis cache-aside
  - Cache repeated search, profile, and ranking reads with versioned keys.
- [x] V1.13 Deployment and README polish
  - Added Dockerfiles for frontend/backend, full-stack Docker Compose wiring, CORS environment configuration, CI typecheck and Docker Compose validation, deployment notes, performance notes, screenshot checklist, and recruiter-facing README polish.
  - No public hosted deployment or production performance metrics have been claimed.

## V2: Recommendation and Decision Intelligence

- [x] V2.1 Data ingestion pipeline
  - Added deterministic raw import, normalization, missing-value handling, derived attributes, validation, and seed/refresh CSV output.
  - Added source metadata fields, public-data-style fixtures, and focused ingestion tests.
  - Full local pytest validation still needs a Python 3.12 environment with project dependencies installed; dependency-light CLI and manual ingestion test validation passed.
- [x] V2.2 pgvector semantic search
  - Added pgvector embedding storage, deterministic school search documents, local/test hash embeddings, refresh CLI, semantic endpoint, hybrid retrieval with deterministic re-ranking, Redis cache keys, and focused backend tests.
  - Full migration validation against PostgreSQL still needs local Docker/Postgres because the current shell did not have system Python on PATH; `.venv` Python test validation passed for semantic-search coverage.
- [x] V2.3 Similar-school discovery
  - Added `GET /schools/{id}/similar`, semantic/fallback source-school retrieval, deterministic variant constraints, similarity scoring, cache keys, backend tests, and profile-page variant cards.
  - Frontend runtime validation still needs local Node/npm dependencies; backend validation passed in the available `.venv`.
- [x] V2.4 Acceptance decision mode
  - Added acceptance/finalist offer capture, deterministic decision reports, confidence flags for missing financial/preferences/outcomes data, backend decision endpoints, report-ready frontend workspace, and focused backend/frontend tests.
  - Full frontend runtime validation still needs Node/npm dependencies available in the shell.
- [x] V2.5 Cost/value calculator
  - Added `POST /cost-calculator`, deterministic yearly/four-year cost, debt exposure, repayment sensitivity scenarios, outcome-adjusted directional value, affordability indicators, confidence warnings, and frontend calculator surfaces in `/decision` and `/compare`.
  - Frontend runtime validation still needs Node/npm dependencies available in the shell.
- [x] V2.6 Sensitivity analysis
  - Added `POST /sensitivity`, deterministic scenario reranking through the existing ranking engine, movement/stability/volatility outputs, confidence impacts, category drivers, Redis cache support, and compare-page slider UI.
  - Full frontend runtime validation still needs Node/npm dependencies available in the shell.
- [x] V2.7 Shareable decision report
  - Expanded `POST /decision/report` into a structured briefing with top recommendation, finalist ranking table, category scores, cost/value comparison, deterministic sensitivity highlights, major tradeoffs, unresolved questions, confidence flags, methodology/disclaimer language, snapshot support, and printable/shareable frontend route.
  - Production-grade authenticated sharing, hosted URLs, and PDF generation remain V3 scope.
- [x] V2.8 Analytics and ranking evaluation
  - Added typed privacy-safe analytics events, `/analytics/events`, `/analytics/summary`, backend instrumentation for search/profile/ranking/semantic/sensitivity/report flows, frontend save/compare/onboarding/report fallback event logging, internal `/analytics` dashboard, ranking evaluation aggregations, and bias/privacy documentation.
  - Production observability, authenticated user-scoped analytics, alerting, and warehouse-style BI remain V3 scope.

## V3: Production Hardening and Portfolio Polish

Reordered 2026-09-12 against an audit of the real repo state. Rationale, evidence, and
scope decisions live in `docs/roadmap.md` — read it before starting any V3 task.

### Phase 0 - Credibility (blocking, sequential)

- [x] V3.0 Real data for the top ~100 US universities
  - 92 universities from College Scorecard, with the four fields Scorecard does not publish
    (student-faculty ratio, on-campus housing, athletics division, grant aid) filled from
    IPEDS. Every metric group is pinned to one reporting year, shown on the profile.
  - Selection excludes online-only institutions. Data version `scorecard-2023.2`.
  - Local database: re-run `seed_database.py --reset` and `refresh_embeddings.py` whenever
    Docker Desktop is up after a seed change. That is an environment step, not open work.
- [x] V3.1 Connect preferences to ranked results in the UI
- [x] V3.2 One end-to-end test covering onboarding -> ranked -> shortlist -> compare -> report
  - `apps/web/tests/journey.spec.ts` crosses the whole journey with no seeded state, plus a
    dead-end check that every stage offers a way forward. Runs in CI via the existing
    `npm run test:e2e` step. The root `tests/e2e/` directory was vestigial and has since been removed;
    playwright.config.ts points at `apps/web/tests`.
  - `apps/api/tests/test_ranking_snapshot.py` pins ranked order against the real corpus.

### Phase 1 - Make it real and public

- [~] V3.3 Public deployment (Vercel + AWS Lambda + Neon + Upstash) - config committed, not yet deployed
- [ ] V3.4 Shareable read-only decision report links
- [x] V3.5 Lock exposed surfaces: gate `/analytics`, rate-limit expensive POST endpoints, CI dependency audit

### Phase 2 - Engineering substance

- [x] V3.6 Retrieval evaluation: hash vs Postgres full-text vs sentence embeddings vs hybrid; constraints applied during retrieval
- [ ] V3.7 Measured performance under load and failure (cold/warm/Redis-down, query plans, one real optimization)
- [ ] V3.8 Trustworthy data refresh (API mode, schema-change detection, validation + anomaly diff, data-version cache invalidation)

### Phase 3 - Optional depth

- [ ] V3.9 Authentication and cross-device account persistence
- [ ] V3.10 Preference learning from forced-choice comparisons
- [ ] V3.11 Usefulness study with 5-8 real students or counselors
- [~] V3.12 Portfolio polish (reshoot GIFs with real data, demo script, honest limitations)
  - Media and README done in the 2026-10-13 review; demo video waits on V3.3.

Deprioritized with reasons in `docs/roadmap.md` section 3: admin data-quality console,
observability dashboard and alerting, field-level provenance, collaborative comments and
report versioning, formal threat model.

## Session Log

- 2026-05-09: Completed V1.1 foundation pass. Preserved the existing skeleton, added root documentation and guardrails, created `.env.example`, added non-failing CI placeholders, and kept implementation scope limited to repository foundation.
- 2026-05-09: Completed V1.2 database foundation. Added local PostgreSQL Compose config, Alembic migration, seed CSV and loader, README setup commands, and updated data dictionary.
- 2026-05-09: Completed V1.3 FastAPI foundation. Added backend app structure, health/readiness endpoints, DB session wiring, typed schema placeholders, repository/service layers, logging/error handling, tests, and API docs.
- 2026-05-09: Completed V1.4 structured search API. Added local venv/dependency docs, root requirements entrypoint, typed search endpoint, repository query composition, search tests, and API contract examples.
- 2026-05-09: Stabilized backend dependency setup for Windows. Standardized Python `>=3.12,<3.13`, relaxed wheel-friendly dependency ranges, updated install troubleshooting, and documented how to avoid native Rust/MSVC builds.
- 2026-05-09: Completed V1.5 school profile API. Added a single-query profile read across all school profile tables, structured profile schemas, missing-field tracking, completeness confidence scoring, route tests, and profile docs.
- 2026-05-09: Completed V1.6 Next.js frontend foundation. Added the App Router app, Tailwind setup, reusable UI primitives, safe API client, polished landing page, and frontend setup documentation.
- 2026-05-09: Completed V1.7 Search UI. Added API-backed structured search, shareable URL filter state, result cards, local save/compare UI, pagination, and Playwright smoke coverage.
- 2026-05-09: Completed V1.8 onboarding and preference profile. Added the local multi-step preference quiz, completeness indicator, local profile persistence, search handoff, schema docs, and Playwright smoke coverage.
- 2026-05-09: Completed V1.9 deterministic ranking engine. Added V1.0 category scoring, normalized weights, hard constraints, deterministic reasons/tradeoffs, ranked API output, backend tests, and scoring methodology docs.

- 2026-05-11: Completed V1.10 school profile frontend. Added the detail route, profile presentation sections, shared local save/compare state, dynamic metadata, profile smoke test, and docs updates. API assumption: `GET /schools/{id}` does not currently include `confidence_score` or `ranking_version`; the page uses `data_confidence_score` for data completeness and marks ranking fields unavailable.
- 2026-05-15: Completed V1.11 saved schools and comparison MVP. Added localStorage-backed saved school statuses, `/dashboard`, a cross-page compare tray, `/compare`, deterministic comparison helpers, Playwright coverage, docs updates, and `acceptance_rate` on `GET /schools/{id}` for comparison metrics.
- 2026-05-15: Completed V1.12 Redis cache-aside. Added Docker Redis support, environment-driven cache settings, centralized cache service, cache-aside reads for search/profile/ranking responses, versioned ranking keys, TTL policy documentation, hit/miss/fallback logging, and mock-backed cache tests.
- 2026-05-15: Completed V1.13 deployment and README polish. Added production-oriented Dockerfiles, full-stack Compose services, local/prod environment documentation, narrow CORS configuration, CI frontend typecheck and Compose validation, architecture diagram, screenshot checklist, honest performance notes, and a recruiter-facing README. Public cloud deployment remains unverified.
- 2026-05-20: Completed V2.1 data ingestion pipeline. Added deterministic raw import, normalization, missing-value handling, derived attributes, validation, seed/refresh CSV output, source metadata columns, fixture coverage, and ingestion usage docs.
- 2026-05-21: Completed V2.2 pgvector semantic search. Added school embedding table/migration, structured document generation, local deterministic embedding provider, refresh CLI, `POST /semantic-search`, pgvector/fallback candidate retrieval, structured hard-constraint preservation, semantic reason tags, cache keys, and tests.
- 2026-05-21: Completed V2.3 similar-school discovery. Added variant-aware similar-school API, deterministic fallback, source exclusion, Redis cache support, explainable reasons/tradeoffs, frontend profile integration with variant controls, and backend/frontend test coverage updates.
- 2026-05-21: Completed V2.4 acceptance decision mode. Added accepted/finalist offer models, `/decision/offers` and `/decision/report`, deterministic category-based decision summaries, confidence/uncertainty flags, a browser-local accepted-schools workspace with editable offer cards and report panel, and updated docs/tests.
- 2026-05-21: Completed V2.5 cost/value calculator. Added deterministic cost/value API and service, calculator schemas, backend tests for cost, aid, debt sensitivity, missing data, and validation, plus editable calculator experiences in decision and compare workflows with Playwright smoke coverage updates.
- 2026-05-21: Completed V2.6 sensitivity analysis. Added deterministic sensitivity schemas/service/route, selected-school candidate reads, scenario weight normalization, stable/volatile classification, category drivers, confidence impacts, cache keys, compare-page sliders, movement table, stability badges, backend tests, and docs updates.
- 2026-05-21: Completed V2.7 shareable decision report. Expanded the decision report contract, reused deterministic ranking/cost/sensitivity logic, added cost/value and sensitivity report sections, persisted report snapshots, added browser-local latest-report storage, built `/decision/report` printable briefing view, extended Playwright coverage, and updated docs.
- 2026-05-21: Completed V2.8 analytics and ranking evaluation. Added privacy-safe event schemas, analytics repository/service/routes, endpoint and frontend instrumentation, internal analytics dashboard, ranking evaluation metrics for fit buckets/rank positions/reason codes/confidence/version usage, tests, and documentation of limitations.

- 2026-09-12: Audited the repo against external feedback and rewrote the V3 plan into `docs/roadmap.md`. Three findings reordered it: `POST /rankings` is never called from `apps/web` so the preferences-to-ranked-results journey does not exist in the running app; all 50 seed schools are synthetic; and the semantic provider is a 64-bucket token hash rather than a learned embedding, making it strictly weaker than the already-installed Postgres full-text search. No code changed in this pass.

- 2026-09-12: V3.1 complete. `/search` now calls `POST /rankings` when "Best fit" is selected and a
  preference profile exists, so fit scores, reason codes, and tradeoffs render from the deterministic
  engine instead of always being null. The display layer already supported this - `ScorePill` and the
  reason lists were built in V1.7 and never received data - so the change was a fetch branch plus
  copy fixes, not new UI. Also: removed the onboarding handoff that copied "preferred" values into URL
  filters, because the search endpoint applies those as hard SQL filters while the ranking engine
  treats the same values as soft inputs (`constraint_enabled()` is opt-in via `strict_*`), so the two
  disagreed and the duplicate narrowing could empty the result set; deleted the dead
  `buildSearchParamsFromPreference` and its never-read `from_onboarding` flag; de-duplicated
  `humanize()` into `lib/utils.ts` instead of adding a third copy. New `ranked-search.spec.ts` covers
  ranked mode and the no-profile fallback. 12 Playwright tests, typecheck, and lint all pass.
  V3.0 remains blocked on an API key.

- 2026-09-12: V3.2 journey test added. `journey.spec.ts` walks onboarding -> ranked results ->
  shortlist -> dashboard statuses -> compare -> decision -> report while seeding no localStorage,
  so each handoff has to be produced by the previous step; it also asserts the weights captured in
  onboarding are what reach `POST /rankings`. A second test checks no stage is a dead end for a
  student arriving with no state. Extracted the shared fixtures out of `saved-compare.spec.ts` into
  `tests/fixtures.ts` rather than copying ~100 lines of mocks (that spec dropped from 269 to 129
  lines). Raised the journey timeout to 180s: six dev-server routes compile on first hit and the
  30s default is sized for single-page specs. 14 Playwright tests, typecheck, and lint pass.
  CI needed no change - `npm run test:e2e` already runs the whole directory.

- 2026-09-12: V3.5 complete. Added a Redis-backed fixed-window rate limiter on every
  compute-heavy POST endpoint plus both analytics routes, gated `GET /analytics/summary`
  behind `ANALYTICS_API_TOKEN` (open in development, 503 when unset in a deployed
  environment so it fails closed, constant-time token compare), added four security headers,
  and added `npm audit`/`pip-audit` gates to CI. Reused the existing cache abstraction by
  adding an atomic `incr` to the backend protocol rather than opening a second Redis client;
  the limiter fails open when Redis is down, which is a deliberate availability-over-
  enforcement tradeoff documented in docs/api-contract.md. The `/analytics` page now prompts
  the operator for the token and keeps it in localStorage instead of bundling a
  `NEXT_PUBLIC_*` secret. Caught during testing: `from __future__ import annotations` in the
  limiter module made FastAPI treat `request: Request` as a query parameter (a callable-class
  dependency has no `__globals__` for resolving stringized annotations), which would have
  422'd every rate-limited endpoint in production. 94 backend tests and 14 Playwright tests pass.

- 2026-09-12: V3.0 data landed. Fetched 92 real universities (union of the 50 most selective and
  50 largest doctoral universities, 8 overlapping) and replaced the synthetic seed. Fill rates are
  91/92 on net price, tuition, graduation, retention, earnings and repayment. Real data exposed two
  bugs: DC was missing from `STATE_REGIONS`, so Georgetown normalized to region "Unknown" and lost
  its location score (AK and HI were absent for the same reason - fixed the shared map and added a
  coverage test), and the fetcher counted the public/private net-price columns separately, making
  both look half-empty when they are alternatives. Reporting years now render on the Academics,
  Cost, and Outcomes sections so a 2023 cost figure is not silently compared against 2020 earnings.
  Confirmed the budget-as-soft-signal decision: no strict flags are set anywhere, so an over-budget
  school ranks lower rather than disappearing. 86 backend and 14 Playwright tests pass.

- 2026-09-12: Loaded the real snapshot into local Postgres and verified the stack end to end:
  search returns 92 schools, profiles carry reporting years, and rankings return real reason
  codes. Fixed on the way: `alembic upgrade head` ignored `.env` because `env.py` only honoured
  an exported `DATABASE_URL`; a native Windows PostgreSQL service owns port 5432, so the
  container publishes 5433 locally; and the first load kept the 50 synthetic rows beside the
  real ones until reseeded with the existing `--reset` flag.

- 2026-09-12: Ranking snapshot test added, finishing V3.2, and RANKING_VERSION moved to v1.1.
  Building the snapshot exposed that `build_explanations()` reported thin evidence as a
  preference mismatch: campus claimed `campus_preference_not_matched` on 65 of 92 schools with
  no campus preference stated, and location told home-state schools they had missed the
  location preference while also awarding them `location_home_state`. `tradeoff_code_for()`
  now reports `<category>_data_limited` below 0.5 confidence. Scores and order were unchanged.
  Also stopped four tests hardcoding "v1.0" where they meant the current version.

- 2026-09-12: IPEDS supplement. Student-faculty ratio (2024, 92/92), on-campus housing (2023,
  92/92), athletics division from EADA (2021, 91/92), and grant aid (2021, 92/92) now come from
  the Urban Institute Education Data API, replacing four columns that were empty for every
  school. Online-only institutions are excluded: ASU Digital Immersion had entered on headcount
  alone and UT Rio Grande Valley replaced it, cutting validation warnings from four to two.
  Added retries for transient network failures after a single read timeout killed a refresh.
  Campus preferences now separate schools: a student asking for athletics and residential life
  previously scored every school 0 on campus, and now 82 score 100 and 10 score 65. The
  earnings-focused snapshot reordered in its lower half; no scoring rule changed, so
  RANKING_VERSION stays v1.1. 96 backend and 14 Playwright tests pass. Not yet reloaded into
  local Postgres because Docker Desktop was stopped.

- 2026-09-12: V3.6 started with measurement. Committed 35 labeled queries in six gap
  categories, with relevance defined by attribute predicates, before any retrieval change.
  `evaluate_retrieval.py` runs the real semantic search service offline against the seed.
  Baseline at the production default candidate limit of 50: the fit re-rank discards more
  than half of retrieval's precision (hash 0.60 to 0.35, lexical 0.66 to 0.30), because
  `search()` orders the pool by fit and uses the semantic score only for display; filtering
  after retrieval empties filtered queries (5 of 6 for hash and 6 of 6 for lexical at limit
  10, 2 of 6 for lexical at 50), while filtering first empties none; and the 64-bucket hash
  loses to plain token overlap everywhere except world-knowledge queries, where both fail.
  Also fixed the fetcher never requesting `school.carnegie_basic`, so the research tag had
  appeared on no school; it now appears on 75. Data version `scorecard-2023.3`.

- 2026-09-12: Semantic search v1.2 (`RANKING_VERSION` v1.2, `DOCUMENT_VERSION` v3.0), chosen by
  the operator from measured options. Filters apply inside the candidate query before the
  nearest-neighbour limit, reusing `_apply_filters`; the page is ordered by relevance with fit
  breaking ties; documents drop text shared by every school and spell out states and athletics
  divisions. End-to-end P@10 at the default limit rose from 0.35 to 0.77 on the same hash
  retriever, and no filtered query returns an empty page at any limit. With no filter, the
  rebuilt vector query returns results identical to the old raw SQL. Similar-school top fives
  changed (2 to 4 of 5 differ for five sampled schools); they have no labeled evaluation yet.
  Retriever comparison at limit 50: hash 0.77, lexical 0.86, model2vec 0.86, Postgres full-text
  0.86, full-text + model2vec hybrid 0.89, lexical + model2vec hybrid 0.91. Differences among the
  last five come down to one to three queries on a 35-query set, and fusion can score below its
  best component on single queries. model2vec, installed for evaluation only, is the only
  retriever above zero on world-knowledge queries. 99 backend tests pass.

- 2026-09-12: V3.6 done. Semantic search retrieves with Postgres full-text (`RANKING_VERSION`
  v1.3), the operator's pick from the measured options. The service builds documents for every
  school the filters admit and `SchoolRepository.get_fulltext_scores` scores them in one
  statement (`unnest` over bound arrays, `ts_rank_cd` normalized to `rank / (rank + 1)`), so no
  migration, stored text, or refresh step was needed; the unused pgvector semantic query was
  deleted. End-to-end P@10 at limit 50: 0.86, from 0.77 for the hash. The harness now scores
  full-text through the real repository SQL and verifies 210 runs against the real service.
  Measured on Windows + Docker: the full-text call takes about 4 ms on `127.0.0.1` and 44 ms on
  `localhost`, where the ~16 KB statement crosses the IPv6 port proxy. `.env.example` and the
  settings default now use `127.0.0.1`. Dropped the planned four-decimal tie rounding: it
  guarded against pgvector float32 near-ties, and semantic search no longer reads pgvector.
  Similar schools still uses hash embeddings. 100 backend tests pass.

- 2026-10-13: Portfolio review council. Six reviewer seats (hiring manager, staff backend,
  frontend/UX, appsec, data science, DevOps) audited the repo; findings and their resolutions
  are in `docs/council-review.md`. Highlights: decision reports made stateless after a
  client-supplied `user_id` exposed every visitor's offers; rate limiting keyed on the
  platform-observed IP; CI now runs migrations, `alembic check`, the seed, and Postgres
  integration tests, plus OpenAPI-generated frontend types with a drift check. A fetcher
  field-name bug had hidden Biology from every school (42 of 92 had wrong top majors); data
  version `scorecard-2023.4` fixes it and adds `majors_offered`. RANKING_VERSION v1.4 stops
  missing data from acting as a score. The quiz had never sent career, campus, or interest
  answers to the API. The retrieval eval gained a held-out set and confidence intervals
  (0.79 held-out, 0.85 in-sample). `docker compose up` now seeds itself, verified from an
  empty volume. IVFFlat index dropped (migration 0005). 104 backend tests, 7 Postgres
  integration tests, and 16 Playwright tests pass.

## Planned Next Steps

Updated 2026-10-13. Ordered by dependency.

### 1. Retrieval follow-ups (after V3.6)
- Similar schools still retrieves by hash embedding and has no labeled evaluation; add one
  before changing or claiming anything about its results.
- World-knowledge queries (Ivy League, HBCU, Bay Area) score 0 with full-text. model2vec is the
  only measured arm above zero; revisit only if those queries matter to users.
- Local `.env` files created before this change still say `localhost`; switch them to
  `127.0.0.1` on Windows.

### 2. Measured performance (V3.7)
- A repeatable workload over the four heaviest endpoints; cold-cache, warm-cache, and
  Redis-down scenarios; committed query plans; one optimization with before and after
  numbers. Needs Docker running.
- Known from V3.6: full-text sends every admitted document with each query. Measure it under
  the V3.7 workload; the upgrade is a stored generated `tsvector` column with a GIN index.
- Check whether `localhost` also slows other large statements or result sets before attributing
  any V3.7 latency to the code.

### 3. Public deployment (V3.3)
- Vercel (web), AWS Lambda (API, `infra/aws/template.yaml`), Neon (Postgres + pgvector),
  Upstash (Redis, optional). Runbook in `docs/deployment.md`.
- Committed: Lambda Web Adapter in the API image, SAM template with function URL, log retention,
  cost alert, and optional concurrency cap. Not yet built as an image or deployed.
- Needs from the operator: Neon, Upstash, AWS, and Vercel accounts, and AWS credentials for
  `sam deploy`. Credentials and billing stay with the operator.
- Set `ANALYTICS_API_TOKEN` and `APP_ENV=production` so the analytics gate closes.

### 4. Portfolio polish (V3.12)
- Done in the 2026-10-13 review: media reshot from the real stack by a committed script,
  README rewritten. Remaining: a short demo script and video once a public URL exists.

### Open questions for the operator
- The "most selective" slice ranks on admission rate alone, which admits small schools with
  low reported rates: Mississippi Christian University (about 2,500 undergraduates, latest
  reported rate 29%). Tightening the rule would change the corpus, so it stays as documented.

### Deferred deliberately
- Vitest/RTL: not added. See the Stack note in CLAUDE.md.
- Accounts, preference learning, usefulness study: Phase 3, unchanged.

## Next Recommended Task

V3.7 measured performance, now that retrieval is settled and Docker is running.

## Railway deployment preparation

- [x] Add separate Railway API/web configurations using the existing Dockerfiles and health endpoints.
- [x] Include public assets in the production web image (Hind fonts and UCLA photo).
- [x] Document private database/Redis connections, initial seeding, CORS, and verification.
- [ ] Verify container builds and PostgreSQL integration tests (Docker is unavailable on this host).
- [x] Connect owner GitHub and Railway accounts, publish source, provision services, and verify deployment.
  - Live frontend: https://web-production-6e40e160.up.railway.app
  - Live API: https://api-production-157aff17.up.railway.app
  - API health/readiness, 92-school search, profiles, similarity, rankings, full-text search, cost calculator, sensitivity, reports, CORS and analytics gate verified.
  - Browser search/save/compare/calculator/report flows and 390px mobile homepage verified.
  - Both production Docker images deployed and passed Railway healthchecks. PostgreSQL integration pytest suite was not run locally.
- Validation: Python 3.12 backend suite: 117 passed, 7 database tests skipped; pip dependency check passed. Frontend ESLint passed with zero warnings using an isolated npm-ci installation. Next.js production build completed successfully before the image-component lint fix; final image change passed ESLint. Local runtime is Node 24; deployment Dockerfile pins Node 22.
