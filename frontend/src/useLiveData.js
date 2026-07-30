import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export function useLiveData() {
  const [accounts, setAccounts] = useState([]);
  const [snapshots, setSnapshots] = useState({}); // { [accountId]: { account, campaigns } }
  const [leads, setLeads] = useState([]); // live feed, newest first
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState("demo");
  const [days, setDays] = useState(7);
  const socketRef = useRef(null);

  const fetchSnapshot = useCallback((ids, rangeDays) => {
    const q = new URLSearchParams();
    if (ids && ids.length) q.set("ids", ids.join(","));
    if (rangeDays) q.set("days", String(rangeDays));
    return fetch(`${API_URL}/api/snapshot?${q.toString()}`)
      .then((r) => r.json())
      .then((rows) => {
        setSnapshots((prev) => {
          const next = { ...prev };
          rows.forEach((row) => { next[row.account.id] = row; });
          return next;
        });
      });
  }, []);

  const setDateRange = useCallback((rangeDays, ids) => {
    setDays(rangeDays);
    fetchSnapshot(ids, rangeDays);
  }, [fetchSnapshot]);

  useEffect(() => {
    fetch(`${API_URL}/api/health`).then((r) => r.json()).then((d) => setMode(d.mode)).catch(() => {});
    fetch(`${API_URL}/api/accounts`).then((r) => r.json()).then(setAccounts).catch(() => {});
    fetchSnapshot(null, days);

    const socket = io(API_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("data:update", (rows) => {
      setSnapshots((prev) => {
        const next = { ...prev };
        rows.forEach((row) => { next[row.account.id] = row; });
        return next;
      });
    });

    socket.on("lead:new", (lead) => {
      setLeads((prev) => [lead, ...prev].slice(0, 30));
    });

    return () => socket.disconnect();
  }, []);

  return { accounts, snapshots, leads, connected, mode, apiUrl: API_URL, days, setDateRange, fetchSnapshot };
}
