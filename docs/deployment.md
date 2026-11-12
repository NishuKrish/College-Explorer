# Deployment

The repository runs locally through Docker Compose and deploys publicly (V3.3) to Vercel, AWS Lambda, Neon, and Upstash. The production configuration is committed, but no public deployment has been verified yet. Check each step of the runbook below off on the first deploy.

## Local Environments

### Service-only local development

Use this path when actively editing the backend or frontend from the host machine:

```powershell
Copy-Item .env.example .env
docker compose up -d postgres redis
```

Then start the API and frontend from separate terminals:

```powershell
.\.venv\Scripts\activate
cd apps/api
alembic upgrade head
python scripts/seed_database.py --reset
uvicorn main:app --reload
```

```powershell
cd apps/web
npm run dev
```

Startup order: PostgreSQL and Redis first, migrations second, seed data third, API fourth, frontend last.

On Windows, point `DATABASE_URL` at `127.0.0.1` rather than `localhost`. Over `localhost` the connection goes through Docker's IPv6 port proxy, and semantic search's larger statements measured about ten times slower.

### Full Docker local startup

Use this path to validate container packaging:

```powershell
docker compose up --build
```

Compose starts:

- `web`: Next.js standalone production server on `http://localhost:3000`.
- `api`: FastAPI container on `http://localhost:8000`.
- `postgres`: PostgreSQL 16 with pgvector support on port `5432`.
- `redis`: Redis 7 on port `6379`.

The API container runs Alembic migrations on startup. It does not reset or seed data automatically, because automatic destructive seed resets are unsafe for shared environments. Seed manually when needed:

```powershell
docker compose exec api python scripts/seed_database.py --reset
```

## Environment Variables

| Variable | Environment | Required in production | Notes |
| --- | --- | --- | --- |
| `APP_ENV` | API | Yes | `production` on Lambda (set by the template). |
| `DATABASE_URL` | API, migrations, seed script | Yes | SQLAlchemy URL: `postgresql+psycopg://...`. Use secret storage. |
| `NEXT_PUBLIC_API_BASE_URL` | Web | Yes | Public browser-facing API URL. Read at build time. |
| `CORS_ORIGINS` | API | Yes | Comma-separated frontend origins. Keep narrow in production. |
| `REDIS_URL` | API | Recommended | Redis URL for caching and rate limiting. |
| `REDIS_ENABLED` | API | No | `false` when Redis is not available. |
| `ANALYTICS_API_TOKEN` | API | No | Without it, `/analytics/summary` is closed outside development. |
| `CACHE_KEY_VERSION` | API | No | Bump to invalidate cache namespace. |
| `CACHE_SEARCH_TTL_SECONDS` | API | No | Defaults to `300`. |
| `CACHE_PROFILE_TTL_SECONDS` | API | No | Defaults to `3600`. |
| `CACHE_RANKING_TTL_SECONDS` | API | No | Defaults to `300`. |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Docker local | No | Local container defaults only. Do not reuse local password in production. |

Secrets come from provider environment settings (Lambda, Vercel) and are never committed. `.env` and `samconfig.toml` are gitignored.

## Production: Vercel + AWS Lambda + Neon + Upstash

Sized to cost about nothing at demo traffic. As of 2026-09-12:

| Piece | Service | What keeps it free |
| --- | --- | --- |
| Web | Vercel Hobby | Free for personal projects. |
| API | AWS Lambda, container image, function URL | Always-free allowance: 1M requests and 400,000 GB-seconds a month. The image in ECR costs a few cents a month. |
| PostgreSQL | Neon free plan | Scales to zero when idle. Supports pgvector. |
| Redis (optional) | Upstash free plan | Pay-per-request with a free daily allowance. |

Put everything in one region: AWS `us-east-1`, Neon's AWS US East 1, and Upstash `us-east-1`.

