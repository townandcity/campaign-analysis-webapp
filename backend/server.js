import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import crypto from "crypto";
import { Server } from "socket.io";
import { fetchAccountSnapshot } from "./services/metaApi.js";
import { DEMO_ACCOUNTS, tickDemoData, getDemoSnapshot, maybeGenerateLead } from "./services/mockLive.js";

const PORT = process.env.PORT || 4000;
const DEMO_MODE = (process.env.DEMO_MODE || "true").toLowerCase() !== "false";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 300000);
const ACCOUNT_IDS = (process.env.META_AD_ACCOUNT_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({
  // keep raw body around for webhook signature verification
  verify: (req, res, buf) => { req.rawBody = buf; },
}));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN || "*" } });

// In-memory cache of the latest snapshot per account, served on initial load
// and refreshed by the poll loop / demo ticker.
const cache = new Map();

function accountsList() {
  if (DEMO_MODE) return DEMO_ACCOUNTS;
  // In live mode, account display names must come from your own config/DB —
  // the Graph API account object also exposes a `name` field via
  // /act_{id}?fields=name if you'd rather pull it live.
  return ACCOUNT_IDS.map((id) => ({ id, name: `Ad Account ${id}`, currency: "USD" }));
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, mode: DEMO_MODE ? "demo" : "live", accounts: accountsList().length });
});

app.get("/api/accounts", (req, res) => {
  res.json(accountsList());
});

// Initial snapshot for one or more accounts: /api/snapshot?ids=1001,1002
app.get("/api/snapshot", async (req, res) => {
  const ids = (req.query.ids || "").split(",").map((s) => s.trim()).filter(Boolean);
  const wanted = ids.length ? ids : accountsList().map((a) => a.id);

  try {
    const results = [];
    for (const id of wanted) {
      if (DEMO_MODE) {
        const d = getDemoSnapshot(id);
        if (d) results.push({ account: d.account, campaigns: d.campaigns });
      } else {
        const cached = cache.get(id);
        if (cached) { results.push(cached); continue; }
        const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
        const until = new Date().toISOString().slice(0, 10);
        const snap = await fetchAccountSnapshot(id, { since, until });
        const withAccount = { account: { id, name: `Ad Account ${id}`, currency: "USD" }, ...snap };
        cache.set(id, withAccount);
        results.push(withAccount);
      }
    }
    res.json(results);
  } catch (err) {
    console.error("snapshot error", err?.response?.data || err.message);
    res.status(502).json({ error: "Failed to fetch from Meta Graph API", detail: err?.response?.data || err.message });
  }
});

/* ------------------------------------------------------------------
   Meta Leadgen webhook — gives you instantly-real-time leads instead
   of waiting on the poll interval. Register this URL (must be public,
   e.g. via ngrok in dev) in Meta App Dashboard > Webhooks.
------------------------------------------------------------------- */
app.get("/webhooks/meta", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post("/webhooks/meta", (req, res) => {
  const secret = process.env.META_APP_SECRET;
  if (secret) {
    const signature = req.headers["x-hub-signature-256"];
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
    if (signature !== expected) return res.sendStatus(401);
  }

  // Meta sends a lightweight notification here; the actual lead fields must
  // be fetched via GET /{leadgen_id}?access_token=... — left as a follow-up
  // fetch so you control which fields you pull.
  const entries = req.body?.entry || [];
  entries.forEach((entry) => {
    (entry.changes || []).forEach((change) => {
      if (change.field === "leadgen") {
        io.emit("lead:new", {
          id: change.value.leadgen_id,
          adId: change.value.ad_id,
          formId: change.value.form_id,
          receivedAt: new Date().toISOString(),
        });
      }
    });
  });

  res.sendStatus(200);
});

/* ------------------------------------------------------------------
   Real-time push loop
------------------------------------------------------------------- */
io.on("connection", (socket) => {
  console.log("client connected", socket.id);
  socket.on("disconnect", () => console.log("client disconnected", socket.id));
});

if (DEMO_MODE) {
  // Ticks every 3s so KPIs/charts visibly move — this is the "live" feel for demos.
  setInterval(() => {
    const state = tickDemoData();
    io.emit("data:update", Object.values(state).map((d) => ({ account: d.account, campaigns: d.campaigns })));
  }, 3000);

  setInterval(() => {
    const lead = maybeGenerateLead();
    if (lead) io.emit("lead:new", lead);
  }, 4000);

  console.log("Running in DEMO_MODE — simulated live data, no Meta credentials needed.");
} else {
  if (!process.env.META_ACCESS_TOKEN || !ACCOUNT_IDS.length) {
    console.warn("DEMO_MODE=false but META_ACCESS_TOKEN or META_AD_ACCOUNT_IDS is missing. Set both in .env.");
  }
  const poll = async () => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);
    for (const id of ACCOUNT_IDS) {
      try {
        const snap = await fetchAccountSnapshot(id, { since, until });
        const withAccount = { account: { id, name: `Ad Account ${id}`, currency: "USD" }, ...snap };
        cache.set(id, withAccount);
      } catch (err) {
        console.error(`poll failed for act_${id}`, err?.response?.data || err.message);
      }
    }
    io.emit("data:update", Array.from(cache.values()));
  };
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
  console.log(`Running in LIVE mode — polling Meta Graph API every ${POLL_INTERVAL_MS / 1000}s.`);
}

server.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
