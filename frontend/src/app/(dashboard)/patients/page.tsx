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

  const defaultClasses = "rounded-xl object-cover shrink-0 shadow-sm border border-black/5";
  const placeholderClasses = "rounded-xl bg-black/5 flex items-center justify-center shrink-0 shadow-inner border border-black/5";
  const finalClass = className || "w-10 h-10";

  return photoUrl ? (
    <img src={photoUrl} alt="Patient" className={`${defaultClasses} ${finalClass}`} />
  ) : (
    <div className={`${placeholderClasses} ${finalClass}`}>
      <span className="material-symbols-outlined text-blue-600 text-lg">person</span>
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
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-black flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-black/5 shadow-inner flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-3xl">person_search</span>
            </div>
            Patient Registration
          </h1>
          <p className="text-black/50 text-sm font-semibold mt-2 uppercase tracking-wider">Search for existing patients or register a new one</p>
        </div>
        <Link
          href="/patients/new"
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold px-6 py-4 rounded-2xl flex items-center gap-2 shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] hover:shadow-[0_15px_40px_-10px_rgba(37,99,235,0.7)] transform hover:-translate-y-1 active:translate-y-0 transition-all text-sm shrink-0"
        >
          <span className="material-symbols-outlined text-xl">person_add</span>
          Create New
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-[2rem] p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5 relative z-10 backdrop-blur-2xl">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Name / ID search */}
          <div className="relative flex-1 group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-black/30 group-focus-within:text-blue-600 transition-colors">
              <span className="material-symbols-outlined text-2xl">search</span>
            </div>
            <input
              type="text"
              placeholder="Search by patient name or ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-black/[0.02] border-2 border-transparent focus:bg-white focus:border-blue-600 rounded-2xl py-4 pl-14 pr-4 text-black placeholder-black/30 transition-all outline-none text-base font-medium hover:bg-black/[0.04] focus:shadow-[0_8px_30px_-6px_rgba(37,99,235,0.2)]"
              autoFocus
            />
            {searching && (
              <span className="material-symbols-outlined absolute right-5 top-1/2 -translate-y-1/2 text-blue-600 text-xl animate-spin">progress_activity</span>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="bg-white rounded-[2.5rem] ring-1 ring-black/5 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.1)] overflow-hidden">
          {results.length === 0 && !searching ? (
            <div className="p-12 md:p-20 text-center">
              <div className="w-24 h-24 rounded-3xl bg-black/5 flex items-center justify-center mx-auto mb-6 shadow-inner">
                <span className="material-symbols-outlined text-black/20 text-5xl block">person_off</span>
              </div>
              <h3 className="text-2xl font-black text-black mb-2 tracking-tight">No patients found</h3>
              <p className="text-black/50 font-medium">We couldn't find anyone matching &ldquo;<span className="text-black">{query}</span>&rdquo;</p>
              <Link
                href="/patients/new"
                className="inline-flex items-center gap-2 mt-8 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-6 py-3 rounded-xl font-bold transition-all"
              >
                <span className="material-symbols-outlined text-lg">person_add</span>
                Register as new patient
              </Link>
            </div>
          ) : (
            <>
              {/* Table Header - Desktop */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-5 border-b border-black/5 bg-black/[0.02] text-xs font-bold text-black/40 uppercase tracking-widest">
                <div className="col-span-2">Patient ID</div>
                <div className="col-span-4">Full Name</div>
                <div className="col-span-1">Gender</div>
                <div className="col-span-1">Age</div>
                <div className="col-span-4">Address</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-black/5">
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
                      className="w-full text-left hover:bg-black/[0.02] transition-colors group"
                    >
                      {/* Desktop row */}
                      <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-5 items-center">
                        <div className="col-span-2 text-blue-600 text-sm font-bold font-mono bg-blue-50 inline-block px-3 py-1 rounded-lg w-fit group-hover:bg-blue-100 transition-colors">{id}</div>
                        <div className="col-span-4 flex items-center gap-4">
                          <PatientRowImage uuid={p.uuid} authFetch={authFetch} />
                          <span className="text-black text-sm font-bold truncate group-hover:text-blue-600 transition-colors">{name}</span>
                        </div>
                        <div className="col-span-1 text-black/60 font-semibold text-sm">{gender === "M" ? "Male" : gender === "F" ? "Female" : "Other"}</div>
                        <div className="col-span-1 text-black/60 font-semibold text-sm">{age != null ? `${age} yrs` : "—"}</div>
                        <div className="col-span-4 text-black/50 font-medium text-sm truncate">{address}</div>
                      </div>
                      {/* Mobile card */}
                      <div className="md:hidden px-6 py-5 flex items-center gap-4">
                        <PatientRowImage uuid={p.uuid} authFetch={authFetch} className="w-12 h-12 !rounded-2xl" />
                        <div className="flex-1 min-w-0">
                          <p className="text-black text-base font-bold truncate group-hover:text-blue-600 transition-colors">{name}</p>
                          <p className="text-black/50 font-medium text-xs mt-1">
                            <span className="text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md mr-1">{id}</span> • {gender === "M" ? "Male" : "Female"} • {age != null ? `${age} yrs` : "—"}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-black/20 text-2xl group-hover:text-blue-600 transition-colors transform group-hover:translate-x-1">chevron_right</span>
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
        <div className="bg-white border border-black/5 rounded-[2.5rem] p-10 md:p-20 text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)]">
          <div className="w-24 h-24 rounded-3xl bg-black/5 shadow-inner flex items-center justify-center mx-auto mb-8">
            <span className="material-symbols-outlined text-blue-600 text-5xl">person_search</span>
          </div>
          <h3 className="text-3xl font-black text-black mb-3 tracking-tight">Search for Patients</h3>
          <p className="text-black/50 text-base font-medium max-w-md mx-auto mb-10 leading-relaxed">
            Type a patient&apos;s name or ID in the search bar above to find existing records, or click <strong className="text-black">Create New</strong> to register a new patient.
          </p>
          <Link
            href="/patients/new"
            className="inline-flex items-center gap-2 bg-black/[0.03] hover:bg-black/[0.06] border-2 border-transparent text-black font-bold px-8 py-4 rounded-2xl text-base transition-all hover:scale-105 active:scale-100"
          >
            <span className="material-symbols-outlined text-xl text-blue-600">person_add</span>
            Register New Patient
          </Link>
        </div>
      )}
    </div>
  );
}
