"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPatientProfile, getDrugOrders } from "@/lib/bahmniApi";

interface ChartPrepPanelProps {
  patientUuid: string;
}

export default function ChartPrepPanel({ patientUuid }: ChartPrepPanelProps) {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    
    const fetchAndRunAgent = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Fetch Patient Context from Bahmni
        const profile = await getPatientProfile(authFetch, patientUuid);
        const meds = await getDrugOrders(authFetch, patientUuid, { includeActiveVisit: true });
        
        // Formulate context for the Agent API
        const context = {
          full_name: profile.patient?.person?.display || "Unknown",
          gender: profile.patient?.person?.gender,
          dob: profile.patient?.person?.birthdate,
          allergies: [], // TODO: extract from observations if available
          medications: meds.map((m: any) => ({
            name: m.drug?.name || "Unknown",
            dosage: m.dosingInstructions?.dose || "",
            frequency: m.dosingInstructions?.frequency || "",
            prescribed_date: m.dateActivated
          })),
          labs: [],
          encounters: [] 
        };

        // 2. Call the Next.js API Route for Chart Prep
        const res = await fetch("/api/agents/chart-prep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient_id: patientUuid,
            encounter_id: "preview-encounter", // Chart prep often runs before active encounter
            context
          })
        });

        if (!res.ok) {
          throw new Error("Failed to generate AI Chart Prep Summary");
        }

        const data = await res.json();
        if (mounted) {
          setSummary(data.pre_visit_summary);
        }
      } catch (err: any) {
        console.error("Chart Prep Error:", err);
        if (mounted) setError(err.message || "An error occurred");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchAndRunAgent();
    
    return () => { mounted = false; };
  }, [patientUuid, authFetch]);

  if (loading) {
    return (
      <div className="bg-slate-900/50 border border-primary/20 rounded-2xl p-6 backdrop-blur-xl animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-sm animate-spin">progress_activity</span>
          </div>
          <div className="h-6 w-48 bg-slate-800 rounded-lg"></div>
        </div>
        <div className="h-4 w-full bg-slate-800 rounded-lg mb-2"></div>
        <div className="h-4 w-3/4 bg-slate-800 rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-6 backdrop-blur-xl">
        <h3 className="text-red-400 font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined">error</span>
          AI Chart Prep Failed
        </h3>
        <p className="text-slate-400 text-sm mt-2">{error}</p>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="bg-gradient-to-br from-slate-900/80 to-slate-800/50 border border-primary/30 shadow-[0_0_20px_rgba(37,192,244,0.1)] rounded-2xl p-6 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary text-sm">auto_awesome</span>
          </div>
          AI Pre-Visit Summary
        </h3>
        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
          Generated Just Now
        </span>
      </div>

      <div className="space-y-4">
        {/* Active Problems */}
        {summary.active_problems?.length > 0 && (
          <div>
            <h4 className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">Active Problems</h4>
            <div className="flex flex-wrap gap-2">
              {summary.active_problems.map((prob: string, idx: number) => (
                <span key={idx} className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2.5 py-1 rounded-lg text-sm">
                  {prob}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Current Meds */}
        {summary.current_medications?.length > 0 && (
          <div>
            <h4 className="text-xs text-slate-400 uppercase tracking-wider mt-4 mb-2 font-semibold">Current Medications</h4>
            <ul className="text-sm text-slate-300 space-y-1">
              {summary.current_medications.map((med: any, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-sm text-primary mt-0.5">medication</span>
                  <span>{med.name} <span className="text-slate-500 text-xs">({med.frequency})</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing or Abnormal Labs */}
        {summary.flags?.length > 0 && (
          <div>
            <h4 className="text-xs text-slate-400 uppercase tracking-wider mt-4 mb-2 font-semibold">AI Insights / Flags</h4>
            <ul className="space-y-2">
              {summary.flags.map((flag: string, idx: number) => (
                <li key={idx} className="bg-primary/5 border border-primary/20 p-3 rounded-xl text-sm text-slate-200 flex items-start gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">lightbulb</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
