"use client";

import React, { useState } from "react";
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
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-4xl font-bold tracking-tight">Diagnoses</h1>
        <p className="text-slate-400 mt-1">Record and view patient diagnoses using ICD-10 / SNOMED concepts.</p>
      </div>

      {/* Patient UUID */}
      <div className="glass-panel border-l-4 border-l-primary p-6 rounded-r-xl bg-white/5 mb-8">
        <label className="block text-slate-300 text-sm font-bold uppercase tracking-wider mb-2">Patient UUID</label>
        <div className="flex gap-4">
          <input
            type="text"
            className="flex-1 bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            placeholder="Enter Patient UUID..."
            value={patientUuid}
            onChange={(e) => setPatientUuid(e.target.value)}
          />
          <button
            onClick={fetchDiagnoses}
            className="px-6 py-3 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-all font-medium"
          >
            Load
          </button>
        </div>
      </div>

      {notification.message && (
        <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${
          notification.type === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
          "bg-green-500/10 text-green-400 border border-green-500/20"
        }`}>{notification.message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Record Diagnosis */}
        <div className="glass-panel rounded-xl p-8">
          <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">add_circle</span>
            Record Diagnosis
          </h3>
          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Search Concept</label>
              <input
                type="text"
                className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                placeholder="Type diagnosis name (e.g. Malaria, Diabetes)..."
                value={searchQuery}
                onChange={(e) => searchConcepts(e.target.value)}
              />
              {conceptResults.length > 0 && (
                <div className="mt-2 bg-slate-800 border border-slate-700 rounded-lg max-h-48 overflow-y-auto">
                  {conceptResults.map((c) => (
                    <button
                      key={c.uuid}
                      onClick={() => { setSelectedConcept(c); setSearchQuery(c.display); setConceptResults([]); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors border-b border-slate-700/50 last:border-b-0"
                    >
                      {c.display}
                    </button>
                  ))}
                </div>
              )}
              {selectedConcept && (
                <p className="mt-2 text-primary text-sm">Selected: <strong>{selectedConcept.display}</strong></p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Certainty</label>
                <select value={certainty} onChange={e => setCertainty(e.target.value)} className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white outline-none">
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="PRESUMED">Presumed</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Order</label>
                <select value={diagOrder} onChange={e => setDiagOrder(e.target.value)} className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white outline-none">
                  <option value="PRIMARY">Primary</option>
                  <option value="SECONDARY">Secondary</option>
                </select>
              </div>
            </div>

            <button
              onClick={submitDiagnosis}
              disabled={isSubmitting || !selectedConcept}
              className="w-full py-3 bg-primary text-background-dark font-bold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? "Recording..." : "Record Diagnosis"}
            </button>
          </div>
        </div>

        {/* Diagnosis History */}
        <div className="glass-panel rounded-xl p-8">
          <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">history</span>
            Diagnosis History
          </h3>
          {isLoading ? (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span>
            </div>
          ) : diagnoses.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2 block">search_off</span>
              No diagnoses found. Enter a Patient UUID and click Load.
            </div>
          ) : (
            <div className="space-y-3">
              {diagnoses.map((d) => (
                <div key={d.uuid} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                  <div>
                    <p className="text-white font-medium">{d.conceptName}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">{d.certainty}</span>
                      <span className="text-xs text-slate-400">{d.order}</span>
                    </div>
                  </div>
                  <span className="text-slate-500 text-sm">{d.date}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
