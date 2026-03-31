"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface PatientResult {
  uuid: string;
  display: string;
  identifiers: { display: string }[];
  person: {
    display: string;
    gender: string;
    age: number;
    birthdate: string;
    preferredAddress?: { cityVillage?: string; address1?: string };
  };
}

const PatientRowImage = ({ uuid, authFetch, className }: { uuid: string; authFetch: any; className?: string }) => {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchImage = async () => {
      try {
        const res = await authFetch(`/openmrs/ws/rest/v1/patientImage?patientUuid=${uuid}`);
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 100 && active) {
            setPhotoUrl(URL.createObjectURL(blob));
          }
        }
      } catch (err) {}
    };
    fetchImage();
    return () => { active = false; };
  }, [uuid, authFetch]);

  const defaultClasses = "rounded-lg object-cover shrink-0";
  const placeholderClasses = "rounded-lg bg-primary/10 flex items-center justify-center shrink-0";
  const finalClass = className || "w-8 h-8";

  return photoUrl ? (
    <img src={photoUrl} alt="Patient" className={`${defaultClasses} ${finalClass}`} />
  ) : (
    <div className={`${placeholderClasses} ${finalClass}`}>
      <span className="material-symbols-outlined text-primary text-sm">person</span>
    </div>
  );
};

export default function PatientsPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setSearching(true);
    setHasSearched(true);
    try {
      const res = await authFetch(`/openmrs/ws/rest/v1/patient?q=${encodeURIComponent(q)}&v=default&limit=20`);
      const data = await res.json();
      setResults(data.results || []);
    } catch (e) {
      console.error("Patient search error:", e);
    } finally {
      setSearching(false);
    }
  }, [authFetch]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => search(query), 350);
    return () => clearTimeout(timer);
  }, [query, search]);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">person_search</span>
            Patient Registration
          </h1>
          <p className="text-slate-400 text-sm mt-1">Search for existing patients or register a new one</p>
        </div>
        <Link
          href="/patients/new"
          className="liquid-button text-background-dark font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all text-sm shrink-0"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Create New
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-4 md:p-6 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Name / ID search */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
            <input
              type="text"
              placeholder="Search by patient name or ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-black/50 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 transition-all outline-none text-sm"
              autoFocus
            />
            {searching && (
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary text-lg animate-spin">progress_activity</span>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-xl overflow-hidden">
          {results.length === 0 && !searching ? (
            <div className="p-8 md:p-12 text-center">
              <span className="material-symbols-outlined text-slate-600 text-5xl mb-3 block">person_off</span>
              <p className="text-slate-400 text-sm">No patients found for &ldquo;{query}&rdquo;</p>
              <Link
                href="/patients/new"
                className="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80 text-sm font-medium transition-colors"
              >
                <span className="material-symbols-outlined text-sm">person_add</span>
                Register as new patient
              </Link>
            </div>
          ) : (
            <>
              {/* Table Header - Desktop */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 bg-slate-800/30 text-xs font-medium text-slate-500 uppercase tracking-wider">
                <div className="col-span-2">ID</div>
                <div className="col-span-4">Name</div>
                <div className="col-span-1">Gender</div>
                <div className="col-span-1">Age</div>
                <div className="col-span-4">Address</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-white/5">
                {results.map((p) => {
                  const id = p.identifiers?.[0]?.display?.replace(/^.*=\s*/, '') || "N/A";
                  const name = p.person?.display || p.display || "Unknown";
                  const gender = p.person?.gender;
                  const age = p.person?.age;
                  const address = p.person?.preferredAddress?.cityVillage || p.person?.preferredAddress?.address1 || "—";

                  return (
                  <button
                    key={p.uuid}
                    onClick={() => router.push(`/patients/${p.uuid}`)}
                    className="w-full text-left hover:bg-primary/5 transition-colors"
                  >
                    {/* Desktop row */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 items-center">
                      <div className="col-span-2 text-primary text-sm font-mono">{id}</div>
                      <div className="col-span-4 flex items-center gap-3">
                        <PatientRowImage uuid={p.uuid} authFetch={authFetch} />
                        <span className="text-white text-sm font-medium truncate">{name}</span>
                      </div>
                      <div className="col-span-1 text-slate-400 text-sm">{gender === "M" ? "Male" : gender === "F" ? "Female" : "Other"}</div>
                      <div className="col-span-1 text-slate-400 text-sm">{age != null ? `${age} yrs` : "—"}</div>
                      <div className="col-span-4 text-slate-500 text-sm truncate">{address}</div>
                    </div>
                    {/* Mobile card */}
                    <div className="md:hidden px-4 py-4 flex items-center gap-3">
                      <PatientRowImage uuid={p.uuid} authFetch={authFetch} className="w-10 h-10 !rounded-xl" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{name}</p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          {id} • {gender === "M" ? "Male" : "Female"} • {age != null ? `${age} yrs` : "—"}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-slate-600 text-lg">chevron_right</span>
                    </div>
                  </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state when no search */}
      {!hasSearched && (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-8 md:p-16 text-center backdrop-blur-xl">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-primary text-4xl">person_search</span>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">Search for Patients</h3>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
            Type a patient&apos;s name or ID in the search bar above to find existing records, or click &ldquo;Create New&rdquo; to register a new patient.
          </p>
          <Link
            href="/patients/new"
            className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-6 py-3 rounded-xl text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Register New Patient
          </Link>
        </div>
      )}
    </div>
  );
}
