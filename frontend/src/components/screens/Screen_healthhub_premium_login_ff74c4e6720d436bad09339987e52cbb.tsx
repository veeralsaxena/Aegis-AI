"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { searchPatientsBahmni, BahmniPatientSearchResult, saveBahmniEncounter } from "@/lib/bahmniApi";

export default function Screen_healthhub_premium_login_ff74c4e6720d436bad09339987e52cbb() {
  const { authFetch } = useAuth();
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<BahmniPatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<BahmniPatientSearchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [vitals, setVitals] = useState({
    heartRate: "",
    systolic: "",
    diastolic: "",
    spO2: "",
    temperature: "",
    respiration: "",
    weight: "",
  });

  const handlePatientSearch = async (q: string) => {
    setPatientQuery(q);
    if (q.trim().length < 2) { setPatientResults([]); return; }
    const results = await searchPatientsBahmni(authFetch, q);
    setPatientResults(results);
  };

  const selectPatient = (p: BahmniPatientSearchResult) => {
    setSelectedPatient(p);
    setPatientQuery(`${p.givenName} ${p.familyName}`);
    setPatientResults([]);
  };

  const handleSave = async () => {
    if (!selectedPatient) { setMessage({ type: "error", text: "Please select a patient first" }); return; }
    setSaving(true);
    setMessage(null);

    const obs: { concept: string; value: any }[] = [];
    if (vitals.heartRate) obs.push({ concept: "Pulse", value: parseFloat(vitals.heartRate) });
    if (vitals.systolic) obs.push({ concept: "Systolic Blood Pressure", value: parseFloat(vitals.systolic) });
    if (vitals.diastolic) obs.push({ concept: "Diastolic Blood Pressure", value: parseFloat(vitals.diastolic) });
    if (vitals.spO2) obs.push({ concept: "SPO2", value: parseFloat(vitals.spO2) });
    if (vitals.temperature) obs.push({ concept: "Temperature", value: parseFloat(vitals.temperature) });
    if (vitals.respiration) obs.push({ concept: "Respiratory Rate", value: parseFloat(vitals.respiration) });
    if (vitals.weight) obs.push({ concept: "Weight", value: parseFloat(vitals.weight) });

    if (obs.length === 0) { setMessage({ type: "error", text: "Please enter at least one vital" }); setSaving(false); return; }

    try {
      const result = await saveBahmniEncounter(authFetch, {
        patientUuid: selectedPatient.uuid,
        encounterTypeUuid: "67a71486-1a54-468f-ac3e-7091a9a79584", // Consultation encounter type UUID
        observations: obs.map(o => ({ concept: { uuid: o.concept }, value: o.value })),
      });
      if (result.ok) {
        setMessage({ type: "success", text: "Vitals saved successfully!" });
        setVitals({ heartRate: "", systolic: "", diastolic: "", spO2: "", temperature: "", respiration: "", weight: "" });
      } else {
        setMessage({ type: "error", text: result.data?.error?.message || "Failed to save vitals" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error — could not save vitals" });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    setVitals({ heartRate: "", systolic: "", diastolic: "", spO2: "", temperature: "", respiration: "", weight: "" });
    setMessage(null);
  };

  return (
    <>
      <div>
  <header className="relative z-20 w-full px-8 py-6 flex items-center justify-between border-b border-white/5 bg-background-dark/50 backdrop-blur-md">
    <div className="flex items-center gap-3">
      <span className="material-symbols-outlined text-primary text-3xl" style={{filter: 'drop-shadow(0 0 8px rgba(37,192,244,0.5))'}}>ecg_heart</span>
      <span className="text-2xl font-bold tracking-tight text-white">Aegis AI</span>
    </div>
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2 text-sm text-slate-400 font-light">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-lg" />
        System Online
      </div>
    </div>
  </header>
  <main className="relative z-10 container mx-auto px-6 py-12 max-w-5xl">
    <div className="mb-10 text-center lg:text-left">
      <h1 className="text-4xl md:text-5xl font-semibold text-white mb-3 tracking-tight">Vitals Capture</h1>
      <p className="text-slate-400 text-base md:text-lg font-light tracking-wide max-w-2xl">
        {selectedPatient
           ? <>Log physiological data for patient <span className="text-white font-medium">{selectedPatient.givenName} {selectedPatient.familyName}</span>. Secure HIPAA-compliant session.</>
          : "Search and select a patient to begin recording vitals."}
      </p>
    </div>

    {/* Patient Search */}
    <div className="glass-panel rounded-2xl p-6 mb-8 relative">
      <div className="flex items-center gap-2 text-primary mb-4">
        <span className="material-symbols-outlined" style={{filter: 'drop-shadow(0 0 5px rgba(37,192,244,0.5))'}}>person_search</span>
        <h3 className="font-medium tracking-wide">Select Patient</h3>
      </div>
      <div className="relative">
        <input
          className="w-full bg-black/30 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-4 text-white placeholder-slate-600 transition-all outline-none font-light"
          placeholder="Search patient by name..."
          type="text"
          value={patientQuery}
          onChange={e => handlePatientSearch(e.target.value)}
        />
        {patientResults.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
            {patientResults.map(p => (
              <button key={p.uuid} onClick={() => selectPatient(p)}
                className="w-full text-left px-4 py-3 text-sm text-white hover:bg-primary/10 transition-colors border-b border-white/5 last:border-0 flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-500 text-lg">person</span>
                <div>
                  <p className="font-medium">{p.givenName} {p.familyName}</p>
                  <p className="text-xs text-slate-500">{p.identifier || ""}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Messages */}
    {message && (
      <div className={`mb-6 px-4 py-3 rounded-xl flex items-center gap-2 ${message.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
        <span className={`material-symbols-outlined text-lg ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
          {message.type === "success" ? "check_circle" : "error"}
        </span>
        <p className={`text-sm font-medium ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
      </div>
    )}

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-lg" />
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined" style={{filter: 'drop-shadow(0 0 5px rgba(37,192,244,0.5))'}}>favorite</span>
            <h3 className="font-medium tracking-wide">Heart Rate</h3>
          </div>
          <span className="text-xs text-slate-500 font-light px-2 py-1 bg-white/5 rounded-md">BPM</span>
        </div>
        <div className="flex items-end gap-3 mt-4">
          <input className="w-full bg-black/30 border-b border-slate-700/50 focus:border-primary border-t-0 border-x-0 rounded-none px-2 py-2 text-4xl text-white font-semibold placeholder-slate-700 transition-all outline-none text-center" placeholder="--" type="number"
            value={vitals.heartRate} onChange={e => setVitals(v => ({ ...v, heartRate: e.target.value }))} />
        </div>
        <p className="text-xs text-slate-500 mt-3 font-light text-center">Normal range: 60-100</p>
      </div>
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-lg" />
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined" style={{filter: 'drop-shadow(0 0 5px rgba(37,192,244,0.5))'}}>blood_pressure</span>
            <h3 className="font-medium tracking-wide">Blood Pressure</h3>
          </div>
          <span className="text-xs text-slate-500 font-light px-2 py-1 bg-white/5 rounded-md">mmHg</span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-4">
          <input className="w-24 bg-black/30 border-b border-slate-700/50 focus:border-primary border-t-0 border-x-0 rounded-none px-1 py-2 text-3xl text-white font-semibold placeholder-slate-700 transition-all outline-none text-center" placeholder="" type="number"
            value={vitals.systolic} onChange={e => setVitals(v => ({ ...v, systolic: e.target.value }))} />
          <span className="text-2xl text-slate-600 font-light">/</span>
          <input className="w-24 bg-black/30 border-b border-slate-700/50 focus:border-primary border-t-0 border-x-0 rounded-none px-1 py-2 text-3xl text-white font-semibold placeholder-slate-700 transition-all outline-none text-center" placeholder="" type="number"
            value={vitals.diastolic} onChange={e => setVitals(v => ({ ...v, diastolic: e.target.value }))} />
        </div>
        <p className="text-xs text-slate-500 mt-3 font-light text-center">SYS / DIA</p>
      </div>
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-lg" />
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined" style={{filter: 'drop-shadow(0 0 5px rgba(37,192,244,0.5))'}}>air</span>
            <h3 className="font-medium tracking-wide">Oxygen (SpO2)</h3>
          </div>
          <span className="text-xs text-slate-500 font-light px-2 py-1 bg-white/5 rounded-md">%</span>
        </div>
        <div className="flex items-end gap-3 mt-4">
          <input className="w-full bg-black/30 border-b border-slate-700/50 focus:border-primary border-t-0 border-x-0 rounded-none px-2 py-2 text-4xl text-white font-semibold placeholder-slate-700 transition-all outline-none text-center" placeholder="--" type="number"
            value={vitals.spO2} onChange={e => setVitals(v => ({ ...v, spO2: e.target.value }))} />
        </div>
        <p className="text-xs text-slate-500 mt-3 font-light text-center">Normal: ≥ 95%</p>
      </div>
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-lg" />
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined" style={{filter: 'drop-shadow(0 0 5px rgba(37,192,244,0.5))'}}>device_thermostat</span>
            <h3 className="font-medium tracking-wide">Temperature</h3>
          </div>
          <span className="text-xs text-slate-500 font-light px-2 py-1 bg-white/5 rounded-md">°F</span>
        </div>
        <div className="flex items-end gap-3 mt-4">
          <input className="w-full bg-black/30 border-b border-slate-700/50 focus:border-primary border-t-0 border-x-0 rounded-none px-2 py-2 text-4xl text-white font-semibold placeholder-slate-700 transition-all outline-none text-center" placeholder="--" step="0.1" type="number"
            value={vitals.temperature} onChange={e => setVitals(v => ({ ...v, temperature: e.target.value }))} />
        </div>
        <p className="text-xs text-slate-500 mt-3 font-light text-center">Baseline: 98.6°F</p>
      </div>
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-lg" />
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined" style={{filter: 'drop-shadow(0 0 5px rgba(37,192,244,0.5))'}}>pulmonology</span>
            <h3 className="font-medium tracking-wide">Respiration</h3>
          </div>
          <span className="text-xs text-slate-500 font-light px-2 py-1 bg-white/5 rounded-md">Breaths/min</span>
        </div>
        <div className="flex items-end gap-3 mt-4">
          <input className="w-full bg-black/30 border-b border-slate-700/50 focus:border-primary border-t-0 border-x-0 rounded-none px-2 py-2 text-4xl text-white font-semibold placeholder-slate-700 transition-all outline-none text-center" placeholder="--" type="number"
            value={vitals.respiration} onChange={e => setVitals(v => ({ ...v, respiration: e.target.value }))} />
        </div>
        <p className="text-xs text-slate-500 mt-3 font-light text-center">Normal range: 12-20</p>
      </div>
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 shadow-lg" />
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2 text-primary">
            <span className="material-symbols-outlined" style={{filter: 'drop-shadow(0 0 5px rgba(37,192,244,0.5))'}}>monitor_weight</span>
            <h3 className="font-medium tracking-wide">Weight</h3>
          </div>
          <span className="text-xs text-slate-500 font-light px-2 py-1 bg-white/5 rounded-md">kg</span>
        </div>
        <div className="flex items-end gap-3 mt-4">
          <input className="w-full bg-black/30 border-b border-slate-700/50 focus:border-primary border-t-0 border-x-0 rounded-none px-2 py-2 text-4xl text-white font-semibold placeholder-slate-700 transition-all outline-none text-center" placeholder="--" step="0.1" type="number"
            value={vitals.weight} onChange={e => setVitals(v => ({ ...v, weight: e.target.value }))} />
        </div>
        <p className="text-xs text-slate-500 mt-3 font-light text-center">Previous: --</p>
      </div>
    </div>
    <div className="glass-panel rounded-2xl p-6 mb-10 relative overflow-hidden">
      <div className="flex items-center gap-2 text-primary mb-4">
        <span className="material-symbols-outlined" style={{filter: 'drop-shadow(0 0 5px rgba(37,192,244,0.5))'}}>edit_note</span>
        <h3 className="font-medium tracking-wide">Clinical Notes</h3>
      </div>
      <textarea className="w-full bg-black/30 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl p-4 text-white placeholder-slate-600 transition-all outline-none font-light resize-none" placeholder="Add any relevant observations or patient comments..." rows={3} defaultValue={""} />
    </div>
    <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
      <button
        onClick={handleClear}
        className="px-6 py-4 text-slate-400 hover:text-white font-light transition-colors w-full sm:w-auto"
      >
        Clear All
      </button>
      <button
        onClick={handleSave}
        disabled={saving || !selectedPatient}
        className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-background-dark text-lg font-semibold py-4 px-10 rounded-xl shadow-lg hover:shadow-lg transition-all flex items-center justify-center gap-3 group w-full sm:w-auto relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
        <span className="material-symbols-outlined text-[24px] relative z-10">save</span>
        <span className="relative z-10">{saving ? "Saving..." : "Save Vitals"}</span>
      </button>
    </div>
  </main>
</div>

    </>
  );
}
