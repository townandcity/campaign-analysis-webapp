// Simulates a "live" Meta Ads account: stable base data plus small realistic
// jitter every tick, so the frontend has something genuinely real-time to
// render before real credentials are wired up.

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

const OBJECTIVES = ["Leads", "Conversions", "Traffic", "Awareness"];
const HEADLINES = [
  "Get Your Free Quote Today", "Limited Slots This Month", "Start Saving Now",
  "Book A Free Consultation", "See Plans & Pricing", "Talk To An Expert Free",
];
const BODIES = [
  "Tell us what you need and we'll match you with the right plan — no obligation.",
  "Spots are filling fast this quarter. Reserve yours before they're gone.",
  "See why thousands switched this year. Get a personalized quote in minutes.",
];

export const DEMO_ACCOUNTS = [
  { id: "1001", name: "Northwind Retail — US", currency: "USD" },
  { id: "1002", name: "Northwind Retail — UK", currency: "GBP" },
  { id: "1003", name: "Bluecrest Finance", currency: "USD" },
  { id: "1004", name: "Aurora Health Clinics", currency: "USD" },
];

function buildAccount(account) {
  const rnd = mulberry32(hashStr(account.id));
  const numCampaigns = 3 + Math.floor(rnd() * 3);
  const campaigns = [];
  for (let c = 0; c < numCampaigns; c++) {
    const objective = OBJECTIVES[c % OBJECTIVES.length];
    const targetCPL = 8 + rnd() * 30;
    const campaignId = `${account.id}_camp_${c}`;
    const numAds = 2 + Math.floor(rnd() * 3);
    const ads = [];
    for (let a = 0; a < numAds; a++) {
      ads.push({
        id: `${campaignId}_ad_${a}`,
        campaignId,
        name: `${objective} Campaign ${c + 1} — Ad ${a + 1}`,
        status: "ACTIVE",
        format: ["image", "video", "carousel"][Math.floor(rnd() * 3)],
        headline: HEADLINES[Math.floor(rnd() * HEADLINES.length)],
        body: BODIES[Math.floor(rnd() * BODIES.length)],
        thumbUrl: null,
        metrics: {
          spend: 40 + rnd() * 300, impressions: 4000 + rnd() * 30000,
          reach: 3000 + rnd() * 20000, clicks: 40 + rnd() * 500,
          leads: 1 + Math.floor(rnd() * 20), ctr: 0.8 + rnd() * 2,
          cpc: 0.3 + rnd() * 2, cpm: 4 + rnd() * 12, frequency: 1 + rnd() * 1.5,
          cpl: 0,
        },
      });
    }
    campaigns.push({ id: campaignId, name: `${objective} Campaign ${c + 1}`, objective, status: "ACTIVE", targetCPL, ads });
  }
  return { account, campaigns };
}

const STATE = Object.fromEntries(DEMO_ACCOUNTS.map((a) => [a.id, buildAccount(a)]));

// Nudges every ad's metrics slightly, recomputes rollups. Called on each tick.
export function tickDemoData() {
  Object.values(STATE).forEach(({ campaigns }) => {
    campaigns.forEach((c) => {
      const agg = { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 };
      c.ads.forEach((ad) => {
        const m = ad.metrics;
        m.spend = Math.max(5, m.spend + (Math.random() - 0.45) * 8);
        m.impressions = Math.max(100, m.impressions + Math.floor((Math.random() - 0.4) * 400));
        m.clicks = Math.max(1, m.clicks + Math.floor((Math.random() - 0.45) * 8));
        m.reach = Math.max(100, m.reach + Math.floor((Math.random() - 0.4) * 200));
        if (Math.random() > 0.7) m.leads += Math.random() > 0.5 ? 1 : 0;
        m.ctr = (m.clicks / m.impressions) * 100;
        m.cpc = m.spend / Math.max(m.clicks, 1);
        m.cpm = (m.spend / m.impressions) * 1000;
        m.cpl = m.spend / Math.max(m.leads, 1);
        agg.spend += m.spend; agg.impressions += m.impressions;
        agg.clicks += m.clicks; agg.reach += m.reach; agg.leads += m.leads;
      });
      c.metrics = {
        ...agg,
        ctr: agg.impressions ? (agg.clicks / agg.impressions) * 100 : 0,
        cpc: agg.clicks ? agg.spend / agg.clicks : 0,
        cpm: agg.impressions ? (agg.spend / agg.impressions) * 1000 : 0,
        cpl: agg.leads ? agg.spend / agg.leads : 0,
        frequency: agg.reach ? agg.impressions / agg.reach : 0,
      };
    });
  });
  return STATE;
}

export function getDemoSnapshot(accountId) {
  return STATE[accountId];
}

// Occasionally "fires" a fresh lead event, for the live leads feed.
export function maybeGenerateLead() {
  if (Math.random() > 0.35) return null;
  const accounts = Object.values(STATE);
  const { account, campaigns } = accounts[Math.floor(Math.random() * accounts.length)];
  const campaign = campaigns[Math.floor(Math.random() * campaigns.length)];
  const ad = campaign.ads[Math.floor(Math.random() * campaign.ads.length)];
  return {
    id: `lead_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    accountId: account.id,
    accountName: account.name,
    campaignName: campaign.name,
    adName: ad.name,
    receivedAt: new Date().toISOString(),
  };
}
