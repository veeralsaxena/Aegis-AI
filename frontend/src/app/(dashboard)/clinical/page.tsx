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
          } catch(e) {}
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
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">stethoscope</span>
            Clinical
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage active patients, search records, and enter consultations
          </p>
        </div>
        <button
          onClick={fetchActivePatients}
          className="bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-xl overflow-hidden">
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setActiveTab("active")}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "active"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span className="material-symbols-outlined text-lg">groups</span>
            Active Patients
            {activePatients.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-bold">
                {activePatients.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 px-6 py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === "search"
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <span className="material-symbols-outlined text-lg">person_search</span>
            Search All Patients
          </button>
        </div>

        {/* Search Bar (only on search tab) */}
        {activeTab === "search" && (
          <div className="p-4 border-b border-white/5">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">
                search
              </span>
              <input
                type="text"
                placeholder="Search by patient name, ID, or village..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-black/50 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-11 pr-4 text-white placeholder-slate-600 transition-all outline-none text-sm"
                autoFocus
              />
              {searching && (
                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-primary text-lg animate-spin">
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
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
                  <p className="text-slate-400 text-sm">Loading active patients...</p>
                </div>
              </div>
            ) : activePatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-slate-600 text-4xl">group_off</span>
                </div>
                <h3 className="text-white text-lg font-semibold mb-1">No Active Patients</h3>
                <p className="text-slate-400 text-sm max-w-md text-center">
                  No patients currently have active visits at this location. Use the &quot;Search All Patients&quot; tab to find a patient and start a visit.
                </p>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 bg-slate-800/30 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <div className="col-span-2">ID</div>
                  <div className="col-span-4">Name</div>
                  <div className="col-span-2">Gender</div>
                  <div className="col-span-2">Age</div>
                  <div className="col-span-2">Status</div>
                </div>
                <div className="divide-y divide-white/5">
                  {activePatients.map((p) => (
                    <button
                      key={p.uuid}
                      onClick={() => navigateToPatient(p.uuid)}
                      className="w-full text-left hover:bg-primary/5 transition-colors"
                    >
                      {/* Desktop row */}
                      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 items-center">
                        <div className="col-span-2 text-primary text-sm font-mono">{p.identifier || "—"}</div>
                        <div className="col-span-4 flex items-center gap-3">
                          <PatientAvatar authFetch={authFetch} patientUuid={p.uuid} />
                          <span className="text-white text-sm font-medium truncate">{displayName(p)}</span>
                        </div>
                        <div className="col-span-2 text-slate-400 text-sm">
                          {p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : p.gender || "—"}
                        </div>
                        <div className="col-span-2 text-slate-400 text-sm">{p.age ? `${p.age} yrs` : "—"}</div>
                        <div className="col-span-2">
                          {p.activeVisitUuid ? (
                            <span className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-medium flex items-center gap-1.5 w-fit">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                              Active Visit
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">No active visit</span>
                          )}
                        </div>
                      </div>
                      {/* Mobile card */}
                      <div className="md:hidden px-4 py-4 flex items-center gap-3">
                        <PatientAvatar authFetch={authFetch} patientUuid={p.uuid} className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden" iconClassName="text-primary text-lg" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{displayName(p)}</p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {p.identifier || "—"} • {p.gender === "M" ? "Male" : "Female"} • {p.age ? `${p.age} yrs` : "—"}
                          </p>
                        </div>
                        {p.activeVisitUuid && (
                          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0" />
                        )}
                        <span className="material-symbols-outlined text-slate-600 text-lg">chevron_right</span>
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
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-primary text-4xl">person_search</span>
                </div>
                <h3 className="text-white text-lg font-semibold mb-1">Search for Patients</h3>
                <p className="text-slate-400 text-sm max-w-md text-center">
                  Type a patient&apos;s name, ID, or village in the search bar above to find their records.
                </p>
              </div>
            ) : searchResults.length === 0 && !searching ? (
              <div className="flex flex-col items-center justify-center py-16">
                <span className="material-symbols-outlined text-slate-600 text-5xl mb-3">person_off</span>
                <p className="text-slate-400 text-sm">No patients found for &ldquo;{query}&rdquo;</p>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/5 bg-slate-800/30 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <div className="col-span-2">ID</div>
                  <div className="col-span-4">Name</div>
                  <div className="col-span-2">Gender</div>
                  <div className="col-span-2">Age</div>
                  <div className="col-span-2">Status</div>
                </div>
                <div className="divide-y divide-white/5">
                  {searchResults.map((p) => (
                    <button
                      key={p.uuid}
                      onClick={() => navigateToPatient(p.uuid)}
                      className="w-full text-left hover:bg-primary/5 transition-colors"
                    >
                      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 items-center">
                        <div className="col-span-2 text-primary text-sm font-mono">{p.identifier || "—"}</div>
                        <div className="col-span-4 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-primary text-sm">person</span>
                          </div>
                          <span className="text-white text-sm font-medium truncate">{displayName(p)}</span>
                        </div>
                        <div className="col-span-2 text-slate-400 text-sm">
                          {p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : p.gender || "—"}
                        </div>
                        <div className="col-span-2 text-slate-400 text-sm">{p.age ? `${p.age} yrs` : "—"}</div>
                        <div className="col-span-2">
                          {p.activeVisitUuid ? (
                            <span className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-medium flex items-center gap-1.5 w-fit">
                              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                              Active Visit
                            </span>
                          ) : (
                            <span className="text-slate-500 text-xs">No active visit</span>
                          )}
                        </div>
                      </div>
                      {/* Mobile */}
                      <div className="md:hidden px-4 py-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-primary text-lg">person</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{displayName(p)}</p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {p.identifier || "—"} • {p.gender === "M" ? "Male" : "Female"} • {p.age ? `${p.age} yrs` : "—"}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-slate-600 text-lg">chevron_right</span>
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
