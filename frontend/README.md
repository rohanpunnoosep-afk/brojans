# Tandem frontend

TANDEM is a menswear marketplace with separate buyer and seller workspaces. The buyer selects Casual and Athletic, saves three lounge-inspired looks, and answers a short context chat. The frontend sends that brief to the existing middleman API and displays its five initial bundles, buyer ratings, seller analysis, final offer, and automatic agent decision.

## Run locally

From `frontend/`, with Node.js 22.12 or newer:

```sh
npm ci
npm run dev
```

The backend must also be running. Follow the repository [backend setup](../README.md) to start FastAPI on port 8000 with its required configuration. Vite proxies browser requests to `/api` to `http://127.0.0.1:8000`, preserving the API path and SSE stream. To use a different local or deployed backend, copy `.env.example` to `.env.local`, set `TANDEM_BACKEND_URL` to its origin, and restart Vite. This setting stays in the development server; it is not a `VITE_*` client variable. Keep model and database credentials in the backend environment.

Open `?role=buyer` and `?role=seller` in two tabs or windows of the same browser profile and origin. **Reset demo** clears the local workspaces. The shared browser session uses `localStorage` and `BroadcastChannel`; the backend stores negotiation state through its own configured repository.

## Backend behavior and UI controls

Creating a negotiation and opening its SSE stream runs the backend's full sequence: `BRIEF → PROPOSE → JUDGE → ANALYZE → FINAL → DECIDE → DONE`. Five initial bundles are rated before the seller creates one final offer. The backend agent's acceptance or rejection arrives automatically; it does not wait for a person to press an Accept button.

Only the buyer sees Accept/Decline on the final offer. The choice is saved locally and shared with the seller tab; it does not replace the backend agent decision. Initial proposals and ratings appear in the collapsible Agent exchange log. Seller limits are read-only references to backend rules. The current backend has no endpoint to save seller rules, approve a selected bundle, submit a human purchase decision, or place an order. Local human actions must not be interpreted as server-side approvals or purchases.

Ratings use the backend's `probability` from 0 to 1: an estimated chance of buying a bundle at that price. They do not need to sum to 1. Price, fit, and style scores are auxiliary display values. Budget, sizes, avoided colors, and explicit notes are validated by the backend; wrong-size and over-budget offers are not intentional alternatives.

## Catalog

`src/data/inventory.json` is a frontend snapshot of the 52-SKU backend seed in `../db/seed_items.json`. Each size is a separate SKU, using the exact inventory fields in [`json_formats.md`](../json_formats.md). Each `image` value is a filename resolved by the frontend; presentation metadata stays in `src/data/product-meta.json`.

There is no live inventory endpoint. This snapshot supports inventory browsing and product display; it does not prove that deployed database stock matches the seed. The backend remains authoritative for eligibility and pricing. Photography is illustrative; see `ASSET-CREDITS.md`.

## Deploy on Vercel

For the integrated app, set the Vercel project's **Root Directory to the repository root**, not `frontend`. The existing root `vercel.json` installs and builds this folder, serves `frontend/dist`, and routes `/api/*` to `api/index.py`. Browser API calls stay on the same origin. Configure backend environment variables in that Vercel project as described in the root README.

`frontend/vercel.json` is only for a separate frontend-only preview. It does not deploy the sibling Python API, and its exclusion of `/api` from the SPA fallback does not create an API proxy. `deployment/vercel.integrated.json` is an archived configuration reference; the root file is authoritative and already contains the combined settings.

The frontend provides no authentication, payments, shipping, or live calendar/email/weather connection. Preset role buttons enter local accounts. See `FRONTEND-INTEGRATION.md` for API boundaries and deployment details.
