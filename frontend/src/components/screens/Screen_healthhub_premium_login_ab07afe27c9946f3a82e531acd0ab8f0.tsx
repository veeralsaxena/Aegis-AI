"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getEncounters, Encounter } from "@/lib/api";
import { searchPatientsBahmni, BahmniPatientSearchResult, getLabOrders } from "@/lib/bahmniApi";

export default function Screen_healthhub_premium_login_ab07afe27c9946f3a82e531acd0ab8f0() {
  const { authFetch } = useAuth();
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<BahmniPatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<BahmniPatientSearchResult | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);

  const handlePatientSearch = useCallback(async (q: string) => {
    setPatientQuery(q);
    if (q.trim().length < 2) { setPatientResults([]); return; }
    const results = await searchPatientsBahmni(authFetch, q);
    setPatientResults(results);
  }, [authFetch]);

  const selectPatient = (p: BahmniPatientSearchResult) => {
    setSelectedPatient(p);
    setPatientQuery(`${p.givenName} ${p.familyName}`);
    setPatientResults([]);
  };

  useEffect(() => {
    if (!selectedPatient) { setEncounters([]); return; }
    setLoading(true);
    getEncounters(authFetch, selectedPatient.uuid, 30)
      .then(data => {
        setEncounters(data);
        if (data.length > 0) setSelectedEncounter(data[0]);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedPatient, authFetch]);

  const getStatusColor = (idx: number) => {
    const colors = [
      "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
      "bg-amber-400/10 text-amber-400 border-amber-400/20",
      "bg-violet-400/10 text-violet-400 border-violet-400/20",
    ];
    return colors[idx % colors.length];
  };

  return (
    <div>
  
  <div className="relative z-10 flex min-h-screen">
    {/* Sidebar — Lab Orders */}
    <aside className="hidden lg:flex w-80 border-r border-white/5 bg-background-dark/70 backdrop-blur-xl flex-col">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-primary text-2xl" style={{filter: 'drop-shadow(0 0 8px rgba(37,192,244,0.5))'}}>ecg_heart</span>
          <span className="text-xl font-bold tracking-tight text-white">Aegis AI</span>
        </div>
        <div className="relative">
          <input className="w-full bg-black/30 border border-slate-700/50 focus:border-primary rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none"
            placeholder="Search patient..." type="text" value={patientQuery}
            onChange={e => handlePatientSearch(e.target.value)} />
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
          {patientResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
              {patientResults.map(p => (
                <button key={p.uuid} onClick={() => selectPatient(p)}
                  className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-primary/10 transition-colors border-b border-white/5 last:border-0">
                  {p.givenName} {p.familyName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {selectedPatient && (
          <div className="p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-light mb-3 px-2">Lab Orders ({encounters.length})</p>
            {encounters.map((enc, idx) => (
              <button key={enc.uuid} onClick={() => setSelectedEncounter(enc)}
                className={`w-full text-left p-3 rounded-xl mb-2 transition-all border ${selectedEncounter?.uuid === enc.uuid ? "bg-primary/10 border-primary/30" : "border-white/5 hover:bg-white/5 hover:border-white/10"}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-white text-sm font-medium truncate">{enc.encounterType?.display || "Lab Panel"}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${getStatusColor(idx)}`}>
                    {enc.obs?.length > 0 ? "Results" : "Pending"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-light">{new Date(enc.encounterDatetime).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>

    {/* Main Content */}
    <main className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white tracking-tight flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl" style={{filter: 'drop-shadow(0 0 8px rgba(37,192,244,0.5))'}}>biotech</span>
            Lab Results & Diagnostics
          </h1>
          <p className="text-slate-400 text-sm font-light mt-1">
            {selectedPatient ? `Viewing diagnostic results for ${selectedPatient.givenName} ${selectedPatient.familyName}` : "Select a patient to view lab results"}
          </p>
        </div>

        {!selectedPatient ? (
          <div className="glass-panel rounded-2xl p-16 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-slate-600 text-6xl mb-4">science</span>
            <p className="text-slate-400 font-light">Search and select a patient from the sidebar to view lab results</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
          </div>
        ) : selectedEncounter ? (
          <>
            {/* Encounter Header */}
            <div className="glass-panel rounded-2xl p-6 mb-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">{selectedEncounter.encounterType?.display || "Lab Panel"}</h2>
                  <p className="text-xs text-slate-500 font-light mt-1">
                    {new Date(selectedEncounter.encounterDatetime).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    {selectedEncounter.location && ` • ${selectedEncounter.location.display}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">download</span> Download PDF
                  </button>
                  <button className="px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-400/30 rounded-lg hover:bg-emerald-400/10 transition-all flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">share</span> Share
                  </button>
                </div>
              </div>
            </div>

            {/* Observations Table */}
            {selectedEncounter.obs && selectedEncounter.obs.length > 0 ? (
              <div className="glass-panel rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-6 py-4 text-xs text-slate-400 font-medium uppercase tracking-wider">Biomarker</th>
                      <th className="text-left px-6 py-4 text-xs text-slate-400 font-medium uppercase tracking-wider">Result</th>
                      <th className="text-left px-6 py-4 text-xs text-slate-400 font-medium uppercase tracking-wider">Date</th>
                      <th className="text-left px-6 py-4 text-xs text-slate-400 font-medium uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEncounter.obs.map((o, idx) => {
                      const value = typeof o.value === "object" ? o.value?.display || JSON.stringify(o.value) : String(o.value);
                      return (
                        <tr key={o.uuid || idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-white text-sm font-medium">{o.concept?.display || "Unknown"}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-white text-sm font-mono">{value}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-slate-400 text-xs font-light">{new Date(o.obsDatetime).toLocaleDateString()}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">Normal</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="glass-panel rounded-2xl p-12 text-center">
                <span className="material-symbols-outlined text-slate-600 text-4xl mb-3">pending</span>
                <p className="text-slate-400 text-sm font-light">No observations recorded for this encounter</p>
              </div>
            )}
          </>
        ) : (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <span className="material-symbols-outlined text-slate-600 text-4xl mb-3">labs</span>
            <p className="text-slate-400 text-sm font-light">Select a lab order from the sidebar to view results</p>
          </div>
        )}
      </div>
    </main>
  </div>
</div>
  );
}
