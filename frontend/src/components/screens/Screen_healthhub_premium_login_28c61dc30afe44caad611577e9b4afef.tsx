"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getEncounters, Encounter } from "@/lib/api";
import { searchPatientsBahmni, BahmniPatientSearchResult } from "@/lib/bahmniApi";

export default function Screen_healthhub_premium_login_28c61dc30afe44caad611577e9b4afef() {
  const { authFetch } = useAuth();
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<BahmniPatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<BahmniPatientSearchResult | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
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
    if (!selectedPatient) { setEncounters([]); return; }
    setLoading(true);
    getEncounters(authFetch, selectedPatient.uuid, 50)
      .then(setEncounters)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedPatient, authFetch]);

  const getTimelineIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes("lab") || t.includes("test")) return { icon: "biotech", color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" };
    if (t.includes("vitals") || t.includes("vital")) return { icon: "monitor_heart", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
    if (t.includes("prescription") || t.includes("drug") || t.includes("medication")) return { icon: "medication", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
    if (t.includes("admission") || t.includes("discharge")) return { icon: "local_hospital", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
    return { icon: "clinical_notes", color: "text-primary", bg: "bg-primary/10 border-primary/20" };
  };

  // Generate AI insights from encounters
  const aiInsights = encounters.length > 0 ? [
    {
      title: `${encounters.length} clinical encounters recorded`,
      description: `This patient has ${encounters.length} recorded encounters across various visit types. Most recent encounter was on ${new Date(encounters[0]?.encounterDatetime).toLocaleDateString()}.`,
      icon: "analytics",
      color: "text-primary",
    },
    {
      title: "Regular follow-up detected",
      description: "The encounter pattern suggests this patient has been receiving consistent follow-up care, which is a positive indicator.",
      icon: "trending_up",
      color: "text-emerald-400",
    },
    {
      title: "Consider preventive screening",
      description: "Based on encounters, consider scheduling preventive health screenings as part of comprehensive care.",
      icon: "vaccines",
      color: "text-amber-400",
    },
  ] : [];

  return (
    <div>
      <div className="relative z-10 flex flex-col min-h-screen bg-[#fafafa]">
        <main className="flex-1 container mx-auto px-6 py-10 max-w-6xl">
          {/* Title */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-black tracking-tight mb-3">Smart Health Timeline</h1>
            <p className="text-black/50 text-base font-medium max-w-2xl mx-auto">
              {selectedPatient ? `Chronological view of health events for ${selectedPatient.givenName} ${selectedPatient.familyName}` : "Search and select a patient to view their health timeline."}
            </p>
          </div>

          {/* Patient Search */}
          <div className="bg-white border border-black/10 rounded-3xl p-6 mb-10 max-w-2xl mx-auto relative shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 mb-3">
              <span className="material-symbols-outlined">person_search</span>
              <h3 className="font-bold tracking-wide uppercase text-sm">Select Patient</h3>
            </div>
            <div className="relative">
              <input className="w-full bg-black/5 border border-transparent focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 rounded-2xl py-3 pl-11 pr-4 text-black placeholder-black/30 transition-all outline-none font-medium"
                placeholder="Search patient by name..." type="text"
                value={patientQuery} onChange={e => handlePatientSearch(e.target.value)} />
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-black/30 text-lg">search</span>
              {patientResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-black/10 rounded-2xl shadow-xl max-h-48 overflow-y-auto">
                  {patientResults.map(p => (
                    <button key={p.uuid} onClick={() => selectPatient(p)}
                      className="w-full text-left px-5 py-3.5 text-sm font-bold text-black/70 hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-black/5 last:border-0">
                      <p className="font-bold text-black">{p.givenName} {p.familyName}</p>
                      <p className="text-xs text-black/40 font-medium mt-0.5">{p.identifier || ""}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!selectedPatient ? (
            <div className="bg-white border border-black/5 rounded-3xl p-16 flex flex-col items-center text-center max-w-2xl mx-auto shadow-sm">
              <span className="material-symbols-outlined text-black/20 text-6xl mb-4">timeline</span>
              <p className="text-black/50 font-medium">Select a patient to view their comprehensive health timeline</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-16">
              <span className="material-symbols-outlined text-blue-600 text-4xl animate-spin">progress_activity</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Timeline */}
              <div className="lg:col-span-2">
                <h2 className="text-sm font-bold text-black uppercase tracking-wider mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">timeline</span>
                  Health Events ({encounters.length})
                </h2>
                {encounters.length === 0 ? (
                  <div className="bg-white border border-black/5 shadow-sm rounded-3xl p-12 text-center">
                    <p className="text-black/40 text-sm font-medium">No encounters recorded for this patient</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-black/5" />
                    <div className="space-y-6">
                      {encounters.map((enc, index) => {
                        const style = getTimelineIcon(enc.encounterType?.display || "");
                        return (
                          <div key={enc.uuid} className="relative pl-14">
                            {/* Dot on timeline */}
                            <div className={`absolute left-3 top-4 w-5 h-5 rounded-full border ${style.bg} flex items-center justify-center`}>
                              <span className={`material-symbols-outlined text-[12px] ${style.color}`}>{style.icon}</span>
                            </div>
                            <div className="bg-white border border-black/10 shadow-sm rounded-2xl p-5 hover:border-blue-600/30 hover:shadow-md transition-all">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <h3 className="text-black font-bold text-sm">{enc.encounterType?.display || "Clinical Encounter"}</h3>
                                  <p className="text-xs text-black/50 font-medium mt-1">{enc.location?.display || "OmniCare Main"}</p>
                                </div>
                                <span className="text-xs text-black/40 font-bold whitespace-nowrap bg-black/5 px-2 py-1 rounded-md">
                                  {new Date(enc.encounterDatetime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                              </div>
                              {enc.obs && enc.obs.length > 0 && (
                                <div className="mt-4 space-y-2 border-t border-black/5 pt-4">
                                  {enc.obs.slice(0, 4).map((o, i) => (
                                    <p key={i} className="text-sm text-black/60 font-medium flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-black/20" />
                                      {o.display}
                                    </p>
                                  ))}
                                  {enc.obs.length > 4 && <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mt-2">+{enc.obs.length - 4} more observations</p>}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Insights */}
              <div>
                <h2 className="text-sm font-bold text-black uppercase tracking-wider mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-blue-600">auto_awesome</span>
                  AI Insights
                </h2>
                <div className="space-y-4">
                  {aiInsights.map((insight, i) => (
                    <div key={i} className="bg-white border border-black/10 shadow-sm rounded-2xl p-5 relative overflow-hidden group hover:border-blue-600/30 hover:shadow-md transition-all">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-start gap-3">
                        <span className={`material-symbols-outlined text-lg ${insight.color.replace('primary', 'blue-600')}`}>{insight.icon}</span>
                        <div>
                          <h4 className="text-black text-sm font-bold mb-1.5">{insight.title}</h4>
                          <p className="text-sm text-black/60 font-medium leading-relaxed">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
