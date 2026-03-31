"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import PatientSearch from "@/components/PatientSearch";

interface Patient { uuid: string; person: { display: string }; }

function BillingContent() {
  const { authFetch } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounters, setEncounters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patient) { setEncounters([]); return; }
    setLoading(true);
    authFetch(`/openmrs/ws/rest/v1/encounter?patient=${patient.uuid}&v=default&limit=50`)
      .then(r => r.json())
      .then(data => setEncounters(data.results || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [patient, authFetch]);

  const totalEncounters = encounters.length;

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-3xl">receipt_long</span>
          Billing & Finance
        </h1>
        <p className="text-slate-400 text-sm mt-1">View patient encounter history for billing</p>
      </div>

      <PatientSearch onSelect={(p) => setPatient(p as Patient)} label="Select Patient" />

      {patient && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Total Encounters</p>
            <p className="text-3xl font-bold text-white">{totalEncounters}</p>
          </div>
          <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Patient</p>
            <p className="text-lg font-semibold text-white truncate">{patient.person.display}</p>
          </div>
          <div className="bg-slate-900/50 border border-white/5 rounded-xl p-5">
            <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Status</p>
            <span className="inline-flex items-center gap-1.5 text-green-400 text-sm font-medium">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              Active
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8"><span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span></div>
      ) : patient && encounters.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6 bg-slate-900/30 rounded-xl border border-white/5">No encounters found</p>
      ) : patient ? (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-4 gap-4 px-4 py-3 bg-slate-800/50 text-xs text-slate-500 uppercase tracking-wider font-medium">
            <span>Type</span><span>Date</span><span>Details</span><span>Status</span>
          </div>
          {encounters.map(enc => (
            <div key={enc.uuid} className="grid grid-cols-4 gap-4 px-4 py-3 border-t border-white/5 text-sm items-center hover:bg-white/[0.02] transition-colors">
              <span className="text-white font-medium">{enc.encounterType?.display || "Encounter"}</span>
              <span className="text-slate-400">{new Date(enc.encounterDatetime).toLocaleDateString()}</span>
              <span className="text-slate-500 truncate">{enc.obs?.length ? `${enc.obs.length} observations` : "No obs"}</span>
              <span className="text-green-400 text-xs font-medium">Recorded</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-white/5">
          <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">account_balance</span>
          <p className="text-slate-500 text-sm">Select a patient to view billing information</p>
        </div>
      )}
    </div>
  );
}

export default function ScreenBilling() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span></div>}><BillingContent /></Suspense>;
}
