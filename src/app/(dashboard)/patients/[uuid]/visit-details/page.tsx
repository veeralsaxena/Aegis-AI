"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface PatientInfo {
  uuid: string;
  person: { display: string; gender: string; age: number };
  identifiers: { display: string }[];
}

interface ActiveVisit {
  uuid: string;
  visitType: { display: string; uuid: string };
  startDatetime: string;
}

// Body position options matching Bahmni
const BODY_POSITIONS = ["sitting", "recumbent", "Unknown", "Other", "standing", "Fowler's position"];

export default function VisitDetailsPage() {
  const params = useParams();
  const uuid = typeof params.uuid === 'string' ? params.uuid : params.uuid?.[0] || '';
  const { authFetch } = useAuth();
  const router = useRouter();

  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [activeVisit, setActiveVisit] = useState<ActiveVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Vitals form state
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [systolicBP, setSystolicBP] = useState("");
  const [diastolicBP, setDiastolicBP] = useState("");
  const [bodyPosition, setBodyPosition] = useState("");
  const [pulse, setPulse] = useState("");
  const [spo2, setSpo2] = useState("");
  const [regFee, setRegFee] = useState("");

  const loadData = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const [patientData, visitData] = await Promise.all([
        authFetch(`/openmrs/ws/rest/v1/patient/${uuid}?v=default`).then(r => r.json()),
        authFetch(`/openmrs/ws/rest/v1/visit?patient=${uuid}&v=default`).then(r => r.json()),
      ]);
      setPatient(patientData);
      const allVisits = visitData.results || [];
      const active = allVisits.find((v: any) => !v.stopDatetime);
      setActiveVisit(active || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [uuid, authFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async () => {
    if (!activeVisit) {
      setMessage({ type: "error", text: "No active visit found. Please start a visit first." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Build observations array — only include non-empty values
      const observations: { concept: string; value: any }[] = [];

      if (height) observations.push({ concept: "5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(height) }); // Height
      if (weight) observations.push({ concept: "5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(weight) }); // Weight
      if (systolicBP) observations.push({ concept: "5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(systolicBP) }); // Systolic
      if (diastolicBP) observations.push({ concept: "5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(diastolicBP) }); // Diastolic
      if (pulse) observations.push({ concept: "5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(pulse) }); // Pulse
      if (spo2) observations.push({ concept: "5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", value: parseFloat(spo2) }); // SpO2

      if (observations.length === 0 && !regFee) {
        setMessage({ type: "error", text: "Please enter at least one vital measurement." });
        setSaving(false);
        return;
      }

      // Save vitals via encounter
      if (observations.length > 0) {
        const encounterPayload = {
          patient: uuid,
          encounterType: "67a71486-1a54-468f-ac3e-7091a9a79584", // Vitals encounter type
          visit: activeVisit.uuid,
          obs: observations.map(o => ({
            concept: o.concept,
            value: o.value,
          })),
        };

        const res = await authFetch("/openmrs/ws/rest/v1/encounter", {
          method: "POST",
          body: JSON.stringify(encounterPayload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || "Failed to save vitals");
        }
      }

      setMessage({ type: "success", text: "Visit details saved successfully!" });
      setTimeout(() => router.push(`/patients/${uuid}`), 1200);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
          <p className="text-slate-400 text-sm">Loading visit details...</p>
        </div>
      </div>
    );
  }

  if (!patient || !activeVisit) {
    return (
      <div className="p-8">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 text-center">
          <span className="material-symbols-outlined text-amber-400 text-3xl mb-2 block">warning</span>
          <p className="text-amber-400">No active visit found for this patient.</p>
          <Link href={`/patients/${uuid}`} className="text-primary hover:underline text-sm mt-2 inline-block">← Back to Patient</Link>
        </div>
      </div>
    );
  }

  const identifier = patient.identifiers?.[0]?.display?.split("= ")?.[1] || "N/A";

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Link
          href={`/patients/${uuid}`}
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Patient
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-500/20 transition-colors print:hidden"
        >
          <span className="material-symbols-outlined text-lg">print</span>
          Print Registration Card
        </button>
      </div>

      {/* Patient + Visit Info Bar */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 md:p-6 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-2xl">person</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">{patient?.person?.display || 'Patient'}</h1>
            <p className="text-slate-400 text-xs">{identifier} • {patient?.person?.gender === "M" ? "Male" : "Female"} • {patient?.person?.age ?? '—'} yrs</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            {activeVisit?.visitType?.display || 'Visit'}
          </span>
          <span className="text-slate-500 text-xs">{activeVisit?.startDatetime ? new Date(activeVisit.startDatetime).toLocaleString() : ''}</span>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={`px-4 py-3 rounded-xl flex items-center gap-2 ${message.type === "success" ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
          <span className={`material-symbols-outlined text-lg ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {message.type === "success" ? "check_circle" : "error"}
          </span>
          <p className={`text-sm font-medium ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>{message.text}</p>
        </div>
      )}

      {/* Nutritional Values */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-xl">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">fitness_center</span>
          Nutritional Values
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Height (cm)</label>
            <input
              type="number"
              step="0.1"
              className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-3 rounded-xl outline-none text-sm"
              placeholder="e.g. 170"
              value={height}
              onChange={e => setHeight(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-3 rounded-xl outline-none text-sm"
              placeholder="e.g. 65"
              value={weight}
              onChange={e => setWeight(e.target.value)}
            />
          </div>
        </div>
        {height && weight && (
          <div className="mt-3 p-3 bg-primary/5 border border-primary/10 rounded-xl">
            <p className="text-primary text-sm font-medium">
              BMI: {(parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1)} kg/m²
            </p>
          </div>
        )}
      </div>

      {/* Vitals */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-xl">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">monitor_heart</span>
          Vitals
        </h3>

        {/* Blood Pressure */}
        <div className="mb-5">
          <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-slate-500">bloodtype</span>
            Blood Pressure
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Systolic (mmHg)</label>
              <input
                type="number"
                className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-3 rounded-xl outline-none text-sm"
                placeholder="e.g. 120"
                value={systolicBP}
                onChange={e => setSystolicBP(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Diastolic (mmHg)</label>
              <input
                type="number"
                className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-3 rounded-xl outline-none text-sm"
                placeholder="e.g. 80"
                value={diastolicBP}
                onChange={e => setDiastolicBP(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Body Position */}
        <div className="mb-5">
          <label className="text-xs text-slate-400 mb-2 block">Body Position</label>
          <div className="flex flex-wrap gap-2">
            {BODY_POSITIONS.map(pos => (
              <button
                key={pos}
                type="button"
                onClick={() => setBodyPosition(bodyPosition === pos ? "" : pos)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                  bodyPosition === pos
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-700/50 hover:text-white"
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Pulse */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Pulse (beats/min)</label>
            <input
              type="number"
              className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-3 rounded-xl outline-none text-sm"
              placeholder="e.g. 72"
              value={pulse}
              onChange={e => setPulse(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">SpO₂ — Arterial Blood Oxygen Saturation (%)</label>
            <input
              type="number"
              className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-3 rounded-xl outline-none text-sm"
              placeholder="e.g. 98"
              value={spo2}
              onChange={e => setSpo2(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Fee Information */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-xl">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">payments</span>
          Fee Information
        </h3>
        <div className="max-w-xs">
          <label className="text-xs text-slate-400 mb-1 block">Registration Fee (₹)</label>
          <input
            type="number"
            className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-3 rounded-xl outline-none text-sm"
            placeholder="e.g. 500"
            value={regFee}
            onChange={e => setRegFee(e.target.value)}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 print:hidden">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 liquid-button text-background-dark font-bold py-4 rounded-xl flex items-center justify-center gap-2 text-sm transition-all disabled:opacity-50"
        >
          {saving ? (
            <><span className="material-symbols-outlined text-lg animate-spin">progress_activity</span> Saving...</>
          ) : (
            <><span className="material-symbols-outlined text-lg">save</span> Save & Go Back to Dashboard</>
          )}
        </button>
      </div>
    </div>
  );
}
