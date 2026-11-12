# Data Dictionary

V1.2 defines the initial PostgreSQL schema and deterministic seed data. The seed data in `data/seed/schools_seed.csv` is synthetic and simplified; it is useful for local development and tests, but it is not an official dataset.

## General Rules

- Missing values are stored as `NULL`, not `0`, unless zero is the real value.
- Rates are stored as decimals from `0` to `1`.
- Dollar amounts are stored as whole-dollar integers.
- School records include `source_name`, `source_year`, `data_version`, `imported_at`, and `refreshed_at`; legacy V1 seed rows default to `synthetic_v1_seed`, `2026`, and `v1_seed`.
- Tables with user-owned or mutable data include `created_at`; most also include `updated_at`.

## Tables

### `schools`

Canonical institution identity and search fields.

Key fields: `id`, `unitid`, `name`, `city`, `state`, `region`, `type`, `setting`, `undergraduate_enrollment`, `acceptance_rate`, `latitude`, `longitude`, `source_name`, `source_year`, `data_version`, `imported_at`, `refreshed_at`, `created_at`, `updated_at`.

Indexes: `state`, `region`, `type`, `setting`, `undergraduate_enrollment`, `acceptance_rate`.

### `school_academics`

One row per school for academic attributes.

Key fields: `school_id`, `top_majors` (the three largest program families), `majors_offered` (every family with graduates, used to tell "not offered" from "smaller"), `graduation_rate`, `retention_rate`, `student_faculty_ratio`, `created_at`.

Index: `graduation_rate`.

### `school_costs`

One row per school for tuition and affordability fields.

Key fields: `school_id`, `tuition_in_state`, `tuition_out_state`, `net_price`, `average_aid`, `debt_median`, `created_at`.

Indexes: `tuition_in_state`, `tuition_out_state`, `net_price`.

### `school_outcomes`

One row per school for early outcome metrics.

Key fields: `school_id`, `median_earnings`, `repayment_rate`, `created_at`.

### `school_campus_life`

One row per school for campus-life attributes.

Key fields: `school_id`, `housing_available`, `sports_division`, `greek_life_rate`, `culture_tags`, `created_at`.

### `school_embeddings`

V2.2 pgvector storage for generated school search document embeddings, read by similar-school discovery. Semantic search stopped reading it in `RANKING_VERSION` v1.3 and scores the same documents with Postgres full-text search, which stores nothing. Rows are metadata-versioned so embedding providers or document construction can change without silently reusing stale vectors.

Key fields: `school_id`, `embedding_type`, `embedding_model`, `vector`, `text_snapshot_hash`, `created_at`, `refreshed_at`.

Primary key: `school_id`, `embedding_type`, `embedding_model`.

Indexes: `embedding_type`/`embedding_model`, cosine `ivfflat` pgvector index on `vector`.

Current embedding type: `school_search_document`.

Current local/test embedding model: `local-hash-embedding-v1`.

The search document text (`DOCUMENT_VERSION` v3.0) is generated from structured school fields only: name, city, full state name, region, type and setting, top majors, culture tags, and the athletics division spelled out. It deliberately omits raw numbers and any label or source line that would repeat across every school, because shared text makes every document match the same query words. Changing the document changes `text_snapshot_hash`, so embeddings must be refreshed. Generated vectors are not source-of-truth facts and should not be committed as large data files.

### `users`

Basic placeholder user identity table for future saved-school and comparison work.

Key fields: `id`, `email`, `display_name`, `auth_provider`, `created_at`, `updated_at`.

### `user_preferences`

Basic placeholder table for future persisted onboarding preferences. The V1 ranking engine is implemented in the backend service layer and currently consumes request-body preferences or browser-local onboarding state rather than this table.

Key fields: `id`, `user_id`, `intended_major`, `home_state`, `max_annual_cost`, `weights`, `constraints`, `created_at`, `updated_at`.

### `saved_schools`

User-owned saved school list entries.

Key fields: `id`, `user_id`, `school_id`, `status`, `notes`, `created_at`, `updated_at`.

Constraint: one saved-school row per user and school. Status is constrained to `interested`, `applying`, `accepted`, `finalist`, or `removed`.

### `comparisons`

User-owned comparison session metadata.

Key fields: `id`, `user_id`, `name`, `created_at`, `updated_at`.

### `comparison_schools`

Join table that keeps comparison school selections normalized.

Key fields: `comparison_id`, `school_id`, `position`, `created_at`.

Constraint: `position` must be from `1` to `5`.

### `acceptance_offers`

User-owned accepted/finalist decision workspace entries. These capture offer-level inputs and notes without replacing canonical school cost/outcome facts.

Key fields: `id`, `user_id`, `school_id`, `status`, `aid_offer`, `scholarships`, `estimated_yearly_cost`, `visit_notes`, `unresolved_concerns`, `parent_priority_notes`, `student_priority_notes`, `created_at`, `updated_at`.

Constraint: one offer row per user and school. Status is constrained to `accepted` or `finalist`. Financial fields are nonnegative whole-dollar annual amounts when present.

