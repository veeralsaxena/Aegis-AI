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

      <div className="bg-[#fafafa] min-h-screen pb-20">
        <main className="flex-1 container mx-auto px-6 py-10 max-w-5xl">
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-black tracking-tight mb-3">Routine Panel Results</h1>
            <p className="text-black/50 text-base font-medium max-w-2xl mx-auto">
              {selectedPatient ? `Observations and trends for ${selectedPatient.givenName} ${selectedPatient.familyName}` : "Search and select a patient to view panel results."}
            </p>
          </div>

          {/* Patient Search */}
          <div className="bg-white border border-black/5 shadow-sm rounded-2xl p-6 mb-10 max-w-2xl mx-auto relative">
            <div className="flex items-center gap-2 text-blue-600 mb-3">
              <span className="material-symbols-outlined">person_search</span>
              <h3 className="font-bold tracking-wide">Select Patient</h3>
            </div>
            <div className="relative">
              <input className="w-full bg-white border border-black/10 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl py-3 pl-10 pr-4 text-black placeholder-black/30 transition-all outline-none font-medium text-sm"
                placeholder="Search patient by name..." type="text"
                value={patientQuery} onChange={e => handlePatientSearch(e.target.value)} />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-black/40 text-lg">search</span>
              {patientResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {patientResults.map(p => (
                    <button key={p.uuid} onClick={() => selectPatient(p)}
                      className="w-full text-left px-4 py-3 text-sm text-black hover:bg-blue-50 transition-colors border-b border-black/5 last:border-0">
                      <p className="font-bold">{p.givenName} {p.familyName}</p>
                      <p className="text-xs text-black/50 font-medium">{p.identifier || ""}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!selectedPatient ? (
            <div className="bg-white border border-black/5 shadow-sm rounded-2xl p-16 flex flex-col items-center text-center max-w-2xl mx-auto">
              <span className="material-symbols-outlined text-black/20 text-6xl mb-4">labs</span>
              <p className="text-black/50 font-medium">Select a patient to view their routine panel results</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="material-symbols-outlined text-blue-600 text-4xl animate-spin">progress_activity</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Panel Results */}
              <div className="lg:col-span-2">
                <h2 className="text-lg font-bold text-black mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">labs</span>
                  Observations ({latestValues.length} metrics)
                </h2>
                {latestValues.length === 0 ? (
                  <div className="bg-white border border-black/5 shadow-sm rounded-2xl p-12 text-center">
                    <p className="text-black/50 text-sm font-medium">No observations recorded</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {latestValues.map((item, idx) => (
                      <div key={item.concept} className="bg-white border border-black/5 shadow-sm rounded-xl p-5 hover:border-blue-600/30 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                              <span className="material-symbols-outlined text-violet-500 text-lg">science</span>
                            </div>
                            <div>
                              <p className="text-black font-bold text-sm tracking-wide uppercase">{item.concept}</p>
                              <p className="text-xs text-black/50 font-medium">
                                {new Date(item.date).toLocaleDateString()} • {item.count} reading{item.count > 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-xl font-bold text-black">{item.value}</p>
                            <span className={`material-symbols-outlined text-lg ${item.trend === "up" ? "text-red-500" : item.trend === "down" ? "text-emerald-500" : "text-black/40"}`}>
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
                <h2 className="text-lg font-bold text-black mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">auto_awesome</span>
                  AI Analysis
                </h2>
                <div className="space-y-4">
                  {obs.length > 0 ? [
                    { title: "Data Overview", desc: `${latestValues.length} unique metrics tracked across ${obs.length} total observations.`, icon: "analytics", color: "text-blue-600", bg: "bg-blue-50" },
                    { title: "Trending Markers", desc: latestValues.filter(v => v.trend !== "neutral").length > 0 ? `${latestValues.filter(v => v.trend !== "neutral").length} markers showing active trends.` : "Insufficient historical data for trend analysis.", icon: "trending_up", color: "text-emerald-600", bg: "bg-emerald-50" },
                    { title: "Recommendation", desc: "Continue routine panel monitoring. Next panel due based on physician's schedule.", icon: "event", color: "text-amber-600", bg: "bg-amber-50" },
                  ].map((insight, i) => (
                    <div key={i} className="bg-white border border-black/5 shadow-sm rounded-xl p-5 hover:border-blue-600/20 transition-all">
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 p-2 rounded-lg ${insight.bg}`}>
                          <span className={`material-symbols-outlined text-lg ${insight.color}`}>{insight.icon}</span>
                        </div>
                        <div>
                          <h4 className="text-black text-sm font-bold mb-1">{insight.title}</h4>
                          <p className="text-xs text-black/60 font-medium leading-relaxed">{insight.desc}</p>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="bg-white border border-black/5 shadow-sm rounded-xl p-5 text-center">
                      <p className="text-black/50 text-sm font-medium">No data for analysis</p>
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
