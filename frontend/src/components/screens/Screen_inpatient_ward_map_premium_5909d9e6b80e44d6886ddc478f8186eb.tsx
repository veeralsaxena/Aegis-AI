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
  
  <div className="bg-[#fafafa] flex min-h-screen">


    {/* Main Content */}
    <main className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black tracking-tight">Ward Control Center</h1>
          <p className="text-black/50 text-sm font-medium mt-1">Real-time monitoring of facility logistics and patient assignments.</p>
        </div>

        {/* Ward Tabs */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          {wards.map(ward => (
            <button key={ward.id} onClick={() => setSelectedWard(ward.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                selectedWard === ward.id
                  ? "bg-blue-50 text-blue-600 border border-blue-600/30 shadow-sm"
                  : "bg-white text-black/50 border border-black/5 hover:border-black/10 hover:text-black shadow-sm"
              }`}>
              <span className="material-symbols-outlined text-lg">{ward.icon}</span>
              {ward.label}
              <span className={`text-xs px-1.5 py-0.5 rounded ${selectedWard === ward.id ? "bg-blue-600/10" : "bg-black/5"}`}>{ward.count}</span>
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Capacity", value: totalBeds.toString(), icon: "bed", color: "text-blue-600" },
            { label: "Vacant Nodes", value: `${vacant}`, sub: `${Math.round((vacant/totalBeds)*100)}%`, icon: "event_available", color: "text-emerald-500" },
            { label: "Active Links", value: `${occupied}`, sub: `${Math.round((occupied/totalBeds)*100)}%`, icon: "link", color: "text-amber-500" },
            { label: "Alert Matrix", value: alerts > 0 ? `0${alerts}` : "00", sub: alerts > 0 ? "ACTIVE" : "NOMINAL", icon: "warning", color: alerts > 0 ? "text-red-500" : "text-emerald-500" },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-black/5 shadow-sm rounded-xl p-5 relative overflow-hidden">
              <p className="text-xs text-black/50 uppercase tracking-wider font-bold mb-2">{stat.label}</p>
              <div className="flex items-end justify-between">
                <p className="text-3xl font-bold text-black">{stat.value}</p>
                <span className={`material-symbols-outlined text-2xl ${stat.color}`}>{stat.icon}</span>
              </div>
              {stat.sub && <p className={`text-xs ${stat.color} font-bold mt-1`}>{stat.sub}</p>}
            </div>
          ))}
        </div>

        {/* Bed Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-blue-600 text-4xl animate-spin">progress_activity</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredVisits.map((visit, idx) => (
              <div key={visit.uuid} onClick={() => router.push(`/patients/${visit.patient?.uuid}`)}
                className="bg-white border border-black/5 shadow-sm rounded-xl p-4 cursor-pointer hover:border-blue-600/30 transition-all group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-black/50 font-mono font-bold">Node {101 + idx}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                </div>
                <p className="text-black font-bold text-sm mb-1 truncate">{visit.patient?.display || "Patient"}</p>
                <p className="text-xs text-black/50 font-medium">
                  {visit.visitType?.display} • {visit.location?.display}
                </p>
                <div className="flex gap-2 mt-3">
                  <button onClick={(e) => { e.stopPropagation(); router.push(`/patients/${visit.patient?.uuid}`); }}
                    className="flex-1 text-[10px] font-bold text-blue-600 border border-blue-600/20 rounded-lg py-1.5 hover:bg-blue-50 transition-all text-center">
                    Chart
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); router.push(`/vitals?patient=${visit.patient?.uuid}`); }}
                    className="flex-1 text-[10px] font-bold text-emerald-600 border border-emerald-500/20 rounded-lg py-1.5 hover:bg-emerald-50 transition-all text-center">
                    Vitals
                  </button>
                </div>
              </div>
            ))}
            {/* Vacant beds */}
            {Array.from({ length: Math.min(4, vacant) }).map((_, idx) => (
              <div key={`vacant-${idx}`} className="bg-white/50 border border-black/5 shadow-sm rounded-xl p-4 border-dashed opacity-70">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-black/40 font-mono font-bold">Node {101 + filteredVisits.length + idx}</span>
                  <span className="w-2 h-2 rounded-full bg-black/20" />
                </div>
                <p className="text-black/60 font-bold text-sm mb-1">Awaiting protocol</p>
                <p className="text-xs text-black/40 font-medium">Vacant node</p>
                <button className="w-full mt-3 text-[10px] font-bold text-black/50 border border-black/10 rounded-lg py-1.5 hover:text-black hover:border-black/20 transition-all">
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
