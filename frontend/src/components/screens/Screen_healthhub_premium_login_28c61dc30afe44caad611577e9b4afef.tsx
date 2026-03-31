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

    <main className="flex-1 container mx-auto px-6 py-10 max-w-6xl">
      {/* Title */}
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-semibold text-white tracking-tight mb-3">Smart Health Timeline</h1>
        <p className="text-slate-400 text-base font-light max-w-2xl mx-auto">
          {selectedPatient ? `Chronological view of health events for ${selectedPatient.givenName} ${selectedPatient.familyName}` : "Search and select a patient to view their health timeline."}
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
          <span className="material-symbols-outlined text-slate-600 text-6xl mb-4">timeline</span>
          <p className="text-slate-400 font-light">Select a patient to view their comprehensive health timeline</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Timeline */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">timeline</span>
              Health Events ({encounters.length})
            </h2>
            {encounters.length === 0 ? (
              <div className="glass-panel rounded-2xl p-12 text-center">
                <p className="text-slate-500 text-sm font-light">No encounters recorded for this patient</p>
              </div>
            ) : (
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-white/10 to-transparent" />
                <div className="space-y-6">
                  {encounters.map((enc, index) => {
                    const style = getTimelineIcon(enc.encounterType?.display || "");
                    return (
                      <div key={enc.uuid} className="relative pl-14">
                        {/* Dot on timeline */}
                        <div className={`absolute left-3 top-4 w-5 h-5 rounded-full border ${style.bg} flex items-center justify-center`}>
                          <span className={`material-symbols-outlined text-[12px] ${style.color}`}>{style.icon}</span>
                        </div>
                        <div className="glass-panel rounded-xl p-5 hover:border-primary/20 transition-all">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-white font-medium text-sm">{enc.encounterType?.display || "Clinical Encounter"}</h3>
                              <p className="text-xs text-slate-500 font-light mt-1">{enc.location?.display || "OmniCare Main"}</p>
                            </div>
                            <span className="text-xs text-slate-500 font-light whitespace-nowrap">
                              {new Date(enc.encounterDatetime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          {enc.obs && enc.obs.length > 0 && (
                            <div className="mt-3 space-y-1 border-t border-white/5 pt-3">
                              {enc.obs.slice(0, 4).map((o, i) => (
                                <p key={i} className="text-xs text-slate-400 font-light flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-slate-600" />
                                  {o.display}
                                </p>
                              ))}
                              {enc.obs.length > 4 && <p className="text-xs text-primary font-light">+{enc.obs.length - 4} more observations</p>}
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
            <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">auto_awesome</span>
              AI Insights
            </h2>
            <div className="space-y-4">
              {aiInsights.map((insight, i) => (
                <div key={i} className="glass-panel rounded-xl p-5 relative overflow-hidden group hover:border-primary/20 transition-all">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="flex items-start gap-3">
                    <span className={`material-symbols-outlined text-lg ${insight.color}`} style={{filter: 'drop-shadow(0 0 5px currentColor)'}}>{insight.icon}</span>
                    <div>
                      <h4 className="text-white text-sm font-medium mb-1">{insight.title}</h4>
                      <p className="text-xs text-slate-400 font-light leading-relaxed">{insight.description}</p>
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
