"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import PatientAvatar from "@/components/clinical/PatientAvatar";
import { getObservationsWithFallback, type BahmniObservation } from "@/lib/bahmniApi";

interface VitalObs {
  concept: { name: string; shortName?: string };
  value: unknown;
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
  result?: unknown;
  minNormal?: number;
  maxNormal?: number;
  testDate?: string;
}

interface PatientName {
  givenName?: string;
  middleName?: string;
  familyName?: string;
}

interface PatientIdentifier {
  display?: string;
  identifier?: string;
  identifierType?: { display?: string };
}

interface PatientAddress {
  address1?: string;
  cityVillage?: string;
  stateProvince?: string;
  postalCode?: string;
}

interface PatientAttribute {
  attributeType?: { display?: string };
  value?: string;
}

interface PatientPerson {
  uuid?: string;
  preferredName?: PatientName;
  names?: PatientName[];
  preferredAddress?: PatientAddress;
  addresses?: PatientAddress[];
  attributes?: PatientAttribute[];
  gender?: string;
  age?: number;
}

interface PatientRecord {
  person?: PatientPerson;
  identifiers?: PatientIdentifier[];
  allergies?: { display?: string }[];
}
interface Visit {
  uuid: string;
  display: string;
  startDatetime: string;
  stopDatetime: string | null;
  visitType: { display: string };
}

interface RecentOrder {
  uuid: string;
  urgency?: string;
  encounterDatetime?: string;
  concept?: { uuid?: string; display?: string };
}

interface PatientAppointment {
  id: string;
  patientUuid: string;
  patientName: string;
  providerName: string;
  service: string;
  date: string;
  time: string;
  status: string;
  source: string;
  reason: string;
}

function formatObsValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object" && v !== null && "display" in v) {
    return String((v as { display: string }).display);
  }
  return String(v);
}

function flattenLeafObservations(rows: BahmniObservation[]): VitalObs[] {
  const out: VitalObs[] = [];
  const walk = (o: BahmniObservation) => {
    if (o.groupMembers && o.groupMembers.length > 0) {
      o.groupMembers.forEach(walk);
      return;
    }
    out.push({
      concept: o.concept,
      value: o.value,
      observationDateTime: o.observationDateTime,
    });
  };
  rows.forEach(walk);
  return out;
}

function extractAllergiesFromPatient(p: Record<string, unknown> | null | undefined): string[] {
  if (!p) return [];
  const person = p.person as Record<string, unknown> | undefined;
  const attrs = (person?.attributes as { attributeType?: { display?: string }; value?: string }[]) || [];
  const fromAttrs = attrs
    .filter((a) => (a.attributeType?.display || "").toLowerCase().includes("allerg"))
    .map((a) => String(a.value || "").trim())
    .filter(Boolean);
  const coded = (p as { allergies?: { display?: string }[] }).allergies;
  if (coded?.length) {
    return [...new Set([...fromAttrs, ...coded.map((x) => x.display || "").filter(Boolean)])];
  }
  return fromAttrs;
}


