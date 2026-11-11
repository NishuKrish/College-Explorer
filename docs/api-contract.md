# API Contract

V2.8 implements process health, DB readiness, structured school search, full school profiles, deterministic rankings, Postgres full-text semantic search with deterministic fallback, similar-school discovery, acceptance decision mode, cost/value calculation, sensitivity analysis, shareable decision reports, analytics/ranking evaluation, Redis cache-aside for read-heavy API responses, CORS configuration for the browser frontend, a frontend-only local preference profile, and browser-local saved-school/comparison/report workflows. Backend preference persistence and authenticated saved schools/comparisons are not implemented yet.

## Implemented Endpoints

### `GET /health`

Process-level health check. It does not require a database connection.

Response `200`:

```json
{
  "status": "ok",
  "service": "College Exploration API",
  "environment": "development",
  "version": "0.3.0",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

### `GET /ready`

Readiness check. Executes `SELECT 1` through the SQLAlchemy database session.

Response `200`:

```json
{
  "status": "ready",
  "database": "ok",
  "timestamp": "2026-05-09T12:00:00Z"
}
```

### `GET /schools/search`

Structured school search for search-result cards. This endpoint does not return full profiles. Ranking fields are present in the response shape but are only populated by `POST /rankings`.

Query parameters:

| Name | Type | Rules |
| --- | --- | --- |
| `query` | string | Optional school-name search, max 120 chars. |
| `state` | string | Optional 2-letter state code. |
| `region` | string | Optional region, max 32 chars. |
| `type` | string | Optional school type, max 32 chars. |
| `setting` | string | Optional campus setting, max 32 chars. |
| `min_enrollment` | integer | Optional, `>= 0`. |
| `max_enrollment` | integer | Optional, `>= 0`; must be >= `min_enrollment` when both are present. |
| `min_net_price` | integer | Optional, `>= 0`. |
| `max_net_price` | integer | Optional, `>= 0`; must be >= `min_net_price` when both are present. |
| `min_acceptance_rate` | number | Optional, `0` to `1`. |
| `max_acceptance_rate` | number | Optional, `0` to `1`; must be >= `min_acceptance_rate` when both are present. |
| `min_graduation_rate` | number | Optional, `0` to `1`. |
| `max_graduation_rate` | number | Optional, `0` to `1`; must be >= `min_graduation_rate` when both are present. |
| `sort` | enum | `name`, `net_price`, `graduation_rate`, `acceptance_rate`, or `enrollment`. Defaults to `name`. |
| `direction` | enum | `asc` or `desc`. Defaults to `asc`. |
| `page` | integer | Defaults to `1`; must be `>= 1`. |
| `page_size` | integer | Defaults to `20`; must be `1` to `50`. |

Example request:

```text
GET /schools/search?state=CA&min_net_price=15000&max_net_price=40000&sort=net_price&page=1&page_size=10
```

Response `200`:

```json
{
  "results": [
    {
      "school_id": 40,
      "name": "Sun Coast State University",
      "city": "San Diego",
      "state": "CA",
      "type": "Public",
      "setting": "Urban",
      "enrollment": 27100,
      "acceptance_rate": 0.37,
      "net_price": 17600,
      "graduation_rate": 0.76,
      "fit_score": null,
      "confidence_score": null,
      "category_scores": {},
      "top_reasons": [],
      "top_tradeoffs": [],
      "ranking_version": null
    }
  ],
  "page": 1,
  "page_size": 10,
  "total_results": 3,
  "has_next": false
}
```

No-result responses use an empty `results` array with pagination metadata.

### `POST /rankings`

Ranks candidate schools against a deterministic preference profile. The endpoint fetches all data needed for V1 ranking in one joined repository query, applies optional hard constraints, computes scores in memory, sorts by `fit_score` descending, then `confidence_score` descending, then `school_id` ascending, and paginates the ranked result.

Request body:

```json
{
  "preferences": {
    "intended_major": "Computer Science",
    "home_state": "CA",
    "max_annual_cost": 30000,
    "weights": {
      "academic": 0.2,
      "cost": 0.2,
      "career": 0.18,
      "location": 0.14,
      "campus": 0.14,
      "admissions_realism": 0.14
    },
    "constraints": {
      "preferred_regions": ["West"],
      "preferred_settings": ["Urban"],
      "career_priorities": ["High earnings", "Internships"],
      "campus_preferences": ["Residential"],
      "admissions_strategy": "balanced",
      "target_acceptance_rate_min": 30,
      "strict_cost": true
    }
  },
  "filters": {
    "state": "CA",
    "page": 1,
    "page_size": 10
  }
}
```

`filters` uses the same fields and validation rules as `GET /schools/search`.

Response `200`:

```json
{
  "ranking_version": "v1.0",
  "results": [
    {
      "school_id": 40,
      "name": "Sun Coast State University",
      "city": "San Diego",
      "state": "CA",
      "type": "Public",
      "setting": "Urban",
      "enrollment": 27100,
      "acceptance_rate": 0.37,
      "net_price": 17600,
      "graduation_rate": 0.76,
      "fit_score": 87.45,
      "confidence_score": 0.94,
      "category_scores": {
        "academic": 83.5,
        "cost": 92.4,
        "career": 86.2,
        "location": 100.0,
        "campus": 91.0,
        "admissions_realism": 72.5
      },
      "top_reasons": [
        "location_preferred_state",
        "cost_within_budget",
        "campus_preferred_setting"
      ],
      "top_tradeoffs": [
        "admissions_below_acceptance_comfort"
      ],
      "ranking_version": "v1.0"
    }
  ],
  "page": 1,
  "page_size": 10,
  "total_results": 1,
  "has_next": false
}
```

Ranking response fields:

| Field | Type | Notes |
| --- | --- | --- |
| `fit_score` | number | Weighted `0` to `100` deterministic fit score. |
| `confidence_score` | number | Weighted `0` to `1` score-coverage confidence. This is separate from fit. |
| `category_scores` | object | Category scores keyed by `academic`, `cost`, `career`, `location`, `campus`, and `admissions_realism`. |
| `top_reasons` | string array | Deterministic reason codes for the strongest positive weighted signals. |
| `top_tradeoffs` | string array | Deterministic reason codes for the largest penalties or lowest-confidence signals. |
| `ranking_version` | string | Current ranking formula version, initially `v1.0`. |

Hard constraints:

- `strict_major`, `major_strict`, or `require_major` filters out schools whose known majors do not include the intended major or academic interests.
- `strict_cost`, `cost_strict`, or `require_cost` filters out schools whose known net price is above `max_annual_cost`.
- `strict_state`, `strict_region`, `strict_setting`, and `strict_school_type` make the matching preference fields required.
- `strict_constraints` may also list strict dimensions, such as `["major", "cost"]`.
- Unknown data is not treated as zero and does not count as a violation by itself.

### `POST /semantic-search`

Natural-language school search. Structured filters are applied first, inside the candidate query, so a filter cannot empty the page by excluding every nearest candidate. The endpoint then scores every remaining school with Postgres full-text search (since `RANKING_VERSION` v1.3) and keeps the best `candidate_limit`, falling back to deterministic token overlap if the full-text query fails. The deterministic ranking engine removes schools that violate hard constraints and scores the rest, and the page is ordered by query relevance with the fit order breaking ties. Relevance never overrides a hard constraint or changes a fit score. For ordering by preference fit alone, use `POST /rankings`.

Request body:

```json
{
  "query": "affordable data science schools near cities",
  "filters": {
    "setting": "Urban",
    "max_net_price": 30000,
    "page": 1,
    "page_size": 10
  },
  "preferences": {
    "intended_major": "Data Science",
    "max_annual_cost": 30000,
    "weights": {
      "academic": 0.35,
      "cost": 0.25,
      "career": 0.25,
      "campus": 0.15
    },
    "constraints": {
      "strict_cost": true
    }
  },
  "candidate_limit": 50
}
```

Request fields:

| Field | Type | Rules |
| --- | --- | --- |
| `query` | string | Required natural-language query, 3 to 240 chars. |
| `filters` | object | Optional `SearchRequest` fields from `GET /schools/search`, applied before candidate retrieval; page/page_size control the final response page. |
| `preferences` | object | Optional deterministic ranking preferences. Hard constraints remove schools before ordering, and fit breaks ties between equally relevant schools. |
| `candidate_limit` | integer | Optional count of best-matching schools passed to ranking, `1` to `200`, defaults to `50`. |

Response `200`:

```json
{
  "ranking_version": "v1.4",
  "embedding_model": "postgres-fulltext-english",
  "embedding_type": "school_search_document",
  "retrieval_mode": "fulltext",
  "results": [
    {
      "school_id": 2,
      "name": "Bayview Technical University",
      "city": "New Haven",
      "state": "CT",
      "type": "Public",
      "setting": "Urban",
      "enrollment": 11800,
      "acceptance_rate": 0.52,
      "net_price": 24400,
      "graduation_rate": 0.78,
      "fit_score": 86.42,
      "confidence_score": 0.95,
      "category_scores": {
        "academic": 92.0,
        "cost": 82.5
      },
      "top_reasons": ["academic_major_match", "cost_within_budget"],
      "top_tradeoffs": [],
      "ranking_version": "v1.0",
      "semantic_score": 0.71,
      "match_reasons": ["major_match", "setting_match", "cost_value_match"]
    }
  ],
  "page": 1,
  "page_size": 10,
  "total_results": 1,
  "has_next": false
}
```

`retrieval_mode` is `fulltext` normally and `deterministic_fallback` when the full-text query fails. `embedding_model` keeps its name for compatibility but reports the retriever: `postgres-fulltext-english` or `lexical-token-overlap`. `semantic_score` is in `[0, 1)`: `ts_rank_cd / (ts_rank_cd + 1)` for full-text, the share of query tokens found for the fallback. It orders results within one response and is not comparable across retrievers. `match_reasons` may include `major_match`, `location_match`, `setting_match`, `cost_value_match`, `outcomes_match`, and `campus_culture_match`.

### `GET /schools/{id}/similar`

Returns explainable similar-school alternatives for a source school. The endpoint retrieves semantic candidates when embeddings exist, falls back to deterministic lexical similarity when they do not, excludes the source school, applies structured constraints, and returns variant-aware scores and reasons.

Query parameters:

| Name | Type | Rules |
| --- | --- | --- |
| `variant` | enum | `general`, `cheaper`, `less_selective`, `smaller`, `stronger_outcomes`, or `closer_to_home`. Defaults to `general`. |
| `state`, `region`, `type`, `setting` | string | Optional structured constraints. |
| `home_state` | string | Optional 2-letter state used by `closer_to_home`. |
| `min_net_price`, `max_net_price`, `min_enrollment`, `max_enrollment` | integer | Optional nonnegative constraints. |
| `min_acceptance_rate`, `max_acceptance_rate`, `min_graduation_rate` | number | Optional `0` to `1` constraints. |
| `page` | integer | Defaults to `1`; must be `>= 1`. |
| `page_size` | integer | Defaults to `6`; must be `1` to `12`. |
| `candidate_limit` | integer | Defaults to `50`; must be `1` to `200`. |

Variant behavior:

- `cheaper`: requires lower net price when both source and candidate net price are known.
- `less_selective`: requires higher acceptance rate when both rates are known.
- `smaller`: requires lower enrollment when both values are known.
- `stronger_outcomes`: requires higher graduation rate or higher median earnings when comparable data is known.
- `closer_to_home`: requires `state == home_state` when `home_state` is supplied.

Response `200`:

```json
{
  "source_school_id": 1,
  "variant": "cheaper",
  "variant_applied": "cheaper",
  "ranking_version": "v1.0",
  "embedding_model": "local-hash-embedding-v1",
  "embedding_type": "school_search_document",
  "retrieval_mode": "deterministic_fallback",
  "results": [
    {
      "school_id": 2,
      "name": "Bayview Technical University",
      "city": "New Haven",
      "state": "CT",
      "type": "Public",
      "setting": "Urban",
      "enrollment": 11800,
      "acceptance_rate": 0.52,
      "net_price": 24400,
      "graduation_rate": 0.78,
      "median_earnings": 68000,
      "similarity_score": 0.82,
      "fit_score": 86.4,
      "top_reasons": ["overlapping_majors", "variant_lower_net_price", "academic_major_match"],
      "top_tradeoffs": [],
      "variant_applied": "cheaper",
      "ranking_version": "v1.0"
    }
  ],
  "page": 1,
  "page_size": 6,
  "total_results": 1,
  "has_next": false
}
```

### `GET /schools/{id}`

Full school profile composed from `schools`, `school_academics`, `school_costs`, `school_outcomes`, and `school_campus_life`. The endpoint uses a single repository query with left joins so missing optional profile rows or fields are represented as `null` rather than causing N+1 relationship loads.

Path parameters:

| Name | Type | Rules |
| --- | --- | --- |
| `id` | integer | School primary key. Returns `404` when no school exists. |

Example request:

```text
GET /schools/1
```

Response `200`:

```json
{
  "school_id": 1,
  "name": "Adams State College",
  "city": "Northbridge",
  "state": "MA",
  "region": "Northeast",
  "type": "Public",
  "setting": "Suburban",
  "enrollment": 6200,
  "acceptance_rate": 0.64,
  "academics": {
    "majors": ["Biology", "Psychology", "Business"],
    "popular_majors": ["Biology", "Psychology", "Business"],
    "graduation_rate": 0.69,
    "retention_rate": 0.82,
    "student_faculty_ratio": 15.0
  },
  "cost": {
    "tuition_in_state": 14200,
    "tuition_out_state": 31800,
    "net_price": 22100,
    "average_aid": 12600,
    "debt_median": 21000
  },
  "outcomes": {
    "median_earnings": 52000,
    "completion_rate": null,
    "repayment_rate": 0.76,
    "outcome_percentiles": null
  },
  "campus_life": {
    "sports": "DIII",
    "greek_life": 0.08,
    "housing": true,
    "weather_band": null,
    "diversity_metrics": null,
    "culture_tags": ["research", "commuter-friendly", "mid-size"]
  },
  "data_fields_missing": [
    "outcomes.completion_rate",
    "outcomes.outcome_percentiles",
    "campus_life.weather_band",
    "campus_life.diversity_metrics"
  ],
  "data_confidence_score": 0.8621,
  "fit_score": null,
  "category_scores": {},
  "top_reasons": [],
  "top_tradeoffs": [],
  "similar_schools": []
}
```

Response schema:

| Field | Type | Notes |
| --- | --- | --- |
| `school_id`, `name`, `city`, `state`, `region`, `type`, `setting`, `enrollment`, `acceptance_rate` | scalar | Core identity and search fields from `schools`. |
| `academics` | object | `majors`, `popular_majors`, `graduation_rate`, `retention_rate`, and `student_faculty_ratio`. Current seed data has one majors array, so both major fields are populated from `top_majors`. |
| `cost` | object | Tuition, net price, aid, and debt fields from `school_costs`. |
| `outcomes` | object | Earnings and repayment from `school_outcomes`; `completion_rate` and `outcome_percentiles` remain `null` until those fields exist. |
| `campus_life` | object | Sports, Greek life, housing, and culture tags from `school_campus_life`; weather and diversity remain `null` until data exists. |
| `data_fields_missing` | string array | Dot-path list of response fields whose values are `null`. |
| `data_confidence_score` | number | Completeness heuristic: non-null data fields divided by total tracked profile data fields, rounded to four decimals. |
| `fit_score`, `category_scores`, `top_reasons`, `top_tradeoffs`, `similar_schools` | placeholders | Profile ranking and V2 similar-school work are not computed by this endpoint. Use `POST /rankings` for ranked search-card output. |

Missing data behavior:

- Missing numeric values are returned as `null`, never converted to `0`.
- Missing object-like future fields such as `outcome_percentiles` and `diversity_metrics` are returned as `null`.
- `data_fields_missing` makes unknown values explicit for clients.
- `data_confidence_score` measures data completeness only; it is not a ranking score, admissions signal, ROI estimate, or recommendation confidence.

### `POST /decision/report`

Generates a deterministic accepted-school decision report from the offers in the request and ranking preferences. The report is a planning artifact, not admissions or financial advice.

The API stores no offers. Until V3.9 authentication exists there is no identity to own
server-side state, and a client-supplied `user_id` let any caller read any visitor's aid
offers and notes, so the offer store endpoints (`POST`/`GET /decision/offers`) and report
snapshots were removed. Offers live in the browser and travel with each request; free-text
notes never leave the browser because the report does not use them.

Request body:

```json
{
  "offers": [
    {"school_id": 1, "status": "finalist", "aid_offer": 12000, "scholarships": 8000,
     "estimated_yearly_cost": 24000, "unresolved_concerns": ["Confirm housing cost"]},
    {"school_id": 2, "status": "accepted", "estimated_yearly_cost": 31000}
  ],
  "preferences": {
    "intended_major": "Computer Science",
    "home_state": "CA",
    "max_annual_cost": 32000,
    "weights": {
      "academic": 0.25,
      "cost": 0.25,
      "career": 0.25,
      "campus": 0.25
    }
  },
  "max_annual_family_budget": 30000
}
```

Response `200` includes:

- `report_title`, `printable_report_path`, and `share_url_path` for the lightweight frontend report view.
- `best_overall_fit`: highest deterministic fit score.
- `best_value`: lowest known offer-level yearly cost, falling back to profile net price when offer cost is missing.
- `strongest_career_upside`: highest deterministic career category score.
- `lowest_risk`: bounded risk proxy using known cost, confidence, and unresolved concern count.
- `biggest_unresolved_factor`: school with the most unresolved questions.
- `finalist_ranking_table`: rank, fit, confidence, estimated cost, career score, and top deterministic tradeoff for each finalist.
- `category_score_table`: academic, cost, career, location, campus, and admissions-realism scores by finalist.
- `cost_value_comparison`: estimated yearly/four-year cost, affordability status, directional value label, confidence, and warnings using the same deterministic cost/value rules.
- `sensitivity_highlights`: deterministic cost, career, and academic stress-test highlights using reranked finalist rows.
- `unresolved_questions`: user-entered unresolved concerns, falling back to explicit confidence gaps when no questions were entered.
- `decision_confidence` and `confidence_flags`: explicit uncertainty indicators for missing financial data, incomplete preferences, missing outcomes, limited school data, or too few finalists.
- `major_tradeoffs`: deterministic comparison sentences grounded in structured data and user-entered offers.
- `methodology_note` and `disclaimer`: decision-support language that clarifies outputs are deterministic planning support, not admissions or financial advice.

Validation behavior:

- `offers` must contain 1 to 8 entries with distinct `school_id`s; `status` is `accepted` or `finalist`.
- Financial inputs are nonnegative whole-dollar yearly amounts up to 250,000; each unresolved concern is at most 300 characters, at most 12 per offer.
- If none of the offered schools exist in the dataset the endpoint returns `422`.
- Missing cost, outcomes, preference, or ranking data lowers confidence and creates flags rather than being treated as zero.

### `POST /cost-calculator`

Compares school financial assumptions and directional value. This endpoint is deterministic planning support, not financial advice.

Request body:

```json
{
  "schools": [
    {
      "school_id": 1,
      "estimated_net_price": 28000,
      "scholarships": 8000,
      "grants_aid": 6000,
      "annual_loan_amount": 5500,
      "loan_interest_rate": 0.0639,
      "loan_term_years": 10
    },
    {
      "school_id": 2,
      "estimated_yearly_cost": 42500,
      "annual_loan_amount": 12000
    }
  ],
  "baseline_school_id": 1,
  "max_annual_family_budget": 30000
}
```

Rules:

| Field | Rules |
| --- | --- |
| `schools` | Required, 1 to 8 unique schools. |
| `tuition`, `estimated_net_price`, `scholarships`, `grants_aid`, `estimated_yearly_cost`, `annual_loan_amount` | Optional nonnegative annual dollar amounts. |
| `loan_interest_rate` | Optional, defaults to `0.0639` (federal undergraduate Direct Loan rate, 2025-26), must be `0` to `0.25`. |
| `loan_term_years` | Optional, defaults to `10`, must be `1` to `30`. |
| `baseline_school_id` | Optional; when supplied, it must be one of the requested schools. |
| `max_annual_family_budget` | Optional nonnegative yearly budget used for affordability indicators. |

Response `200`:

```json
{
  "calculator_version": "v1.0",
  "generated_at": "2026-05-21T12:00:00Z",
  "disclaimer": "Cost/value calculator outputs are estimates for planning only, not financial advice. Actual aid, costs, borrowing terms, repayment, and outcomes may vary.",
  "baseline_school_id": 1,
  "results": [
    {
      "school_id": 2,
      "name": "USC Demo College",
      "city": "Los Angeles",
      "state": "CA",
      "observed_cost_data": {
        "tuition_in_state": null,
        "tuition_out_state": 68000,
        "net_price": 48500,
        "average_aid": 22000,
        "debt_median": 26000
      },
      "observed_outcome_data": {
        "median_earnings": 72000,
        "graduation_rate": 0.86,
        "repayment_rate": 0.82
      },
      "assumptions": {
        "school_id": 2,
        "tuition": null,
        "estimated_net_price": null,
        "scholarships": null,
        "grants_aid": null,
        "estimated_yearly_cost": 42500,
        "annual_loan_amount": 12000,
        "loan_interest_rate": 0.0639,
        "loan_term_years": 10
      },
      "estimated_yearly_cost": 42500,
      "estimated_four_year_total_cost": 170000,
      "yearly_cost_difference": 20500,
      "four_year_cost_difference": 82000,
      "estimated_debt_exposure": 48000,
      "repayment_scenarios": [
        {
          "scenario": "base",
          "principal": 48000,
          "interest_rate": 0.0639,
          "term_years": 10,
          "estimated_monthly_payment": 521,
          "estimated_total_repaid": 62520,
          "assumption": "Total borrowed matches the current assumption or observed median debt indicator."
        }
      ],
      "directional_outcome_adjusted_value": "reasonable_value",
      "affordability": {
        "status": "above_budget",
        "message": "Estimated yearly cost is above the entered family budget."
      },
      "confidence": "high",
      "warnings": [],
      "formulas": [
        "estimated_yearly_cost = max(0, estimated_yearly_cost)",
        "estimated_four_year_total_cost = estimated_yearly_cost * 4"
      ]
    }
  ],
  "comparison_summary": [
    "USC Demo College may cost about $82,000 more over four years than Berkeley Demo University under current assumptions."
  ]
}
```

Calculation rules:

- Yearly cost uses entered `estimated_yearly_cost` first, then entered net price, then entered tuition minus scholarships and grants/aid, then profile net price, then profile out-of-state tuition minus aid. Net price already reflects typical grant aid, so aid is never subtracted from it; aid entered against a net price adds the `aid_not_subtracted_from_net_price` warning. Scholarships plus grants cannot exceed entered tuition.
- Four-year total is yearly cost multiplied by `4`; no inflation or year-by-year sensitivity is applied in V2.5.
- Debt exposure uses entered annual loans multiplied by `4`; if loans are missing, observed median debt may be shown as a data indicator with a warning.
- Repayment scenarios use standard amortization for lower debt, base debt, and higher debt. They are simple sensitivities, not personalized repayment advice.
- Directional value labels use known four-year cost, median earnings, graduation rate, and repayment rate where available. Missing outcomes produce `uncertain`.
- Missing aid, net price, outcomes, or debt assumptions reduce confidence and appear in `warnings`.

### `POST /sensitivity`

Analyzes how deterministic ranking outputs move when category weights change. This endpoint reuses the existing ranking engine and preserves `ranking_version`; it does not create a second scoring system.

Request body:

```json
{
  "preferences": {
    "intended_major": "Computer Science",
    "home_state": "CA",
    "max_annual_cost": 32000,
    "weights": {
      "academic": 0.25,
      "cost": 0.2,
      "career": 0.2,
      "campus": 0.12,
      "location": 0.1,
      "admissions_realism": 0.13
    }
  },
  "scenarios": [
    {
      "scenario_id": "cost_focus",
      "label": "Cost sensitivity raised",
      "weight_adjustments": {
        "cost_value": 0.45
      }
    }
  ],
  "candidate_school_ids": [1, 2, 3],
  "filters": {
    "page": 1,
    "page_size": 10
  }
}
```

Rules:

| Field | Rules |
| --- | --- |
| `preferences` | Existing deterministic ranking preference profile. Supported weights must be `0` to `1` for this endpoint. |
| `scenarios` | Required, 1 to 8 scenarios. Each scenario has a stable `scenario_id`, user-facing `label`, and weight adjustments. |
| `weight_adjustments` | Supports `academic`, `academic_fit`, `cost`, `cost_value`, `career`, `career_outcomes`, `campus`, `campus_lifestyle`, `location`, `prestige_selectivity`, and `admissions_realism`. Values must be `0` to `1` before normalization. |
| `candidate_school_ids` | Optional, unique positive school IDs, up to 20. Used by the compare-page workflow to analyze selected schools only. |
| `filters` | Existing `SearchRequest` fields used when `candidate_school_ids` is empty. |

Response `200`:

```json
{
  "ranking_version": "v1.0",
  "baseline_weights": {
    "academic": 0.25,
    "cost": 0.2,
    "career": 0.2,
    "location": 0.1,
    "campus": 0.12,
    "admissions_realism": 0.13
  },
  "stable_choice_definition": "A stable choice remains highly ranked across many weighting scenarios, with little rank movement.",
  "volatile_choice_definition": "A volatile choice changes rank dramatically when one preference changes.",
  "baseline_results": [],
  "scenarios": [
    {
      "scenario_id": "cost_focus",
      "label": "Cost sensitivity raised",
      "applied_weights": {
        "academic": 0.17,
        "cost": 0.38,
        "career": 0.14,
        "location": 0.07,
        "campus": 0.09,
        "admissions_realism": 0.15
      },
      "emphasis_dimension": "cost_value",
      "results": [
        {
          "school_id": 2,
          "name": "Bayview Technical University",
          "city": "New Haven",
          "state": "CT",
          "base_rank": 2,
          "scenario_rank": 1,
          "rank_delta": 1,
          "fit_score": 86.4,
          "fit_delta": 2.5,
          "confidence_score": 0.91,
          "confidence_delta": -0.01,
          "category_scores": {
            "academic": 92.0,
            "cost": 82.5,
            "career": 88.0
          },
          "category_drivers": ["cost"],
          "movement": "up",
          "stability": "watch_choice",
          "top_reasons": ["cost_within_budget"],
          "top_tradeoffs": [],
          "explanation": "Bayview Technical University rises 1 rank position(s), mainly from cost; classification: watch choice."
        }
      ],
      "summary": "Bayview Technical University rises most when cost value changes."
    }
  ],
  "stable_schools": [],
  "volatile_schools": [],
  "category_drivers": [],
  "confidence_impacts": [],
  "tradeoff_explanations": [],
  "summary_messages": []
}
```

Definitions:

- Stable choice: remains highly ranked across many weighting scenarios, with little rank movement.
- Volatile choice: changes rank dramatically when one preference changes.
- `prestige_selectivity` is handled as a selectivity-emphasis scenario over the existing admissions-realism scoring path. It does not introduce a separate prestige score.

### `POST /analytics/events`

Logs one privacy-safe product analytics event. This endpoint is for lightweight V2.8 product telemetry and ranking evaluation. It does not accept arbitrary event names.

Supported `event_name` values:

- `search_performed`
- `semantic_search_performed`
- `school_profile_viewed`
- `school_saved`
- `school_compared`
- `onboarding_completed`
- `ranking_generated`
- `sensitivity_adjusted`
- `decision_report_generated`

Request body:

```json
{
  "event_name": "school_saved",
  "entity_type": "school",
  "entity_id": 2,
  "metadata": {
    "source": "search",
    "rank_position": 3,
    "fit_score": 86.4,
    "confidence_score": 0.88,
    "ranking_version": "v1.0",
    "top_reasons": ["academic_major_match"]
  }
}
```

Privacy rules:

- Raw search text, notes, emails, aid offers, scholarships, estimated yearly costs, loan amounts, and free-form preference narratives are dropped by the sanitizer.
- Filter metadata is stored as enabled filter keys, not raw user query text.
- Preference analytics may store normalized category weights, not major text, home state, or family budget.
- Events carry no user identity. `metadata` is capped at 40 keys and 4 KB serialized.

Response `200` returns the stored sanitized event.

### `GET /analytics/summary`

Returns internal analytics and ranking evaluation metrics for a configurable lookback window.

Query parameters:

| Name | Type | Rules |
| --- | --- | --- |
| `lookback_days` | integer | Optional, defaults to `90`, must be `1` to `365`. |

Response `200` includes event counts, metric cards, most-used filters, most-viewed/saved schools, compare frequency, onboarding completion rate, save rate by rank position, report generation frequency, ranking-version usage, ranking evaluation metrics, privacy notes, and limitations.

`ranking_evaluation` includes save rate by fit-score bucket, compare rate by ranking position, top reason-code frequency, confidence distribution, ranking-version distribution, category-weight summaries for saved schools, and interpretation notes.

Metrics are descriptive. They should not be presented as causal proof that a ranking caused a save, comparison, or final decision.

## Rate Limits and Access Control (V3.5)

Added ahead of the public deployment in V3.3: before it, every compute-heavy endpoint
accepted an unauthenticated POST body and the internal analytics dashboard was open.

### Rate limits

A fixed-window, per-client limit applies to the endpoints that do real work:

| Endpoint | Bucket | Default limit |
| --- | --- | --- |
| `POST /rankings` | `rankings` | 60 / 60s |
| `POST /semantic-search` | `semantic_search` | 60 / 60s |
| `POST /sensitivity` | `sensitivity` | 60 / 60s |
| `POST /cost-calculator` | `cost_calculator` | 60 / 60s |
| `POST /decision/report` | `decision` | 60 / 60s |
| `POST /analytics/events` | `analytics_events` | 120 / 60s |
| `GET /analytics/summary` | `analytics_summary` | 60 / 60s |
| `GET /schools/*` (search, profile, similar) | `read` | 240 / 60s |

Configured by `RATE_LIMIT_ENABLED`, `RATE_LIMIT_REQUESTS`, and
`RATE_LIMIT_WINDOW_SECONDS`. Exceeding a limit returns **429** with a `Retry-After`
header in seconds.

Clients are bucketed by the source IP the platform observed: the `sourceIp` in the Lambda
function URL request context (forwarded by Lambda Web Adapter as `x-amzn-request-context`),
else the right-most `X-Forwarded-For` hop (the one our own proxy appended), else the socket
address. The left-most hop is never used because the client writes it; keying on it would
give an attacker a fresh bucket per request. The identity is hashed to 16 hex characters
before it reaches the Redis key, so key size does not depend on header size.

Counters are atomic `INCR` operations in Redis, so a limit holds across workers rather
than per-process. **When Redis is unavailable the limiter fails open** and requests are
allowed: refusing all traffic because the cache blinked is worse than briefly not
enforcing a demo limit. The window is fixed rather than sliding, so a client can burst up
to twice the limit across a boundary.

### Analytics access control

`GET /analytics/summary` reports aggregate product behaviour and is operator-facing.

| `APP_ENV` | `ANALYTICS_API_TOKEN` | Result |
| --- | --- | --- |
| development / dev / local / test | unset | Served (local convenience) |
| anything else | unset | **503** - disabled rather than silently public |
| any | set | Requires a matching `X-Analytics-Token` header, else **401** |

The token is compared with `hmac.compare_digest` so the check does not leak its prefix
through timing. The `/analytics` page asks the operator for it and keeps it in
localStorage; it is deliberately not a `NEXT_PUBLIC_*` variable, which would ship the
secret to every visitor.

`POST /analytics/events` stays open because the browser must be able to log events, and
is rate-limited instead.

### Security headers

Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, and `Cross-Origin-Resource-Policy: same-site`. No CSP:
this service returns JSON only, and a CSP protects documents. Add one if it ever serves
HTML.

## Error Format

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed."
  }
}
```

Client input errors return `422`. Unexpected server errors, including a response model failing to validate against a database row, return `500` and are logged with a stack trace. 429 responses keep their `Retry-After` header.

## Browser Access

The API enables CORS for origins listed in `CORS_ORIGINS`. Local defaults allow `http://localhost:3000` and `http://127.0.0.1:3000` so the Next.js frontend can call FastAPI during development. Production deployments should set this to the exact hosted frontend origin.

## Query Strategy

Structured search joins `schools` to `school_costs` and `school_academics` with left joins, composes filters through SQLAlchemy expressions, counts the filtered result set, applies deterministic sorting, and then applies offset/limit pagination. Route handlers do not write SQL directly.

School profile reads join `schools` to academics, costs, outcomes, and campus life with left joins in one repository query. The service layer composes the nested profile response, computes missing-field metadata, and leaves ranking and similar-school placeholders empty.

Ranking reads join `schools`, `school_academics`, `school_costs`, `school_outcomes`, and `school_campus_life` with left joins in one repository query. The ranking service applies hard constraints, computes category scores, confidence, reason codes, and tradeoffs in memory for V1 scale.

Decision reports read `acceptance_offers`, join candidate school rows through the decision repository, call the ranking service for deterministic fit/category scoring, reuse cost/value result builders for report cost rows, and rerank the same finalist rows for report-level sensitivity highlights. Cost calculator reads requested school cost/outcome rows through the school repository and performs deterministic calculations in the service layer. Sensitivity analysis reads either selected candidate IDs or filtered ranking candidates, then calls the ranking service for baseline and scenario ordering. Route handlers do not write SQL directly.

Analytics event writes go through the analytics repository. Analytics aggregation reads recent events and computes V2.8 metrics in the analytics service. Route handlers do not write SQL directly.

Semantic search reads school document rows through the same `_apply_filters` that structured search uses, builds each document in the service, and scores them in one parameterized statement (`SchoolRepository.get_fulltext_scores`: `unnest` over bound id and text arrays, `ts_rank_cd` against `websearch_to_tsquery('english', ...)`). Only then is `candidate_limit` applied. Documents are sent with each query, so there is no stored text to refresh; that cost is linear in corpus size and is the point at which to store a generated `tsvector` with a GIN index. The ranking service then applies hard constraints and computes fit, and the semantic service orders the page by relevance with fit breaking ties.

Similar-school discovery uses the same generated embedding documents. It compares candidates to a source school, excludes the source school, applies variant constraints, deduplicates name/city/state matches, and returns a deterministic similarity score plus ranking reasons.

## Cache Behavior

Caching is transparent to clients and does not change request or response contracts. The backend checks Redis before repository/database work, stores successful responses on misses, and falls back to normal execution if Redis is unavailable. Every key also carries `SCHEMA_VERSION` (`services/cache.py`), bumped whenever a cached response model changes shape, so a deploy never deserializes JSON written under the old shape. Semantic and similar-school responses produced by the lexical fallback are not cached: that path runs when the database query failed, and pinning a degraded answer for the TTL would outlive the failure.

| Resource | Key inputs | TTL |
| --- | --- | --- |
| Search | Resource name, all filters, sort, direction, page, page size, `CACHE_KEY_VERSION` | 300 seconds |
| School profile | Resource name, `school_id`, `CACHE_KEY_VERSION` | 3600 seconds |
| Ranking | Resource name, full request body, `RANKING_VERSION`, `CACHE_KEY_VERSION` | 300 seconds |
| Semantic search | Resource name, normalized query, filters, preferences, retriever, embedding type, candidate limit, `RANKING_VERSION`, `DOCUMENT_VERSION`, `CACHE_KEY_VERSION` | 300 seconds |
| Similar schools | Resource name, school id, variant request, embedding type/model, `RANKING_VERSION`, `CACHE_KEY_VERSION` | 300 seconds |
| Sensitivity analysis | Resource name, request body, `RANKING_VERSION`, `CACHE_KEY_VERSION` | 300 seconds |

Example key shapes:

```text
college-exploration:cache:v1:s2:search:{sha256-digest}
college-exploration:cache:v1:s2:school-profile:{sha256-digest}
college-exploration:cache:v1:s2:ranking:{sha256-digest}
```

Ranking keys include `RANKING_VERSION` so cached rankings cannot cross deterministic formula versions.

## Planned V1 Endpoints

| Method | Path | Purpose | Stage |
| --- | --- | --- | --- |
| `POST` | `/preferences` | Create or update onboarding preference profile. | V1.8 |
| `POST` | `/rankings` | Rank candidate schools against deterministic preferences. | Implemented in V1.9 |
| `POST` | `/saved-schools` | Save or update school list status. | Planned after auth |
| `GET` | `/saved-schools` | Fetch saved schools. | Planned after auth |
| `POST` | `/comparisons` | Create a comparison session. | Planned after auth |
| `GET` | `/comparisons/{id}` | Read comparison output. | Planned after auth |

Decision reports are stateless: offers travel with each request and nothing per-visitor is stored server-side. Account-backed persistence remains V3.9 work.

The V1.11 frontend does not call these planned saved-school or comparison endpoints because there is no authenticated user/session boundary. It persists state locally in browser `localStorage` instead:

| Key | Purpose |
| --- | --- |
| `college-exploration.saved-schools.v1` | Saved school snapshots with status `interested`, `applying`, `accepted`, `finalist`, or `removed`. |
| `college-exploration.compare-schools.v1` | Deduplicated compare school snapshots capped at 5 schools. |

Future V2/V3 persistence should map these local records to user-owned backend records after authentication and privacy documentation are in place.

## Frontend-Only V1.8 Preference Profile

Until `POST /preferences` exists, the web app stores a local `PreferenceProfile` in browser `localStorage` under `college-exploration.preference-profile.v1`.

The local profile extends the planned backend `Preference` schema:

| Field | Notes |
| --- | --- |
| `intended_major`, `home_state`, `max_annual_cost`, `weights` | Directly map to the existing backend `Preference` schema placeholder. |
| `academic_interests`, `career_priorities`, `preferred_regions`, `preferred_states`, `preferred_settings`, `preferred_school_types`, `campus_preferences`, `admissions_strategy`, `target_acceptance_rate_min`, `aid_importance` | Structured constraints intended for the V1.9 deterministic ranking engine. |
| `completion` | Frontend-only completeness metadata for the onboarding UI. |

Onboarding completion forwards only currently supported search filters to `/search`: state, setting, school type, and max net price. It does not call a ranking endpoint or compute fit scores.

## Contract Rules

- Request and response schemas are Pydantic models.
- Route handlers should call services or repositories rather than writing SQL directly.
- Missing data should be represented explicitly instead of disguised as zero.
- Ranking and generated prose remain separate: ranking fields must come from deterministic code.

## AI counselor (optional)

`GET /counselor/status` returns `{available, model, provider, source_url}`. Availability means configured, not a live provider health probe.

`POST /counselor/chat` accepts `messages` (alternating user/assistant, first and last user; at most 10, 4,000 characters each, 12,000 total), `mode` (`plan`, `essay`, `visits`), optional `essay` (8,000 characters, essay mode only), and required `consent: true`. No system/tool roles or extra fields. Returns `{reply, sources: [{id,title,url,detail}], tools_used, model}`. Sources link to `/schools/{id}`. The client renders plain text, not HTML.

At most two model requests and three allowlisted read-only school tools per turn. Essay mode has no tools. Ranking is delegated to the existing versioned deterministic service. AI summaries can still be wrong; they do not replace the structured ranking UI. No chat persistence, response caching or analytics; responses use `Cache-Control: no-store`.

Errors use the standard error envelope: 422 invalid input or missing consent, 429 local/provider usage cap (Retry-After), 502 incomplete/provider failure, 503 disabled/misconfigured service, unavailable usage limiter or school data. No provider error bodies or student input are returned in errors. Six requests/minute per hashed connection identity and a global default 100 requests/UTC day; requests count even if later validation/provider calls fail.
