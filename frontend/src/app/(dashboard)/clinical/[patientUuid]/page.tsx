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
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
          <p className="text-slate-400 text-sm">Loading clinical dashboard...</p>
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
        <Link href="/clinical" className="text-slate-400 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold text-white">{fullName}</h1>
            {activeVisit && (
              <span className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-medium flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Active Visit — {activeVisit.visitType?.display}
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-0.5">
            ID: <span className="text-primary font-mono">{patientId}</span>
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
              className="liquid-button text-background-dark font-bold px-6 py-3 rounded-xl flex items-center gap-2 text-sm"
            >
              <span className="material-symbols-outlined text-lg">edit_note</span>
              Start Consultation
            </button>
            <button
              onClick={endVisit}
              className="bg-red-500/10 text-red-400 border border-red-500/20 font-medium rounded-xl px-5 py-3 hover:bg-red-500/20 transition-colors text-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">stop_circle</span>
              End Visit
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => startVisit("13a5ea15-82bc-45ee-b07d-763c346e1cf5", "OPD")}
              className="liquid-button text-background-dark font-bold px-6 py-3 rounded-xl flex items-center gap-2 text-sm"
            >
              <span className="material-symbols-outlined text-lg">personal_injury</span>
              Start OPD Visit
            </button>
            <button
              onClick={() => startVisit("ff237ff8-b5c0-46a6-9abc-1017c6a0ff10", "Emergency")}
              className="bg-red-500/10 text-red-400 border border-red-500/20 font-medium rounded-xl px-5 py-3 hover:bg-red-500/20 transition-colors text-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">local_hospital</span>
              Start Emergency Visit
            </button>
          </>
        )}
        <button
          onClick={() => window.print()}
          className="bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border border-slate-700/50 rounded-xl px-5 py-3 text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">print</span>
          Print Summary
        </button>
        <button
          onClick={loadDashboard}
          className="bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 border border-slate-700/50 rounded-xl px-5 py-3 text-sm font-medium transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Refresh
        </button>
      </div>

      {/* Dashboard Widgets Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vitals Widget */}
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">monitor_heart</span>
            <h3 className="text-white font-semibold text-sm">Latest Vitals</h3>
          </div>
          <div className="p-6">
            {vitals.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No vitals recorded yet</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {vitals.slice(0, 9).map((v, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <p className="text-slate-400 text-xs mb-1 truncate">{v.concept?.shortName || v.concept?.name || "—"}</p>
                    <p className="text-white font-semibold text-lg">
                      {typeof v.value === "object" ? v.value?.display || JSON.stringify(v.value) : v.value ?? "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Diagnoses Widget */}
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">diagnosis</span>
            <h3 className="text-white font-semibold text-sm">Diagnoses</h3>
          </div>
          <div className="p-6">
            {diagnoses.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No diagnoses recorded</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {diagnoses.map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <div>
                      <p className="text-white text-sm font-medium">{d.codedAnswer?.name || d.freeTextAnswer || "Unknown"}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${d.order === "PRIMARY" ? "bg-primary/10 text-primary" : "bg-slate-700 text-slate-300"}`}>
                          {d.order}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded ${d.certainty === "CONFIRMED" ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"}`}>
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
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">medication</span>
            <h3 className="text-white font-semibold text-sm">Active Treatments</h3>
          </div>
          <div className="p-6">
            {drugOrders.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No active treatments</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {drugOrders.map((d, i) => (
                  <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-white text-sm font-medium">{d.drug?.name || "Unknown Drug"}</p>
                    {d.dosingInstructions && (
                      <p className="text-slate-400 text-xs mt-1">
                        {d.dosingInstructions.dose} {d.dosingInstructions.doseUnits} — {d.dosingInstructions.frequency} — {d.dosingInstructions.route}
                      </p>
                    )}
                    {d.duration && (
                      <p className="text-slate-500 text-xs mt-0.5">Duration: {d.duration} {d.durationUnits}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lab Results Widget */}
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">biotech</span>
            <h3 className="text-white font-semibold text-sm">Lab Results</h3>
          </div>
          <div className="p-6">
            {labResults.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No lab results available</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {labResults.map((l, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                    <div>
                      <p className="text-white text-sm font-medium">{l.testName || "Test"}</p>
                      {l.minNormal != null && l.maxNormal != null && (
                        <p className="text-slate-500 text-xs mt-0.5">Normal: {l.minNormal}–{l.maxNormal}</p>
                      )}
                    </div>
                    <span className="text-primary font-semibold text-sm">{l.result ?? "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Visits Widget */}
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-xl overflow-hidden lg:col-span-2">
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">history</span>
            <h3 className="text-white font-semibold text-sm">Visit History</h3>
          </div>
          <div className="p-6">
            {visits.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No visits recorded</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {visits.map((v) => (
                  <div key={v.uuid} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${!v.stopDatetime ? "bg-green-500/10" : "bg-slate-800"}`}>
                        <span className={`material-symbols-outlined text-lg ${!v.stopDatetime ? "text-green-400" : "text-slate-500"}`}>
                          {!v.stopDatetime ? "check_circle" : "event_available"}
                        </span>
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{v.visitType?.display || "Visit"}</p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {new Date(v.startDatetime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          {v.stopDatetime && ` — ${new Date(v.stopDatetime).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`}
                        </p>
                      </div>
                    </div>
                    {!v.stopDatetime && (
                      <span className="px-2.5 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-medium">
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