Two costs to avoid on AWS: NAT gateways and public IPv4 addresses. Neither is used here, because the function reaches Neon and Upstash over the internet without a VPC.

### 1. Database (Neon)

1. Create a project in AWS US East 1 with Postgres 16, which matches local development.
2. Copy the direct (non-pooled) connection string. Change the scheme to `postgresql+psycopg://` and keep `sslmode=require`. At this demo's concurrency the pooler adds nothing.
3. Load the schema and data from your machine:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://USER:PASSWORD@HOST/neondb?sslmode=require"
cd apps/api
alembic upgrade head
python scripts/seed_database.py
python scripts/refresh_embeddings.py
Remove-Item Env:DATABASE_URL
```

`refresh_embeddings.py` writes the vectors that similar-school discovery reads. Semantic search needs nothing stored.

### 2. Redis (Upstash, optional)

Create a Redis database in `us-east-1` and copy its `rediss://` URL. Without Redis the API still works: caching is off, and rate limiting fails open. In that case the Lambda concurrency limit is the only cap on abuse.

### 3. API (AWS Lambda)

Prerequisites:

- An AWS account.
- AWS CLI v2 and the AWS SAM CLI.
- Docker running.
- Deploy credentials from IAM Identity Center (`aws configure sso`) or an IAM user. Never root access keys.

```powershell
sam build --template-file infra/aws/template.yaml
sam deploy --guided --resolve-image-repos
```

The guided deploy asks for a stack name (for example `college-exploration-api`), the region, and these parameters:

| Parameter | Value |
| --- | --- |
| `DatabaseUrl` | The Neon URL from step 1. |
| `RedisUrl` | The Upstash URL, or empty. |
| `CorsOrigins` | The Vercel production URL from step 4. Deploy once with a placeholder, then update. |
| `AnalyticsApiToken` | Empty unless you want `/analytics` reachable. |
| `BudgetEmail` | Where the cost alert goes. |
| `MonthlyBudgetUsd` | `1` is the default. The alert covers the whole account, not only this stack. |
| `ReservedConcurrency` | `0` on new accounts. Their 10-execution quota already caps the function, and Lambda refuses reservations there. On a 1,000-execution account, use `5`. |

Allow SAM to create the image repository and save the arguments. The stack output `ApiUrl` is the public API URL.

To redeploy after code changes, run `sam build --template-file infra/aws/template.yaml`, then `sam deploy`. Both reuse the saved arguments. Every deploy pushes a new image to the SAM-managed ECR repository, so delete old images now and then.

How the image runs on Lambda: `apps/api/Dockerfile` copies in the AWS Lambda Web Adapter. On Lambda the adapter starts the normal `uvicorn` server and forwards function URL requests to it, and it waits on `/health` before sending traffic. Outside Lambda the adapter does nothing, so Docker Compose uses the identical image. Migrations are not run on start. Run them from your machine, as in step 1, before deploying code that needs them.

### 4. Web (Vercel)

1. Import the repository and set the root directory to `apps/web`. The Next.js defaults (`npm ci`, `npm run build`) apply.
2. Set `NEXT_PUBLIC_API_BASE_URL` to the `ApiUrl` output; a trailing slash is fine. The value is compiled in at build time, so redeploy the web app after changing it.
3. Put the Vercel production URL (`https://<project>.vercel.app`) into `CorsOrigins` and run `sam deploy` again. Preview deployments get other hostnames and are blocked by CORS, which is intended.

### 5. Verify

- `curl.exe <ApiUrl>health` returns `"environment": "production"`, and `curl.exe <ApiUrl>ready` returns `"database": "ok"`.
- Complete the journey (onboarding, search, a profile, compare, decision report) on a phone.
- The AWS Budgets console lists the budget.
- Leave everything idle for 10 minutes, then check that Neon reports the compute as idle. `db/session.py` already uses `NullPool` when `AWS_LAMBDA_FUNCTION_NAME` is set, so idle Lambda containers hold no connections; if the compute stays active, look for another client.
- Measure the first request after 15 idle minutes (cold start) and a warm request. Record both numbers here; do not estimate them.

