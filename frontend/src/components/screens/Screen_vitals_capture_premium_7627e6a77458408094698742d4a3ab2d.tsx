"use client";

import { useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import PatientSearch from "@/components/PatientSearch";

interface Patient { uuid: string; person: { display: string }; }

function VitalsContent() {
  const { authFetch } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState({ height: "", weight: "", temperature: "", pulse: "", systolic: "", diastolic: "", respiratory: "", spO2: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    if (!patient) { setMessage({ type: "error", text: "Please select a patient first" }); return; }
    setSaving(true);
    setMessage(null);

    try {
      // Create an encounter of type Consultation with vitals as obs
      const encounterData = {
        patient: patient.uuid,
        encounterType: "Consultation",
        obs: Object.entries(vitals)
          .filter(([, val]) => val.trim())
          .map(([key, val]) => ({
            concept: key,
            value: parseFloat(val),
          })),
      };

      const res = await authFetch("/openmrs/ws/rest/v1/encounter", {
        method: "POST",
        body: JSON.stringify(encounterData),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "Vitals saved successfully!" });
        setVitals({ height: "", weight: "", temperature: "", pulse: "", systolic: "", diastolic: "", respiratory: "", spO2: "" });
      } else {
        const err = await res.json();
        setMessage({ type: "error", text: err.error?.message || "Failed to save vitals" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error — could not save vitals" });
    } finally {
      setSaving(false);
    }
  };

  const vitalFields = [
    { key: "height", label: "Height (cm)", icon: "height" },
    { key: "weight", label: "Weight (kg)", icon: "monitor_weight" },
    { key: "temperature", label: "Temperature (°C)", icon: "thermostat" },
    { key: "pulse", label: "Pulse (bpm)", icon: "favorite" },
    { key: "systolic", label: "Systolic BP (mmHg)", icon: "bloodtype" },
    { key: "diastolic", label: "Diastolic BP (mmHg)", icon: "bloodtype" },
    { key: "respiratory", label: "Respiratory Rate", icon: "pulmonology" },
    { key: "spO2", label: "SpO2 (%)", icon: "spo2" },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-3xl">monitor_heart</span>
          Vitals Capture
        </h1>
        <p className="text-slate-400 text-sm mt-1">Record patient vital signs</p>
      </div>

      <PatientSearch onSelect={(p) => setPatient(p as Patient)} label="Select Patient" />

      {message && (
        <div className={`px-4 py-3 rounded-xl flex items-center gap-2 ${message.type === "success" ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
          <span className={`material-symbols-outlined text-lg ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {message.type === "success" ? "check_circle" : "error"}
          </span>
          <p className={`text-sm font-medium ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>{message.text}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vitalFields.map(field => (
          <div key={field.key} className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
            <label className="text-xs text-slate-400 mb-2 flex items-center gap-1.5 block">
              <span className="material-symbols-outlined text-sm text-slate-500">{field.icon}</span>
              {field.label}
            </label>
            <input
              type="number"
              step="0.1"
              value={vitals[field.key as keyof typeof vitals]}
              onChange={e => setVitals(prev => ({ ...prev, [field.key]: e.target.value }))}
              placeholder="Enter value"
              className="w-full bg-black/50 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-lg py-2.5 px-3 text-white placeholder-slate-600 transition-all outline-none text-sm"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !patient}
        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-background-dark font-semibold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
      >
        {saving ? (
          <><span className="animate-spin material-symbols-outlined text-lg">progress_activity</span> Saving...</>
        ) : (
          <><span className="material-symbols-outlined text-lg">save</span> Save Vitals</>
        )}
      </button>
    </div>
  );
}

export default function ScreenVitals() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span></div>}><VitalsContent /></Suspense>;
}
