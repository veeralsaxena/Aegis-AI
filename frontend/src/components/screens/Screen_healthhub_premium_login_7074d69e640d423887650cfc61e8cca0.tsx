"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getActiveVisits, Visit, searchPatients, Patient } from "@/lib/api";

export default function Screen_healthhub_premium_login_7074d69e640d423887650cfc61e8cca0() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activeVisits, setActiveVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"queue" | "schedule" | "analytics">("queue");

  // Load active visits on mount
  useEffect(() => {
    setLoading(true);
    getActiveVisits(authFetch)
      .then(setActiveVisits)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authFetch]);

  // Search patients
  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setPatients([]); return; }
    setSearching(true);
    try {
      const results = await searchPatients(authFetch, q);
      setPatients(results);
    } catch (e) { console.error(e); }
    setSearching(false);
  }, [authFetch]);

  const getStatusColor = (hasActiveVisit: boolean) => {
    return hasActiveVisit
      ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
      : "bg-amber-400/10 text-amber-400 border-amber-400/20";
  };

  return (
    <div>
  
  <div className="relative z-10 flex flex-col min-h-screen">
    <header className="relative z-20 w-full px-8 py-5 flex items-center justify-between border-b border-white/5 bg-background-dark/50 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary text-3xl" style={{filter: 'drop-shadow(0 0 8px rgba(37,192,244,0.5))'}}>ecg_heart</span>
        <span className="text-2xl font-bold tracking-tight text-white">Aegis AI</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-400 font-light">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-lg" />
          System Online
        </div>
      </div>
    </header>
    <main className="flex-1 container mx-auto px-6 py-10 max-w-6xl">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">Patient Queue</h1>
          <p className="text-slate-400 text-sm font-light mt-1">Today&apos;s active patients and clinical queue — {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div className="flex gap-2">
          {(["queue", "schedule", "analytics"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-primary/10 text-primary border border-primary/30 shadow-lg"
                  : "text-slate-400 hover:text-white border border-transparent hover:border-white/10"
              }`}>
              {tab === "queue" ? "Active Queue" : tab === "schedule" ? "Schedule" : "Analytics"}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="glass-panel rounded-2xl p-6 mb-8 relative">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
            <input
              className="w-full bg-black/30 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 transition-all outline-none font-light"
              placeholder="Search patients by name, ID, or condition..."
              type="text"
              value={query}
              onChange={e => handleSearch(e.target.value)}
            />
            {searching && <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-primary animate-spin text-sm">progress_activity</span>}
          </div>
          <button
            onClick={() => router.push("/patients/new")}
            className="px-5 py-3 bg-primary hover:bg-primary/90 text-background-dark font-medium rounded-xl shadow-lg transition-all flex items-center gap-2 text-sm whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Add Patient
          </button>
        </div>

        {/* Search Results Dropdown */}
        {patients.length > 0 && query.trim().length >= 2 && (
          <div className="absolute z-50 left-6 right-6 mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
            {patients.map(p => (
              <button key={p.uuid} onClick={() => router.push(`/patients/${p.uuid}`)}
                className="w-full text-left px-4 py-3 text-sm text-white hover:bg-primary/10 transition-colors border-b border-white/5 last:border-0 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-lg">person</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{p.person?.display}</p>
                  <p className="text-xs text-slate-500">{p.identifiers?.[0]?.display?.split(' = ')[1] || p.identifiers?.[0]?.display || ""} • {p.person?.gender === "M" ? "Male" : "Female"}, {p.person?.age} yrs</p>
                </div>
                <span className="material-symbols-outlined text-slate-600 text-sm">chevron_right</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Queue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Active Visits", value: activeVisits.length.toString(), icon: "group", color: "text-primary" },
          { label: "Waiting", value: Math.max(0, activeVisits.length - 2).toString(), icon: "schedule", color: "text-amber-400" },
          { label: "In Progress", value: Math.min(2, activeVisits.length).toString(), icon: "clinical_notes", color: "text-emerald-400" },
          { label: "Completed Today", value: "0", icon: "check_circle", color: "text-violet-400" },
        ].map(stat => (
          <div key={stat.label} className="glass-panel rounded-xl p-4 flex items-center gap-3">
            <span className={`material-symbols-outlined text-2xl ${stat.color}`} style={{filter: `drop-shadow(0 0 5px currentColor)`}}>{stat.icon}</span>
            <div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-slate-400 font-light">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active Queue */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-xl">queue</span>
          Active Queue
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
          </div>
        ) : activeVisits.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-slate-600 text-5xl mb-4">event_available</span>
            <p className="text-slate-400 text-sm font-light">No active visits at the moment</p>
          </div>
        ) : (
          activeVisits.map((visit, idx) => (
            <div key={visit.uuid} className="glass-panel rounded-xl p-5 flex items-center gap-4 hover:border-primary/20 transition-all cursor-pointer group"
              onClick={() => router.push(`/patients/${visit.patient?.uuid}`)}>
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/20 shrink-0">
                <span className="material-symbols-outlined text-primary text-xl">person</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white font-medium text-sm truncate">{visit.patient?.display || visit.display}</p>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${getStatusColor(true)}`}>
                    Active Visit
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-light">
                  {visit.visitType?.display} • {visit.location?.display} • Started {new Date(visit.startDatetime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); router.push(`/patients/${visit.patient?.uuid}`); }}
                  className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all">
                  Review
                </button>
                <button onClick={(e) => { e.stopPropagation(); router.push(`/vitals?patient=${visit.patient?.uuid}`); }}
                  className="px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-400/30 rounded-lg hover:bg-emerald-400/10 transition-all">
                  Vitals
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  </div>
</div>
  );
}
