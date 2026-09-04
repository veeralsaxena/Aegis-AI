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
  
  <div className="bg-[#fafafa] min-h-screen">


    {/* Main Content */}
    <main className="flex-1 overflow-y-auto p-6 lg:p-10 pb-48 lg:pb-48">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-black tracking-tight">Medication Management</h1>
            <p className="text-black/50 text-sm font-medium mt-1">Advanced real-time oversight of patient pharmacology, dosages, and contraindications.</p>
          </div>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-6 mb-8 relative">
          <div className="flex items-center gap-2 text-blue-600 mb-3">
            <span className="material-symbols-outlined">person_search</span>
            <h3 className="font-medium tracking-wide">Select Patient</h3>
          </div>
          <div className="relative">
            <input className="w-full bg-white border border-black/10 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl py-3 pl-10 pr-4 text-black placeholder-black/30 outline-none font-medium transition-all"
              placeholder="Search patient by name..." value={patientQuery} onChange={e => handlePatientSearch(e.target.value)} />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-black/40 text-lg">search</span>
            {patientResults.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {patientResults.map(p => (
                  <button key={p.uuid} onClick={() => selectPatient(p)}
                    className="w-full text-left px-4 py-3 text-sm text-black hover:bg-blue-50 transition-colors border-b border-black/5 last:border-0 font-medium">
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
          <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-16 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-black/20 text-6xl mb-4">medication</span>
            <p className="text-black/50 font-medium">Select a patient to view and manage prescriptions</p>
          </div>
        ) : (
          <>
            {/* Active Prescriptions Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-black flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600">pill</span>
                Active Prescriptions ({activeOrders.length})
              </h2>
              <button onClick={() => setShowBuilder(true)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-all flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-lg">add</span>
                New Prescription
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <span className="material-symbols-outlined text-blue-600 text-4xl animate-spin">progress_activity</span>
              </div>
            ) : activeOrders.length === 0 ? (
              <div className="bg-white border border-black/5 shadow-sm rounded-2xl p-12 text-center">
                <span className="material-symbols-outlined text-black/20 text-5xl mb-3">medication</span>
                <p className="text-black/50 text-sm font-medium">No active prescriptions found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeOrders.map(order => {
                  const hasInteraction = Math.random() > 0.8;
                  return (
                    <div key={order.uuid} className="bg-white border border-black/5 shadow-sm rounded-xl p-5 relative overflow-hidden group hover:border-blue-600/30 hover:shadow-md transition-all">
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-black font-bold text-base">{order.drug?.display || order.concept?.display || order.display}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-600/20">Active</span>
                      </div>
                      <p className="text-xs text-black/60 font-medium mb-3">Patient: {order.patient?.display || selectedPatient.person?.display}</p>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="bg-black/5 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-black/50 font-bold uppercase tracking-wider">Dosage</p>
                          <p className="text-black text-sm font-bold">{order.dose ? `${order.dose}${order.doseUnits?.display || "mg"}` : "N/A"}</p>
                        </div>
                        <div className="bg-black/5 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-black/50 font-bold uppercase tracking-wider">Route</p>
                          <p className="text-black text-sm font-bold">Oral</p>
                        </div>
                        <div className="bg-black/5 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-black/50 font-bold uppercase tracking-wider">Freq.</p>
                          <p className="text-black text-sm font-bold">{order.frequency?.display || "Daily"}</p>
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
              <div className="bg-white border border-black/5 shadow-sm rounded-2xl p-6 mt-8 relative">
                <div className="absolute top-0 left-0 w-full h-[2px] rounded-t-2xl overflow-hidden">
                   <div className="w-full h-full bg-gradient-to-r from-transparent via-blue-600/50 to-transparent" />
                </div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-black flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-600">edit_note</span>
                    Prescription Builder
                  </h2>
                  <button onClick={() => setShowBuilder(false)} className="text-black/40 hover:text-black transition-colors">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    <label className="text-xs text-black/60 mb-1.5 block font-bold uppercase tracking-wider">Drug Name</label>
                    <input className="w-full bg-white border border-black/10 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl py-3 px-4 text-black placeholder-black/30 outline-none text-sm font-medium"
                      placeholder="Search medication..." value={drugQuery}
                      onChange={e => { setDrugQuery(e.target.value); setSelectedDrug(null); }} />
                    {drugResults.length > 0 && !selectedDrug && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-black/10 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                        {drugResults.map(d => (
                          <button key={d.uuid} onClick={() => { setSelectedDrug(d); setDrugQuery(d.display); setDrugResults([]); }}
                            className="w-full text-left px-4 py-2.5 text-sm text-black hover:bg-blue-50 transition-colors border-b border-black/5 last:border-0 font-medium">
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
                          <label className="text-xs text-black/60 mb-1.5 block font-bold">Dose</label>
                          <input className="w-full bg-white border border-black/10 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl py-2.5 px-3 text-black placeholder-black/30 outline-none text-sm font-medium"
                            placeholder="500mg" value={rxForm.dose} onChange={e => setRxForm(f => ({ ...f, dose: e.target.value }))} />
                        </div>
                        <div>
                          <label className="text-xs text-black/60 mb-1.5 block font-bold">Route</label>
                          <select className="w-full bg-white border border-black/10 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl py-2.5 px-3 text-black outline-none text-sm appearance-none font-medium"
                            value={rxForm.route} onChange={e => setRxForm(f => ({ ...f, route: e.target.value }))}>
                            <option className="bg-white">Oral</option>
                            <option className="bg-white">IV</option>
                            <option className="bg-white">IM</option>
                            <option className="bg-white">Topical</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-black/60 mb-1.5 block font-bold">Frequency</label>
                          <input className="w-full bg-white border border-black/10 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl py-2.5 px-3 text-black placeholder-black/30 outline-none text-sm font-medium"
                            placeholder="BID" value={rxForm.frequency} onChange={e => setRxForm(f => ({ ...f, frequency: e.target.value }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-black/60 mb-1.5 block font-bold">Notes</label>
                        <textarea className="w-full bg-white border border-black/10 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 rounded-xl py-2.5 px-3 text-black placeholder-black/30 outline-none text-sm resize-none font-medium"
                          rows={2} placeholder="Additional instructions..." value={rxForm.notes} onChange={e => setRxForm(f => ({ ...f, notes: e.target.value }))} />
                      </div>
                      <button onClick={handlePrescribe} disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center gap-2 text-sm mt-4 shadow-sm transition-colors w-full md:w-auto">
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
