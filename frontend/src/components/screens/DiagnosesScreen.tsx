"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface DiagnosisEntry {
  uuid: string;
  conceptName: string;
  certainty: string;
  order: string;
  date: string;
}

export default function DiagnosesScreen() {
  const { authFetch } = useAuth();
  const [patientUuid, setPatientUuid] = useState("");
  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [conceptResults, setConceptResults] = useState<{ uuid: string; display: string }[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<{ uuid: string; display: string } | null>(null);
  const [certainty, setCertainty] = useState("CONFIRMED");
  const [diagOrder, setDiagOrder] = useState("PRIMARY");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ type: "", message: "" });

  const fetchDiagnoses = async () => {
    if (!patientUuid) return;
    setIsLoading(true);
    try {
      const res = await authFetch(`/openmrs/ws/rest/v1/obs?patient=${patientUuid}&v=custom:(uuid,concept:(display),value,obsDatetime)`);
      const data = await res.json();
      // Filter for diagnosis-related observations
      const diags = (data.results || [])
        .filter((obs: any) => {
          const name = obs.concept?.display?.toLowerCase() || "";
          return name.includes("diagnosis") || name.includes("coded diagnosis");
        })
        .map((obs: any) => ({
          uuid: obs.uuid,
          conceptName: typeof obs.value === "object" ? obs.value?.display : obs.value || "Unknown",
          certainty: "CONFIRMED",
          order: "PRIMARY",
          date: new Date(obs.obsDatetime).toLocaleDateString(),
        }));
      setDiagnoses(diags);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to fetch diagnoses" });
    } finally {
      setIsLoading(false);
    }
  };

  const searchConcepts = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 3) { setConceptResults([]); return; }
    try {
      const res = await authFetch(`/openmrs/ws/rest/v1/concept?q=${encodeURIComponent(q)}&limit=10`);
      const data = await res.json();
      setConceptResults(data.results || []);
    } catch {
      setConceptResults([]);
    }
  };

  const submitDiagnosis = async () => {
    if (!patientUuid || !selectedConcept) {
      setNotification({ type: "error", message: "Select a patient and diagnosis concept." });
      return;
    }
    setIsSubmitting(true);
    try {
      // Create encounter with diagnosis obs
      const payload = {
        patient: patientUuid,
        encounterType: "b9ccceaa-f496-11ed-b02c-0242ac150003", // Consultation
        obs: [
          {
            concept: "c3a4f486-2e58-4a30-8c62-a8ecca5f1e7f", // Coded Diagnosis concept (may need adjustment)
            value: selectedConcept.uuid,
          },
        ],
      };

      const res = await authFetch("/openmrs/ws/rest/v1/encounter", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to record diagnosis");

      setNotification({ type: "success", message: `Diagnosis "${selectedConcept.display}" recorded successfully.` });
      setSelectedConcept(null);
      setSearchQuery("");
      setConceptResults([]);
      fetchDiagnoses();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to submit diagnosis" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#fafafa] min-h-screen pb-20">
      <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-black tracking-tighter">Diagnoses</h1>
            <p className="text-black/50 text-sm font-semibold mt-1 uppercase tracking-wider">Record and view patient diagnoses using ICD-10 / SNOMED concepts.</p>
          </div>
        </div>

        {/* Patient UUID */}
        <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
          <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Patient UUID</label>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              className="flex-1 bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]"
              placeholder="Enter Patient UUID..."
              value={patientUuid}
              onChange={(e) => setPatientUuid(e.target.value)}
            />
            <button
              onClick={fetchDiagnoses}
              className="bg-black/[0.03] text-black border-2 border-transparent hover:bg-black/[0.06] font-bold py-3.5 px-8 rounded-xl flex items-center justify-center transition-all text-sm"
            >
              Load
            </button>
          </div>
        </div>

        {notification.message && (
          <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${notification.type === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
            "bg-green-500/10 text-green-400 border border-green-500/20"
            }`}>{notification.message}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Record Diagnosis */}
          <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
            <h3 className="text-black font-black tracking-tight mb-6 flex items-center gap-2 text-xl">
              <span className="material-symbols-outlined text-blue-600 text-2xl">add_circle</span>
              Record Diagnosis
            </h3>
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Search Concept</label>
                <input
                  type="text"
                  className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05]"
                  placeholder="Type diagnosis name (e.g. Malaria, Diabetes)..."
                  value={searchQuery}
                  onChange={(e) => searchConcepts(e.target.value)}
                />
                {conceptResults.length > 0 && (
                  <div className="mt-2 bg-white border border-black/10 shadow-lg rounded-xl max-h-48 overflow-y-auto relative z-10 overflow-hidden">
                    {conceptResults.map((c) => (
                      <button
                        key={c.uuid}
                        onClick={() => { setSelectedConcept(c); setSearchQuery(c.display); setConceptResults([]); }}
                        className="w-full text-left px-5 py-3 text-sm text-black/70 hover:bg-blue-50 hover:text-blue-600 transition-colors border-b border-black/5 last:border-b-0 font-medium"
                      >
                        {c.display}
                      </button>
                    ))}
                  </div>
                )}
                {selectedConcept && (
                  <p className="mt-3 text-blue-600 text-sm font-bold flex items-center gap-1.5"><span className="material-symbols-outlined text-lg">check_circle</span> Selected: {selectedConcept.display}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Certainty</label>
                  <select value={certainty} onChange={e => setCertainty(e.target.value)} className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm appearance-none transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05] cursor-pointer">
                    <option value="CONFIRMED">Confirmed</option>
                    <option value="PRESUMED">Presumed</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-black/60 mb-2 block uppercase tracking-wider">Order</label>
                  <select value={diagOrder} onChange={e => setDiagOrder(e.target.value)} className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 text-black font-medium p-3.5 rounded-xl outline-none text-sm appearance-none transition-all focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] hover:bg-black/[0.05] cursor-pointer">
                    <option value="PRIMARY">Primary</option>
                    <option value="SECONDARY">Secondary</option>
                  </select>
                </div>
              </div>

              <button
                onClick={submitDiagnosis}
                disabled={isSubmitting || !selectedConcept}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)]"
              >
                {isSubmitting ? (
                  <><span className="material-symbols-outlined text-lg animate-spin">progress_activity</span> Recording...</>
                ) : (
                  <><span className="material-symbols-outlined text-lg">save</span> Record Diagnosis</>
                )}
              </button>
            </div>
          </div>

          {/* Diagnosis History */}
          <div className="bg-white border border-black/5 rounded-[2rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5">
            <h3 className="text-black font-black tracking-tight mb-6 flex items-center gap-2 text-xl">
              <span className="material-symbols-outlined text-blue-600 text-2xl">history</span>
              Diagnosis History
            </h3>
            {isLoading ? (
              <div className="text-center py-8">
                <span className="material-symbols-outlined text-blue-600 text-3xl animate-spin">progress_activity</span>
              </div>
            ) : diagnoses.length === 0 ? (
              <div className="text-center py-16 bg-black/[0.02] rounded-[1.5rem] border-2 border-dashed border-black/5 text-black/40 font-bold">
                <span className="material-symbols-outlined text-5xl mb-3 block">search_off</span>
                No diagnoses found.<br />Enter a Patient UUID and click Load.
              </div>
            ) : (
              <div className="space-y-4">
                {diagnoses.map((d) => (
                  <div key={d.uuid} className="flex items-center justify-between p-5 bg-black/[0.03] rounded-2xl border border-black/5 hover:bg-black/[0.05] transition-colors">
                    <div>
                      <p className="text-black font-bold tracking-tight">{d.conceptName}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-1 rounded-md">{d.certainty}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-black/50">{d.order}</span>
                      </div>
                    </div>
                    <span className="text-black/40 text-xs font-bold uppercase tracking-wider">{d.date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
