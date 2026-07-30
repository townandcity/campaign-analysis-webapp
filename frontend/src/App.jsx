import React, { useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ChevronDown, DollarSign, Eye, MousePointerClick, Users, Target, Image as ImageIcon,
  X, ChevronRight, Search, Video, GalleryHorizontal, ArrowUpRight, ArrowDownRight, Radio, Zap,
} from "lucide-react";
import { useLiveData } from "./useLiveData.js";

const COLORS = {
  bg: "#0B0F14", surface: "#12181F", surface2: "#1A222B", border: "#232D38",
  text: "#E7ECF1", muted: "#8A96A3", teal: "#2DD4BF", amber: "#F2B84B",
  coral: "#FF6B5B", blue: "#5B8DEF",
};

const fmtMoney = (n, currency = "INR") =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(n || 0);
const fmtNum = (n) => {
  n = n || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return Math.round(n).toLocaleString();
};
const fmtPct = (n) => `${(n || 0).toFixed(2)}%`;

function hashSeed(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h; }
function genThumbGradient(seed) {
  const h = Math.abs(hashSeed(seed));
  const h1 = h % 360, h2 = (h1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${h1} 55% 22%), hsl(${h2} 60% 14%))`;
}

/* ---------- small presentational pieces ---------- */
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const w = 90, h = 28, pad = 2;
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${pad + (i / (data.length - 1)) * (w - pad * 2)},${h - pad - ((v - min) / range) * (h - pad * 2)}`);
  return <svg width={w} height={h}><polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" /></svg>;
}

function KpiCard({ icon: Icon, label, value, sub, spark, sparkColor }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: COLORS.muted, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          <Icon size={13} />{label}
        </div>
        {spark && <Sparkline data={spark} color={sparkColor} />}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 600, color: COLORS.text, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: COLORS.muted }}>{sub}</div>}
    </div>
  );
}

function StatusPill({ status }) {
  const active = String(status).toUpperCase() === "ACTIVE";
  return (
    <span style={{
      fontSize: 10.5, padding: "2px 8px", borderRadius: 99, fontWeight: 600,
      color: active ? COLORS.teal : COLORS.muted,
      background: active ? "rgba(45,212,191,0.12)" : "rgba(138,150,163,0.12)",
      border: `1px solid ${active ? "rgba(45,212,191,0.3)" : COLORS.border}`,
    }}>{String(status).toUpperCase()}</span>
  );
}

