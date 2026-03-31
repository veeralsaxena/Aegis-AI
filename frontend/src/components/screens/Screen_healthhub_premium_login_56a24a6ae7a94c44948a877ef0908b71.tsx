"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getObs, Obs } from "@/lib/api";
import { searchPatientsBahmni, BahmniPatientSearchResult } from "@/lib/bahmniApi";

export default function Screen_healthhub_premium_login_56a24a6ae7a94c44948a877ef0908b71() {
  const { authFetch } = useAuth();
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<BahmniPatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<BahmniPatientSearchResult | null>(null);
  const [obs, setObs] = useState<Obs[]>([]);
  const [loading, setLoading] = useState(false);

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
    if (!selectedPatient) { setObs([]); return; }
    setLoading(true);
    getObs(authFetch, selectedPatient.uuid)
      .then(setObs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedPatient, authFetch]);

  // Group obs by concept for the panel view
  const obsByConcept = obs.reduce((acc, o) => {
    const key = o.concept?.display || "Unknown";
    if (!acc[key]) acc[key] = [];
    acc[key].push(o);
    return acc;
  }, {} as Record<string, Obs[]>);

  // Get latest value for each concept
  const latestValues = Object.entries(obsByConcept).map(([concept, observations]) => {
    const sorted = [...observations].sort((a, b) => new Date(b.obsDatetime).getTime() - new Date(a.obsDatetime).getTime());
    const latest = sorted[0];
    const previous = sorted[1];
    return {
      concept,
      value: typeof latest.value === "object" ? latest.value?.display || JSON.stringify(latest.value) : String(latest.value),
      date: latest.obsDatetime,
      trend: previous ? (parseFloat(String(latest.value)) > parseFloat(String(previous.value)) ? "up" : "down") : "neutral",
      count: observations.length,
    };
  });

  return (
    <div>
  
  <div className="relative z-10 flex flex-col min-h-screen">
    <header className="w-full px-8 py-5 flex items-center justify-between border-b border-white/5 bg-background-dark/50 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary text-3xl" style={{filter: 'drop-shadow(0 0 8px rgba(37,192,244,0.5))'}}>ecg_heart</span>
        <span className="text-2xl font-bold tracking-tight text-white">Aegis AI</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-slate-400 font-light">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-lg" />
        System Online
      </div>
    </header>

    <main className="flex-1 container mx-auto px-6 py-10 max-w-5xl">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-semibold text-white tracking-tight mb-3">Routine Panel Results</h1>
        <p className="text-slate-400 text-base font-light max-w-2xl mx-auto">
          {selectedPatient ? `Observations and trends for ${selectedPatient.givenName} ${selectedPatient.familyName}` : "Search and select a patient to view panel results."}
        </p>
      </div>

      {/* Patient Search */}
      <div className="glass-panel rounded-2xl p-6 mb-10 max-w-2xl mx-auto relative">
        <div className="flex items-center gap-2 text-primary mb-3">
          <span className="material-symbols-outlined" style={{filter: 'drop-shadow(0 0 5px rgba(37,192,244,0.5))'}}>person_search</span>
          <h3 className="font-medium tracking-wide">Select Patient</h3>
        </div>
        <div className="relative">
          <input className="w-full bg-black/30 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 transition-all outline-none font-light"
            placeholder="Search patient by name..." type="text"
            value={patientQuery} onChange={e => handlePatientSearch(e.target.value)} />
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
          {patientResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
              {patientResults.map(p => (
                <button key={p.uuid} onClick={() => selectPatient(p)}
                  className="w-full text-left px-4 py-3 text-sm text-white hover:bg-primary/10 transition-colors border-b border-white/5 last:border-0">
                  <p className="font-medium">{p.givenName} {p.familyName}</p>
                  <p className="text-xs text-slate-500">{p.identifier || ""}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!selectedPatient ? (
        <div className="glass-panel rounded-2xl p-16 flex flex-col items-center text-center max-w-2xl mx-auto">
          <span className="material-symbols-outlined text-slate-600 text-6xl mb-4">labs</span>
          <p className="text-slate-400 font-light">Select a patient to view their routine panel results</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Panel Results */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">labs</span>
              Observations ({latestValues.length} metrics)
            </h2>
            {latestValues.length === 0 ? (
              <div className="glass-panel rounded-2xl p-12 text-center">
                <p className="text-slate-500 text-sm font-light">No observations recorded</p>
              </div>
            ) : (
              <div className="space-y-3">
                {latestValues.map((item, idx) => (
                  <div key={item.concept} className="glass-panel rounded-xl p-5 hover:border-primary/20 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-violet-400 text-lg">science</span>
                        </div>
                        <div>
                          <p className="text-white font-medium text-sm">{item.concept}</p>
                          <p className="text-xs text-slate-500 font-light">
                            {new Date(item.date).toLocaleDateString()} • {item.count} reading{item.count > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-xl font-bold text-white font-mono">{item.value}</p>
                        <span className={`material-symbols-outlined text-lg ${item.trend === "up" ? "text-red-400" : item.trend === "down" ? "text-emerald-400" : "text-slate-500"}`}>
                          {item.trend === "up" ? "trending_up" : item.trend === "down" ? "trending_down" : "trending_flat"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Analysis */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
              AI Analysis
            </h2>
            <div className="space-y-4">
              {obs.length > 0 ? [
                { title: "Data Overview", desc: `${latestValues.length} unique metrics tracked across ${obs.length} total observations.`, icon: "analytics", color: "text-primary" },
                { title: "Trending Markers", desc: latestValues.filter(v => v.trend !== "neutral").length > 0 ? `${latestValues.filter(v => v.trend !== "neutral").length} markers showing active trends.` : "Insufficient historical data for trend analysis.", icon: "trending_up", color: "text-emerald-400" },
                { title: "Recommendation", desc: "Continue routine panel monitoring. Next panel due based on physician's schedule.", icon: "event", color: "text-amber-400" },
              ].map((insight, i) => (
                <div key={i} className="glass-panel rounded-xl p-5 group hover:border-primary/20 transition-all">
                  <div className="flex items-start gap-3">
                    <span className={`material-symbols-outlined text-lg ${insight.color}`} style={{filter: 'drop-shadow(0 0 5px currentColor)'}}>{insight.icon}</span>
                    <div>
                      <h4 className="text-white text-sm font-medium mb-1">{insight.title}</h4>
                      <p className="text-xs text-slate-400 font-light leading-relaxed">{insight.desc}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="glass-panel rounded-xl p-5 text-center">
                  <p className="text-slate-500 text-sm font-light">No data for analysis</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  </div>
</div>
  );
}
