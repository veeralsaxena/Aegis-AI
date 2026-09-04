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
    <div className="bg-[#fafafa] min-h-screen p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-black flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-3xl">biotech</span>
            Lab Results
          </h1>
          <p className="text-black/50 font-medium text-sm mt-1">View laboratory test results for a patient</p>
        </div>

        <div className="bg-white border border-black/5 shadow-sm rounded-2xl p-6 relative">
          <PatientSearch onSelect={(p) => setPatient(p as Patient)} label="Select Patient" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="material-symbols-outlined text-blue-600 text-3xl animate-spin">progress_activity</span>
          </div>
        ) : !patient ? (
          <div className="text-center py-16 bg-white shadow-sm rounded-2xl border border-black/5">
            <span className="material-symbols-outlined text-black/20 text-5xl mb-3 block">science</span>
            <p className="text-black/50 font-medium text-sm">Select a patient to view their lab results</p>
          </div>
        ) : encounters.length === 0 ? (
          <div className="text-center py-16 bg-white shadow-sm rounded-2xl border border-black/5">
            <span className="material-symbols-outlined text-black/20 text-5xl mb-3 block">labs</span>
            <p className="text-black/50 font-medium text-sm">No lab results found for {patient.person.display}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {encounters.map(enc => (
              <div key={enc.uuid} className="bg-white border border-black/5 shadow-sm rounded-xl p-5 relative overflow-hidden group hover:border-blue-600/30 hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-black font-bold text-base">{enc.encounterType.display}</span>
                  <span className="text-black/50 font-medium text-xs bg-black/5 px-2.5 py-1 rounded-md">{new Date(enc.encounterDatetime).toLocaleString()}</span>
                </div>
                {enc.obs && enc.obs.length > 0 ? (
                  <div className="space-y-3 border-t border-black/5 pt-4">
                    {enc.obs.map((o, i) => (
                      <div key={i} className="flex justify-between items-center bg-black/[0.02] p-3 rounded-lg border border-black/[0.03]">
                        <span className="text-black/60 font-bold text-sm tracking-wide uppercase">{o.display.split(":")[0]}</span>
                        <span className="text-black text-sm font-bold">{typeof o.value === "object" ? o.value?.display : o.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-black/40 font-medium text-xs">No observations recorded</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScreenLabResults() {
  return <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span></div>}><LabResultsContent /></Suspense>;
}
