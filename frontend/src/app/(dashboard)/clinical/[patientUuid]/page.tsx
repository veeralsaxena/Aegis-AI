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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      <div className="max-w-[1100px] mx-auto p-6 lg:py-16">

        {/* Back + Patient Header */}
        <header className="mb-10">
          <Link href="/clinical" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-8">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to Registry
          </Link>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="flex items-center gap-4 flex-wrap mb-2">
                <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-slate-900">{fullName}</h1>
                {activeVisit && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    Active Visit — {activeVisit.visitType?.display}
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-sm flex items-center gap-2">
                <span className="font-mono text-xs bg-slate-100 px-2 py-0.5">{patientId}</span>
                {person?.gender && <span>&bull; {person.gender === "M" ? "Male" : person.gender === "F" ? "Female" : "Other"}</span>}
                {person?.age != null && <span>&bull; {person.age} years</span>}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {activeVisit ? (
                <>
                  <button
                    onClick={() => router.push(`/clinical/${patientUuid}/consultation`)}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 rounded-lg shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit_note</span>
                    Resume Consultation
                  </button>
                  <button
                    onClick={endVisit}
                    className="text-rose-600 hover:bg-rose-50 px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 rounded-lg"
                  >
                    <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                    End Visit
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => startVisit("13a5ea15-82bc-45ee-b07d-763c346e1cf5", "OPD")}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 rounded-lg shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">stethoscope</span>
                    Start Consultation
                  </button>
                  <button
                    onClick={() => startVisit("ff237ff8-b5c0-46a6-9abc-1017c6a0ff10", "Emergency")}
                    className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2.5 text-sm font-medium transition-colors flex items-center gap-2 rounded-lg shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">local_hospital</span>
                    Emergency
                  </button>
                </>
              )}
              <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block"></div>
              <button
                onClick={() => window.print()}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 p-2.5 rounded-lg transition-colors flex items-center shadow-sm"
                title="Print Patient Record"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
              </button>
              <button
                onClick={loadDashboard}
                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-900 p-2.5 rounded-lg transition-colors flex items-center shadow-sm"
                title="Refresh Data"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
              </button>
            </div>
          </div>
        </header>

        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Clinical Overview</h2>

        {/* Dashboard Widgets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Vitals Widget */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">monitor_heart</span>
              <h3 className="text-slate-900 font-semibold text-sm tracking-wide uppercase">Latest Vitals</h3>
            </div>
            <div className="p-5">
              {vitals.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm mb-3">No vitals recorded yet.</p>
                  <button
                    onClick={() => activeVisit ? router.push(`/clinical/${patientUuid}/consultation`) : startVisit("13a5ea15-82bc-45ee-b07d-763c346e1cf5", "OPD")}
                    className="text-slate-900 font-medium text-sm hover:underline flex items-center justify-center gap-1 mx-auto"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Record vitals
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {vitals.slice(0, 9).map((v, i) => (
                    <div key={i} className="bg-slate-50 border border-slate-100 p-3 rounded-lg">
                      <p className="text-slate-500 text-[10px] font-semibold mb-1 truncate uppercase tracking-widest">{v.concept?.shortName || v.concept?.name || "—"}</p>
                      <p className="text-slate-900 font-semibold text-lg">
                        {typeof v.value === "object" ? v.value?.display || JSON.stringify(v.value) : v.value ?? "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Diagnoses Widget */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">medical_information</span>
              <h3 className="text-slate-900 font-semibold text-sm tracking-wide uppercase">Diagnoses</h3>
            </div>
            <div className="p-5">
              {diagnoses.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm mb-3">No diagnoses recorded.</p>
                  <button
                    onClick={() => activeVisit ? router.push(`/clinical/${patientUuid}/consultation`) : startVisit("13a5ea15-82bc-45ee-b07d-763c346e1cf5", "OPD")}
                    className="text-slate-900 font-medium text-sm hover:underline flex items-center justify-center gap-1 mx-auto"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add diagnosis
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {diagnoses.map((d, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg">
                      <p className="text-slate-900 text-sm font-medium">{d.codedAnswer?.name || d.freeTextAnswer || "Unknown"}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded ${d.order === "PRIMARY" ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"}`}>
                          {d.order}
                        </span>
                        <span className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-0.5 rounded ${d.certainty === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {d.certainty}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Active Treatments Widget */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">prescriptions</span>
              <h3 className="text-slate-900 font-semibold text-sm tracking-wide uppercase">Active Treatments</h3>
            </div>
            <div className="p-5">
              {drugOrders.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm mb-3">No active treatments.</p>
                  <button
                    onClick={() => activeVisit ? router.push(`/clinical/${patientUuid}/consultation`) : startVisit("13a5ea15-82bc-45ee-b07d-763c346e1cf5", "OPD")}
                    className="text-slate-900 font-medium text-sm hover:underline flex items-center justify-center gap-1 mx-auto"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Add treatment
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {drugOrders.map((d, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-slate-900 text-sm font-medium">{d.drug?.name || "Unknown Drug"}</p>
                      {d.dosingInstructions && (
                        <p className="text-slate-500 text-xs mt-1.5 flex items-center gap-2">
                          <span className="font-mono bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">{d.dosingInstructions.dose} {d.dosingInstructions.doseUnits}</span>
                          <span>&bull;</span>
                          <span>{d.dosingInstructions.frequency}</span>
                          <span>&bull;</span>
                          <span>{d.dosingInstructions.route}</span>
                        </p>
                      )}
                      {d.duration && (
                        <p className="text-slate-400 text-xs mt-1 font-mono">Dur: {d.duration} {d.durationUnits}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lab Results Widget */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">science</span>
              <h3 className="text-slate-900 font-semibold text-sm tracking-wide uppercase">Lab Results</h3>
            </div>
            <div className="p-5">
              {labResults.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-slate-500 text-sm mb-3">No lab results available.</p>
                  <button
                    onClick={() => activeVisit ? router.push(`/clinical/${patientUuid}/consultation`) : startVisit("13a5ea15-82bc-45ee-b07d-763c346e1cf5", "OPD")}
                    className="text-slate-900 font-medium text-sm hover:underline flex items-center justify-center gap-1 mx-auto"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Order labs
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {labResults.map((l, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="text-slate-900 text-sm font-medium">{l.testName || "Test"}</p>
                        {l.minNormal != null && l.maxNormal != null && (
                          <p className="text-slate-400 text-xs mt-1 font-mono">Range: {l.minNormal} – {l.maxNormal}</p>
                        )}
                      </div>
                      <span className="text-slate-900 font-semibold text-lg shrink-0">{l.result ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Visits Widget */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden lg:col-span-2">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[18px]">history</span>
              <h3 className="text-slate-900 font-semibold text-sm tracking-wide uppercase">Visit History</h3>
            </div>
            <div className="p-0">
              {visits.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-10">No visits recorded.</p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {visits.map((v) => (
                    <div key={v.uuid} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-slate-50 transition-colors gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${!v.stopDatetime ? "bg-emerald-50 border-emerald-200" : "bg-slate-100 border-slate-200"}`}>
                          <span className={`material-symbols-outlined text-[16px] ${!v.stopDatetime ? "text-emerald-600" : "text-slate-400"}`}>
                            {!v.stopDatetime ? "check_circle" : "event_available"}
                          </span>
                        </div>
                        <div>
                          <p className="text-slate-900 text-sm font-medium">{v.visitType?.display || "Visit"}</p>
                          <p className="text-slate-500 text-[11px] mt-1 uppercase tracking-wide font-semibold">
                            {new Date(v.startDatetime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            {v.stopDatetime && ` — ${new Date(v.stopDatetime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
                          </p>
                        </div>
                      </div>
                      {!v.stopDatetime && (
                        <span className="shrink-0 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-semibold uppercase tracking-wider">
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
    </div>
  );
}
