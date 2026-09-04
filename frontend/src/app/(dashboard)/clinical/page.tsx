"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import PatientAvatar from "@/components/clinical/PatientAvatar";

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

  // Lucene patient search
  const searchPatients = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({
        q,
        s: "byIdOrNameOrVillage",
        startIndex: "0",
        patientAttributes: "",
        programAttributeFieldName: "",
        programAttributeFieldValue: "",
        addressFieldName: "city_village",
        addressFieldValue: "",
        addressSearchResultsConfig: "",
        patientSearchResultsConfig: "",
        filterOnAllIdentifiers: "false",
      });
      const res = await authFetch(`/openmrs/ws/rest/v1/bahmnicore/search/patient/lucene?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.pageOfResults || []);
      } else {
        // Fallback to standard OpenMRS search
        const fallbackRes = await authFetch(`/openmrs/ws/rest/v1/patient?q=${encodeURIComponent(q)}&v=default&limit=20`);
        const fallbackData = await fallbackRes.json();
        const mapped: SearchPatient[] = (fallbackData.results || []).map((p: any) => ({
          uuid: p.uuid,
          givenName: p.person?.preferredName?.givenName || p.person?.display?.split(" ")?.[0] || "",
          familyName: p.person?.preferredName?.familyName || p.person?.display?.split(" ")?.slice(1)?.join(" ") || "",
          identifier: p.identifiers?.[0]?.display?.replace(/^.*=\s*/, "") || "",
          gender: p.person?.gender || "",
          age: p.person?.age || 0,
          dateCreated: p.auditInfo?.dateCreated || "",
          activeVisitUuid: undefined,
        }));
        setSearchResults(mapped);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  }, [authFetch]);

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
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-black tracking-tight flex items-center gap-3">
            <span className="material-symbols-outlined text-blue-600 text-3xl">stethoscope</span>
            Clinical
          </h1>
          <p className="text-black/50 font-bold text-sm mt-1">
            Manage active patients, search records, and enter consultations
          </p>
        </div>
        <button
          onClick={fetchActivePatients}
          className="bg-black/5 hover:bg-black/10 text-black/70 rounded-2xl px-5 py-2.5 text-sm font-bold transition-all flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-black/5 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5 overflow-hidden">
        <div className="flex border-b border-black/5">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 px-6 py-5 text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "active"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
              : "text-black/50 hover:text-black hover:bg-black/[0.02]"
              }`}
          >
            <span className="material-symbols-outlined text-xl">groups</span>
            Active Patients
            {activePatients.length > 0 && (
              <span className="ml-1 px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-black">
                {activePatients.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 px-6 py-5 text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "search"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
              : "text-black/50 hover:text-black hover:bg-black/[0.02]"
              }`}
          >
            <span className="material-symbols-outlined text-xl">person_search</span>
            Search All Patients
          </button>
        </div>

        {/* Search Bar (only on search tab) */}
        {activeTab === "search" && (
          <div className="p-6 border-b border-black/5">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-black/40 text-xl">
                search
              </span>
              <input
                type="text"
                placeholder="Search by patient name, ID, or village..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-black/[0.03] border-2 border-transparent focus:bg-white focus:border-blue-600 focus:shadow-[0_4px_20px_-4px_rgba(37,99,235,0.15)] rounded-2xl py-4 pl-12 pr-4 text-black font-medium placeholder-black/40 transition-all outline-none text-sm hover:bg-black/[0.05]"
                autoFocus
              />
              {searching && (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-blue-600 text-xl animate-spin">
                  progress_activity
                </span>
              )}
            </div>
          </div>
        )}

        {/* Active Patients Tab Content */}
        {activeTab === "active" && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <span className="material-symbols-outlined text-blue-600 text-4xl animate-spin">progress_activity</span>
                  <p className="text-black/50 font-bold text-sm">Loading active patients...</p>
                </div>
              </div>
            ) : activePatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                <div className="w-24 h-24 rounded-3xl bg-black/5 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-black/40 text-5xl">group_off</span>
                </div>
                <h3 className="text-black text-xl font-black tracking-tight mb-2">No Active Patients</h3>
                <p className="text-black/50 font-bold text-sm max-w-md">
                  No patients currently have active visits at this location. Use the &quot;Search All Patients&quot; tab to find a patient and start a visit.
                </p>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-4 border-b border-black/5 bg-black/[0.02] text-xs font-bold text-black/50 uppercase tracking-wider">
                  <div className="col-span-2">ID</div>
                  <div className="col-span-4">Name</div>
                  <div className="col-span-2">Gender</div>
                  <div className="col-span-2">Age</div>
                  <div className="col-span-2">Status</div>
                </div>
                <div className="divide-y divide-black/5">
                  {activePatients.map((p) => (
                    <button
                      key={p.uuid}
                      onClick={() => navigateToPatient(p.uuid)}
                      className="w-full text-left hover:bg-black/[0.02] transition-colors"
                    >
                      {/* Desktop row */}
                      <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-5 items-center">
                        <div className="col-span-2 text-black/60 text-sm font-bold">{p.identifier || "—"}</div>
                        <div className="col-span-4 flex items-center gap-4">
                          <PatientAvatar authFetch={authFetch} patientUuid={p.uuid} />
                          <span className="text-black text-sm font-bold truncate">{displayName(p)}</span>
                        </div>
                        <div className="col-span-2 text-black/60 font-bold text-sm">
                          {p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : p.gender || "—"}
                        </div>
                        <div className="col-span-2 text-black/60 font-bold text-sm">{p.age ? `${p.age} yrs` : "—"}</div>
                        <div className="col-span-2">
                          {p.activeVisitUuid ? (
                            <span className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-green-700 text-xs font-bold flex items-center gap-1.5 w-fit">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              Active Visit
                            </span>
                          ) : (
                            <span className="text-black/40 font-bold text-xs bg-black/5 px-3 py-1.5 rounded-full">No active visit</span>
                          )}
                        </div>
                      </div>
                      {/* Mobile card */}
                      <div className="md:hidden px-6 py-5 flex items-center gap-4">
                        <PatientAvatar authFetch={authFetch} patientUuid={p.uuid} className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 overflow-hidden" iconClassName="text-blue-600 text-xl" />
                        <div className="flex-1 min-w-0">
                          <p className="text-black text-base font-bold truncate">{displayName(p)}</p>
                          <p className="text-black/50 font-bold text-xs mt-1 uppercase tracking-wider">
                            {p.identifier || "—"} • {p.gender === "M" ? "Male" : "Female"} • {p.age ? `${p.age} yrs` : "—"}
                          </p>
                        </div>
                        {p.activeVisitUuid && (
                          <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                        )}
                        <span className="material-symbols-outlined text-black/30 text-xl">chevron_right</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Search Tab Content */}
        {activeTab === "search" && (
          <>
            {!query.trim() ? (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                <div className="w-24 h-24 rounded-3xl bg-blue-50 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-blue-600 text-5xl">person_search</span>
                </div>
                <h3 className="text-black text-xl font-black tracking-tight mb-2">Search for Patients</h3>
                <p className="text-black/50 font-bold text-sm max-w-md">
                  Type a patient&apos;s name, ID, or village in the search bar above to find their records.
                </p>
              </div>
            ) : searchResults.length === 0 && !searching ? (
              <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
                <span className="material-symbols-outlined text-black/20 text-6xl mb-4">person_off</span>
                <p className="text-black/60 font-bold text-base">No patients found for &ldquo;<span className="text-black">{query}</span>&rdquo;</p>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-4 border-b border-black/5 bg-black/[0.02] text-xs font-bold text-black/50 uppercase tracking-wider">
                  <div className="col-span-2">ID</div>
                  <div className="col-span-4">Name</div>
                  <div className="col-span-2">Gender</div>
                  <div className="col-span-2">Age</div>
                  <div className="col-span-2">Status</div>
                </div>
                <div className="divide-y divide-black/5">
                  {searchResults.map((p) => (
                    <button
                      key={p.uuid}
                      onClick={() => navigateToPatient(p.uuid)}
                      className="w-full text-left hover:bg-black/[0.02] transition-colors"
                    >
                      <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-5 items-center">
                        <div className="col-span-2 text-black/60 text-sm font-bold">{p.identifier || "—"}</div>
                        <div className="col-span-4 flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-blue-600 text-lg">person</span>
                          </div>
                          <span className="text-black text-sm font-bold truncate">{displayName(p)}</span>
                        </div>
                        <div className="col-span-2 text-black/60 font-bold text-sm">
                          {p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : p.gender || "—"}
                        </div>
                        <div className="col-span-2 text-black/60 font-bold text-sm">{p.age ? `${p.age} yrs` : "—"}</div>
                        <div className="col-span-2">
                          {p.activeVisitUuid ? (
                            <span className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-green-700 text-xs font-bold flex items-center gap-1.5 w-fit">
                              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              Active Visit
                            </span>
                          ) : (
                            <span className="text-black/40 font-bold text-xs bg-black/5 px-3 py-1.5 rounded-full">No active visit</span>
                          )}
                        </div>
                      </div>
                      {/* Mobile */}
                      <div className="md:hidden px-6 py-5 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-blue-600 text-xl">person</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-black text-base font-bold truncate">{displayName(p)}</p>
                          <p className="text-black/50 font-bold text-xs mt-1 uppercase tracking-wider">
                            {p.identifier || "—"} • {p.gender === "M" ? "Male" : "Female"} • {p.age ? `${p.age} yrs` : "—"}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-black/30 text-xl">chevron_right</span>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