### `decision_summary_snapshots`

Report-ready JSON snapshots produced by `POST /decision/report`. V2.7 snapshots include recommendation cards, finalist ranking rows, category scores, cost/value comparison, sensitivity highlights, unresolved questions, confidence flags, methodology notes, and disclaimer text. Snapshots preserve a deterministic summary at generation time so later export/share workflows can be added without recomputing from changed inputs.

Key fields: `id`, `user_id`, `summary_version`, `school_ids`, `summary`, `created_at`.

### `events`

Privacy-safe analytics/event table for V2.8 product telemetry and ranking evaluation.

Key fields: `id`, `user_id`, `event_name`, `entity_type`, `entity_id`, `metadata`, `created_at`.

Indexes: `user_id`, `event_name`, `created_at`.

Supported V2.8 event names include `search_performed`, `semantic_search_performed`, `school_profile_viewed`, `school_saved`, `school_compared`, `onboarding_completed`, `ranking_generated`, `sensitivity_adjusted`, and `decision_report_generated`.

The `metadata` JSON is sanitized before storage. It may contain structured fields such as enabled filter keys, result counts, rank position, fit score, confidence score, reason codes, normalized category weights, report version, and ranking version. It must not store raw search text, user notes, emails, aid offers, scholarships, estimated yearly costs, loan amounts, or other sensitive free-form student details.

## V2.1 Ingestion Fields

The V2.1 ingestion pipeline writes product-ready school seed CSVs with the same school, academic, cost, outcome, and campus-life columns used by `scripts/seed_database.py`, plus source metadata.

| Field | Meaning |
| --- | --- |
| `source_name` | Human-readable dataset/source label, such as `public_college_snapshot` or a local fixture name. |
| `source_year` | Reporting year for the source snapshot. |
| `data_version` | Deterministic operator-supplied version string for the ingested snapshot. |
| `imported_at` | Timestamp attached when raw data is normalized/imported. |
| `refreshed_at` | Timestamp attached when the refresh command regenerates product-ready output. |

Validation warnings call out unavailable ranking inputs so missing data lowers confidence in downstream scoring instead of silently distorting fit scores.

## V3.0 College Scorecard Snapshot

Real data is fetched by `apps/api/scripts/fetch_scorecard.py`, which writes the raw CSV
that `ingest_college_data.py` already consumes. Normalization, validation, and
missing-value handling stay in the V2.1 pipeline.

### Selection rule

The sample is the union of two slices over the same base population, so it spans both
selective private universities and large public ones — the cost and geography spread the
ranking engine needs to produce meaningful tradeoffs.

Base population (Scorecard filters, reproducible from these alone):

| Filter | Value | Meaning |
| --- | --- | --- |
| `school.carnegie_basic` | `15,16,17` | Doctoral universities (the standard academic definition of "university") |
| `school.ownership` | `1,2` | Public or private nonprofit; for-profit excluded |
| `school.degrees_awarded.predominant` | `3` | Predominantly bachelor's-degree granting |
| `school.operating` | `1` | Currently operating |
| `school.online_only` | not `1` | Online-only institutions excluded. Applied while paging, because the API rejects this column as a filter. ASU Digital Immersion had entered the largest-enrollment slice on headcount alone, with no housing, aid, or athletics record. |

Slices, 50 each by default (`--per-slice`):

1. Most selective by latest reported admission rate, bounded to `0.01..0.40` so the slice
   only contains institutions that actually report a rate.
2. Largest by latest reported undergraduate enrollment.

No magazine or commercial ranking is used anywhere in the selection. Slice ordering uses
`latest.*` aliases because the API only permits sorting on those; that choice affects
which schools enter the sample, never the value of any displayed metric.

### Reporting years

Scorecard's `latest.*` fields can describe different years, which the official
documentation warns about. A probe across several institutions confirmed it: cost,
admissions, completion, and enrollment carry data through 2023, while median earnings and
median debt stop at 2020 and return null for later years.

The fetcher therefore pins **one explicit year per metric group for every school**, rather
than reading `latest.*`:

| Metric group | Year | Fields |
| --- | --- | --- |
| Admissions | 2023 | `acceptance_rate` |
| Student body | 2023 | `undergraduate_enrollment`, `retention_rate` |
| Cost | 2023 | `tuition_in_state`, `tuition_out_state`, `net_price` |
| Completion | 2023 | `graduation_rate` |
| Earnings | 2020 | `median_earnings` |
| Debt | 2020 | `debt_median` |
| Repayment | latest | `repayment_rate` (no explicit-year series is published) |

Because the year is uniform per group, a column never mixes vintages across schools, and
the years are dataset-level facts rather than per-row columns. Each fetch writes them to
`<output>.manifest.json` alongside the selection rule. There is deliberately no per-school
fallback to an older year: a school missing 2023 cost stays missing rather than borrowing
2022 and breaking comparability.

### IPEDS supplement

Scorecard does not publish four of the fields the ranking engine uses. The fetcher fills
them from IPEDS through the Urban Institute Education Data API (`educationdata.urban.org`,
no key required), each pinned to one explicit year:

