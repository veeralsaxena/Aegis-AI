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
          className="inline-flex items-center gap-1.5 text-black/40 hover:text-black transition-colors text-sm font-bold"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          Back to Patient
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 px-5 py-2.5 rounded-2xl text-sm font-bold transition-colors print:hidden"
        >
          <span className="material-symbols-outlined text-lg">print</span>
          Print Registration Card
        </button>
      </div>

      {/* Patient + Visit Info Bar */}
      <div className="bg-white border border-black/5 rounded-[2rem] p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-blue-600 text-3xl">person</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-black tracking-tight">{patient?.person?.display || 'Patient'}</h1>
            <p className="text-black/50 font-bold text-xs uppercase tracking-wider mt-1">{identifier} • {patient?.person?.gender === "M" ? "Male" : "Female"} • {patient?.person?.age ?? '—'} yrs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-4 py-2 bg-green-50 border border-green-200 rounded-full text-green-600 text-xs font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            {activeVisit?.visitType?.display || 'Visit'}
          </span>
          <span className="text-black/40 font-bold text-xs bg-black/5 px-3 py-2 rounded-full">{activeVisit?.startDatetime ? new Date(activeVisit.startDatetime).toLocaleString() : ''}</span>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={`px-5 py-4 rounded-2xl flex items-center gap-3 ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          <span className="material-symbols-outlined text-xl">
            {message.type === "success" ? "check_circle" : "error"}
          </span>
          <p className="text-sm font-bold">{message.text}</p>
        </div>
      )}

      {/* Nutritional Values */}
      <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
        <h3 className="text-black font-black tracking-tight mb-6 flex items-center gap-2 text-xl">
          <span className="material-symbols-outlined text-blue-600 text-2xl">fitness_center</span>
          Nutritional Values
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Height (cm)</label>
            <input
              type="number"
              step="0.1"
              className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]"
              placeholder="e.g. 170"
              value={height}
              onChange={e => setHeight(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]"
              placeholder="e.g. 65"
              value={weight}
              onChange={e => setWeight(e.target.value)}
            />
          </div>
        </div>
        {height && weight && (
          <div className="mt-5 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between">
            <p className="text-blue-700 text-sm font-bold">
              Body Mass Index (BMI)
            </p>
            <p className="text-blue-800 text-lg font-black font-mono bg-blue-200/50 px-3 py-1 rounded-xl">
              {(parseFloat(weight) / Math.pow(parseFloat(height) / 100, 2)).toFixed(1)} <span className="text-sm font-bold">kg/m²</span>
            </p>
          </div>
        )}
      </div>

      {/* Vitals */}
      <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
        <h3 className="text-black font-black tracking-tight mb-8 flex items-center gap-2 text-xl">
          <span className="material-symbols-outlined text-blue-600 text-2xl">monitor_heart</span>
          Vitals
        </h3>

        {/* Blood Pressure */}
        <div className="mb-8">
          <h4 className="text-sm font-bold text-black/70 mb-4 flex items-center gap-2 bg-black/[0.03] p-3 rounded-xl w-max">
            <span className="material-symbols-outlined text-red-500">bloodtype</span>
            Blood Pressure
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Systolic (mmHg)</label>
              <input
                type="number"
                className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]"
                placeholder="e.g. 120"
                value={systolicBP}
                onChange={e => setSystolicBP(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Diastolic (mmHg)</label>
              <input
                type="number"
                className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]"
                placeholder="e.g. 80"
                value={diastolicBP}
                onChange={e => setDiastolicBP(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Body Position */}
        <div className="mb-8">
          <label className="text-xs font-bold text-black/60 mb-3 block uppercase tracking-wider">Body Position</label>
          <div className="flex flex-wrap gap-3">
            {BODY_POSITIONS.map(pos => (
              <button
                key={pos}
                type="button"
                onClick={() => setBodyPosition(bodyPosition === pos ? "" : pos)}
                className={`px-5 py-3 rounded-xl text-sm font-bold transition-all border-2 ${bodyPosition === pos
                  ? "bg-blue-50 border-blue-200 text-blue-700 shadow-[0_4px_12px_-4px_rgba(37,99,235,0.2)]"
                  : "bg-black/[0.02] border-transparent text-black/60 hover:bg-black/[0.05] hover:text-black"
                  }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Pulse */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-2">
          <div>
            <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Pulse (beats/min)</label>
            <input
              type="number"
              className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]"
              placeholder="e.g. 72"
              value={pulse}
              onChange={e => setPulse(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">SpO₂ — Oxygen Saturation (%)</label>
            <input
              type="number"
              className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]"
              placeholder="e.g. 98"
              value={spo2}
              onChange={e => setSpo2(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Fee Information */}
      <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
        <h3 className="text-black font-black tracking-tight mb-6 flex items-center gap-2 text-xl">
          <span className="material-symbols-outlined text-blue-600 text-2xl">payments</span>
          Fee Information
        </h3>
        <div className="max-w-xs">
          <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Registration Fee (₹)</label>
          <input
            type="number"
            className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]"
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
          className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-5 px-6 rounded-2xl flex items-center justify-center gap-2 text-sm transition-all shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] disabled:opacity-50"
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
