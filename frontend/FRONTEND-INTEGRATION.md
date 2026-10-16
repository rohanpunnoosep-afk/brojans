# TANDEM frontend integration

TANDEM is an agent-to-agent marketplace. Clothing is the first implemented vertical; menswear loungewear is the presentation scenario. Buyer styles, selected looks, location, occasions, sizes, fit, target price, and maximum budget are editable inputs. The $150 target and $200 maximum are initial presentation defaults, not fixed negotiation outcomes. The target can be cleared. Other marketplace verticals are outside the current frontend/backend contract.

`frontend/` is the canonical TANDEM Vite/React application. It consumes the existing FastAPI middleman API in `../api/index.py`; the backend drives both agents and persists negotiation stages. The frontend's local session coordinates the buyer and seller views and records human feedback. These are separate kinds of state.

## Deployment and origins

| Configuration | Role |
| --- | --- |
| Repository root `vercel.json` | Active integrated configuration. Installs and builds `frontend/`, serves `frontend/dist`, deploys `api/index.py`, and rewrites `/api/*` to that function. Use the repository root as the Vercel Root Directory. |
| `frontend/vercel.json` | Separate frontend-only preview. It does not include or route to the sibling Python API. Do not select `frontend` as the root for the integrated deployment. |
| `frontend/deployment/vercel.integrated.json` | Archived reference for the combined configuration, not an additional active Vercel configuration. The repository root file is authoritative. |

The root configuration already retains the Python function's 300-second maximum duration and excludes `/api`, assets, images, and the favicon from the SPA fallback. The frontend does not need to modify root or backend configuration for the existing same-origin routing.

The browser uses relative `/api` URLs for fetch and SSE. In local development, `vite.config.ts` proxies `/api` to `TANDEM_BACKEND_URL`, defaulting to `http://127.0.0.1:8000`. It preserves the full path and sets `changeOrigin: true`. Copy `.env.example` to `.env.local` in `frontend/` to override the target with a backend origin; restart Vite after a change. The proxy requires a running, configured backend and does not launch one. Vite's production build and `vite preview` do not provide this development proxy.

`TANDEM_BACKEND_URL` is loaded only in the Vite server configuration and is not exposed as a `VITE_*` client variable. No OpenAI or database credential belongs in frontend source or client environment variables. The existing API has no CORS middleware; routing through the local proxy or integrated Vercel origin avoids cross-origin browser requests. A standalone frontend deployment would need a separately configured server-side proxy or backend CORS support.

## Current API

| Endpoint | Frontend use |
| --- | --- |
| `GET /api/health` | Check backend availability. |
| `POST /api/negotiations` | Send `{buyer_input, brief?}`; receive `{id, stream_url}`. |
| `GET /api/negotiations/{id}/stream` | Consume SSE history and live stage updates; opening the stream runs or resumes the negotiation. Resume with `?after=` or `Last-Event-ID`. |
| `GET /api/negotiations/{id}` | Restore the negotiation snapshot, rounds, judgments, heat, analysis, final offer, and agent decision. |
| `POST /api/negotiations/{id}/retry` | Re-arm a failed negotiation, then reopen its stream. This is not a new negotiation. |

SSE event types are `brief`, `check`, `bundles_proposed`, `ratings`, `heat`, `analysis`, `final_offer`, `decision`, `done`, and `error`. Each event's JSON envelope contains `id`, `type`, `payload`, and `ts`. The stream ID supports replay without regenerating a completed stage. Backend event and snapshot shapes follow `models/schemas.py` and `api/index.py`; use these rather than assuming that every API response is identical to an example in `json_formats.md`.

The backend completes `BRIEF → PROPOSE → JUDGE → ANALYZE → FINAL → DECIDE → DONE` automatically. An optional pre-built `brief` skips brief extraction. The five proposals are learning inputs; their ratings inform seller analysis and exactly one final offer. The final `decision` is the buyer agent's own acceptance or rejection.

## Human controls and persistence

The five initial proposals and their ratings appear only in the collapsible Agent exchange log. Only the buyer sees Accept/Decline on the final offer; the seller waits for that choice. The human decision is stored separately from the backend agent decision and synchronizes between local tabs. No seller approval is required. The current API exposes no endpoints for those actions, seller rule settings, orders, payment, or inventory reservation. Human clicks must not overwrite the backend's automatic agent decision or claim a server-confirmed purchase. Seller preferences only influence a run if explicitly represented in its accepted buyer input or brief; there is no separate seller-settings API.

`localStorage` and `BroadcastChannel` synchronize the local UI between tabs/windows on the same browser profile and origin. They do not provide cross-device accounts or a hosted frontend database. The backend negotiation ID identifies server state; its persistence depends on the configured backend repository. Preset buyer/seller entry buttons provide no authentication.

## Catalog and contract

`src/data/backend-inventory.json` mirrors the 52-SKU source seed in `../db/seed_items.json`. It is a bundled snapshot, not a live database read: the API currently has no inventory endpoint. Deployed database inventory can differ, so the backend controls actual offer eligibility. Frontend item display must resolve returned SKU and image references without treating local stock as a live reservation.

Inventory fields remain `sku`, `name`, `category`, `color`, `material`, `size`, `price`, `stock`, and `image`. Each size is a separate SKU. `image` stays a filename in messages and is resolved to an asset only for rendering. Presentation tags and photo mappings belong in `src/data/backend-product-meta.json`, separate from the wire inventory schema.

Buyer input includes style choices and selected look descriptions, location, occasion, sizes, preferred fit, an optional target price, and the maximum budget. The backend extracts its brief from this input; target and fit are descriptive preferences rather than additional schema fields. Look options are filtered by the selected styles. Buyer context serializes style, colors, sizes, budget, occasion, and explicit notes. Budget, size, avoided colors, notes, stock, and price bands are backend validation rules. Initial offers differ through valid combinations and softer style, fabric, coverage, and price tradeoffs; wrong-size or over-budget offers are not deliberate alternatives.

Backend ratings use a 0–1 `probability` for estimated purchase chance at the offered price. These estimates are independent and need not total 1; they are not calibrated measurements. Price, fit, and style scores are auxiliary explanations when returned by the backend. Item totals, savings, and attribute averages are computed by backend code.

The frontend adapter must preserve backend IDs, SKUs, prices, and decisions when adapting them to display models. A network or validation failure should remain visible and retryable; it should not silently substitute seeded offers for server results. Successful frontend compilation or an available health route does not establish a successful end-to-end model run.
