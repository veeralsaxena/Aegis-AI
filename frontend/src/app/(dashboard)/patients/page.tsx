"use client";

import { useState, useCallback, useEffect } from "react";
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
      } catch (err) { }
    };
    fetchImage();
    return () => { active = false; };
  }, [uuid, authFetch]);

  const defaultClasses = "rounded-lg object-cover shrink-0 shadow-sm border border-slate-200";
  const placeholderClasses = "rounded-lg bg-slate-50 flex items-center justify-center shrink-0 border border-slate-200";
  const finalClass = className || "w-10 h-10";

  return photoUrl ? (
    <img src={photoUrl} alt="Patient" className={`${defaultClasses} ${finalClass}`} />
  ) : (
    <div className={`${placeholderClasses} ${finalClass}`}>
      <span className="material-symbols-outlined text-slate-400 text-lg">person</span>
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
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-medium tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-600 text-2xl">person_search</span>
            </div>
            Patient Registration
          </h1>
          <p className="text-slate-500 text-[11px] font-semibold mt-2 uppercase tracking-wider">Search for existing patients or register a new one</p>
        </div>
        <Link
          href="/patients/new"
          className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors text-sm shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          Create New
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 relative z-10">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Name / ID search */}
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-slate-600 transition-colors">
              <span className="material-symbols-outlined text-xl">search</span>
            </div>
            <input
              type="text"
              placeholder="Search by patient name or ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 rounded-lg py-3 pl-11 pr-4 text-slate-900 placeholder-slate-400 transition-colors outline-none text-sm"
              autoFocus
            />
            {searching && (
              <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg animate-spin">progress_activity</span>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {results.length === 0 && !searching ? (
            <div className="p-12 md:p-16 text-center">
              <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-5">
                <span className="material-symbols-outlined text-slate-400 text-3xl block">person_off</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No patients found</h3>
              <p className="text-slate-500 text-sm">We couldn't find anyone matching &ldquo;<span className="text-slate-700 font-medium">{query}</span>&rdquo;</p>
              <Link
                href="/patients/new"
                className="inline-flex items-center gap-2 mt-6 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-5 py-2.5 rounded-lg font-medium transition-colors text-sm border border-slate-200"
              >
                <span className="material-symbols-outlined text-[18px]">person_add</span>
                Register as new patient
              </Link>
            </div>
          ) : (
            <>
              {/* Table Header - Desktop */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50/50 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                <div className="col-span-2">Patient ID</div>
                <div className="col-span-4">Full Name</div>
                <div className="col-span-1">Gender</div>
                <div className="col-span-1">Age</div>
                <div className="col-span-4">Address</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-slate-100">
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
                      className="w-full text-left hover:bg-slate-50 transition-colors group block"
                    >
                      {/* Desktop row */}
                      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 items-center">
                        <div className="col-span-2">
                          <span className="text-slate-600 text-[11px] font-mono bg-slate-100 border border-slate-200 px-2 py-0.5 rounded uppercase font-semibold">{id}</span>
                        </div>
                        <div className="col-span-4 flex items-center gap-3">
                          <PatientRowImage uuid={p.uuid} authFetch={authFetch} className="w-9 h-9" />
                          <span className="text-slate-900 text-sm font-medium group-hover:text-slate-600 transition-colors">{name}</span>
                        </div>
                        <div className="col-span-1 text-slate-500 text-sm">{gender === "M" ? "Male" : gender === "F" ? "Female" : "Other"}</div>
                        <div className="col-span-1 text-slate-500 text-sm">{age != null ? `${age} yrs` : "—"}</div>
                        <div className="col-span-4 text-slate-500 text-sm truncate">{address}</div>
                      </div>
                      {/* Mobile card */}
                      <div className="md:hidden px-5 py-4 flex items-center gap-4">
                        <PatientRowImage uuid={p.uuid} authFetch={authFetch} className="w-10 h-10" />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 text-sm font-medium truncate group-hover:text-slate-600 transition-colors">{name}</p>
                          <p className="text-slate-500 text-xs mt-1">
                            <span className="text-slate-600 font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] mr-1">{id}</span> • {gender === "M" ? "Male" : "Female"} • {age != null ? `${age} yrs` : "—"}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-slate-300 text-xl group-hover:text-slate-600 transition-colors">chevron_right</span>
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
        <div className="bg-white border border-slate-200 rounded-xl p-10 md:p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto mb-5">
            <span className="material-symbols-outlined text-slate-400 text-3xl">person_search</span>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Search for Patients</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-8">
            Type a patient&apos;s name or ID in the search bar above to find existing records, or click <strong className="text-slate-700 font-semibold">Create New</strong> to register a new patient.
          </p>
          <Link
            href="/patients/new"
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Register New Patient
          </Link>
        </div>
      )}
    </div>
  );
}
