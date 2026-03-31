"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getOrders, searchDrugs, createEncounter, Order, Drug } from "@/lib/api";
import { searchPatientsBahmni, BahmniPatientSearchResult, getAllDrugOrders } from "@/lib/bahmniApi";

export default function Screen_healthhub_premium_login_9e2731a6e05f48c0802c9f8a1e3b4f75() {
  const { authFetch } = useAuth();
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<BahmniPatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<BahmniPatientSearchResult | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"active" | "refills" | "interactions">("active");
  const [showNewRx, setShowNewRx] = useState(false);
  const [drugQuery, setDrugQuery] = useState("");
  const [drugResults, setDrugResults] = useState<Drug[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [rxForm, setRxForm] = useState({ dose: "", frequency: "", duration: "", instructions: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  // Load orders when patient is selected
  useEffect(() => {
    if (!selectedPatient) { setOrders([]); return; }
    setLoading(true);
    getOrders(authFetch, selectedPatient.uuid)
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedPatient, authFetch]);

  // Drug search
  useEffect(() => {
    if (!drugQuery.trim()) { setDrugResults([]); return; }
    const timer = setTimeout(async () => {
      const results = await searchDrugs(authFetch, drugQuery);
      setDrugResults(results);
    }, 300);
    return () => clearTimeout(timer);
  }, [drugQuery, authFetch]);

  const handlePrescribe = async () => {
    if (!selectedPatient || !selectedDrug) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await createEncounter(authFetch, selectedPatient.uuid, "Consultation", [{
        concept: "Medication",
        value: `${selectedDrug.display} - Dose: ${rxForm.dose}, Frequency: ${rxForm.frequency}, Duration: ${rxForm.duration}. Instructions: ${rxForm.instructions}`,
      }]);
      if (result.ok) {
        setMessage({ type: "success", text: "Prescription saved successfully!" });
        setShowNewRx(false);
        setSelectedDrug(null);
        setDrugQuery("");
        setRxForm({ dose: "", frequency: "", duration: "", instructions: "" });
        // Reload orders
        const updated = await getOrders(authFetch, selectedPatient.uuid);
        setOrders(updated);
      } else {
        setMessage({ type: "error", text: result.data?.error?.message || "Failed to save prescription" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (tab === "active") return !o.dateStopped;
    if (tab === "refills") return o.dateStopped;
    return false;
  });

  return (
    <div>
  
  <div className="relative z-10 flex min-h-screen">
    {/* Sidebar */}
    <aside className="hidden lg:flex w-80 border-r border-white/5 bg-background-dark/70 backdrop-blur-xl flex-col">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-primary text-2xl" style={{filter: 'drop-shadow(0 0 8px rgba(37,192,244,0.5))'}}>ecg_heart</span>
          <span className="text-xl font-bold tracking-tight text-white">Aegis AI</span>
        </div>
        <div className="relative">
          <input
            className="w-full bg-black/30 border border-slate-700/50 focus:border-primary rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none"
            placeholder="Search patient..."
            type="text"
            value={patientQuery}
            onChange={e => handlePatientSearch(e.target.value)}
          />
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
      {selectedPatient && (
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-lg">person</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">{selectedPatient.givenName} {selectedPatient.familyName}</p>
              <p className="text-xs text-slate-500">{selectedPatient.identifier || ""}</p>
            </div>
          </div>
        </div>
      )}
      <div className="p-4 flex-1 overflow-y-auto">
        <p className="text-xs text-slate-500 font-light uppercase tracking-wider mb-3 px-2">Navigation</p>
        {[
          { icon: "medication", label: "Prescriptions", active: true },
          { icon: "science", label: "Lab Orders" },
          { icon: "vaccines", label: "Immunizations" },
          { icon: "history", label: "Drug History" },
        ].map(item => (
          <div key={item.label} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all mb-1 ${item.active ? "bg-primary/10 text-primary" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            {item.label}
          </div>
        ))}
      </div>
    </aside>
    {/* Main Content */}
    <main className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white tracking-tight">Medication Management</h1>
            <p className="text-slate-400 text-sm font-light mt-1">
              {selectedPatient ? `Managing prescriptions for ${selectedPatient.givenName} ${selectedPatient.familyName}` : "Select a patient to manage medications"}
            </p>
          </div>
          {selectedPatient && (
            <button onClick={() => setShowNewRx(true)}
              className="px-5 py-3 bg-primary hover:bg-primary/90 text-background-dark font-medium rounded-xl shadow-lg transition-all flex items-center gap-2 text-sm">
              <span className="material-symbols-outlined text-lg">add</span> New Prescription
            </button>
          )}
        </div>

        {message && (
          <div className={`mb-6 px-4 py-3 rounded-xl flex items-center gap-2 ${message.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
            <span className={`material-symbols-outlined text-lg ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
              {message.type === "success" ? "check_circle" : "error"}
            </span>
            <p className={`text-sm font-medium ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
          </div>
        )}

        {/* Tabs */}
        {selectedPatient && (
          <div className="flex gap-1 mb-6 p-1 bg-white/5 rounded-xl w-fit">
            {([["active", "All Active"], ["refills", "Completed"], ["interactions", "Interactions"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setTab(key as typeof tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === key ? "bg-primary/10 text-primary shadow-sm" : "text-slate-400 hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Orders list */}
        {!selectedPatient ? (
          <div className="glass-panel rounded-2xl p-16 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-slate-600 text-6xl mb-4">medication</span>
            <p className="text-slate-400 font-light">Search and select a patient from the sidebar to view medications</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
          </div>
        ) : filteredOrders.length === 0 && tab !== "interactions" ? (
          <div className="glass-panel rounded-2xl p-12 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-slate-600 text-5xl mb-3">pill</span>
            <p className="text-slate-400 text-sm font-light">{tab === "active" ? "No active prescriptions" : "No completed prescriptions"}</p>
          </div>
        ) : tab === "interactions" ? (
          <div className="glass-panel rounded-2xl p-12 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-emerald-400 text-5xl mb-3">verified</span>
            <p className="text-emerald-400 text-sm font-medium">No drug interactions detected</p>
            <p className="text-slate-500 text-xs font-light mt-1">All current medications are compatible</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(order => (
              <div key={order.uuid} className="glass-panel rounded-xl p-5 hover:border-primary/20 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mt-0.5">
                      <span className="material-symbols-outlined text-violet-400 text-lg">medication</span>
                    </div>
                    <div>
                      <p className="text-white font-medium">{order.drug?.display || order.concept?.display || order.display}</p>
                      <p className="text-xs text-slate-500 mt-1 font-light">
                        {order.dose && `${order.dose} ${order.doseUnits?.display || ""}`}
                        {order.frequency && ` • ${order.frequency.display}`}
                        {order.duration && ` • ${order.duration} ${order.durationUnits?.display || "days"}`}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">Ordered: {new Date(order.dateActivated).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full border ${
                    order.dateStopped
                      ? "bg-slate-500/10 text-slate-400 border-slate-500/20"
                      : "bg-emerald-400/10 text-emerald-400 border-emerald-400/20"
                  }`}>
                    {order.dateStopped ? "Completed" : "Active"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>

    {/* New Rx Slide Panel */}
    {showNewRx && (
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-slate-900/95 backdrop-blur-xl border-l border-white/10 z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">New Prescription</h2>
          <button onClick={() => setShowNewRx(false)} className="text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Drug Search */}
          <div>
            <label className="text-xs text-slate-400 mb-2 block uppercase tracking-wider font-light">Search Drug</label>
            <div className="relative">
              <input className="w-full bg-black/50 border border-slate-700/50 focus:border-primary rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 outline-none text-sm"
                placeholder="Search drug name..."
                value={drugQuery}
                onChange={e => { setDrugQuery(e.target.value); setSelectedDrug(null); }}
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
              {drugResults.length > 0 && !selectedDrug && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-40 overflow-y-auto">
                  {drugResults.map(d => (
                    <button key={d.uuid} onClick={() => { setSelectedDrug(d); setDrugQuery(d.display); setDrugResults([]); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-primary/10 transition-colors border-b border-white/5 last:border-0">
                      {d.display}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {selectedDrug && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block font-light">Dose</label>
                  <input className="w-full bg-black/50 border border-slate-700/50 focus:border-primary rounded-xl py-2.5 px-3 text-white placeholder-slate-600 outline-none text-sm"
                    placeholder="e.g. 500mg" value={rxForm.dose} onChange={e => setRxForm(f => ({ ...f, dose: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block font-light">Frequency</label>
                  <input className="w-full bg-black/50 border border-slate-700/50 focus:border-primary rounded-xl py-2.5 px-3 text-white placeholder-slate-600 outline-none text-sm"
                    placeholder="e.g. Twice daily" value={rxForm.frequency} onChange={e => setRxForm(f => ({ ...f, frequency: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-light">Duration</label>
                <input className="w-full bg-black/50 border border-slate-700/50 focus:border-primary rounded-xl py-2.5 px-3 text-white placeholder-slate-600 outline-none text-sm"
                  placeholder="e.g. 7 days" value={rxForm.duration} onChange={e => setRxForm(f => ({ ...f, duration: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block font-light">Instructions</label>
                <textarea className="w-full bg-black/50 border border-slate-700/50 focus:border-primary rounded-xl py-2.5 px-3 text-white placeholder-slate-600 outline-none text-sm resize-none"
                  rows={3} placeholder="Take with food..." value={rxForm.instructions} onChange={e => setRxForm(f => ({ ...f, instructions: e.target.value }))} />
              </div>
            </>
          )}
        </div>
        <div className="p-6 border-t border-white/5">
          <button onClick={handlePrescribe} disabled={!selectedDrug || saving}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-background-dark font-semibold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
            {saving ? <><span className="animate-spin material-symbols-outlined text-sm">progress_activity</span> Saving...</> : <><span className="material-symbols-outlined text-sm">save</span> Save Prescription</>}
          </button>
        </div>
      </div>
    )}
  </div>
</div>
  );
}
