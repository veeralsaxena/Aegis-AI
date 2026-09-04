"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface VitalObs {
  concept: { name: string; shortName?: string };
  value: any;
  observationDateTime: string;
}
interface Diagnosis {
  codedAnswer?: { name: string };
  freeTextAnswer?: string;
  order: string;
  certainty: string;
  diagnosisDateTime?: string;
  existingObs?: string;
}
interface DrugOrder {
  drug: { name: string; form?: string };
  dosingInstructions?: { dose: number; doseUnits: string; frequency: string; route: string };
  effectiveStartDate: string;
  effectiveStopDate?: string;
  duration?: number;
  durationUnits?: string;
  dateStopped?: string;
}
interface LabResult {
  testName?: string;
  result?: any;
  minNormal?: number;
  maxNormal?: number;
  testDate?: string;
}
interface Visit {
  uuid: string;
  display: string;
  startDatetime: string;
  stopDatetime: string | null;
  visitType: { display: string };
}

export default function PatientDashboardPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const params = useParams();
  const patientUuid = params.patientUuid as string;

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<any>(null);
  const [vitals, setVitals] = useState<VitalObs[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [drugOrders, setDrugOrders] = useState<DrugOrder[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!patientUuid) return;
    setLoading(true);

    try {
      // Parallel fetch all dashboard data
      const [patientRes, vitalsRes, diagRes, drugRes, labRes, visitRes] = await Promise.all([
        authFetch(`/openmrs/ws/rest/v1/patient/${patientUuid}?v=full`),
        authFetch(`/openmrs/ws/rest/v1/bahmnicore/observations?patientUuid=${patientUuid}&numberOfVisits=1&scope=latest`).catch(() => null),
        authFetch(`/openmrs/ws/rest/v1/bahmnicore/diagnosis/search?patientUuid=${patientUuid}`).catch(() => null),
        authFetch(`/openmrs/ws/rest/v1/bahmnicore/drugOrders/prescribedAndActive?patientUuid=${patientUuid}`).catch(() => null),
        authFetch(`/openmrs/ws/rest/v1/bahmnicore/labOrderResults?patientUuid=${patientUuid}&numberOfVisits=3`).catch(() => null),
        authFetch(`/openmrs/ws/rest/v1/visit?patient=${patientUuid}&v=default`),
      ]);

      // Patient
      if (patientRes.ok) {
        setPatient(await patientRes.json());
      }

      // Vitals
      if (vitalsRes?.ok) {
        try {
          const vitalsData = await vitalsRes.json();
          setVitals(Array.isArray(vitalsData) ? vitalsData : []);
        } catch { setVitals([]); }
      }

      // Diagnoses
      if (diagRes?.ok) {
        try {
          const diagData = await diagRes.json();
          setDiagnoses(Array.isArray(diagData) ? diagData : []);
        } catch { setDiagnoses([]); }
      }

      // Drug Orders
      if (drugRes?.ok) {
        try {
          const drugData = await drugRes.json();
          setDrugOrders(Array.isArray(drugData) ? drugData : drugData?.visitDrugOrders || []);
        } catch { setDrugOrders([]); }
      }

      // Lab Results
      if (labRes?.ok) {
        try {
          const labData = await labRes.json();
          setLabResults(Array.isArray(labData) ? labData : labData?.results || []);
        } catch { setLabResults([]); }
      }

      // Visits
      if (visitRes.ok) {
        const visitData = await visitRes.json();
        const allVisits: Visit[] = visitData.results || [];
        setVisits(allVisits);
        const active = allVisits.find((v: Visit) => !v.stopDatetime);
        setActiveVisit(active || null);
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }, [patientUuid, authFetch]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const startVisit = async (visitTypeUuid: string, visitTypeName: string) => {
    try {
      const res = await authFetch("/openmrs/ws/rest/v1/visit", {
        method: "POST",
        body: JSON.stringify({
          patient: patientUuid,
          visitType: visitTypeUuid,
          startDatetime: new Date().toISOString(),
          location: "833d0c66-e29a-4d31-ac13-ca9050d1bfa9",
        }),
      });
      if (res.ok) {
        await loadDashboard();
      }
    } catch (err) {
      console.error("Failed to start visit:", err);
    }
  };

  const endVisit = async () => {
    if (!activeVisit) return;
    try {
      await authFetch(`/openmrs/ws/rest/v1/visit/${activeVisit.uuid}`, {
        method: "POST",
        body: JSON.stringify({ stopDatetime: new Date().toISOString() }),
      });
      await loadDashboard();
    } catch (err) {
      console.error("Failed to end visit:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-blue-600 text-5xl animate-spin">progress_activity</span>
          <p className="text-black/50 font-bold text-sm">Loading clinical dashboard...</p>
        </div>
      </div>
    );
  }

  const person = patient?.person;
  const pName = person?.preferredName || person?.names?.[0];
  const fullName = pName ? [pName.givenName, pName.middleName, pName.familyName].filter(Boolean).join(" ") : "Unknown";
  const patientId = patient?.identifiers?.[0]?.display?.replace(/^.*=\s*/, "") || "N/A";

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Back + Patient Header */}
      <div className="flex items-center gap-4">
        <Link href="/clinical" className="text-black/40 hover:text-black transition-colors font-bold">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-black text-black tracking-tight">{fullName}</h1>
            {activeVisit && (
              <span className="px-3 py-1 bg-green-50 border border-green-200 rounded-full text-green-700 text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Active Visit — {activeVisit.visitType?.display}
              </span>
            )}
          </div>
          <p className="text-black/50 font-bold text-xs uppercase tracking-wider mt-1">
            ID: <span className="text-blue-600 font-mono">{patientId}</span>
            {person?.gender && <> • {person.gender === "M" ? "Male" : person.gender === "F" ? "Female" : "Other"}</>}
            {person?.age != null && <> • {person.age} years</>}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {activeVisit ? (
          <>
            <button
              onClick={() => router.push(`/clinical/${patientUuid}/consultation`)}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] font-bold px-6 py-3 rounded-2xl flex items-center gap-2 text-sm transition-all"
            >
              <span className="material-symbols-outlined text-lg">edit_note</span>
              Start Consultation
            </button>
            <button
              onClick={endVisit}
              className="bg-red-50 text-red-600 border border-red-200 font-bold rounded-2xl px-5 py-3 hover:bg-red-100 transition-colors text-sm flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">stop_circle</span>
              End Visit
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => startVisit("13a5ea15-82bc-45ee-b07d-763c346e1cf5", "OPD")}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-[0_10px_30px_-10px_rgba(37,99,235,0.5)] font-bold px-6 py-3 rounded-2xl flex items-center gap-2 text-sm transition-all"
            >
              <span className="material-symbols-outlined text-lg">personal_injury</span>
              Start OPD Visit
            </button>
            <button
              onClick={() => startVisit("ff237ff8-b5c0-46a6-9abc-1017c6a0ff10", "Emergency")}
              className="bg-red-50 text-red-600 border border-red-200 font-bold rounded-2xl px-5 py-3 hover:bg-red-100 transition-colors text-sm flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-lg">local_hospital</span>
              Start Emergency Visit
            </button>
          </>
        )}
        <button
          onClick={() => window.print()}
          className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-transparent rounded-2xl px-5 py-3 text-sm font-bold transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">print</span>
          Print Summary
        </button>
        <button
          onClick={loadDashboard}
          className="bg-black/5 hover:bg-black/10 text-black/70 border border-transparent rounded-2xl px-5 py-3 text-sm font-bold transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Refresh
        </button>
      </div>

      {/* Dashboard Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vitals Widget */}
        <div className="bg-white border border-black/5 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5 overflow-hidden">
          <div className="px-8 py-5 border-b border-black/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">monitor_heart</span>
            <h3 className="text-black font-black tracking-tight text-sm uppercase">Latest Vitals</h3>
          </div>
          <div className="p-8">
            {vitals.length === 0 ? (
              <p className="text-black/40 text-sm font-bold text-center py-4">No vitals recorded yet</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {vitals.slice(0, 9).map((v, i) => (
                  <div key={i} className="bg-black/[0.02] rounded-2xl p-4 border border-black/5 shadow-sm">
                    <p className="text-black/50 text-xs font-bold mb-1 truncate uppercase tracking-wider">{v.concept?.shortName || v.concept?.name || "—"}</p>
                    <p className="text-black font-black text-xl">
                      {typeof v.value === "object" ? v.value?.display || JSON.stringify(v.value) : v.value ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Diagnoses Widget */}
        <div className="bg-white border border-black/5 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5 overflow-hidden">
          <div className="px-8 py-5 border-b border-black/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">diagnosis</span>
            <h3 className="text-black font-black tracking-tight text-sm uppercase">Diagnoses</h3>
          </div>
          <div className="p-8">
            {diagnoses.length === 0 ? (
              <p className="text-black/40 text-sm font-bold text-center py-4">No diagnoses recorded</p>
            ) : (
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {diagnoses.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-black/[0.02] rounded-2xl border border-black/5 shadow-sm">
                    <div>
                      <p className="text-black text-sm font-bold">{d.codedAnswer?.name || d.freeTextAnswer || "Unknown"}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md ${d.order === "PRIMARY" ? "bg-blue-100 text-blue-700" : "bg-black/10 text-black/60"}`}>
                          {d.order}
                        </span>
                        <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md ${d.certainty === "CONFIRMED" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {d.certainty}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Treatments Widget */}
        <div className="bg-white border border-black/5 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5 overflow-hidden">
          <div className="px-8 py-5 border-b border-black/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">medication</span>
            <h3 className="text-black font-black tracking-tight text-sm uppercase">Active Treatments</h3>
          </div>
          <div className="p-8">
            {drugOrders.length === 0 ? (
              <p className="text-black/40 text-sm font-bold text-center py-4">No active treatments</p>
            ) : (
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {drugOrders.map((d, i) => (
                  <div key={i} className="p-4 bg-black/[0.02] rounded-2xl border border-black/5 shadow-sm">
                    <p className="text-black text-sm font-bold">{d.drug?.name || "Unknown Drug"}</p>
                    {d.dosingInstructions && (
                      <p className="text-black/60 text-xs font-bold mt-2">
                        {d.dosingInstructions.dose} {d.dosingInstructions.doseUnits} — {d.dosingInstructions.frequency} — {d.dosingInstructions.route}
                      </p>
                    )}
                    {d.duration && (
                      <p className="text-black/50 text-xs font-bold mt-1">Duration: {d.duration} {d.durationUnits}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lab Results Widget */}
        <div className="bg-white border border-black/5 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5 overflow-hidden">
          <div className="px-8 py-5 border-b border-black/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">biotech</span>
            <h3 className="text-black font-black tracking-tight text-sm uppercase">Lab Results</h3>
          </div>
          <div className="p-8">
            {labResults.length === 0 ? (
              <p className="text-black/40 text-sm font-bold text-center py-4">No lab results available</p>
            ) : (
              <div className="space-y-4 max-h-64 overflow-y-auto">
                {labResults.map((l, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-black/[0.02] rounded-2xl border border-black/5 shadow-sm">
                    <div>
                      <p className="text-black text-sm font-bold">{l.testName || "Test"}</p>
                      {l.minNormal != null && l.maxNormal != null && (
                        <p className="text-black/50 font-bold text-xs mt-1 uppercase tracking-wider">Normal: {l.minNormal}–{l.maxNormal}</p>
                      )}
                    </div>
                    <span className="text-blue-600 font-black text-lg">{l.result ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Visits Widget */}
        <div className="bg-white border border-black/5 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] ring-1 ring-black/5 overflow-hidden lg:col-span-2">
          <div className="px-8 py-5 border-b border-black/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600 text-xl">history</span>
            <h3 className="text-black font-black tracking-tight text-sm uppercase">Visit History</h3>
          </div>
          <div className="p-8">
            {visits.length === 0 ? (
              <p className="text-black/40 text-sm font-bold text-center py-4">No visits recorded</p>
            ) : (
              <div className="space-y-4 max-h-72 overflow-y-auto pr-2">
                {visits.map((v) => (
                  <div key={v.uuid} className="flex items-center justify-between p-5 bg-black/[0.02] rounded-2xl border border-black/5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${!v.stopDatetime ? "bg-green-100" : "bg-blue-50"}`}>
                        <span className={`material-symbols-outlined text-xl ${!v.stopDatetime ? "text-green-600" : "text-blue-600"}`}>
                          {!v.stopDatetime ? "check_circle" : "event_available"}
                        </span>
                      </div>
                      <div>
                        <p className="text-black text-sm font-bold">{v.visitType?.display || "Visit"}</p>
                        <p className="text-black/50 font-bold text-xs mt-1 uppercase tracking-wider">
                          {new Date(v.startDatetime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          {v.stopDatetime && ` — ${new Date(v.stopDatetime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
                        </p>
                      </div>
                    </div>
                    {!v.stopDatetime && (
                      <span className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-full text-green-700 text-xs font-bold shadow-sm">
                        Active
                      </span>
                    )}
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
