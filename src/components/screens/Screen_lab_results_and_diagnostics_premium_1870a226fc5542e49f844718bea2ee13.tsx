"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import PatientSearch from "@/components/PatientSearch";

interface Patient { uuid: string; person: { display: string }; }
interface LabEncounter {
  uuid: string;
  encounterDatetime: string;
  encounterType: { display: string };
  obs: { display: string; value: any }[];
}

function LabResultsContent() {
  const { authFetch } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounters, setEncounters] = useState<LabEncounter[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patient) { setEncounters([]); return; }
    setLoading(true);
    authFetch(`/openmrs/ws/rest/v1/encounter?patient=${patient.uuid}&encounterType=LAB_RESULT&v=default&limit=20`)
      .then(r => r.json())
      .then(data => setEncounters(data.results || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [patient, authFetch]);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-3xl">biotech</span>
          Lab Results
        </h1>
        <p className="text-slate-400 text-sm mt-1">View laboratory test results for a patient</p>
      </div>

      <PatientSearch onSelect={(p) => setPatient(p as Patient)} label="Select Patient" />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span>
        </div>
      ) : !patient ? (
        <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-white/5">
          <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">science</span>
          <p className="text-slate-500 text-sm">Select a patient to view their lab results</p>
        </div>
      ) : encounters.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-white/5">
          <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">labs</span>
          <p className="text-slate-500 text-sm">No lab results found for {patient.person.display}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {encounters.map(enc => (
            <div key={enc.uuid} className="bg-slate-900/50 border border-white/5 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-medium text-sm">{enc.encounterType.display}</span>
                <span className="text-slate-500 text-xs">{new Date(enc.encounterDatetime).toLocaleString()}</span>
              </div>
              {enc.obs && enc.obs.length > 0 ? (
                <div className="space-y-2 border-t border-white/5 pt-3">
                  {enc.obs.map((o, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">{o.display.split(":")[0]}</span>
                      <span className="text-white text-sm font-medium">{typeof o.value === "object" ? o.value?.display : o.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-600 text-xs">No observations recorded</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ScreenLabResults() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span></div>}><LabResultsContent /></Suspense>;
}
