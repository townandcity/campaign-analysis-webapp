# Campaign Analysis — Live Meta Ads Dashboard

A two-part web app:
- **backend/** — Node/Express + Socket.IO server. Polls the Meta Marketing API (or simulates live data in demo mode) and pushes updates to connected clients in real time. Also exposes a webhook endpoint for instant lead notifications.
- **frontend/** — React (Vite) dashboard: account switcher, KPI strip, spend/CPL trend, a "CPL Pulse" panel, sortable campaign table, ad creative gallery, and a live leads feed.

## 1. Run it in demo mode (no Meta account needed)

```bash
cd backend
cp .env.example .env      # DEMO_MODE=true by default — leave as is
npm install
npm run dev               # starts on http://localhost:4000
```

```bash
cd frontend
npm install
npm run dev                # starts on http://localhost:5173
```

Open http://localhost:5173 — you'll see 4 mock ad accounts with numbers ticking every ~3 seconds and a live leads feed firing periodically, so you can see exactly how the real-time behavior works before connecting anything real.

## 2. Connect your real Meta Ads accounts

**a. Get an access token**
1. Go to [business.facebook.com](https://business.facebook.com) → Business Settings → Users → System Users.
2. Create a system user, generate a token with the `ads_read` permission (add `ads_management` too if you'll later want to pause/edit ads from the same token).
3. Copy the token — this is `META_ACCESS_TOKEN`.

**b. Get your ad account IDs**
- In Ads Manager, the ID is shown as `act_123456789` — you only need the numeric part (`123456789`) in `.env`. Comma-separate multiple accounts.

**c. Update `backend/.env`**
```
DEMO_MODE=false
META_ACCESS_TOKEN=your_long_lived_token
META_AD_ACCOUNT_IDS=123456789,987654321
POLL_INTERVAL_MS=300000
```

Restart the backend. It will poll each account's campaigns/ads/insights every `POLL_INTERVAL_MS` and push a `data:update` event to the frontend — no restart needed on the frontend, it just starts showing real numbers.

> **Why not sub-minute polling?** Meta's own rate limits and attribution windows mean insights data isn't more "real-time" than a few minutes old no matter how often you ask. 3–5 minutes is a sensible floor for performance metrics. Leads are the exception — see below.

## 3. Instant leads via webhook (optional but recommended)

Polling insights won't tell you about a new lead the second it happens — for that, register a webhook:

1. In your Meta App Dashboard → Webhooks → Page → subscribe to the `leadgen` field.
2. Set the callback URL to `https://your-public-domain/webhooks/meta` (use `ngrok http 4000` while developing locally).
3. Set `META_WEBHOOK_VERIFY_TOKEN` in `.env` to any string, and enter the same string in the Meta dashboard's verify-token field.
4. Set `META_APP_SECRET` in `.env` (from your Meta App's Basic Settings) so incoming webhook payloads are signature-verified.

New leads will appear instantly in the "Live Leads" panel, independent of the polling interval.

## Project structure

```
backend/
  server.js            # Express + Socket.IO, polling loop, webhook endpoint
  services/
    metaApi.js          # Real Graph API calls (campaigns, ads, insights)
    mockLive.js          # Demo-mode simulator
  .env.example
frontend/
  src/
    App.jsx              # Dashboard UI
    useLiveData.js        # Socket.IO + REST data hook
```

## Customizing target CPL per campaign

`metaApi.js` leaves `targetCPL: null` for live-mode campaigns — merge your own targets in from a config file or small database (keyed by campaign ID) inside `fetchAccountSnapshot`, so the CPL Pulse panel can compare against them.

## Deploying

- Backend: any Node host (Render, Railway, Fly.io, a small VPS). Set the same `.env` vars there.
- Frontend: any static host (Vercel, Netlify). Set `VITE_API_URL` to your deployed backend's URL at build time.
- Set `CORS_ORIGIN` on the backend to your deployed frontend's URL.