| Column | Source endpoint | Year | Notes |
| --- | --- | --- | --- |
| `student_faculty_ratio` | `ipeds/student-faculty-ratio` | 2024 | Students per instructional faculty member. |
| `housing_available` | `ipeds/institutional-characteristics` (`oncampus_housing`) | 2023 | 2024 still carries the `-1` "not reported" code. |
| `sports_division` | `eada/institutional-characteristics` (`ath_classification_name`) | 2021 | Latest EADA year; mapped to `DI`, `DII`, `DIII`, or `NAIA`. |
| `average_aid` | `ipeds/sfa-ftft`, `type_of_aid = 3` | 2021 | Latest year; see below. |

The years live in `REPORTING_YEARS` and appear on the school profile next to each field,
because they differ from the year of the section each field sits in.

**Average grant aid** is all grant aid - federal, state, local, and institutional - and
excludes loans, since a loan does not reduce what a family pays. The population is
first-time, full-time, degree-seeking undergraduates, and the amount is the average among
students who *received* a grant, not across every student (Berkeley: $21,669 to the 52%
who received one). Sticker price minus net price is still not used as a proxy: net price
already nets living costs and covers aided students only, so that derivation would be wrong.

**Sentinel codes.** IPEDS reports missing, not-applicable, and suppressed values as `-1`,
`-2`, and `-3`. They become empty cells, never numbers. Housing is `true` only for `1` and
`false` only for `0`; any other value is unknown rather than "no".

**Athletics mapping.** EADA names such as "NCAA Division I-FBS" or "NCAA Division III
without football" map to their division. A classification of "Other" is resolved from its
free-text note, where the first division named is the primary one: Johns Hopkins files
"NCAA DIII w/FB; M/W LAX DI" and maps to `DIII`. A note with no recognisable division stays
empty rather than guessed.

**Known gaps and vintage effects.**

- Penn State (University Park) has no 2021 EADA record under its unitid, so its athletics
  division is empty rather than filled in from general knowledge.
- UC San Diego reads `DII` because it moved to Division I after the 2021 reporting year.
  The year label on the profile is what makes that legible.
- `greek_life_rate` is not published by any official source and remains unavailable.

Transient failures - timeouts, dropped connections, and 5xx responses - are retried up to
three times with a short backoff, because a single read timeout once killed a full refresh
that succeeded moments later. Client errors are not retried. If an IPEDS request still
fails, the whole fetch stops: writing Scorecard rows with silently empty IPEDS columns
would look like a real data regression, so a partial snapshot is never produced.

`top_majors` is derived from `latest.academics.program_percentage.*`, taking the three
largest program shares, and `majors_offered` keeps every family with a share above zero.
Both are stored sorted by name. Until data version `scorecard-2023.4` the fetcher asked for
`program_percentage.biology`, but the field is `biological`, so Biology was missing from
every school; `parks_recreation` had the same problem, and 14 smaller families were never
requested. 42 of 92 schools had the wrong top three (Biology is a top-three program at 35).
The fetcher now requests every family and stops if any requested program field is absent
from every school, instead of producing a silently incomplete snapshot.

`scorecard-2023.4` was produced with `--unitids-from data/seed/schools_seed.csv`, which
refreshes exactly the current schools by UNITID instead of re-running selection: selection
sorts on `latest.*` values that move between Scorecard releases, so a plain refresh could
swap schools in or out. Apart from the two majors columns, every value is byte-identical to
`scorecard-2023.3`. `culture_tags` is derived only from reported structural fields
(ownership, locale, enrollment band, research classification) — no invented descriptors.
The research tag (`very-high-research`, Carnegie Basic 15) was silently absent from every
school until data version `scorecard-2023.3`: the fetcher read `school.carnegie_basic` but
never requested it from the API. It now appears on 75 of the 92 schools, and every field the
fetcher reads is listed in one `REQUESTED_FIELDS` constant.

## Placeholder vs. Real Data

- V1.2 school records were synthetic fixtures with plausible ranges. V3.0 replaces them
  with real College Scorecard data; the synthetic generator is retained only as a test
  fixture so tests never depend on the network.
- V2.1 includes small public-data-style fixtures for pipeline tests, not full official datasets.
- User, preference, saved-school, comparison, and decision tables are structural placeholders until full authenticated account persistence and privacy controls are implemented. Event analytics are implemented for V2.8 local/demo evaluation, but production retention, consent, access control, and deletion workflows belong to V3.
- Full official College Scorecard/IPEDS snapshot operations, similar-school discovery, and data freshness UI belong to later tasks.

## Campus map coordinate bundle

`apps/web/data/campus-coordinates.json` contains only `unitid`, `name`, `lat`, `lng`
from the existing `data/seed/schools_seed.csv` snapshot (latitude/longitude). No new
school facts or external geocoding are introduced. The UI joins by exact school name
to the current search API's school IDs; missing coordinates are omitted from the map
and counted in the page note. Run `python apps/web/scripts/generate-campus-coordinates.py`
from the repo root after changing the seed snapshot. The bundle is public data, not a
record of student locations.
