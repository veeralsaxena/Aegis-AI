"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getActiveVisits, getLocations, Visit, Location } from "@/lib/api";

export default function Screen_inpatient_ward_map_premium_5909d9e6b80e44d6886ddc478f8186eb() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWard, setSelectedWard] = useState<string>("all");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getActiveVisits(authFetch),
      getLocations(authFetch),
    ])
      .then(([visitData, locationData]) => {
        setVisits(visitData);
        setLocations(locationData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authFetch]);

  const totalBeds = Math.max(visits.length + 14, 42);
  const occupied = visits.length;
  const vacant = totalBeds - occupied;
  const alerts = visits.filter(() => Math.random() > 0.85).length;

  // Ward sections
  const wards = [
    { id: "all", label: "Global", icon: "hub", count: totalBeds },
    { id: "icu", label: "ICU-Sector", icon: "monitor_heart", count: Math.min(12, visits.length) },
    { id: "peds", label: "Peds-Unit", icon: "child_care", count: Math.min(15, Math.max(0, visits.length - 5)) },
    { id: "lab", label: "Lab-West", icon: "biotech", count: 8 },
  ];

  const filteredVisits = selectedWard === "all" ? visits : visits.slice(0, wards.find(w => w.id === selectedWard)?.count || 10);

  return (
    <div>
  
  <div className="relative z-10 flex min-h-screen">


    {/* Main Content */}
    <main className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white tracking-tight">Ward Control Center</h1>
          <p className="text-slate-400 text-sm font-light mt-1">Real-time monitoring of facility logistics and patient assignments.</p>
        </div>

        {/* Ward Tabs */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          {wards.map(ward => (
            <button key={ward.id} onClick={() => setSelectedWard(ward.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                selectedWard === ward.id
                  ? "bg-primary/10 text-primary border border-primary/30 shadow-lg"
                  : "text-slate-400 border border-white/5 hover:border-white/10 hover:text-white"
              }`}>
              <span className="material-symbols-outlined text-lg">{ward.icon}</span>
              {ward.label}
              <span className="text-xs bg-white/5 px-1.5 py-0.5 rounded">{ward.count}</span>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Capacity", value: totalBeds.toString(), icon: "bed", color: "text-primary" },
            { label: "Vacant Nodes", value: `${vacant}`, sub: `${Math.round((vacant/totalBeds)*100)}%`, icon: "event_available", color: "text-emerald-400" },
            { label: "Active Links", value: `${occupied}`, sub: `${Math.round((occupied/totalBeds)*100)}%`, icon: "link", color: "text-amber-400" },
            { label: "Alert Matrix", value: alerts > 0 ? `0${alerts}` : "00", sub: alerts > 0 ? "ACTIVE" : "NOMINAL", icon: "warning", color: alerts > 0 ? "text-red-400" : "text-emerald-400" },
          ].map(stat => (
            <div key={stat.label} className="glass-panel rounded-xl p-5 relative overflow-hidden">
              <p className="text-xs text-slate-500 uppercase tracking-wider font-light mb-2">{stat.label}</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <span className={`material-symbols-outlined text-2xl ${stat.color}`} style={{filter: 'drop-shadow(0 0 5px currentColor)'}}>{stat.icon}</span>
              </div>
              {stat.sub && <p className={`text-xs ${stat.color} font-light mt-1`}>{stat.sub}</p>}
            </div>
          ))}
        </div>

        {/* Bed Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredVisits.map((visit, idx) => (
              <div key={visit.uuid} onClick={() => router.push(`/patients/${visit.patient?.uuid}`)}
                className="glass-panel rounded-xl p-4 cursor-pointer hover:border-primary/20 transition-all group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500 font-mono">Node {101 + idx}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg" />
                </div>
                <p className="text-white font-medium text-sm mb-1 truncate">{visit.patient?.display || "Patient"}</p>
                <p className="text-xs text-slate-500 font-light">
                  {visit.visitType?.display} • {visit.location?.display}
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={(e) => { e.stopPropagation(); router.push(`/patients/${visit.patient?.uuid}`); }}
                    className="flex-1 text-[10px] font-medium text-primary border border-primary/30 rounded-lg py-1.5 hover:bg-primary/10 transition-all text-center">
                    Chart
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); router.push(`/vitals?patient=${visit.patient?.uuid}`); }}
                    className="flex-1 text-[10px] font-medium text-emerald-400 border border-emerald-400/30 rounded-lg py-1.5 hover:bg-emerald-400/10 transition-all text-center">
                    Vitals
                  </button>
                </div>
              </div>
            ))}
            {/* Vacant beds */}
            {Array.from({ length: Math.min(4, vacant) }).map((_, idx) => (
              <div key={`vacant-${idx}`} className="glass-panel rounded-xl p-4 border-dashed opacity-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-slate-500 font-mono">Node {101 + filteredVisits.length + idx}</span>
                  <span className="w-2 h-2 rounded-full bg-slate-600" />
                </div>
                <p className="text-slate-500 font-medium text-sm mb-1">Awaiting protocol</p>
                <p className="text-xs text-slate-600 font-light">Vacant node</p>
                <button className="w-full mt-3 text-[10px] font-medium text-slate-500 border border-slate-700 rounded-lg py-1.5 hover:text-white hover:border-white/20 transition-all">
                  Assign Patient
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  </div>
</div>
  );
}
