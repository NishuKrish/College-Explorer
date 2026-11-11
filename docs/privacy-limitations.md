# Privacy And Evaluation Limitations

V2.8 analytics are designed for product feedback and ranking evaluation in a local/demo environment. They are not a production observability, consent, or data-governance system.

## Privacy-Safe Logging

Analytics events are typed and sanitized before storage.

Allowed examples:

- Event name and timestamp.
- School id for school-level actions.
- Enabled filter keys.
- Result count, rank position, fit score, confidence score, reason codes, and ranking version.
- Normalized category weights.
- Report version and decision confidence label.

Disallowed examples:

- Raw search text.
- Visit notes, unresolved concerns, parent notes, or student notes.
- Aid offers, scholarships, estimated yearly cost, or loan amounts.
- Email addresses or authentication identifiers. Analytics events carry no user identity at all.
- Free-form preference narratives such as intended major text or home-state input.

## Evaluation Caveats

Ranking evaluation metrics are descriptive, not causal.

- High-fit schools being saved more often can indicate ranking alignment, but it can also reflect users already preferring those schools.
- Compare rates by rank position can be affected by the UI layout, demo scripts, and local browser state.
- Reason-code frequency can show explanation coverage, but it does not prove that users trusted or understood an explanation.
- Confidence distributions reflect available source data. Missing public-data fields can bias confidence downward.
- Prestige, selectivity, and name recognition may influence user saves or finalists independently of deterministic fit scores.

## V3 Requirements

Before production analytics, the platform needs authenticated ownership, retention windows, deletion/export controls, consent language, access control for internal dashboards, rate limiting, and audit logging.

## Optional AI counselor

The counselor sends the current conversation and optional draft to Groq only after the student checks consent. It uses the open-weight GPT-OSS model hosted by Groq; inference is not local. Dream Campus does not store chats/drafts in PostgreSQL, Redis, localStorage, analytics or application logs. They remain in page memory until navigation, refresh, mode change or New chat. Error logging records categories, never validation inputs or provider bodies. Do not paste identifying or sensitive details.

Groq has its own handling and retention rules: https://console.groq.com/docs/your-data. Provider abuse/reliability retention can apply; this app does not assert Zero Data Retention is enabled. The account owner can review Groq data controls. Redis holds expiring usage counters (hashed connection identity, minute bucket and global day bucket), not conversation text. Shared proxies can share the per-minute allowance. No accounts or per-student quotas are claimed.

AI feedback is general planning/writing support. School tools use the existing 92-school reporting-year snapshot, not live tuition, aid eligibility, deadlines or individual admission odds. Students must verify current facts. The prompt asks the model to preserve essay authorship and cite known facts; prompt constraints cannot guarantee perfect behavior. There are no shell, web, application-submission, messaging or database-write tools.

Counseling instructions adapt College Navigator under AGPL-3.0; corresponding source is linked from the counselor page. Original MIT notices are preserved in LICENSES and NOTICE. Model and hosting terms are separate.
