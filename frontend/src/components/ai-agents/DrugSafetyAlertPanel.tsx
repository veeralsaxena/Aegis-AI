"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aiFetchUrl, aiWsUrl } from "@/lib/aiAgentBaseUrl";

interface AlertRow {
  id: string;
  severity: string;
  title: string;
  body: string;
  rule_fired: string | null;
  status: string;
  created_at: string;
}

interface DrugSafetyAlertPanelProps {
  patientUuid: string;
  encounterUuid?: string;
  doctorUuid?: string;
}

export function DrugSafetyAlertPanel({
  patientUuid,
  doctorUuid,
}: DrugSafetyAlertPanelProps) {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const loadAlerts = useCallback(() => {
    fetch(aiFetchUrl(`/api/alerts/${patientUuid}?status=active`))
      .then((r) => r.json())
      .then((data: AlertRow[]) => setAlerts(Array.isArray(data) ? data : []))
      .catch(() => setAlerts([]));
  }, [patientUuid]);

  useEffect(() => {
    loadAlerts();

    const poll = setInterval(loadAlerts, 15000);

    const ws = new WebSocket(aiWsUrl(`/api/alerts/ws/${patientUuid}`));
    wsRef.current = ws;
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_alerts" && Array.isArray(data.alerts)) {
          setAlerts((prev) => [...data.alerts, ...prev]);
        }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };

    return () => {
      clearInterval(poll);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [patientUuid, loadAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    await fetch(aiFetchUrl(`/api/alerts/${alertId}/acknowledge`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctor_uuid: doctorUuid }),
    });
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleOverride = async (alertId: string) => {
    const reason = typeof window !== "undefined" ? window.prompt("Override reason (audit log):") : null;
    if (!reason?.trim()) return;
    await fetch(aiFetchUrl(`/api/alerts/${alertId}/override`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, doctor_uuid: doctorUuid }),
    });
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {alerts.map((alert) => {
        let ruleData: {
          decision?: string;
          concerns?: { concern_type?: string; description?: string; evidence_source?: string }[];
          alternatives?: string;
          monitoring?: string;
          safe_dose?: string;
        } = {};
        try {
          if (alert.rule_fired) ruleData = JSON.parse(alert.rule_fired);
        } catch {
          ruleData = {};
        }
        const concerns = Array.isArray(ruleData.concerns) ? ruleData.concerns : [];
        const isCritical = alert.severity === "CRITICAL";

        return (
          <div
            key={alert.id}
            className={`rounded-xl border p-4 ${
              isCritical
                ? "border-rose-200 bg-rose-50/70 shadow-sm"
                : "border-amber-500/30 bg-amber-500/5"
            }`}
          >
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <h4 className={`text-sm font-semibold ${isCritical ? "text-rose-700" : "text-amber-800"}`}>
                {isCritical ? "Critical: " : "Warning: "}
                {alert.title}
              </h4>
              {ruleData.decision && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    ruleData.decision === "BLOCK"
                      ? "bg-red-500/20 text-rose-700"
                      : "bg-amber-500/20 text-amber-800"
                  }`}
                >
                  {ruleData.decision}
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed text-slate-700">
              {(alert.body || "").split("\n\n")[0]}
            </p>
            {concerns.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {concerns.map((c, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-black/20 px-3 py-1.5 text-[11px] text-slate-700"
                  >
                    <span className="font-medium text-slate-200">
                      {(c.concern_type || "concern").replace(/_/g, " ")}:{" "}
                    </span>
                    {c.description}
                    {c.evidence_source && (
                      <span className="ml-1 text-slate-500">({c.evidence_source})</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {ruleData.alternatives ? (
              <p className="mt-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
                <span className="font-semibold">Alternatives: </span>
                {ruleData.alternatives}
              </p>
            ) : null}
            {ruleData.monitoring && ruleData.decision !== "BLOCK" ? (
              <p className="mt-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">If proceeding: </span>
                {ruleData.monitoring}
              </p>
            ) : null}
            {ruleData.safe_dose ? (
              <p className="mt-2 rounded-lg bg-blue-500/10 px-3 py-2 text-[11px] text-blue-200">
                <span className="font-semibold">Dose: </span>
                {ruleData.safe_dose}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAcknowledge(alert.id)}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-slate-900"
              >
                Acknowledge
              </button>
              {ruleData.decision !== "BLOCK" && (
                <button
                  type="button"
                  onClick={() => handleOverride(alert.id)}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-700"
                >
                  Override with reason
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
