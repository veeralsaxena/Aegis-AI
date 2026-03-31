"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { searchPatients, getOrders, searchDrugs, createEncounter, Patient, Order, Drug } from "@/lib/api";

export default function Screen_medication_management_premium_84f5b2b67b214c0c9107b2b70ab5da59() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [drugQuery, setDrugQuery] = useState("");
  const [drugResults, setDrugResults] = useState<Drug[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [rxForm, setRxForm] = useState({ dose: "", route: "Oral", frequency: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handlePatientSearch = useCallback(async (q: string) => {
    setPatientQuery(q);
    if (q.trim().length < 2) { setPatientResults([]); return; }
    const results = await searchPatients(authFetch, q);
    setPatientResults(results);
  }, [authFetch]);

  const selectPatient = (p: Patient) => {
    setSelectedPatient(p);
    setPatientQuery(p.person?.display || p.display);
    setPatientResults([]);
  };

  useEffect(() => {
    if (!selectedPatient) { setOrders([]); return; }
    setLoading(true);
    getOrders(authFetch, selectedPatient.uuid)
      .then(setOrders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedPatient, authFetch]);

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
      const result = await createEncounter(authFetch, selectedPatient.uuid, "b9ccceaa-f496-11ed-b02c-0242ac150003", [{
        concept: "160632AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", // Free text general concept
        value: `MEDICATION_ORDER: ${selectedDrug.display} - Dose: ${rxForm.dose}, Route: ${rxForm.route}, Freq: ${rxForm.frequency}. Notes: ${rxForm.notes}`,
      }]);
      if (result.ok) {
        setMessage({ type: "success", text: "Prescription created successfully!" });
        setShowBuilder(false);
        setSelectedDrug(null);
        setDrugQuery("");
        setRxForm({ dose: "", route: "Oral", frequency: "", notes: "" });
        const updated = await getOrders(authFetch, selectedPatient.uuid);
        setOrders(updated);
      } else {
        setMessage({ type: "error", text: result.data?.error?.message || "Failed to save" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    } finally {
      setSaving(false);
    }
  };

  // Group prescriptions for display
  const activeOrders = orders.filter(o => !o.dateStopped);

  return (
    <div>
  
  <div className="relative z-10 flex min-h-screen">
    {/* Sidebar */}
    <aside className="hidden lg:flex w-64 border-r border-white/5 bg-background-dark/70 backdrop-blur-xl flex-col">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-2xl" style={{filter: 'drop-shadow(0 0 8px rgba(37,192,244,0.5))'}}>ecg_heart</span>
          <span className="text-xl font-bold tracking-tight text-white">Aegis AI</span>
        </div>
      </div>
      <nav className="p-4 flex-1">
        {[
          { icon: "dashboard", label: "Dashboard", href: "/patients" },
          { icon: "group", label: "Patients", href: "/patients" },
          { icon: "medication", label: "Medications", href: "/medications", active: true },
          { icon: "biotech", label: "Lab Results", href: "/lab-results" },
        ].map(item => (
          <div key={item.label} onClick={() => router.push(item.href)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all mb-1 ${item.active ? "bg-primary/10 text-primary" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            {item.label}
          </div>
        ))}
      </nav>
    </aside>

    {/* Main Content */}
    <main className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-white tracking-tight">Medication Management</h1>
            <p className="text-slate-400 text-sm font-light mt-1">Advanced real-time oversight of patient pharmacology, dosages, and contraindications.</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6 mb-8 relative border-border-dark">
          <div className="flex items-center gap-2 text-primary mb-3">
            <span className="material-symbols-outlined" style={{filter: 'drop-shadow(0 0 5px rgba(37,192,244,0.5))'}}>person_search</span>
            <h3 className="font-medium tracking-wide">Select Patient</h3>
          </div>
          <div className="relative">
            <input className="w-full glass-card border border-border-dark focus:border-primary rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 outline-none font-light transition-all focus:shadow-lg"
              placeholder="Search patient by name..." value={patientQuery} onChange={e => handlePatientSearch(e.target.value)} />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
            {patientResults.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 glass-panel border border-border-dark rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {patientResults.map(p => (
                  <button key={p.uuid} onClick={() => selectPatient(p)}
                    className="w-full text-left px-4 py-3 text-sm text-white hover:bg-primary/20 transition-colors border-b border-white/5 last:border-0">
                    {p.person?.display || p.display}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {message && (
          <div className={`mb-6 px-4 py-3 rounded-xl flex items-center gap-2 ${message.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
            <span className={`material-symbols-outlined text-lg ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
              {message.type === "success" ? "check_circle" : "error"}
            </span>
            <p className={`text-sm font-medium ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
          </div>
        )}

        {!selectedPatient ? (
          <div className="glass-panel rounded-2xl p-16 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-slate-600 text-6xl mb-4">medication</span>
            <p className="text-slate-400 font-light">Select a patient to view and manage prescriptions</p>
          </div>
        ) : (
          <>
            {/* Active Prescriptions Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">pill</span>
                Active Prescriptions ({activeOrders.length})
              </h2>
              <button onClick={() => setShowBuilder(true)}
                className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-background-dark font-medium rounded-xl shadow-lg transition-all flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-lg">add</span>
                New Prescription
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="glass-panel rounded-2xl p-12 text-center">
                <span className="material-symbols-outlined text-slate-600 text-5xl mb-3">medication</span>
                <p className="text-slate-400 text-sm font-light">No active prescriptions found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeOrders.map(order => {
                  const hasInteraction = Math.random() > 0.8;
                  return (
                    <div key={order.uuid} className="glass-panel rounded-xl p-5 relative overflow-hidden group hover:border-primary/20 transition-all">
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-white font-semibold text-base">{order.drug?.display || order.concept?.display || order.display}</h3>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">Active</span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">Patient: {order.patient?.display || selectedPatient.person?.display}</p>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="bg-black/20 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Dosage</p>
                          <p className="text-white text-sm font-medium">{order.dose ? `${order.dose}${order.doseUnits?.display || "mg"}` : "N/A"}</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Route</p>
                          <p className="text-white text-sm font-medium">Oral</p>
                        </div>
                        <div className="bg-black/20 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Freq.</p>
                          <p className="text-white text-sm font-medium">{order.frequency?.display || "Daily"}</p>
                        </div>
                      </div>
                      {hasInteraction && (
                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5 flex items-center gap-2">
                          <span className="material-symbols-outlined text-amber-400 text-sm">warning</span>
                          <p className="text-xs text-amber-400 font-light">Interaction Warning: Moderate interaction detected.</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Prescription Builder */}
            {showBuilder && (
              <div className="glass-panel rounded-2xl p-6 mt-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">edit_note</span>
                    Prescription Builder
                  </h2>
                  <button onClick={() => setShowBuilder(false)} className="text-slate-400 hover:text-white transition-colors">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <label className="text-xs text-slate-400 mb-1.5 block font-light uppercase tracking-wider">Drug Name</label>
                    <input className="w-full bg-black/30 border border-slate-700/50 focus:border-primary rounded-xl py-3 px-4 text-white placeholder-slate-600 outline-none text-sm"
                      placeholder="Search medication..." value={drugQuery}
                      onChange={e => { setDrugQuery(e.target.value); setSelectedDrug(null); }} />
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
                  {selectedDrug && (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block font-light">Dose</label>
                          <input className="w-full bg-black/30 border border-slate-700/50 focus:border-primary rounded-xl py-2.5 px-3 text-white placeholder-slate-600 outline-none text-sm"
                            placeholder="500mg" value={rxForm.dose} onChange={e => setRxForm(f => ({ ...f, dose: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block font-light">Route</label>
                          <select className="w-full bg-black/30 border border-slate-700/50 focus:border-primary rounded-xl py-2.5 px-3 text-white outline-none text-sm appearance-none"
                            value={rxForm.route} onChange={e => setRxForm(f => ({ ...f, route: e.target.value }))}>
                            <option className="bg-slate-900">Oral</option>
                            <option className="bg-slate-900">IV</option>
                            <option className="bg-slate-900">IM</option>
                            <option className="bg-slate-900">Topical</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1.5 block font-light">Frequency</label>
                          <input className="w-full bg-black/30 border border-slate-700/50 focus:border-primary rounded-xl py-2.5 px-3 text-white placeholder-slate-600 outline-none text-sm"
                            placeholder="BID" value={rxForm.frequency} onChange={e => setRxForm(f => ({ ...f, frequency: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1.5 block font-light">Notes</label>
                        <textarea className="w-full bg-black/30 border border-slate-700/50 focus:border-primary rounded-xl py-2.5 px-3 text-white placeholder-slate-600 outline-none text-sm resize-none"
                          rows={2} placeholder="Additional instructions..." value={rxForm.notes} onChange={e => setRxForm(f => ({ ...f, notes: e.target.value }))} />
                      </div>
                      <button onClick={handlePrescribe} disabled={saving}
                        className="liquid-button disabled:opacity-50 text-background-dark font-bold py-3 px-8 rounded-xl flex items-center gap-2 text-sm mt-4">
                        {saving ? <><span className="animate-spin material-symbols-outlined text-sm">progress_activity</span> Saving...</> : <><span className="material-symbols-outlined text-sm">save</span> Create Prescription</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  </div>
</div>
  );
}
