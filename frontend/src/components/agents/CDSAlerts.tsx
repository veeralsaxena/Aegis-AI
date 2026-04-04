"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPatientProfile, getDrugOrders } from "@/lib/bahmniApi";

interface CDSAlertsProps {
  patientUuid: string;
  encounterId?: string;
  soapNote?: string;
  medicationsPlanned: any[];
}

export default function CDSAlerts({ patientUuid, encounterId, soapNote, medicationsPlanned }: CDSAlertsProps) {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const runCDS = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch Patient Context from Bahmni (Allergies + Current Meds)
      const profile = await getPatientProfile(authFetch, patientUuid);
      const meds = await getDrugOrders(authFetch, patientUuid, { includeActiveVisit: true });
      
      const context = {
        allergies: [], // TODO: extract from profile/observations
        current_meds: meds.map((m: any) => m.drug?.name || "Unknown"),
        medications_planned: medicationsPlanned.map((m: any) => ({
          drug: m.drug?.name || null,
          dose: m.dose,
          dose_units: m.doseUnits,
          route: m.route,
          frequency: m.frequency,
          as_needed: m.asNeeded,
          instructions: m.instructions,
        })),
        soap_note: soapNote || "",
      };

      // 2. Call the Next.js API Route for CDS
      const res = await fetch("/api/agents/cds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounter_id: encounterId || "draft-encounter",
          context
        })
      });

      if (!res.ok) {
        throw new Error("Failed to run Clinical Decision Support agent");
      }

      const data = await res.json();
      setAlerts(data.cds_alerts || []);
    } catch (err: any) {
      console.error("CDS Agent Error:", err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColors = (severity: string) => {
    switch(severity) {
      case "CRITICAL": return "bg-red-500/10 border-red-500/30 text-red-400";
      case "WARNING": return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      case "INFO": return "bg-blue-500/10 border-blue-500/30 text-blue-400";
      default: return "bg-slate-500/10 border-slate-500/30 text-slate-400";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch(severity) {
      case "CRITICAL": return "error";
      case "WARNING": return "warning";
      case "INFO": return "info";
      default: return "lightbulb";
    }
  };

  return (
    <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <span className="material-symbols-outlined text-indigo-400 text-sm">health_and_safety</span>
          </div>
          Clinical Decision Support
        </h3>
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-4">
          {error}
        </div>
      )}

      {/* Button to run check */}
      <button
        onClick={runCDS}
        disabled={loading}
        className="w-full liquid-button-secondary border border-indigo-500/30 text-indigo-400 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm hover:bg-indigo-500/10 mb-4"
      >
        {loading ? (
          <><span className="material-symbols-outlined text-lg animate-spin">progress_activity</span> Analyzing Chart...</>
        ) : (
          <><span className="material-symbols-outlined text-lg">policy</span> Run Safety Check</>
        )}
      </button>

      {/* Alerts View */}
      {alerts.length === 0 && !loading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4 py-8 border border-dashed border-white/10 rounded-xl">
          <span className="material-symbols-outlined text-slate-600 text-4xl mb-2">check_circle</span>
          <p className="text-sm text-slate-400">No active alerts. Run safety check to analyze medications and diagnoses.</p>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2">
          {alerts.map((alert: any, idx: number) => (
            <div key={alert.id || idx} className={`p-4 rounded-xl border ${getSeverityColors(alert.severity)}`}>
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-xl mt-0.5">{getSeverityIcon(alert.severity)}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">{alert.type.replace('_', ' ').toUpperCase()}</h4>
                  <p className="text-sm opacity-90">{alert.message}</p>
                  {alert.suggested_action && (
                    <div className="mt-3 bg-black/20 p-2 rounded-lg text-xs">
                      <strong>Suggestion:</strong> {alert.suggested_action}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
