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
    if (vitals.heartRate) obs.push({ concept: "5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(vitals.heartRate) });
    if (vitals.systolic) obs.push({ concept: "5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(vitals.systolic) });
    if (vitals.diastolic) obs.push({ concept: "5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(vitals.diastolic) });
    if (vitals.spO2) obs.push({ concept: "5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(vitals.spO2) });
    if (vitals.temperature) {
      const tempC = (parseFloat(vitals.temperature) - 32) * 5 / 9;
      obs.push({ concept: "5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(tempC.toFixed(1)) });
    }
    if (vitals.respiration) obs.push({ concept: "5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(vitals.respiration) });
    if (vitals.weight) obs.push({ concept: "5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(vitals.weight) });

    if (obs.length === 0) { setMessage({ type: "error", text: "Please enter at least one vital" }); setSaving(false); return; }

    try {
      const result = await saveBahmniEncounter(authFetch, {
        patientUuid: selectedPatient.uuid,
        encounterTypeUuid: "b9ccceaa-f496-11ed-b02c-0242ac150003", // Consultation encounter type UUID
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
      <div className="bg-[#fafafa] min-h-screen">
        <main className="relative z-10 container mx-auto px-6 py-12 max-w-5xl">
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-4xl md:text-5xl font-bold text-black mb-3 tracking-tight">Vitals Capture</h1>
            <p className="text-black/50 text-base md:text-lg font-medium tracking-wide max-w-2xl">
              {selectedPatient
                ? <>Log physiological data for patient <span className="text-black font-bold">{selectedPatient.givenName} {selectedPatient.familyName}</span>. Secure HIPAA-compliant session.</>
                : "Search and select a patient to begin recording vitals."}
            </p>
          </div>

          {/* Patient Search */}
          <div className="bg-white border border-black/10 shadow-sm rounded-3xl p-6 mb-8 relative">
            <div className="flex items-center gap-2 text-blue-600 mb-4">
              <span className="material-symbols-outlined">person_search</span>
              <h3 className="font-bold tracking-wide uppercase text-sm">Select Patient</h3>
            </div>
            <div className="relative">
              <input
                className="w-full bg-black/5 border border-transparent focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10 rounded-2xl py-3 px-5 text-black placeholder-black/30 transition-all outline-none font-medium"
                placeholder="Search patient by name..."
                type="text"
                value={patientQuery}
                onChange={e => handlePatientSearch(e.target.value)}
              />
              {patientResults.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white border border-black/10 rounded-2xl shadow-xl max-h-48 overflow-y-auto">
                  {patientResults.map(p => (
                    <button key={p.uuid} onClick={() => selectPatient(p)}
                      className="w-full text-left px-5 py-3.5 text-sm font-bold text-black/70 hover:bg-blue-50 hover:text-blue-700 transition-colors border-b border-black/5 last:border-0 flex items-center gap-3">
                      <span className="material-symbols-outlined text-black/40 text-xl">person</span>
                      <div>
                        <p className="font-bold text-black">{p.givenName} {p.familyName}</p>
                        <p className="text-xs text-black/40 mt-0.5">{p.identifier || ""}</p>
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
            <div className="bg-white border border-black/10 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-blue-600/30 hover:shadow-md transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <span className="material-symbols-outlined">favorite</span>
                  <h3 className="font-bold tracking-wide uppercase text-sm">Heart Rate</h3>
                </div>
                <span className="text-xs font-bold text-black/40 px-2 py-1 bg-black/5 rounded-md">BPM</span>
              </div>
              <div className="flex items-end gap-3 mt-4">
                <input className="w-full bg-black/5 focus:bg-white border-b-2 border-transparent focus:border-blue-600 rounded-xl px-2 py-3 text-4xl text-black font-bold placeholder-black/20 transition-all outline-none text-center" placeholder="--" type="number"
                  value={vitals.heartRate} onChange={e => setVitals(v => ({ ...v, heartRate: e.target.value }))} />
              </div>
              <p className="text-xs text-black/50 mt-3 font-medium text-center">Normal range: 60-100</p>
            </div>
            <div className="bg-white border border-black/10 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-blue-600/30 hover:shadow-md transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <span className="material-symbols-outlined">blood_pressure</span>
                  <h3 className="font-bold tracking-wide uppercase text-sm">Blood Pressure</h3>
                </div>
                <span className="text-xs font-bold text-black/40 px-2 py-1 bg-black/5 rounded-md">mmHg</span>
              </div>
              <div className="flex items-center justify-center gap-3 mt-4">
                <input className="w-24 bg-black/5 focus:bg-white border-b-2 border-transparent focus:border-blue-600 rounded-xl px-2 py-3 text-3xl text-black font-bold placeholder-black/20 transition-all outline-none text-center" placeholder="" type="number"
                  value={vitals.systolic} onChange={e => setVitals(v => ({ ...v, systolic: e.target.value }))} />
                <span className="text-3xl text-black/30 font-light">/</span>
                <input className="w-24 bg-black/5 focus:bg-white border-b-2 border-transparent focus:border-blue-600 rounded-xl px-2 py-3 text-3xl text-black font-bold placeholder-black/20 transition-all outline-none text-center" placeholder="" type="number"
                  value={vitals.diastolic} onChange={e => setVitals(v => ({ ...v, diastolic: e.target.value }))} />
              </div>
              <p className="text-xs text-black/50 mt-3 font-medium text-center">SYS / DIA</p>
            </div>
            <div className="bg-white border border-black/10 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-blue-600/30 hover:shadow-md transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <span className="material-symbols-outlined">air</span>
                  <h3 className="font-bold tracking-wide uppercase text-sm">Oxygen (SpO2)</h3>
                </div>
                <span className="text-xs font-bold text-black/40 px-2 py-1 bg-black/5 rounded-md">%</span>
              </div>
              <div className="flex items-end gap-3 mt-4">
                <input className="w-full bg-black/5 focus:bg-white border-b-2 border-transparent focus:border-blue-600 rounded-xl px-2 py-3 text-4xl text-black font-bold placeholder-black/20 transition-all outline-none text-center" placeholder="--" type="number"
                  value={vitals.spO2} onChange={e => setVitals(v => ({ ...v, spO2: e.target.value }))} />
              </div>
              <p className="text-xs text-black/50 mt-3 font-medium text-center">Normal: ≥ 95%</p>
            </div>
            <div className="bg-white border border-black/10 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-blue-600/30 hover:shadow-md transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <span className="material-symbols-outlined">device_thermostat</span>
                  <h3 className="font-bold tracking-wide uppercase text-sm">Temperature</h3>
                </div>
                <span className="text-xs font-bold text-black/40 px-2 py-1 bg-black/5 rounded-md">°F</span>
              </div>
              <div className="flex items-end gap-3 mt-4">
                <input className="w-full bg-black/5 focus:bg-white border-b-2 border-transparent focus:border-blue-600 rounded-xl px-2 py-3 text-4xl text-black font-bold placeholder-black/20 transition-all outline-none text-center" placeholder="--" step="0.1" type="number"
                  value={vitals.temperature} onChange={e => setVitals(v => ({ ...v, temperature: e.target.value }))} />
              </div>
              <p className="text-xs text-black/50 mt-3 font-medium text-center">Baseline: 98.6°F</p>
            </div>
            <div className="bg-white border border-black/10 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-blue-600/30 hover:shadow-md transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <span className="material-symbols-outlined">pulmonology</span>
                  <h3 className="font-bold tracking-wide uppercase text-sm">Respiration</h3>
                </div>
                <span className="text-xs font-bold text-black/40 px-2 py-1 bg-black/5 rounded-md">Breaths/min</span>
              </div>
              <div className="flex items-end gap-3 mt-4">
                <input className="w-full bg-black/5 focus:bg-white border-b-2 border-transparent focus:border-blue-600 rounded-xl px-2 py-3 text-4xl text-black font-bold placeholder-black/20 transition-all outline-none text-center" placeholder="--" type="number"
                  value={vitals.respiration} onChange={e => setVitals(v => ({ ...v, respiration: e.target.value }))} />
              </div>
              <p className="text-xs text-black/50 mt-3 font-medium text-center">Normal range: 12-20</p>
            </div>
            <div className="bg-white border border-black/10 shadow-sm rounded-3xl p-6 relative overflow-hidden group hover:border-blue-600/30 hover:shadow-md transition-all">
              <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <span className="material-symbols-outlined">monitor_weight</span>
                  <h3 className="font-bold tracking-wide uppercase text-sm">Weight</h3>
                </div>
                <span className="text-xs font-bold text-black/40 px-2 py-1 bg-black/5 rounded-md">kg</span>
              </div>
              <div className="flex items-end gap-3 mt-4">
                <input className="w-full bg-black/5 focus:bg-white border-b-2 border-transparent focus:border-blue-600 rounded-xl px-2 py-3 text-4xl text-black font-bold placeholder-black/20 transition-all outline-none text-center" placeholder="--" step="0.1" type="number"
                  value={vitals.weight} onChange={e => setVitals(v => ({ ...v, weight: e.target.value }))} />
              </div>
              <p className="text-xs text-black/50 mt-3 font-medium text-center">Previous: --</p>
            </div>
          </div>
          <div className="bg-white border border-black/10 shadow-sm rounded-3xl p-6 mb-10 relative overflow-hidden">
            <div className="flex items-center gap-2 text-blue-600 mb-4">
              <span className="material-symbols-outlined">edit_note</span>
              <h3 className="font-bold tracking-wide uppercase text-sm">Clinical Notes</h3>
            </div>
            <textarea className="w-full bg-black/5 border border-transparent focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 rounded-2xl p-5 text-black placeholder-black/30 transition-all outline-none font-medium resize-none" placeholder="Add any relevant observations or patient comments..." rows={3} defaultValue={""} />
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
            <button
              onClick={handleClear}
              className="px-6 py-4 text-black/40 font-bold hover:text-black transition-colors w-full sm:w-auto uppercase tracking-wide text-sm"
            >
              Clear All
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !selectedPatient}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-base font-bold py-4 px-10 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group w-full sm:w-auto relative overflow-hidden"
            >
              <span className="material-symbols-outlined text-xl relative z-10">save</span>
              <span className="relative z-10">{saving ? "Saving..." : "Save Vitals"}</span>
            </button>
          </div>
        </main>
      </div>

    </>
  );
}