export default function PatientDashboardPage() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const params = useParams();
  const patientUuid = params.patientUuid as string;

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [vitals, setVitals] = useState<VitalObs[]>([]);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [drugOrders, setDrugOrders] = useState<DrugOrder[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [patientProfile, setPatientProfile] = useState<Record<string, unknown> | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!patientUuid) return;
    setLoading(true);

    try {
      const [patientRes, diagRes, drugRes, labRes, visitRes, encounterRes, appointmentRes] = await Promise.all([
        authFetch(`/openmrs/ws/rest/v1/patient/${patientUuid}?v=full`),
        authFetch(`/openmrs/ws/rest/v1/bahmnicore/diagnosis/search?patientUuid=${patientUuid}`).catch(() => null),
        authFetch(`/openmrs/ws/rest/v1/bahmnicore/drugOrders/prescribedAndActive?patientUuid=${patientUuid}`).catch(() => null),
        authFetch(`/openmrs/ws/rest/v1/bahmnicore/labOrderResults?patientUuid=${patientUuid}&numberOfVisits=3`).catch(() => null),
        authFetch(`/openmrs/ws/rest/v1/visit?patient=${patientUuid}&v=default`),
        authFetch(
          `/openmrs/ws/rest/v1/encounter?patient=${patientUuid}&v=custom:(uuid,display,encounterDatetime,orders:(uuid,urgency,concept:(uuid,display)))&limit=10`
        ).catch(() => null),
        fetch(`/api/appointments?patientUuid=${patientUuid}`, { cache: "no-store" }).catch(() => null),
      ]);

      // Patient
      if (patientRes.ok) {
        setPatient(await patientRes.json());
      }

      setPatientProfile(null);

      try {
        const obs = await getObservationsWithFallback(authFetch, patientUuid, undefined, {
          numberOfVisits: 5,
          scope: "latest",
        });
        setVitals(flattenLeafObservations(obs));
      } catch {
        setVitals([]);
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

      if (encounterRes?.ok) {
        try {
          const encounterData = await encounterRes.json();
          const encounters = Array.isArray(encounterData?.results) ? encounterData.results : [];
          const collected = encounters.flatMap((enc: { encounterDatetime?: string; orders?: RecentOrder[] }) =>
            (enc.orders || []).map((order) => ({
              ...order,
              encounterDatetime: enc.encounterDatetime,
            }))
          );
          setRecentOrders(collected.slice(0, 12));
        } catch {
          setRecentOrders([]);
        }
      } else {
        setRecentOrders([]);
      }

      if (appointmentRes?.ok) {
        try {
          const appointmentData = await appointmentRes.json();
          setAppointments(Array.isArray(appointmentData?.results) ? appointmentData.results : []);
        } catch {
          setAppointments([]);
        }
      } else {
        setAppointments([]);
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

  const startVisit = async (visitTypeUuid: string) => {
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

  const addr = person?.preferredAddress || person?.addresses?.[0];
  const addressLine = [addr?.address1, addr?.cityVillage, addr?.stateProvince, addr?.postalCode]
    .filter(Boolean)
    .join(", ");

  const allergies = extractAllergiesFromPatient(patient);
  const allIdentifiers =
    (patient?.identifiers as { display?: string; identifier?: string; identifierType?: { display?: string } }[]) || [];
  const programs = (patientProfile?.activePrograms as { display?: string; dateEnrolled?: string }[]) || [];
  const relationships = (patientProfile?.relationships as { personA?: { display?: string }; personB?: { display?: string }; relationshipType?: { display?: string } }[]) || [];
  const phoneAttr =
    person?.attributes?.find(
      (a: { attributeType?: { display?: string } }) =>
        (a.attributeType?.display || "").toLowerCase().includes("phone")
    )?.value || "";

  const facilityName = process.env.NEXT_PUBLIC_CLINIC_NAME || "Outpatient clinic (OPD)";

  return (
    <>
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

        <div className="bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">assignment_add</span>
            <h3 className="text-white font-semibold text-sm">Recent Orders</h3>
          </div>
          <div className="p-6">
            {recentOrders.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No saved investigations visible yet</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {recentOrders.map((order, i) => (
                  <div key={`${order.uuid}-${i}`} className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-white text-sm font-medium">{order.concept?.display || "Order"}</p>
                    <p className="text-slate-400 text-xs mt-1">
                      {order.urgency || "ROUTINE"}
                      {order.encounterDatetime ? ` • ${new Date(order.encounterDatetime).toLocaleString()}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">calendar_month</span>
              <h3 className="text-white font-semibold text-sm">Appointments</h3>
            </div>
            <Link
              href={`/appointments?patientUuid=${patientUuid}`}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Open all
            </Link>
          </div>
          <div className="p-6">
            {appointments.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No appointments booked for this patient</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-white text-sm font-medium">{appointment.service}</p>
                        <p className="text-slate-400 text-xs mt-1">
                          {appointment.date} • {appointment.time} • {appointment.providerName}
                        </p>
                        {appointment.reason ? (
                          <p className="text-slate-500 text-xs mt-1">{appointment.reason}</p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded ${
                            appointment.status === "Cancelled"
                              ? "bg-red-500/20 text-red-400"
                              : appointment.status === "Completed"
                                ? "bg-blue-500/20 text-blue-400"
                                : appointment.status === "Checked In"
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-primary/20 text-primary"
                          }`}
                        >
                          {appointment.status}
                        </span>
                        <p className="text-[11px] text-slate-500 mt-2">{appointment.source.replace("_", " ")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* OPD-style printable chart (layout aligned with typical Bahmni print; see /OPD.pdf reference) */}
    <div className="opd-print-document hidden print:block max-w-4xl mx-auto bg-white p-6 text-black text-[11px] leading-snug">
      <table className="opd-grid w-full mb-4">
        <tbody>
          <tr>
            <td colSpan={4} className="text-center font-bold text-sm py-2">
              {facilityName}
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="text-center font-bold text-xs py-1">
              Outpatient (OPD) — Patient chart / visit summary
            </td>
          </tr>
          <tr>
            <td colSpan={4} className="text-center text-[10px] text-neutral-700 py-1">
              Printed: {new Date().toLocaleString()} • Patient UUID: {patientUuid}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="opd-grid w-full mb-4">
        <tbody>
          <tr>
            <td className="w-[100px] font-bold bg-neutral-100">Patient name</td>
            <td colSpan={3}>{fullName}</td>
          </tr>
          <tr>
            <td className="font-bold bg-neutral-100">Primary ID</td>
            <td>{patientId}</td>
            <td className="w-[90px] font-bold bg-neutral-100">Gender</td>
            <td>{person?.gender === "M" ? "Male" : person?.gender === "F" ? "Female" : person?.gender || "—"}</td>
          </tr>
          <tr>
            <td className="font-bold bg-neutral-100">Age</td>
            <td>{person?.age != null ? `${person.age} yrs` : "—"}</td>
            <td className="font-bold bg-neutral-100">DOB</td>
            <td>{person?.birthdate ? person.birthdate.split("T")[0] : "—"}</td>
          </tr>
          <tr>
            <td className="font-bold bg-neutral-100">Address</td>
            <td colSpan={3}>{addressLine || "—"}</td>
          </tr>
          <tr>
            <td className="font-bold bg-neutral-100">Phone</td>
            <td>{phoneAttr ? String(phoneAttr) : "—"}</td>
            <td className="font-bold bg-neutral-100">Allergies</td>
            <td>{allergies.length ? allergies.join(", ") : "None recorded"}</td>
          </tr>
          <tr>
            <td className="font-bold bg-neutral-100">Visit</td>
            <td colSpan={3}>
              {activeVisit
                ? `${activeVisit.visitType?.display} — started ${new Date(activeVisit.startDatetime).toLocaleString()}`
                : "No active visit at time of print"}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mb-2 flex gap-4 items-start">
        <PatientAvatar
          authFetch={authFetch}
          patientUuid={patientUuid}
          personUuid={person?.uuid}
          className="w-28 h-28 shrink-0 border border-black overflow-hidden flex items-center justify-center bg-neutral-100"
          iconClassName="text-neutral-500 text-4xl"
        />
        <p className="text-[10px] text-neutral-600 pt-1">
          Photo as on file. If no image appears, capture is not stored in OpenMRS for this patient.
        </p>
      </div>

      {allIdentifiers.length > 0 && (
        <section className="mb-4">
          <p className="font-bold mb-1">Patient identifiers</p>
          <table className="opd-grid w-full">
            <thead>
              <tr>
                <th>Type</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {allIdentifiers.map((row, i) => (
                <tr key={i}>
                  <td>{row.identifierType?.display || "—"}</td>
                  <td className="font-mono">{row.identifier || row.display?.replace(/^.*=\s*/, "") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mb-4">
        <p className="font-bold mb-1">Observations / vitals</p>
        {vitals.length === 0 ? (
          <p className="text-neutral-600">None recorded.</p>
        ) : (
          <table className="opd-grid w-full">
            <thead>
              <tr>
                <th>Concept</th>
                <th>Value</th>
                <th>Date / time</th>
              </tr>
            </thead>
            <tbody>
              {vitals.map((v, i) => (
                <tr key={`p-${v.concept?.name}-${i}`}>
                  <td>{v.concept?.shortName || v.concept?.name || "—"}</td>
                  <td>{formatObsValue(v.value)}</td>
                  <td>
                    {v.observationDateTime ? new Date(v.observationDateTime).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-4">
        <p className="font-bold mb-1">Diagnoses</p>
        {diagnoses.length === 0 ? (
          <p className="text-neutral-600">None recorded.</p>
        ) : (
          <table className="opd-grid w-full">
            <thead>
              <tr>
                <th>Diagnosis</th>
                <th>Order</th>
                <th>Certainty</th>
              </tr>
            </thead>
            <tbody>
              {diagnoses.map((d, i) => (
                <tr key={i}>
                  <td>{d.codedAnswer?.name || d.freeTextAnswer || "—"}</td>
                  <td>{d.order}</td>
                  <td>{d.certainty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-4">
        <p className="font-bold mb-1">Medications</p>
        {drugOrders.length === 0 ? (
          <p className="text-neutral-600">None active.</p>
        ) : (
          <table className="opd-grid w-full">
            <thead>
              <tr>
                <th>Drug</th>
                <th>Dose / route / frequency</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {drugOrders.map((d, i) => (
                <tr key={i}>
                  <td>{d.drug?.name || "—"}</td>
                  <td>
                    {d.dosingInstructions
                      ? `${d.dosingInstructions.dose} ${d.dosingInstructions.doseUnits}, ${d.dosingInstructions.route}, ${d.dosingInstructions.frequency}`
                      : "—"}
                  </td>
                  <td>
                    {d.duration != null ? `${d.duration} ${d.durationUnits || ""}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-4">
        <p className="font-bold mb-1">Lab results</p>
        {labResults.length === 0 ? (
          <p className="text-neutral-600">None available.</p>
        ) : (
          <table className="opd-grid w-full">
            <thead>
              <tr>
                <th>Test</th>
                <th>Result</th>
                <th>Reference range</th>
              </tr>
            </thead>
            <tbody>
              {labResults.map((l, i) => (
                <tr key={i}>
                  <td>{l.testName || "—"}</td>
                  <td>{l.result != null ? String(l.result) : "—"}</td>
                  <td>
                    {l.minNormal != null && l.maxNormal != null ? `${l.minNormal}–${l.maxNormal}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {programs.length > 0 && (
        <section className="mb-4">
          <p className="font-bold mb-1">Programs</p>
          <table className="opd-grid w-full">
            <thead>
              <tr>
                <th>Program</th>
                <th>Date enrolled</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((pr, i) => (
                <tr key={i}>
                  <td>{pr.display || "Program"}</td>
                  <td>{pr.dateEnrolled || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mb-8">
        <p className="font-bold mb-1">Visit history</p>
        {visits.length === 0 ? (
          <p className="text-neutral-600">No visits.</p>
        ) : (
          <table className="opd-grid w-full">
            <thead>
              <tr>
                <th>Type</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.uuid}>
                  <td>{v.visitType?.display || "Visit"}</td>
                  <td>{new Date(v.startDatetime).toLocaleString()}</td>
                  <td>{v.stopDatetime ? new Date(v.stopDatetime).toLocaleString() : "—"}</td>
                  <td>{v.stopDatetime ? "Closed" : "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="mt-12 border-t border-neutral-400 pt-4 text-xs text-neutral-600">
        <p className="font-semibold text-black">Provider signature: _________________________________</p>
        <p className="mt-2">This summary is generated for clinical reference. Verify all data in the EHR.</p>
      </div>
    </div>
    </>
  );
}