function CplPulse({ campaigns, currency }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
        <Radio size={14} color={COLORS.teal} /> CPL PULSE
        <span style={{ color: COLORS.muted, fontWeight: 400, fontSize: 11 }}>vs. target</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", maxHeight: 260 }}>
        {campaigns.map((c) => {
          const target = c.targetCPL || Math.max(c.metrics.cpl * 1.1, 10);
          const ratio = c.metrics.cpl / target;
          const pct = Math.min(ratio, 1.6) / 1.6 * 100;
          const color = ratio <= 1 ? COLORS.teal : ratio <= 1.3 ? COLORS.amber : COLORS.coral;
          return (
            <div key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 170 }}>{c.name}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color }}>{fmtMoney(c.metrics.cpl, currency)}</span>
              </div>
              <div style={{ height: 5, background: COLORS.surface2, borderRadius: 3, overflow: "hidden", marginTop: 4 }}>
                <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .4s ease" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveLeadsFeed({ leads }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600 }}>
        <Zap size={14} color={COLORS.amber} /> LIVE LEADS
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
        {leads.length === 0 && <div style={{ color: COLORS.muted, fontSize: 12 }}>Waiting for new leads…</div>}
        {leads.map((l) => (
          <div key={l.id} style={{ borderLeft: `2px solid ${COLORS.amber}`, paddingLeft: 10, fontSize: 11.5 }}>
            <div style={{ color: COLORS.text }}>{l.campaignName || l.adId}</div>
            <div style={{ color: COLORS.muted }}>{l.adName || l.formId} · {new Date(l.receivedAt).toLocaleTimeString()}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormatIcon({ format }) {
  if (format === "video") return <Video size={12} />;
  if (format === "carousel") return <GalleryHorizontal size={12} />;
  return <ImageIcon size={12} />;
}

function CreativeCard({ ad, currency, onOpen }) {
  return (
    <div onClick={() => onOpen(ad)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden", cursor: "pointer" }}>
      <div style={{ height: 130, background: ad.thumbUrl ? `url(${ad.thumbUrl}) center/cover` : genThumbGradient(ad.id), position: "relative", display: "flex", alignItems: "flex-end", padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(11,15,20,0.7)", color: COLORS.text, fontSize: 10, padding: "3px 8px", borderRadius: 6, textTransform: "capitalize" }}>
          <FormatIcon format={ad.format} /> {ad.format}
        </div>
        <div style={{ position: "absolute", top: 10, right: 10 }}><StatusPill status={ad.status} /></div>
      </div>
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>{ad.headline}</div>
        <div style={{ color: COLORS.muted, fontSize: 11.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{ad.body}</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: 10.5, color: COLORS.muted }}>SPEND<div style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.text, fontSize: 12.5 }}>{fmtMoney(ad.metrics.spend, currency)}</div></div>
          <div style={{ fontSize: 10.5, color: COLORS.muted }}>LEADS<div style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.text, fontSize: 12.5 }}>{Math.round(ad.metrics.leads)}</div></div>
          <div style={{ fontSize: 10.5, color: COLORS.muted }}>CPL<div style={{ fontFamily: "'JetBrains Mono', monospace", color: COLORS.teal, fontSize: 12.5 }}>{fmtMoney(ad.metrics.cpl, currency)}</div></div>
        </div>
      </div>
    </div>
  );
}

function CreativeModal({ ad, currency, onClose }) {
  if (!ad) return null;
  const rows = [
    ["Spend", fmtMoney(ad.metrics.spend, currency)], ["Impressions", fmtNum(ad.metrics.impressions)],
    ["Reach", fmtNum(ad.metrics.reach)], ["Frequency", (ad.metrics.frequency || 0).toFixed(2)],
    ["Clicks", fmtNum(ad.metrics.clicks)], ["CTR", fmtPct(ad.metrics.ctr)],
    ["CPC", fmtMoney(ad.metrics.cpc, currency)], ["CPM", fmtMoney(ad.metrics.cpm, currency)],
    ["Leads", Math.round(ad.metrics.leads)], ["CPL", fmtMoney(ad.metrics.cpl, currency)],
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, maxWidth: 640, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ height: 200, background: ad.thumbUrl ? `url(${ad.thumbUrl}) center/cover` : genThumbGradient(ad.id), position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, background: "rgba(11,15,20,0.7)", border: "none", borderRadius: 8, color: COLORS.text, padding: 6, cursor: "pointer" }}><X size={16} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <StatusPill status={ad.status} />
          <h3 style={{ color: COLORS.text, fontSize: 18, margin: "8px 0" }}>{ad.headline}</h3>
          <p style={{ color: COLORS.muted, fontSize: 13, marginBottom: 16 }}>{ad.body}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 10 }}>
            {rows.map(([label, val]) => (
              <div key={label} style={{ background: COLORS.surface2, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 10, color: COLORS.muted, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: COLORS.text }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignTable({ campaigns, currency, expanded, setExpanded }) {
  const [sortKey, setSortKey] = useState("spend");
  const [sortDir, setSortDir] = useState("desc");
  const sorted = useMemo(() => {
    const arr = [...campaigns];
    arr.sort((a, b) => {
      const av = sortKey === "name" ? a.name : a.metrics[sortKey];
      const bv = sortKey === "name" ? b.name : b.metrics[sortKey];
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [campaigns, sortKey, sortDir]);
  const cols = [
    { key: "name", label: "Campaign" }, { key: "spend", label: "Spend" }, { key: "impressions", label: "Impr." },
    { key: "clicks", label: "Clicks" }, { key: "ctr", label: "CTR" }, { key: "leads", label: "Leads" }, { key: "cpl", label: "CPL" },
  ];
  const toggleSort = (k) => { if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("desc"); } };

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${COLORS.border}`, fontSize: 13, fontWeight: 600 }}>Campaigns</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
          <thead><tr>
            <th style={{ width: 28 }}></th>
            {cols.map((c) => (
              <th key={c.key} onClick={() => toggleSort(c.key)} style={{ textAlign: c.key === "name" ? "left" : "right", padding: "8px 12px", color: COLORS.muted, cursor: "pointer", borderBottom: `1px solid ${COLORS.border}` }}>
                {c.label}{sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
              </th>
            ))}
            <th style={{ width: 90, textAlign: "right", padding: "8px 12px", color: COLORS.muted, borderBottom: `1px solid ${COLORS.border}` }}>Status</th>
          </tr></thead>
          <tbody>
            {sorted.map((c) => (
              <React.Fragment key={c.id}>
                <tr onClick={() => setExpanded(expanded === c.id ? null : c.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${COLORS.border}` }}>
                  <td style={{ padding: "10px 12px", color: COLORS.muted }}><ChevronRight size={13} style={{ transform: expanded === c.id ? "rotate(90deg)" : "none" }} /></td>
                  <td style={{ padding: "10px 12px", color: COLORS.text, fontWeight: 500 }}>{c.name}<div style={{ color: COLORS.muted, fontSize: 10.5 }}>{c.objective}</div></td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{fmtMoney(c.metrics.spend, currency)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{fmtNum(c.metrics.impressions)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{fmtNum(c.metrics.clicks)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{fmtPct(c.metrics.ctr)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{fmtNum(c.metrics.leads)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", color: c.metrics.cpl <= (c.targetCPL || Infinity) ? COLORS.teal : COLORS.amber }}>{fmtMoney(c.metrics.cpl, currency)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right" }}><StatusPill status={c.status} /></td>
                </tr>
                {expanded === c.id && c.ads.map((ad) => (
                  <tr key={ad.id} style={{ background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${COLORS.border}` }}>
                    <td></td>
                    <td style={{ padding: "8px 12px 8px 28px", color: COLORS.muted, fontSize: 11.5 }}>↳ {ad.name}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: COLORS.muted, fontSize: 11.5 }}>{fmtMoney(ad.metrics.spend, currency)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: COLORS.muted, fontSize: 11.5 }}>{fmtNum(ad.metrics.impressions)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: COLORS.muted, fontSize: 11.5 }}>{fmtNum(ad.metrics.clicks)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: COLORS.muted, fontSize: 11.5 }}>{fmtPct(ad.metrics.ctr)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: COLORS.muted, fontSize: 11.5 }}>{fmtNum(ad.metrics.leads)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: COLORS.muted, fontSize: 11.5 }}>{fmtMoney(ad.metrics.cpl, currency)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}><StatusPill status={ad.status} /></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- App ---------------------------------------------------------------- */
export default function App() {
  const { accounts, snapshots, leads, connected, mode, days, setDateRange } = useLiveData();
  const [selected, setSelected] = useState([]);
  const [acctMenuOpen, setAcctMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [activeAd, setActiveAd] = useState(null);
  const [search, setSearch] = useState("");

  const activeIds = selected.length ? selected : accounts.slice(0, 1).map((a) => a.id);

  const combined = useMemo(() => {
    const campaigns = [];
    // INR is used for every account in this deployment — see fmtMoney default.
    let currency = "INR";
    activeIds.forEach((id) => {
      const snap = snapshots[id];
      if (!snap) return;
      campaigns.push(...(snap.campaigns || []));
    });
    return { campaigns, currency };
  }, [snapshots, activeIds]);

  const totals = useMemo(() => {
    const t = combined.campaigns.reduce((acc, c) => {
      acc.spend += c.metrics.spend; acc.impressions += c.metrics.impressions;
      acc.clicks += c.metrics.clicks; acc.leads += c.metrics.leads; acc.reach += c.metrics.reach;
      return acc;
    }, { spend: 0, impressions: 0, clicks: 0, leads: 0, reach: 0 });
    t.ctr = t.impressions ? (t.clicks / t.impressions) * 100 : 0;
    t.cpc = t.clicks ? t.spend / t.clicks : 0;
    t.cpm = t.impressions ? (t.spend / t.impressions) * 1000 : 0;
    t.cpl = t.leads ? t.spend / t.leads : 0;
    return t;
  }, [combined]);

  const allAds = useMemo(() => {
    const ads = combined.campaigns.flatMap((c) => c.ads.map((a) => ({ ...a, campaignName: c.name })));
    if (!search.trim()) return ads;
    const q = search.toLowerCase();
    return ads.filter((a) => (a.headline || "").toLowerCase().includes(q) || (a.name || "").toLowerCase().includes(q));
  }, [combined, search]);

  const toggleAccount = (id) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
  };

  const jumpTo = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: "100%", color: COLORS.text, fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 4px; }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* TOP BAR — sticky: logo, title, quick jump nav, date range, account switcher */}
      <div style={{
        position: "sticky", top: 0, zIndex: 30, background: "rgba(11,15,20,0.92)", backdropFilter: "blur(6px)",
        borderBottom: `1px solid ${COLORS.border}`, padding: "12px 22px",
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* TNCD logo (white variant) — swap frontend/public/tncd-logo.png to update */}
            <img
              src="/tncd-logo.png"
              alt="TNCD"
              style={{ height: 30, width: "auto", objectFit: "contain" }}
              onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }}
            />
            <div style={{
              display: "none", height: 30, width: 30, borderRadius: 6, background: COLORS.blue, color: "#fff",
              alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13,
            }}>TC</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: 99, background: connected ? COLORS.teal : COLORS.coral, boxShadow: `0 0 8px ${connected ? COLORS.teal : COLORS.coral}` }} />
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, margin: 0 }}>Campaign Analysis — Live</h1>
              </div>
              <div style={{ color: COLORS.muted, fontSize: 11, marginTop: 2 }}>
                {connected ? "Connected" : "Reconnecting…"} · {mode === "demo" ? "Demo mode" : "Live · Meta Graph API"}
              </div>
            </div>
          </div>

          {/* Quick jump nav */}
          <div style={{ display: "flex", gap: 6 }}>
            {[["overview-section", "Overview"], ["campaigns-section", "Campaigns"], ["creatives-section", "Ad Creatives"]].map(([id, label]) => (
              <button key={id} onClick={() => jumpTo(id)} style={{
                background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text,
                padding: "7px 12px", fontSize: 12, cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Date range filter */}
            <select value={days} onChange={(e) => setDateRange(Number(e.target.value), activeIds)} style={{
              background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text,
              padding: "7px 10px", fontSize: 12, cursor: "pointer",
            }}>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>

            {/* Account switcher */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setAcctMenuOpen((v) => !v)} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, padding: "7px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                {activeIds.length} Ad Account{activeIds.length !== 1 ? "s" : ""} <ChevronDown size={14} />
              </button>
              {acctMenuOpen && (
                <div style={{ position: "absolute", top: "110%", right: 0, background: COLORS.surface2, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: 8, zIndex: 20, minWidth: 240 }}>
                  {accounts.map((a) => (
                    <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12.5 }}>
                      <input type="checkbox" checked={activeIds.includes(a.id)} onChange={() => toggleAccount(a.id)} />
                      <span style={{ flex: 1 }}>{a.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 22px 40px" }}>
        <div id="overview-section">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
            <KpiCard icon={DollarSign} label="Total Spend" value={fmtMoney(totals.spend, combined.currency)} />
            <KpiCard icon={Eye} label="Impressions" value={fmtNum(totals.impressions)} sub={`Reach ${fmtNum(totals.reach)}`} />
            <KpiCard icon={MousePointerClick} label="Clicks / CTR" value={fmtNum(totals.clicks)} sub={`CTR ${fmtPct(totals.ctr)}`} />
            <KpiCard icon={Target} label="CPC / CPM" value={fmtMoney(totals.cpc, combined.currency)} sub={`CPM ${fmtMoney(totals.cpm, combined.currency)}`} />
            <KpiCard icon={Users} label="Leads" value={fmtNum(totals.leads)} />
            <KpiCard icon={Target} label="Cost Per Lead" value={fmtMoney(totals.cpl, combined.currency)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
            <CplPulse campaigns={combined.campaigns} currency={combined.currency} />
            <LiveLeadsFeed leads={leads} />
          </div>
        </div>

        <div id="campaigns-section" style={{ marginBottom: 16, scrollMarginTop: 90 }}>
          <CampaignTable campaigns={combined.campaigns} currency={combined.currency} expanded={expanded} setExpanded={setExpanded} />
        </div>

        <div id="creatives-section" style={{ scrollMarginTop: 90 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Ad Creatives</div>
            <div style={{ position: "relative" }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: 8, color: COLORS.muted }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search creatives..." style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, padding: "6px 10px 6px 28px", fontSize: 12, width: 200 }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 12 }}>
            {allAds.map((ad) => <CreativeCard key={ad.id} ad={ad} currency={combined.currency} onOpen={setActiveAd} />)}
          </div>
        </div>

        <CreativeModal ad={activeAd} currency={combined.currency} onClose={() => setActiveAd(null)} />
      </div>
    </div>
  );
}
