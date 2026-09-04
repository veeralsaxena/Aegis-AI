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
    <div className="bg-[#fafafa] min-h-screen pb-20">
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-black flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-blue-600 text-4xl">receipt_long</span>
            Billing & Finance
          </h1>
          <p className="text-black/50 font-medium text-base mt-1">View patient encounter history for billing</p>
        </div>

      <PatientSearch onSelect={(p) => setPatient(p as Patient)} label="Select Patient" />

      {patient && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-black/5 shadow-sm rounded-xl p-5">
            <p className="text-black/50 text-xs font-bold uppercase tracking-wider mb-2">Total Encounters</p>
            <p className="text-3xl font-bold text-black">{totalEncounters}</p>
          </div>
          <div className="bg-white border border-black/5 shadow-sm rounded-xl p-5">
            <p className="text-black/50 text-xs font-bold uppercase tracking-wider mb-2">Patient</p>
            <p className="text-lg font-bold text-black truncate">{patient.person.display}</p>
          </div>
          <div className="bg-white border border-black/5 shadow-sm rounded-xl p-5">
            <p className="text-black/50 text-xs font-bold uppercase tracking-wider mb-2">Status</p>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 text-sm font-bold">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              Active
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8"><span className="material-symbols-outlined text-blue-600 text-3xl animate-spin">progress_activity</span></div>
      ) : patient && encounters.length === 0 ? (
        <p className="text-black/50 font-medium text-sm text-center py-6 bg-white shadow-sm rounded-xl border border-black/5">No encounters found</p>
      ) : patient ? (
        <div className="bg-white border border-black/5 shadow-sm rounded-2xl overflow-hidden">
          <div className="grid grid-cols-4 gap-4 px-6 py-4 bg-black/5 text-xs text-black/50 uppercase tracking-wider font-bold">
            <span>Type</span><span>Date</span><span>Details</span><span>Status</span>
          </div>
          {encounters.map(enc => (
            <div key={enc.uuid} className="grid grid-cols-4 gap-4 px-6 py-4 border-t border-black/5 text-sm items-center hover:bg-blue-50/50 transition-colors">
              <span className="text-black font-bold">{enc.encounterType?.display || "Encounter"}</span>
              <span className="text-black/50 font-medium">{new Date(enc.encounterDatetime).toLocaleDateString()}</span>
              <span className="text-black/40 font-medium truncate">{enc.obs?.length ? `${enc.obs.length} observations` : "No obs"}</span>
              <span className="text-emerald-600 text-xs font-bold">Recorded</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white shadow-sm rounded-3xl border border-black/5">
          <span className="material-symbols-outlined text-black/20 text-6xl mb-4 block">account_balance</span>
          <p className="text-black/50 font-medium text-sm">Select a patient to view billing information</p>
        </div>
      )}
      </div>
    </div>
  );
}

export default function ScreenBilling() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><span className="material-symbols-outlined text-blue-600 text-5xl animate-spin">progress_activity</span></div>}><BillingContent /></Suspense>;
}
