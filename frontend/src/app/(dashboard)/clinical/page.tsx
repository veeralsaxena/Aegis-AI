"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import PatientAvatar from "@/components/clinical/PatientAvatar";
import CDSAgentAlerts from "@/components/clinical/CDSAgentAlerts";
import { searchPatientsBahmni } from "@/lib/bahmniApi";

interface ActivePatient {
  uuid: string;
  identifier: string;
  givenName: string;
  middleName?: string;
  familyName: string;
  gender: string;
  age: number;
  activeVisitUuid?: string;
  dateCreated?: string;
  personId?: number;
}

interface SearchPatient {
  uuid: string;
  givenName: string;
  middleName?: string;
  familyName: string;
  identifier: string;
  gender: string;
  age: number;
  dateCreated: string;
  activeVisitUuid?: string;
  birthDate?: string;
  addressFieldValue?: string;
  personUuid?: string;
}

export default function ClinicalPage() {
  const { authFetch, locationUuid } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"active" | "search">("active");
  const [activePatients, setActivePatients] = useState<ActivePatient[]>([]);
  const [searchResults, setSearchResults] = useState<SearchPatient[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // Fetch active patients on mount
  const fetchActivePatients = useCallback(async () => {
    setLoading(true);
    try {
      // Try Bahmni SQL search for active patients first
      const locUuid = locationUuid || "833d0c66-e29a-4d31-ac13-ca9050d1bfa9";
      const res = await authFetch(
        `/openmrs/ws/rest/v1/bahmnicore/sql?location_uuid=${locUuid}&q=emrapi.sqlSearch.activePatients&v=full`
      );
      if (res.ok) {
        const data = await res.json();
        const patientsPromise = (data || []).map(async (v: any) => {
          try {
            const pRes = await authFetch(`/openmrs/ws/rest/v1/patient/${v.uuid}?v=full`);
            if (pRes.ok) {
              const fullP = await pRes.json();
              return {
                uuid: v.uuid,
                identifier: v.identifier,
                name: v.name,
                givenName: fullP.person?.preferredName?.givenName || fullP.person?.display?.split(" ")[0] || v.name,
                familyName: fullP.person?.preferredName?.familyName || fullP.person?.display?.split(" ")?.slice(1)?.join(" ") || "",
                gender: fullP.person?.gender || "",
                age: fullP.person?.age || 0,
                activeVisitUuid: v.activeVisitUuid,
              };
            }
          } catch (e) { }
          return {
            uuid: v.uuid,
            identifier: v.identifier,
            name: v.name,
            givenName: v.name?.split(" ")[0] || "",
            familyName: v.name?.split(" ").slice(1).join(" ") || "",
            gender: "",
            age: 0,
            activeVisitUuid: v.activeVisitUuid,
          };
        });
        const patients = await Promise.all(patientsPromise);
        setActivePatients(patients);
      } else {
        // Fallback: fetch active visits and extract patients
        const visitRes = await authFetch(`/openmrs/ws/rest/v1/visit?includeInactive=false&v=default&limit=50`);
        const visitData = await visitRes.json();
        const patients: ActivePatient[] = (visitData.results || []).map((v: any) => ({
          uuid: v.patient?.uuid || "",
          identifier: v.patient?.display?.split(" - ")?.[0] || "",
          givenName: v.patient?.display?.split(" - ")?.[1]?.split(" ")?.[0] || v.patient?.display || "",
          familyName: v.patient?.display?.split(" - ")?.[1]?.split(" ")?.slice(1)?.join(" ") || "",
          gender: "",
          age: 0,
          activeVisitUuid: v.uuid,
        }));
        setActivePatients(patients);
      }
    } catch (err) {
      console.error("Failed to fetch active patients:", err);
      // Try simple visit fallback
      try {
        const visitRes = await authFetch(`/openmrs/ws/rest/v1/visit?includeInactive=false&v=default&limit=50`);
        const visitData = await visitRes.json();
        const patients: ActivePatient[] = (visitData.results || []).map((v: any) => ({
          uuid: v.patient?.uuid || "",
          identifier: v.patient?.display?.split(" - ")?.[0] || "",
          givenName: v.patient?.display?.split(" - ")?.[1] || v.patient?.display || "",
          familyName: "",
          gender: "",
          age: 0,
          activeVisitUuid: v.uuid,
        }));
        setActivePatients(patients);
      } catch {
        setActivePatients([]);
      }
    } finally {
      setLoading(false);
    }
  }, [authFetch, locationUuid]);

  useEffect(() => {
    fetchActivePatients();
  }, [fetchActivePatients]);

  const searchPatients = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const rows = await searchPatientsBahmni(authFetch, q.trim(), {
          loginLocationUuid: locationUuid || undefined,
        });
        const mapped: SearchPatient[] = rows.map((r) => ({
          uuid: r.uuid,
          givenName: r.givenName,
          middleName: r.middleName,
          familyName: r.familyName,
          identifier: r.identifier,
          gender: r.gender,
          age: r.age,
          dateCreated: r.dateCreated,
          activeVisitUuid: r.activeVisitUuid,
          birthDate: r.birthDate,
          addressFieldValue: r.addressFieldValue,
          personUuid: r.personUuid,
        }));
        setSearchResults(mapped);
      } catch (err) {
        console.error("Search error:", err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [authFetch, locationUuid]
  );

  // Debounced search
  useEffect(() => {
    if (activeTab !== "search") return;
    const timer = setTimeout(() => searchPatients(query), 350);
    return () => clearTimeout(timer);
  }, [query, searchPatients, activeTab]);

  const navigateToPatient = (patientUuid: string) => {
    router.push(`/clinical/${patientUuid}`);
  };

  const displayName = (p: { givenName?: string; middleName?: string; familyName?: string; name?: string }) => {
    const parts = [p.givenName, p.middleName, p.familyName].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    return p.name || "Unknown Patient";
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-900 font-sans pb-24">
      <div className="max-w-[1100px] mx-auto px-6 py-12 lg:py-20">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-12">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight mb-4 text-slate-900">
              Clinical Registry
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-xl">
              Manage your active patient consultations, or search the hospital registry to begin a new clinical encounter.
            </p>
          </div>
          <button
            onClick={fetchActivePatients}
            className="shrink-0 flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors border border-slate-200 hover:border-slate-300 px-5 py-2.5 bg-white shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Sync Data
          </button>
        </header>

        {/* AI Governance Banner (ArmorIQ) */}
        <div className="mb-8">
          <CDSAgentAlerts patientUuid="DEMO-UUID-FOR-SECURITY-LAYER" />
        </div>

        {/* Tabs */}
        <nav className="flex gap-8 border-b border-slate-200 mb-10">
          <button
            onClick={() => setActiveTab("active")}
            className={`pb-4 text-sm font-medium transition-colors border-b-2 relative -mb-[1px] ${activeTab === "active"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            Active Encounters
            {activePatients.length > 0 && (
              <span className="ml-2 text-xs bg-slate-100 text-slate-700 px-2 py-0.5 font-mono">
                {activePatients.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`pb-4 text-sm font-medium transition-colors border-b-2 relative -mb-[1px] ${activeTab === "search"
              ? "border-slate-900 text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
          >
            Directory Search
          </button>
        </nav>

        {/* Search Bar (only on search tab) */}
        {activeTab === "search" && (
          <div className="mb-10">
            <div className="relative max-w-2xl">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
                search
              </span>
              <input
                type="text"
                placeholder="Search by patient name, identifier, or location..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-slate-50/50 border border-slate-200 focus:border-slate-400 focus:bg-white text-slate-900 py-3.5 pl-12 pr-12 transition-colors outline-none text-base"
                autoFocus
              />
              {searching && (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl animate-spin">
                  progress_activity
                </span>
              )}
            </div>
          </div>
        )}

        {/* Active Patients Tab Content */}
        {activeTab === "active" && (
          <div className="w-full">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 text-slate-400">
                <span className="material-symbols-outlined text-3xl animate-spin mb-4">progress_activity</span>
                <p className="text-sm font-medium">Retrieving active encounters...</p>
              </div>
            ) : activePatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-center border border-dashed border-slate-200 bg-slate-50/50">
                <span className="material-symbols-outlined text-slate-300 text-4xl mb-4">inbox</span>
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Active Encounters</h3>
                <p className="text-slate-500 text-sm max-w-md">
                  There are no patients currently registered for an active visit at this location.
                </p>
              </div>
            ) : (
              <div className="w-full">
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 pb-4 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-widest">
                  <div className="col-span-2">ID</div>
                  <div className="col-span-4">Patient</div>
                  <div className="col-span-2">Sex</div>
                  <div className="col-span-2">Age</div>
                  <div className="col-span-2">Status</div>
                </div>
                {/* Table Body */}
                <div className="flex flex-col">
                  {activePatients.map((p) => (
                    <button
                      key={p.uuid}
                      onClick={() => navigateToPatient(p.uuid)}
                      className="group text-left border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      {/* Desktop row */}
                      <div className="hidden md:grid grid-cols-12 gap-4 py-5 items-center">
                        <div className="col-span-2 text-sm text-slate-500 font-mono tracking-tight">{p.identifier || "—"}</div>
                        <div className="col-span-4 flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                            <PatientAvatar authFetch={authFetch} patientUuid={p.uuid} iconClassName="text-slate-400 text-sm" />
                          </div>
                          <span className="text-base font-medium text-slate-800 group-hover:text-slate-900 transition-colors">
                            {displayName(p)}
                          </span>
                        </div>
                        <div className="col-span-2 text-slate-600 text-sm">
                          {p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : p.gender || "—"}
                        </div>
                        <div className="col-span-2 text-slate-600 text-sm">
                          {p.age ? `${p.age} years` : "—"}
                        </div>
                        <div className="col-span-2">
                          {p.activeVisitUuid ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/60">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-medium px-2.5 py-1 bg-slate-100">Inactive</span>
                          )}
                        </div>
                      </div>

                      {/* Mobile row */}
                      <div className="md:hidden py-4 flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                          <PatientAvatar authFetch={authFetch} patientUuid={p.uuid} iconClassName="text-slate-400 text-base" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 text-base font-medium truncate">{displayName(p)}</p>
                          <p className="text-slate-500 text-sm mt-1">
                            <span className="font-mono text-xs mr-2">{p.identifier || "—"}</span>
                            {p.gender === "M" ? "Male" : "Female"} • {p.age ? `${p.age}y` : "—"}
                          </p>
                        </div>
                        {p.activeVisitUuid && (
                          <span className="w-2 h-2 bg-emerald-500 rounded-full mt-2 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Search Tab Content */}
        {activeTab === "search" && (
          <div className="w-full">
            {!query.trim() ? (
              <div className="flex flex-col items-center justify-center py-32 text-center text-slate-500">
                <span className="material-symbols-outlined text-4xl mb-4 text-slate-300">search</span>
                <p className="text-sm max-w-sm leading-relaxed">
                  Enter a patient's name, identifier, or location to query the hospital registry.
                </p>
              </div>
            ) : searchResults.length === 0 && !searching ? (
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <p className="text-slate-600 font-medium">No records found for &ldquo;<span className="text-slate-900">{query}</span>&rdquo;</p>
                <p className="text-slate-400 text-sm mt-2">Try adjusting your search terms.</p>
              </div>
            ) : (
              <div className="w-full">
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 pb-4 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-widest">
                  <div className="col-span-2">ID</div>
                  <div className="col-span-4">Patient</div>
                  <div className="col-span-2">Sex</div>
                  <div className="col-span-2">Age</div>
                  <div className="col-span-2">Status</div>
                </div>
                {/* Table Body */}
                <div className="flex flex-col">
                  {searchResults.map((p) => (
                    <button
                      key={p.uuid}
                      onClick={() => navigateToPatient(p.uuid)}
                      className="group text-left border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <div className="hidden md:grid grid-cols-12 gap-4 py-5 items-center">
                        <div className="col-span-2 text-sm text-slate-500 font-mono tracking-tight">{p.identifier || "—"}</div>
                        <div className="col-span-4 flex items-center gap-4">
                          <PatientAvatar
                            authFetch={authFetch}
                            patientUuid={p.uuid}
                            personUuid={p.personUuid}
                            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden"
                          />
                          <span className="text-base font-medium text-slate-800 group-hover:text-slate-900 transition-colors">
                            {displayName(p)}
                          </span>
                        </div>
                        <div className="col-span-2 text-slate-600 text-sm">
                          {p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : p.gender || "—"}
                        </div>
                        <div className="col-span-2 text-slate-600 text-sm">{p.age ? `${p.age} years` : "—"}</div>
                        <div className="col-span-2">
                          {p.activeVisitUuid ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/60">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              Active
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs font-medium px-2.5 py-1 bg-slate-100">Inactive</span>
                          )}
                        </div>
                      </div>
                      {/* Mobile row */}
                      <div className="md:hidden py-4 flex items-start gap-4">
                        <PatientAvatar
                          authFetch={authFetch}
                          patientUuid={p.uuid}
                          personUuid={p.personUuid}
                          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200 overflow-hidden"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-slate-900 text-base font-medium truncate">{displayName(p)}</p>
                          <p className="text-slate-500 text-sm mt-1">
                            <span className="font-mono text-xs mr-2">{p.identifier || "—"}</span>
                            {p.gender === "M" ? "Male" : "Female"} • {p.age ? `${p.age}y` : "—"}
                          </p>
                        </div>
                        {p.activeVisitUuid && (
                          <span className="w-2 h-2 bg-emerald-500 rounded-full mt-2 shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
