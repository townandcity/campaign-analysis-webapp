import axios from "axios";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const TOKEN = process.env.META_ACCESS_TOKEN;

function client() {
  return axios.create({
    baseURL: BASE,
    params: { access_token: TOKEN },
    timeout: 20000,
  });
}

/**
 * List campaigns for an ad account.
 * https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group
 */
export async function fetchCampaigns(accountId) {
  const { data } = await client().get(`/act_${accountId}/campaigns`, {
    params: {
      fields: "id,name,objective,status,daily_budget,lifetime_budget",
      // Large accounts (hundreds of campaigns) will hit Meta's "reduce the
      // amount of data" error if we ask for everything at once. Limiting to
      // active campaigns keeps the payload small and the dashboard relevant.
      effective_status: JSON.stringify(["ACTIVE"]),
      limit: 100,
    },
  });
  return data.data || [];
}

/**
 * List ads (+ creative) for an ad account.
 * https://developers.facebook.com/docs/marketing-api/reference/adgroup
 */
export async function fetchAds(accountId) {
  const { data } = await client().get(`/act_${accountId}/ads`, {
    params: {
      fields:
        "id,name,status,adset_id,campaign_id," +
        "creative{id,title,body,thumbnail_url,image_url,object_type,video_id}",
      effective_status: JSON.stringify(["ACTIVE"]),
      limit: 100,
    },
  });
  return data.data || [];
}

/**
 * Insights (performance) at ad level for a date range.
 * `since`/`until` are 'YYYY-MM-DD'. Leads are derived from the `actions` array
 * (action_type is usually 'lead' or 'onsite_conversion.lead_grouped' depending
 * on how the lead objective/pixel is set up — check your own account's action
 * names once real data is flowing and adjust LEAD_ACTION_TYPES below).
 * https://developers.facebook.com/docs/marketing-api/insights
 */
const LEAD_ACTION_TYPES = new Set([
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
]);

export async function fetchInsights(accountId, { since, until, level = "ad" } = {}) {
  const { data } = await client().get(`/act_${accountId}/insights`, {
    params: {
      level,
      time_range: JSON.stringify({ since, until }),
      fields: "ad_id,campaign_id,spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions",
      limit: 100,
    },
  });

  return (data.data || []).map((row) => {
    const leads = (row.actions || [])
      .filter((a) => LEAD_ACTION_TYPES.has(a.action_type))
      .reduce((sum, a) => sum + Number(a.value || 0), 0);
    return {
      adId: row.ad_id,
      campaignId: row.campaign_id,
      spend: Number(row.spend || 0),
      impressions: Number(row.impressions || 0),
      reach: Number(row.reach || 0),
      clicks: Number(row.clicks || 0),
      ctr: Number(row.ctr || 0),
      cpc: Number(row.cpc || 0),
      cpm: Number(row.cpm || 0),
      frequency: Number(row.frequency || 0),
      leads,
      cpl: leads > 0 ? Number(row.spend || 0) / leads : 0,
    };
  });
}

/**
 * Pulls campaigns + ads + insights for one account and assembles them into the
 * shape the frontend dashboard expects (see frontend/src/App.jsx schema).
 */
export async function fetchAccountSnapshot(accountId, { since, until } = {}) {
  const [campaigns, ads, insights] = await Promise.all([
    fetchCampaigns(accountId),
    fetchAds(accountId),
    fetchInsights(accountId, { since, until }),
  ]);

  const insightsByAd = Object.fromEntries(insights.map((i) => [i.adId, i]));

  const adsById = ads.map((ad) => {
    const m = insightsByAd[ad.id] || {
      spend: 0, impressions: 0, reach: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, frequency: 0, leads: 0, cpl: 0,
    };
    return {
      id: ad.id,
      campaignId: ad.campaign_id,
      name: ad.name,
      status: ad.status,
      format: ad.creative?.video_id ? "video" : ad.creative?.object_type === "carousel" ? "carousel" : "image",
      headline: ad.creative?.title || ad.name,
      body: ad.creative?.body || "",
      thumbUrl: ad.creative?.thumbnail_url || ad.creative?.image_url || null,
      metrics: m,
    };
  });

  const campaignsOut = campaigns.map((c) => {
    const ownAds = adsById.filter((a) => a.campaignId === c.id);
    const agg = ownAds.reduce(
      (acc, a) => {
        acc.spend += a.metrics.spend; acc.impressions += a.metrics.impressions;
        acc.clicks += a.metrics.clicks; acc.reach += a.metrics.reach; acc.leads += a.metrics.leads;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, reach: 0, leads: 0 }
    );
    return {
      id: c.id,
      name: c.name,
      objective: c.objective,
      status: c.status,
      targetCPL: null, // set your own targets in a config/DB and merge in here
      ads: ownAds,
      metrics: {
        ...agg,
        ctr: agg.impressions ? (agg.clicks / agg.impressions) * 100 : 0,
        cpc: agg.clicks ? agg.spend / agg.clicks : 0,
        cpm: agg.impressions ? (agg.spend / agg.impressions) * 1000 : 0,
        cpl: agg.leads ? agg.spend / agg.leads : 0,
        frequency: agg.reach ? agg.impressions / agg.reach : 0,
      },
    };
  });

  return { accountId, campaigns: campaignsOut };
}
