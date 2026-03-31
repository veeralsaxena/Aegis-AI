"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface PatientResult {
  uuid: string;
  display: string;
  identifiers: { display: string }[];
  person: {
    display: string;
    gender: string;
    age: number;
    birthdate: string;
  };
}

interface ActiveVisit {
  uuid: string;
  patient: { uuid: string; display: string };
  visitType: { display: string };
  startDatetime: string;
  location?: { display: string };
  stopDatetime: string | null;
}

export default function Screen_clinical_queue_and_search() {
  const { authFetch } = useAuth();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [activeVisits, setActiveVisits] = useState<ActiveVisit[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingVisits, setLoadingVisits] = useState(true);
  const [activeTab, setActiveTab] = useState<"queue" | "search">("queue");

  // Load active visits on mount
  useEffect(() => {
    setLoadingVisits(true);
    authFetch("/openmrs/ws/rest/v1/visit?v=default&includeInactive=false")
      .then(r => r.json())
      .then(data => {
        // Filter to only active visits (no stopDatetime)
        const active = (data.results || []).filter((v: ActiveVisit) => !v.stopDatetime);
        setActiveVisits(active);
      })
      .catch(console.error)
      .finally(() => setLoadingVisits(false));
  }, [authFetch]);

  // Search patients by name
  const searchPatients = useCallback(async (query: string) => {
    if (!query.trim()) {
      setPatients([]);
      return;
    }
    setSearching(true);
    try {
      const res = await authFetch(`/openmrs/ws/rest/v1/patient?q=${encodeURIComponent(query)}&v=default&limit=20`);
      const data = await res.json();
      setPatients(data.results || []);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setSearching(false);
    }
  }, [authFetch]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setPatients([]);
      return;
    }
    const timer = setTimeout(() => searchPatients(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchPatients]);

  const navigateToPatient = (uuid: string) => {
    router.push(`/patients/${uuid}`);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">group</span>
            Patient Queue & Search
          </h1>
          <p className="text-slate-400 text-sm mt-1">Search patients by name or view active visits</p>
        </div>
        <button
          onClick={() => router.push("/patients/new")}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-background-dark font-semibold px-5 py-2.5 rounded-xl shadow-lg hover:shadow-lg transition-all text-sm"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Register New Patient
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
        <input
          type="text"
          placeholder="Search by patient name or ID..."
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim()) setActiveTab("search");
            else setActiveTab("queue");
          }}
          className="w-full bg-slate-900/50 border border-white/10 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-600 transition-all outline-none"
        />
        {searching && (
          <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary text-xl animate-spin">progress_activity</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-1">
        <button
          onClick={() => setActiveTab("queue")}
          className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
            activeTab === "queue"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-white"
          }`}
        >
          Active Queue ({activeVisits.length})
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`px-4 py-2.5 text-sm font-medium transition-all border-b-2 ${
            activeTab === "search"
              ? "border-primary text-primary"
              : "border-transparent text-slate-500 hover:text-white"
          }`}
        >
          Search Results {patients.length > 0 ? `(${patients.length})` : ""}
        </button>
      </div>

      {/* Active Queue Tab */}
      {activeTab === "queue" && (
        <div className="space-y-3">
          {loadingVisits ? (
            <div className="flex items-center justify-center py-12">
              <span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span>
            </div>
          ) : activeVisits.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-white/5">
              <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">event_busy</span>
              <p className="text-slate-500 text-sm">No active visits at the moment</p>
              <p className="text-slate-600 text-xs mt-1">Register a new patient or start a visit to see them here</p>
            </div>
          ) : (
            activeVisits.map(visit => (
              <button
                key={visit.uuid}
                onClick={() => navigateToPatient(visit.patient.uuid)}
                className="w-full bg-slate-900/50 hover:bg-slate-800/50 border border-white/5 hover:border-primary/20 rounded-xl p-4 flex items-center gap-4 transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-green-400 text-xl">person</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">{visit.patient.display}</p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {visit.visitType.display} • {visit.location?.display || "N/A"} • Started {new Date(visit.startDatetime).toLocaleString()}
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded-full">Active</span>
                <span className="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors">chevron_right</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Search Results Tab */}
      {activeTab === "search" && (
        <div className="space-y-3">
          {!searchQuery.trim() ? (
            <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-white/5">
              <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">search</span>
              <p className="text-slate-500 text-sm">Type a patient name to search</p>
            </div>
          ) : patients.length === 0 && !searching ? (
            <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-white/5">
              <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">person_off</span>
              <p className="text-slate-500 text-sm">No patients found for &quot;{searchQuery}&quot;</p>
              <p className="text-slate-600 text-xs mt-1">Try a different name or register a new patient</p>
            </div>
          ) : (
            patients.map(patient => {
              const id = patient.identifiers?.[0]?.display?.split("= ")?.[1] || "N/A";
              return (
                <button
                  key={patient.uuid}
                  onClick={() => navigateToPatient(patient.uuid)}
                  className="w-full bg-slate-900/50 hover:bg-slate-800/50 border border-white/5 hover:border-primary/20 rounded-xl p-4 flex items-center gap-4 transition-all group text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary text-xl">person</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">{patient.person.display}</p>
                    <div className="flex items-center gap-3 text-slate-500 text-xs mt-0.5">
                      <span>ID: {id}</span>
                      <span>{patient.person.gender === "M" ? "Male" : "Female"}</span>
                      <span>{patient.person.age} yrs</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-slate-600 group-hover:text-primary transition-colors">chevron_right</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