## Production Safety Rules

- Keep `CORS_ORIGINS` narrow; do not use wildcard CORS for production.
- Do not commit secrets or real student data.
- Do not reset or reseed production databases.
- Treat missing school data as unknown, not zero.
- Do not claim uptime, p95 latency, cache hit rate, user counts, or database reduction until measured in the deployed environment.

## CI

GitHub Actions currently validates:

- Frontend dependency install with `npm ci`.
- Frontend lint with `npm run lint`.
- Frontend typecheck with `npm run typecheck`.
- Frontend production build with `npm run build`.
- Playwright smoke tests with Chromium.
- Backend dependency install and `pytest`.
- Docker Compose syntax with `docker compose config`.

Deploys are manual (`sam deploy`, Vercel's Git integration). A CI deploy job would also be the place to stamp the commit onto `/health`.

## Current Limitations

- No public deployment has been verified; the runbook above has not been run end to end.
- No custom domain; the API is served from the Lambda function URL hostname.
- No production observability beyond CloudWatch logs (14-day retention).
- No load testing or production latency baseline exists yet.

## Railway (single-project deployment)

The Railway API and web service settings are configured directly in Railway.
Config as Code is deprecated by the current Railway API; do not select the legacy
JSON configuration files under `infra/railway`. Keep the repository root as the
source root for both app services. Set the API Dockerfile to `apps/api/Dockerfile`
and the web Dockerfile to `apps/web/Dockerfile`. The builds need the full repository
context. API healthcheck: `/ready`; web healthcheck: `/`; restart on failure with
5 retries. Set `PORT=8000` on API and `PORT=3000` on web.

Create four services in one region:

- PostgreSQL 16 using a pgvector-enabled image (`pgvector/pgvector:pg16`), persistent
  storage at `/var/lib/postgresql/data`, and strong database credentials. Configure
  `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`. Keep the database private.
- Redis with persistent storage as appropriate; keep it private.
- API built from this GitHub repository using the API config.
- Web built from the same repository using the web config.

API variables:

- `APP_ENV=production`
- `PORT=8000` (the existing Dockerfile listens on 8000)
- `DATABASE_URL=postgresql+psycopg://USER:PASSWORD@PRIVATE_HOST:5432/DATABASE`;
  construct with service references, not copied credentials. URL-encode credential
  components if needed.
- `REDIS_URL` referencing the Redis private URL, and `REDIS_ENABLED=true`.
- `CORS_ORIGINS` set to the exact web HTTPS origin; no trailing slash or wildcard.
- Leave `ANALYTICS_API_TOKEN` unset to keep the analytics summary closed.

Set the API pre-deploy command to `alembic upgrade head`. For the initial empty
school database, temporarily use:

```sh
sh -c 'alembic upgrade head && python scripts/seed_database.py --if-empty && python scripts/refresh_embeddings.py'
```

After initialization succeeds, restore `alembic upgrade head` in Railway service
settings. Never use `--reset`
on the deployed database. Generate an API domain targeting port 8000.

Web variables:

- `PORT=3000`
- `NEXT_PUBLIC_API_BASE_URL=https://<generated-api-domain>`

The API URL is a build argument; rebuild the web service after changing it. Generate
the web domain targeting port 3000, then update the API CORS origin and redeploy it.
The web image includes `public/` for the locally hosted Hind font and UCLA photo.

Verify API `/health` and `/ready`, all key user journeys on desktop and mobile,
and the actual photo/font HTTP responses. Configure persistent-volume backups,
restore procedures, and usage alerts in Railway before public launch. These have
not been configured by committing the deployment files. Saved schools and offers
remain browser-local; deployment does not introduce user accounts.


### Verified Railway deployment

- Project: https://railway.com/project/34afc48c-5609-478c-870f-807814d713f1
- Source: https://github.com/NishuKrish/College-Explorer (main)
- Frontend: https://web-production-6e40e160.up.railway.app
- API: https://api-production-157aff17.up.railway.app
- PostgreSQL: `pgvector/pgvector:pg16`, private network, persistent volume.
- Redis: Railway Redis template, private network, persistent volume.

Both app deployments passed healthchecks. The first API deployment ran every
migration, seeded 92 schools, and refreshed their similarity embeddings. The API
pre-deploy setting is now only `alembic upgrade head`. API deploys watch
`/apps/api/**` and `/data/seed/**`; web deploys watch `/apps/web/**`.

Live verification covered health/readiness, search, school profiles, similar
schools, deterministic ranking, full-text search, cost calculations, sensitivity,
decision reports, CORS and the disabled analytics summary. Browser verification
covered real search results, saving, comparison, cost calculation and printable
report generation. Hind and the UCLA image loaded. The mobile homepage was checked
at 390px without horizontal overflow. The first browser calculator request had a
transient connection failure; retry succeeded. No uptime or load claims are made.

The workspace currently uses a Railway trial. A paid plan will be needed when its
trial allowance ends to keep services running. No paid plan, automatic database
backup schedule, or spending alert was configured as part of this deployment.
Saved schools/offers remain browser-local. Public deployment does not add accounts.

## Optional Groq counselor

Set API-service variables `COUNSELOR_ENABLED=true`, `GROQ_API_KEY` (secret), `COUNSELOR_MODEL=openai/gpt-oss-120b`, and optionally `COUNSELOR_DAILY_LIMIT=100`. The only other allowed model is `openai/gpt-oss-20b`. Never use a NEXT_PUBLIC secret. Redeploy the API after updating variables. Redis must be available: counselor usage limiting fails closed even when normal read endpoints can work without Redis. No migrations or model downloads are needed.

The model runs on Groq's free plan, subject to account token/request limits and availability. Railway hosting remains separately billable. Each turn uses at most two model requests. The app additionally caps six requests/minute per hashed connection identity and 100 requests/day globally by default; no paid fallback. Status reports configuration only; verify a synthetic chat to test the actual provider. Account billing, retention and Zero Data Retention settings are managed in Groq. Rotate any key shared through chat and replace the Railway secret; do not commit credentials.

Corresponding source and AGPL notices must remain available when hosting modifications of the adapted counselor. Docker images include license/attribution files. See NOTICE for upstream revision and preserved references.

Counselor verified live on 2026-11-11: Groq GPT-OSS returned UCLA snapshot net price with a school-profile source and responded to a synthetic essay with no school-tool calls. Browser consent, mode selection and essay submission were exercised. Both API and web passed Railway healthchecks. A college-name punctuation/alias fallback was added after the first live test missed UCLA. These are smoke checks, not a comprehensive model-quality evaluation.

## Planning tools and campus map

The planning/writing/map features need no additional backend service, paid API key,
model, database migration or environment variable. Standard open-source Tiptap,
FullCalendar, jsdiff and Leaflet packages are included by the web Docker build.
Public campus coordinates are bundled from the existing seed snapshot. OpenStreetMap
tiles load directly from the student's browser only after Load interactive map;
retain visible attribution and observe the tile provider's usage policy. High-traffic
map deployments should select a suitable tile provider instead of assuming unlimited
public tile capacity. Application deadlines are student-entered, not scraped or AI-generated.

Run `npm run test:planner`, `npm run lint`, `npm run typecheck` and `npm run build` in
`apps/web`. Browser smoke checks should cover shortlist-to-planner flow, task/date
persistence after refresh, calendar event navigation, essay word count/comparison,
explicit save/load/download behavior, and map filtering/loading. Next.js was updated
within v15 to the patched 15.5.29 release after a runtime dependency audit.
