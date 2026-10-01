# SPIKE — Growth Intelligence

SPIKE is an AI business-growth workspace created by Evans Muyomba.

## Run

```bash
npm install
npm run dev
```

For the production-style server:

```bash
npm run build
npm start
```

The server listens on `PORT` (default `8787`) and serves the built frontend plus `/api/*` billing routes.

## Peach Payments

Copy `.env.example` to `.env` and fill the Peach credentials on the server only. Start with sandbox.

The current integration uses Peach Orchestration V2 Hosted Checkout. The initial checkout is a zero-value preauthorisation with card tokenisation for the 7-day trial; a verified webhook stores the registration ID. A scheduled server call to `/api/billing/renew-due` can then perform the first $10 recurring debit after the trial and subsequent monthly debits. This requires a real recurring-payment credential and persistent server storage.

Never put payment secrets in frontend source code or localStorage.


## v0.5 additions
- Money workspace for recording sales and expenses locally.
- App-calculated revenue, expenses, profit and profit margin from recorded transactions.
- Explicit demo-data notice so example dashboard figures are not presented as real business data.
- No Supabase dependency.
- Web-first architecture remains compatible with PC, iPhone, Android and tablets through a modern browser.


## v0.6
- Dashboard financial snapshot now uses recorded local transactions when available.
- Dashboard explicitly distinguishes missing data from example/demo context.
- Customer profile and acquisition-channel context are editable and persisted locally.
- Cross-platform web-first architecture remains unchanged; no Supabase dependency.


## v0.7
- Expanded onboarding to capture country, currency, products/services, prices, hours, booking, customers, acquisition channels, challenges and goals.
- Added a deterministic 14-day revenue vs expense activity graph.
- Personalized recommended actions from recorded metrics and business context.
- Customer and Business Setup context is explicitly saved.
- No Supabase.


## SPIKE AI
The SPIKE AI screen calls `/api/ai/chat`. The server sends the business context and recorded transactions to the OpenAI Responses API. Keep `OPENAI_API_KEY` on the server only; never put it in frontend code or localStorage.

Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL` in the server environment before using live AI. The endpoint uses `store:false` so the application does not request stored Responses API state.

## OpenAI setup
1. Create a server environment variable named `OPENAI_API_KEY`.
2. Optionally set `OPENAI_MODEL` (default in this build: `gpt-5`).
3. Never put the API key in React source, browser localStorage, or `.env` files that are committed publicly.
4. The frontend calls `POST /api/ai/chat`; the backend attaches SPIKE's business context and recorded transactions and calls OpenAI.
5. The AI response costs 1 SPIKE AI credit in the current MVP UI.

The project can run without an OpenAI key, but the SPIKE AI screen will show a configuration message until a key is supplied on the deployed server.


## SPIKE v1.3 upgrades
- Server-enforced monthly AI credit accounting (50 trial / 250 Growth).
- Research-capable SPIKE Responses API with web search enabled for current external questions.
- Structured next-move output and automatic Action Board memory.
- Growth intelligence uses recorded financial data plus business context.
- English, isiZulu and Afrikaans language preference.
- No Supabase dependency.
- OpenAI model is configurable via `OPENAI_MODEL`; the default is `gpt-5-mini`.
- Creator attribution remains: Evans Muyomba.


## v1.5 Feedback & Recommendations
Users can submit recommendations, comments, bug reports and praise from the Feedback page. Feedback is stored by the SPIKE server, can be upvoted, and is designed to feed the creator's future product decisions.

## Evans Creator Console (v1.6)

SPIKE now includes a private creator console for Evans Muyomba. It lets the creator:
- review and search all feedback submissions;
- filter by status;
- pin important ideas;
- change status (`new`, `reviewing`, `planned`, `in_progress`, `completed`, `declined`);
- reply publicly as Evans;
- see upvotes and recurring request terms;
- view a compact feedback summary.

Set `SPIKE_OWNER_SECRET` on the server to a long random secret. The browser sends it only as the `x-spike-owner-secret` header; the secret is not bundled into the frontend. Do not commit a real owner secret to source control.

The console is intentionally owner-gated server-side. Creator identity (`Evans Muyomba`) and creator ownership information are separate from authentication.


## v1.7 — Customer Opportunity Matching

SPIKE can research publicly available customer opportunities using its server-side web research capability. It matches opportunities against the business context, shows the source when available, and keeps the owner in control: SPIKE does not automatically contact customers or claim that an opportunity is a confirmed customer.

Opportunity research uses AI credits (10 credits per search) and requires `OPENAI_API_KEY`.


## v1.8 additions
- Customer Intelligence lead tracker with new/contacted/qualified/won/lost stages.
- Public opportunity results can be promoted into the local lead tracker for owner follow-up.
- Customer pipeline counts are calculated from recorded leads; SPIKE does not treat opportunities as confirmed customers.
- Growth, Action Board, feedback/Creator Console, AI research and subscription foundations remain preserved.

## v1.9 improvements
- Money entries now support explicit dates and deletion.
- Customer lead tracker now supports search and status filtering.
- Mobile-friendly lead controls and transaction controls.
- Existing feedback, Creator Console, Customer Opportunity Matching, Growth Intelligence, Action Board, AI research, monetization foundation and creator attribution preserved.
- Full production build still requires dependency installation (`npm install`) on a machine with network access; server syntax is checked with Node.

## v2.0 UI/UX pass
- Polished dark visual system with stronger hierarchy, focus states, hover/active feedback and mobile spacing.
- Improved forms, cards, AI chat, feedback, creator console, customer opportunities and lead-management surfaces.
- Added reduced-motion support and clearer keyboard focus treatment.
- Kept the existing feature set and data model intact.

## Docker deployment

This repository includes a production Dockerfile. Build and run it with:

```bash
docker build -t spike-growth-hub .
docker run --rm -p 8787:8787 --env-file .env spike-growth-hub
```

For production, provide secrets through the hosting platform's secret/environment-variable manager. Never commit `.env` or real API keys.
