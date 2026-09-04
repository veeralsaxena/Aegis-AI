"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import ObservationForms, { type ObservationFormsHandle } from "@/components/clinical/ObservationForms";
import Dropdown from "@/components/Dropdown";
import {
  ScribePanel,
  type ConsultationDraft,
  type ScribeApplyOptions,
} from "@/components/ai-agents/ScribePanel";
import { DrugSafetyAlertPanel } from "@/components/ai-agents/DrugSafetyAlertPanel";
import { DifferentialPanel } from "@/components/ai-agents/DifferentialPanel";
import { aiFetchUrl } from "@/lib/aiAgentBaseUrl";

type ConsultationTab = "observations" | "diagnoses" | "medications" | "orders" | "disposition" | "notes";

interface DiagnosisEntry {
  codedAnswer: { uuid: string; name: string } | null;
  freeTextAnswer: string;
  order: "PRIMARY" | "SECONDARY";
  certainty: "CONFIRMED" | "PRESUMED";
  isNew?: boolean;
  existingObs?: string | null;
}

interface DrugOrderEntry {
  drug: { uuid: string; name: string } | null;
  dose: string;
  doseUnits: string;
  route: string;
  frequency: string;
  duration: string;
  durationUnits: string;
  asNeeded: boolean;
  instructions: string;
}

interface LabOrderEntry {
  concept: { uuid: string; name: string; conceptClass?: string };
  urgency: string;
  section?: "Laboratory" | "Radiology";
  category?: string;
  requestedName?: string;
}

export default function ConsultationPage() {
  const { authFetch, provider, locationUuid } = useAuth();
  const router = useRouter();
  const params = useParams();
  const patientUuid = params.patientUuid as string;

  const [activeTab, setActiveTab] = useState<ConsultationTab>("observations");
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);

  // --- Observation Forms ref ---
  const obsFormsRef = useRef<ObservationFormsHandle>(null);
  const [chiefComplaintForAi, setChiefComplaintForAi] = useState("");

  const inferOrderSectionFromName = (name: string): "laboratory" | "radiology" => {
    const n = name.toLowerCase();
    if (n.includes("x-ray") || n.includes("xray") || n.includes("mri") || n.includes("ct") || n.includes("ultrasound") || n.includes("scan") || n.includes("radiology")) {
      return "radiology";
    }
    return "laboratory";
  };

  const resolveDrugSuggestion = useCallback(
    async (rawName: string) => {
      const q = rawName.trim();
      if (!q) return null;
      try {
        const res = await authFetch(`/openmrs/ws/rest/v1/drug?s=default&q=${encodeURIComponent(q)}&v=default&limit=5`);
        if (res.ok) {
          const data = await res.json();
          if (data.results?.length) return data.results[0];
        }
        const cres = await authFetch(`/openmrs/ws/rest/v1/concept?q=${encodeURIComponent(q)}&limit=5&v=custom:(uuid,name,display)&class=Drug`);
        if (cres.ok) {
          const cdata = await cres.json();
          if (cdata.results?.length) {
            return {
              uuid: cdata.results[0].uuid,
              name: cdata.results[0].display || cdata.results[0].name?.display || q,
            };
          }
        }
      } catch { /* ignore */ }
      return null;
    },
    [authFetch]
  );

  const resolveLabSuggestion = useCallback(
    async (rawName: string, section?: "laboratory" | "radiology") => {
      const q = rawName.trim();
      if (!q) return null;
      try {
        const res = await authFetch(`/openmrs/ws/rest/v1/concept?q=${encodeURIComponent(q)}&limit=8&v=custom:(uuid,name,display,conceptClass)`);
        if (res.ok) {
          const data = await res.json();
          const results = data.results || [];
          if (results.length) {
            return {
              uuid: results[0].uuid,
              display: results[0].display || results[0].name?.display || q,
              conceptClass: results[0].conceptClass?.display || results[0].conceptClass?.name,
            };
          }
        }
      } catch { /* ignore */ }
      return null;
    },
    [authFetch]
  );

  const runDrugSafetyCheck = useCallback(
    async (medicationName: string) => {
      const name = medicationName.trim();
      if (!name) return;
      try {
        await fetch(aiFetchUrl("/drug-safety/check"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient_uuid: patientUuid,
            doctor_uuid: provider?.uuid,
            medication_name: name,
          }),
        });
      } catch { /* ignore */ }
    },
    [patientUuid, provider?.uuid]
  );

  const handleScribeAccepted = useCallback(
    async (draft: ConsultationDraft, options: ScribeApplyOptions) => {
      const noteSections: string[] = [];
      const diagnosisEntries: DiagnosisEntry[] = [];
      const resolvedDrugEntries: DrugOrderEntry[] = [];
      const unresolvedDrugNames: string[] = [];
      const resolvedLabEntries: LabOrderEntry[] = [];
      const unresolvedLabNames: string[] = [];

      if (options.notes) {
        if (draft.visit_summary.trim()) {
          noteSections.push(`--- AI visit summary ---\n${draft.visit_summary.trim()}`);
        }
        noteSections.push(
          [
            "--- SOAP (AI scribe) ---",
            `S: ${draft.soap.subjective}`,
            `O: ${draft.soap.objective}`,
            `A: ${draft.soap.assessment}`,
            `P: ${draft.soap.plan}`,
          ].join("\n")
        );

        if (draft.suggestions.follow_up.trim()) {
          noteSections.push(`--- Follow-up ---\n${draft.suggestions.follow_up.trim()}`);
        }
        if (draft.suggestions.patient_instructions.length > 0) {
          noteSections.push(
            `--- Patient instructions ---\n${draft.suggestions.patient_instructions
              .map((line) => `- ${line}`)
              .join("\n")}`
          );
        }
        if (draft.suggestions.red_flags.length > 0) {
          noteSections.push(
            `--- Red flags ---\n${draft.suggestions.red_flags
              .map((line) => `- ${line}`)
              .join("\n")}`
          );
        }
      }

      if (options.diagnoses) {
        diagnosisEntries.push(
          ...draft.suggestions.diagnoses
            .filter((item) => item.name.trim())
            .map((item) => ({
              codedAnswer: null,
              freeTextAnswer: item.name.trim(),
              order: item.order,
              certainty: item.certainty,
              isNew: true,
              existingObs: null,
            }))
        );
      }

      if (options.medications) {
        for (const item of draft.suggestions.medications) {
          const medicationName = item.name.trim();
          if (!medicationName || item.status === "stop") continue;
          const match = await resolveDrugSuggestion(medicationName);
          if (!match?.uuid) {
            unresolvedDrugNames.push(medicationName);
            continue;
          }
          resolvedDrugEntries.push({
            drug: {
              uuid: match.uuid,
              name: match.name || match.display || medicationName,
            },
            dose: item.dose || "",
            doseUnits: item.dose_units || "mg",
            route: item.route || "Oral",
            frequency: item.frequency || "Once a day",
            duration: item.duration || "",
            durationUnits: item.duration_units || "Day(s)",
            asNeeded: false,
            instructions: item.instructions || "",
          });
        }
      }

      if (options.labOrders) {
        for (const item of draft.suggestions.lab_orders) {
          const labName = item.name.trim();
          if (!labName) continue;
          const inferredSection = inferOrderSectionFromName(labName);
          const match = await resolveLabSuggestion(labName, inferredSection);
          if (!match?.uuid) {
            unresolvedLabNames.push(labName);
            continue;
          }
          resolvedLabEntries.push({
            concept: {
              uuid: match.uuid,
              name: match.display || labName,
              conceptClass: match.conceptClass,
            },
            urgency: item.urgency || "ROUTINE",
            section: inferredSection === "radiology" ? "Radiology" : "Laboratory",
            requestedName: labName,
          });
        }
      }

      if (unresolvedDrugNames.length > 0) {
        noteSections.push(
          `--- Medication suggestions needing manual mapping ---\n${unresolvedDrugNames
            .map((line) => `- ${line}`)
            .join("\n")}`
        );
      }

      if (unresolvedLabNames.length > 0) {
        noteSections.push(
          `--- Lab suggestions needing manual mapping ---\n${unresolvedLabNames
            .map((line) => `- ${line}`)
            .join("\n")}`
        );
      }

      if (diagnosisEntries.length > 0) {
        setDiagnoses((prev) => [...prev, ...diagnosisEntries]);
      }

      if (resolvedDrugEntries.length > 0) {
        setDrugOrders((prev) => [...prev, ...resolvedDrugEntries]);
        for (const entry of resolvedDrugEntries) {
          if (entry.drug?.name) void runDrugSafetyCheck(entry.drug.name);
        }
      }

      if (resolvedLabEntries.length > 0) {
        setLabOrders((prev) => [...prev, ...resolvedLabEntries]);
      }

      if (
        options.disposition &&
        draft.suggestions.disposition.action &&
        draft.suggestions.disposition.action !== "NONE"
      ) {
        setDispositionAction(draft.suggestions.disposition.action);
        if (draft.suggestions.disposition.note.trim()) {
          setDispositionNote((prev) =>
            prev
              ? `${prev}\n${draft.suggestions.disposition.note.trim()}`
              : draft.suggestions.disposition.note.trim()
          );
        }
      }

      if (noteSections.length > 0) {
        const combined = noteSections.join("\n\n");
        setConsultationNotes((prev) =>
          prev ? `${prev}\n\n${combined}` : combined
        );
      }

      if (resolvedDrugEntries.length > 0) {
        setActiveTab("medications");
      } else if (diagnosisEntries.length > 0) {
        setActiveTab("diagnoses");
      } else if (resolvedLabEntries.length > 0) {
        setActiveTab("orders");
      } else if (
        options.disposition &&
        draft.suggestions.disposition.action !== "NONE"
      ) {
        setActiveTab("disposition");
      } else {
        setActiveTab("notes");
      }

      const summaryParts: string[] = [];
      if (options.notes) summaryParts.push("notes");
      if (diagnosisEntries.length > 0) summaryParts.push(`${diagnosisEntries.length} diagnosis suggestion(s)`);
      if (resolvedDrugEntries.length > 0) summaryParts.push(`${resolvedDrugEntries.length} medication(s)`);
      if (resolvedLabEntries.length > 0) summaryParts.push(`${resolvedLabEntries.length} lab order(s)`);
      if (options.disposition && draft.suggestions.disposition.action !== "NONE") {
        summaryParts.push(`disposition ${draft.suggestions.disposition.action.toLowerCase()}`);
      }
      if (unresolvedDrugNames.length > 0 || unresolvedLabNames.length > 0) {
        summaryParts.push("manual review notes added");
      }

      setNotification({
        type: "success",
        message:
          summaryParts.length > 0
            ? `Scribe draft applied: ${summaryParts.join(", ")}.`
            : "Scribe draft reviewed. No structured items were applied.",
      });
    },
    [resolveDrugSuggestion, resolveLabSuggestion, runDrugSafetyCheck]
  );

  // --- Diagnoses state ---
  const [diagnoses, setDiagnoses] = useState<DiagnosisEntry[]>([]);
  const [diagSearchQuery, setDiagSearchQuery] = useState("");
  const [diagSearchResults, setDiagSearchResults] = useState<{ uuid: string; display: string }[]>([]);
  const [diagSearching, setDiagSearching] = useState(false);

  // --- Medications state ---
  const [drugOrders, setDrugOrders] = useState<DrugOrderEntry[]>([]);
  const [drugSearchQuery, setDrugSearchQuery] = useState("");
  const [drugSearchResults, setDrugSearchResults] = useState<{ uuid: string; display: string; name: string }[]>([]);
  const [drugSearching, setDrugSearching] = useState(false);

  // --- Lab Orders state ---
  const [labOrders, setLabOrders] = useState<LabOrderEntry[]>([]);
  const [labPanels, setLabPanels] = useState<{ uuid: string; display: string; setMembers?: any[] }[]>([]);
  const [labLoading, setLabLoading] = useState(false);

  // --- Disposition state ---
  const [dispositionAction, setDispositionAction] = useState("");
  const [dispositionNote, setDispositionNote] = useState("");

  // --- Consultation Notes ---
  const [consultationNotes, setConsultationNotes] = useState("");

  // Keyboard shortcut for save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.altKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // Load patient info
  useEffect(() => {
    if (!patientUuid) return;
    setLoading(true);
    authFetch(`/openmrs/ws/rest/v1/patient/${patientUuid}?v=full`)
      .then((r) => r.json())
      .then((data) => setPatient(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [patientUuid, authFetch]);

  // --- Diagnosis Search ---
  const searchDiagnosisConcepts = useCallback(async (q: string) => {
    if (q.length < 2) { setDiagSearchResults([]); return; }
    setDiagSearching(true);
    try {
      const res = await authFetch(`/openmrs/ws/rest/v1/concept?q=${encodeURIComponent(q)}&limit=15&v=custom:(uuid,name,display)&class=Diagnosis`);
      const data = await res.json();
      const results = (data.results || []).map((d: any) => ({
        uuid: d.uuid,
        display: d.display || d.name?.display,
      }));
      setDiagSearchResults(results);
    } catch { setDiagSearchResults([]); }
    finally { setDiagSearching(false); }
  }, [authFetch]);

  useEffect(() => {
    const timer = setTimeout(() => searchDiagnosisConcepts(diagSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [diagSearchQuery, searchDiagnosisConcepts]);

  // Load existing diagnoses
  useEffect(() => {
    if (!patientUuid) return;
    authFetch(`/openmrs/ws/rest/v1/bahmnicore/diagnosis/search?patientUuid=${patientUuid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data)) {
          const loaded = data.map((d: any) => ({
            codedAnswer: d.codedAnswer ? { uuid: d.codedAnswer.uuid, name: d.codedAnswer.display || d.codedAnswer.name?.name || "" } : null,
            freeTextAnswer: d.freeTextAnswer || "",
            order: d.order || "PRIMARY",
            certainty: d.certainty || "CONFIRMED",
            existingObs: d.existingObs || null,
            isNew: false
          }));
          setDiagnoses(loaded);
        }
      })
      .catch(console.error);
  }, [patientUuid, authFetch]);

  const addDiagnosis = (concept: { uuid: string; display: string }) => {
    setDiagnoses((prev) => [
      ...prev,
      { codedAnswer: { uuid: concept.uuid, name: concept.display }, freeTextAnswer: "", order: "PRIMARY", certainty: "CONFIRMED", isNew: true },
    ]);
    setDiagSearchQuery("");
    setDiagSearchResults([]);
  };

  const removeDiagnosis = (index: number) => {
    setDiagnoses((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Drug Search ---
  const searchDrugs = useCallback(async (q: string) => {
    if (q.length < 2) { setDrugSearchResults([]); return; }
    setDrugSearching(true);
    try {
      const res = await authFetch(`/openmrs/ws/rest/v1/drug?q=${encodeURIComponent(q)}&s=default&v=default&limit=15`);
      const data = await res.json();
      setDrugSearchResults(data.results || []);
    } catch { setDrugSearchResults([]); }
    finally { setDrugSearching(false); }
  }, [authFetch]);

  useEffect(() => {
    const timer = setTimeout(() => searchDrugs(drugSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [drugSearchQuery, searchDrugs]);

  const addDrugOrder = (drug: { uuid: string; name: string; display: string }) => {
    if (drug.name || drug.display) void runDrugSafetyCheck(drug.name || drug.display);
    setDrugOrders((prev) => [
      ...prev,
      { drug: { uuid: drug.uuid, name: drug.name || drug.display }, dose: "", doseUnits: "mg", route: "Oral", frequency: "Once a day", duration: "", durationUnits: "Day(s)", asNeeded: false, instructions: "" },
    ]);
    setDrugSearchQuery("");
    setDrugSearchResults([]);
  };

  const updateDrugOrder = (index: number, field: string, value: any) => {
    setDrugOrders((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const removeDrugOrder = (index: number) => {
    setDrugOrders((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Lab Panels ---
  useEffect(() => {
    if (activeTab !== "orders") return;
    if (labPanels.length > 0) return;
    setLabLoading(true);
    authFetch(`/openmrs/ws/rest/v1/concept?s=byFullySpecifiedName&name=All_Tests_and_Panels&v=custom:(uuid,display,setMembers:(uuid,display))`)
      .then((r) => r.json())
      .then((data) => {
        const results = data.results || [];
        if (results.length > 0 && results[0].setMembers) {
          setLabPanels(results[0].setMembers);
        }
      })
      .catch(() => {
        // Fallback: offer manual text search for lab concepts
        setLabPanels([]);
      })
      .finally(() => setLabLoading(false));
  }, [activeTab, authFetch, labPanels.length]);

  const addLabOrder = (concept: { uuid: string; display: string }) => {
    if (labOrders.some((l) => l.concept.uuid === concept.uuid)) return;
    setLabOrders((prev) => [...prev, { concept: { uuid: concept.uuid, name: concept.display }, urgency: "ROUTINE" }]);
  };

  const removeLabOrder = (index: number) => {
    setLabOrders((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Save (Coarse-grained bahmniencounter) ---
  const handleSave = async () => {
    setSaving(true);
    setNotification(null);

    try {
      // Build observations array from ObservationForms component
      const formObservations = obsFormsRef.current?.getObservations() || [];
      const observations: any[] = [...formObservations];
      if (consultationNotes.trim()) {
        observations.push({
          concept: { uuid: "81d6e852-3f10-11e4-adec-0800271c1b75" }, // Consultation Note concept
          value: consultationNotes,
        });
      }

      // Build diagnoses array (Bahmni-compatible format)
      const diagPayload = diagnoses.map((d: any) => ({
        codedAnswer: d.codedAnswer ? { uuid: d.codedAnswer.uuid } : undefined,
        freeTextAnswer: d.freeTextAnswer || undefined,
        order: d.order,
        certainty: d.certainty,
        existingObs: d.existingObs || null,
        diagnosisStatusConcept: null,
        diagnosisDateTime: new Date().toISOString(),
      }));

      // Build drug orders array
      const drugOrdersPayload = drugOrders
        .filter((d) => d.drug && d.dose)
        .map((d) => ({
          drug: { uuid: d.drug!.uuid },
          dosingInstructions: {
            dose: parseFloat(d.dose),
            doseUnits: d.doseUnits,
            route: d.route,
            frequency: d.frequency,
            asNeeded: d.asNeeded,
          },
          duration: d.duration ? parseInt(d.duration) : undefined,
          durationUnits: d.durationUnits || undefined,
          instructions: d.instructions || undefined,
          type: "drugorder",
          careSetting: "OUTPATIENT",
          orderType: "Drug Order",
        }));

      // Build lab orders array
      const ordersPayload = labOrders.map((l) => ({
        concept: { uuid: l.concept.uuid },
        type: "testorder",
        careSetting: "OUTPATIENT",
        orderType: "Order",
        urgency: l.urgency,
      }));

      // Build disposition
      const dispositionPayload = dispositionAction
        ? { code: dispositionAction, additionalObs: dispositionNote ? [{ value: dispositionNote, concept: { name: "Disposition Note" } }] : [] }
        : undefined;

      // The big JSON — Bahmni coarse-grained save
      const encounterPayload: any = {
        patientUuid,
        encounterTypeUuid: "b9ccceaa-f496-11ed-b02c-0242ac150003", // Consultation encounter type
        locationUuid: locationUuid || "833d0c66-e29a-4d31-ac13-ca9050d1bfa9",
        providers: provider ? [{ uuid: provider.uuid }] : [],
        observations,
        diagnoses: diagPayload.length > 0 ? diagPayload : undefined,
        drugOrders: drugOrdersPayload.length > 0 ? drugOrdersPayload : undefined,
        orders: ordersPayload.length > 0 ? ordersPayload : undefined,
        disposition: dispositionPayload,
      };

      const res = await authFetch("/openmrs/ws/rest/v1/bahmnicore/bahmniencounter", {
        method: "POST",
        body: JSON.stringify(encounterPayload),
      });

      if (res.ok) {
        setNotification({ type: "success", message: "Consultation saved successfully! All data has been recorded." });
        // Clear new entries
        setDiagnoses((prev) => prev.map((d) => ({ ...d, isNew: false })));
      } else {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message || `Save failed (HTTP ${res.status})`);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to save consultation" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#FDFDFD]">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-slate-400 text-5xl animate-spin">progress_activity</span>
          <p className="text-slate-500 font-medium text-sm tracking-wide">Loading consultation...</p>
        </div>
      </div>
    );
  }

  const person = patient?.person;
  const pName = person?.preferredName || person?.names?.[0];
  const fullName = pName ? [pName.givenName, pName.middleName, pName.familyName].filter(Boolean).join(" ") : "Unknown";
  const patientId = patient?.identifiers?.[0]?.display?.replace(/^.*=\s*/, "") || "N/A";

  const TABS: { key: ConsultationTab; label: string; icon: string }[] = [
    { key: "observations", label: "Observations", icon: "vital_signs" },
    { key: "diagnoses", label: "Diagnoses", icon: "diagnosis" },
    { key: "medications", label: "Medications", icon: "medication" },
    { key: "orders", label: "Lab Orders", icon: "biotech" },
    { key: "disposition", label: "Disposition", icon: "swap_horiz" },
    { key: "notes", label: "Notes", icon: "edit_note" },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFD] p-4 md:p-6 lg:p-8 pb-32">
      <div className="max-w-[1600px] mx-auto xl:grid xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-8 xl:items-start">
        <div className="min-w-0 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap pb-6 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <Link href={`/clinical/${patientUuid}`} className="text-slate-400 hover:text-slate-900 transition-colors">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </Link>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900 flex items-center gap-2 tracking-tight">
                Consultation — {fullName}
              </h1>
              <p className="text-slate-500 text-xs mt-1 font-medium uppercase tracking-wider">
                ID: <span className="text-slate-900 font-mono">{patientId}</span>
                {person?.gender && <> • {person.gender === "M" ? "Male" : "Female"}</>}
                {person?.age != null && <> • {person.age} yrs</>}
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-6 py-2.5 rounded-lg flex items-center gap-2 text-sm disabled:opacity-50 transition-colors"
            title="Alt+S"
          >
            {saving ? (
              <><span className="material-symbols-outlined text-lg animate-spin">progress_activity</span> Saving...</>
            ) : (
              <><span className="material-symbols-outlined text-lg">save</span> Save (Alt+S)</>
            )}
          </button>
        </div>

        {/* Notification */}
        {notification && (
          <div className={`px-4 py-3 rounded-lg flex items-center gap-2 ${notification.type === "success" ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}`}>
            <span className={`material-symbols-outlined text-lg ${notification.type === "success" ? "text-emerald-600" : "text-rose-600"}`}>
              {notification.type === "success" ? "check_circle" : "error"}
            </span>
            <p className={`text-sm font-medium ${notification.type === "success" ? "text-emerald-700" : "text-rose-700"}`}>{notification.message}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-slate-200 scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all whitespace-nowrap border-b-2 ${activeTab === tab.key
                  ? "text-slate-900 border-slate-900 bg-slate-50/50"
                  : "text-slate-500 border-transparent hover:text-slate-900 hover:bg-slate-50"
                  }`}
              >
                <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                {tab.label}
                {tab.key === "diagnoses" && diagnoses.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded-full font-semibold">{diagnoses.length}</span>
                )}
                {tab.key === "medications" && drugOrders.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded-full font-semibold">{drugOrders.length}</span>
                )}
                {tab.key === "orders" && labOrders.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] rounded-full font-semibold">{labOrders.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6 md:p-8">
            {/* ===== OBSERVATIONS TAB ===== */}
            {activeTab === "observations" && (
              <div className="space-y-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Chief Complaint (for AI Differential Suggestions)
                  </label>
                  <textarea
                    value={chiefComplaintForAi}
                    onChange={(e) => setChiefComplaintForAi(e.target.value)}
                    rows={3}
                    placeholder="Describe chief complaint to generate live AI differential diagnosis…"
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-slate-400 transition-colors"
                  />
                  <div className="mt-4">
                    <DifferentialPanel
                      patientUuid={patientUuid}
                      doctorUuid={provider?.uuid}
                      chiefComplaint={chiefComplaintForAi}
                      onSelectDiagnosis={(diagName) => {
                        setDiagSearchQuery(diagName);
                        setActiveTab("diagnoses");
                      }}
                    />
                  </div>
                </div>
                <ObservationForms ref={obsFormsRef} authFetch={authFetch} />
              </div>
            )}

            {/* ===== DIAGNOSES TAB ===== */}
            {activeTab === "diagnoses" && (
              <div className="space-y-6">
                <h3 className="text-slate-900 font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-xl">diagnosis</span>
                  Diagnoses
                </h3>

                {/* Search */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                  <input
                    type="text"
                    value={diagSearchQuery}
                    onChange={(e) => setDiagSearchQuery(e.target.value)}
                    placeholder="Search diagnosis (e.g., Malaria, Diabetes, Hypertension)..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-3.5 pl-12 rounded-lg outline-none text-sm transition-colors"
                  />
                  {diagSearching && (
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg animate-spin">progress_activity</span>
                  )}
                  {diagSearchResults.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {diagSearchResults.map((c) => (
                        <button
                          key={c.uuid}
                          onClick={() => addDiagnosis(c)}
                          className="w-full text-left px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors border-b border-slate-100 last:border-0"
                        >
                          {c.display}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Added diagnoses */}
                {diagnoses.length === 0 ? (
                  <p className="text-slate-400 text-sm font-medium text-center py-8">No diagnoses added yet. Use the search above to add one.</p>
                ) : (
                  <div className="space-y-3">
                    {diagnoses.map((d, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
                        <div className="flex-1">
                          <p className="text-slate-900 text-sm font-medium">{d.codedAnswer?.name || d.freeTextAnswer}</p>
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex-1">
                              <Dropdown
                                value={d.order}
                                onChange={(value) => {
                                  const updated = [...diagnoses];
                                  updated[i].order = value as "PRIMARY" | "SECONDARY";
                                  setDiagnoses(updated);
                                }}
                                options={[
                                  { label: "Primary", value: "PRIMARY" },
                                  { label: "Secondary", value: "SECONDARY" },
                                ]}
                                className="w-[130px]"
                              />
                            </div>
                            <div className="flex-1">
                              <Dropdown
                                value={d.certainty}
                                onChange={(value) => {
                                  const updated = [...diagnoses];
                                  updated[i].certainty = value as "CONFIRMED" | "PRESUMED";
                                  setDiagnoses(updated);
                                }}
                                options={[
                                  { label: "Confirmed", value: "CONFIRMED" },
                                  { label: "Presumed", value: "PRESUMED" },
                                ]}
                                className="w-[140px]"
                              />
                            </div>
                          </div>
                        </div>
                        <button onClick={() => removeDiagnosis(i)} className="text-slate-400 hover:text-rose-600 transition-colors w-8 h-8 flex items-center justify-center rounded-md hover:bg-rose-50">
                          <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== MEDICATIONS TAB ===== */}
            {activeTab === "medications" && (
              <div className="space-y-6">
                <DrugSafetyAlertPanel patientUuid={patientUuid} doctorUuid={provider?.uuid} />
                <h3 className="text-slate-900 font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-xl">medication</span>
                  Medications
                </h3>

                {/* Drug Search */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                  <input
                    type="text"
                    value={drugSearchQuery}
                    onChange={(e) => setDrugSearchQuery(e.target.value)}
                    placeholder="Search for a medication (e.g., Paracetamol, Amoxicillin)..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-3.5 pl-12 rounded-lg outline-none text-sm transition-colors"
                  />
                  {drugSearching && (
                    <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg animate-spin">progress_activity</span>
                  )}
                  {drugSearchResults.length > 0 && (
                    <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {drugSearchResults.map((d) => (
                        <button
                          key={d.uuid}
                          onClick={() => addDrugOrder(d)}
                          className="w-full text-left px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors border-b border-slate-100 last:border-0"
                        >
                          {d.display || d.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Drug Order Forms */}
                {drugOrders.length === 0 ? (
                  <p className="text-slate-400 text-sm font-medium text-center py-8">No medications added yet. Search and add a drug above.</p>
                ) : (
                  <div className="space-y-4">
                    {drugOrders.map((d, i) => (
                      <div key={i} className="p-5 bg-white rounded-lg border border-slate-200 shadow-sm space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <h4 className="text-slate-900 font-semibold text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-slate-400 text-lg">pill</span>
                            {d.drug?.name}
                          </h4>
                          <button onClick={() => removeDrugOrder(i)} className="text-slate-400 hover:text-rose-600 transition-colors w-8 h-8 flex items-center justify-center rounded-md hover:bg-rose-50">
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Dose</label>
                            <input type="number" value={d.dose} onChange={(e) => updateDrugOrder(i, "dose", e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-2.5 rounded-md outline-none text-sm" placeholder="e.g., 500" />
                          </div>
                          <div>
                            <Dropdown
                              label="Units"
                              value={d.doseUnits}
                              onChange={(value) => updateDrugOrder(i, "doseUnits", value)}
                              options={[
                                { label: "mg", value: "mg" },
                                { label: "ml", value: "ml" },
                                { label: "g", value: "g" },
                                { label: "mcg", value: "mcg" },
                                { label: "IU", value: "IU" },
                                { label: "Tablet(s)", value: "Tablet(s)" },
                                { label: "Capsule(s)", value: "Capsule(s)" },
                              ]}
                            />
                          </div>
                          <div>
                            <Dropdown
                              label="Route"
                              value={d.route}
                              onChange={(value) => updateDrugOrder(i, "route", value)}
                              options={[
                                { label: "Oral", value: "Oral" },
                                { label: "Intravenous", value: "Intravenous" },
                                { label: "Intramuscular", value: "Intramuscular" },
                                { label: "Subcutaneous", value: "Subcutaneous" },
                                { label: "Topical", value: "Topical" },
                                { label: "Inhalation", value: "Inhalation" },
                                { label: "Rectal", value: "Rectal" },
                              ]}
                            />
                          </div>
                          <div>
                            <Dropdown
                              label="Frequency"
                              value={d.frequency}
                              onChange={(value) => updateDrugOrder(i, "frequency", value)}
                              options={[
                                { label: "Once a day", value: "Once a day" },
                                { label: "Twice a day", value: "Twice a day" },
                                { label: "Thrice a day", value: "Thrice a day" },
                                { label: "Four times a day", value: "Four times a day" },
                                { label: "Every 6 hours", value: "Every 6 hours" },
                                { label: "Every 8 hours", value: "Every 8 hours" },
                                { label: "Every 12 hours", value: "Every 12 hours" },
                                { label: "Immediately", value: "Immediately" },
                              ]}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Duration</label>
                            <input type="number" value={d.duration} onChange={(e) => updateDrugOrder(i, "duration", e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-2.5 rounded-md outline-none text-sm" placeholder="e.g., 5" />
                          </div>
                          <div>
                            <Dropdown
                              label="Duration Unit"
                              value={d.durationUnits}
                              onChange={(value) => updateDrugOrder(i, "durationUnits", value)}
                              options={[
                                { label: "Day(s)", value: "Day(s)" },
                                { label: "Week(s)", value: "Week(s)" },
                                { label: "Month(s)", value: "Month(s)" },
                              ]}
                            />
                          </div>
                          <div className="col-span-2 flex items-center gap-2 pt-5">
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                              <input type="checkbox" checked={d.asNeeded} onChange={(e) => updateDrugOrder(i, "asNeeded", e.target.checked)}
                                className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                              SOS / As Needed
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Additional Instructions</label>
                          <input type="text" value={d.instructions} onChange={(e) => updateDrugOrder(i, "instructions", e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-2.5 rounded-md outline-none text-sm" placeholder="e.g., After food, with water..." />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== LAB ORDERS TAB ===== */}
            {activeTab === "orders" && (
              <div className="space-y-6">
                <h3 className="text-slate-900 font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-xl">biotech</span>
                  Lab Orders
                </h3>

                {labLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="material-symbols-outlined text-slate-400 text-3xl animate-spin">progress_activity</span>
                  </div>
                ) : labPanels.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {labPanels.map((panel) => {
                      const isOrdered = labOrders.some((l) => l.concept.uuid === panel.uuid);
                      return (
                        <button
                          key={panel.uuid}
                          onClick={() => isOrdered ? removeLabOrder(labOrders.findIndex(l => l.concept.uuid === panel.uuid)) : addLabOrder(panel)}
                          className={`p-4 rounded-lg text-left text-sm font-medium transition-all border ${isOrdered
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-400"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-xl ${isOrdered ? "text-white" : "text-slate-400"}`}>{isOrdered ? "check_circle" : "add_circle_outline"}</span>
                            <span className="truncate">{panel.display}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-slate-500 font-medium text-sm text-center py-8">
                    Lab test panels could not be loaded from the server. Tests will still be saved if you add them manually.
                  </p>
                )}

                {/* Ordered lab tests */}
                {labOrders.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-slate-200">
                    <h4 className="text-slate-900 font-semibold text-sm uppercase tracking-wider mb-4">Ordered Tests ({labOrders.length})</h4>
                    <div className="space-y-2">
                      {labOrders.map((l, i) => (
                        <div key={i} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-slate-400 text-lg">science</span>
                            <span className="text-slate-900 font-medium text-sm">{l.concept.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <Dropdown
                              value={l.urgency}
                              onChange={(value) => {
                                const updated = [...labOrders];
                                updated[i].urgency = value;
                                setLabOrders(updated);
                              }}
                              options={[
                                { label: "Routine", value: "ROUTINE" },
                                { label: "Stat (Urgent)", value: "STAT", icon: "warning" },
                              ]}
                              className="w-[160px]"
                            />
                            <button onClick={() => removeLabOrder(i)} className="text-slate-400 hover:text-rose-600 transition-colors w-8 h-8 flex items-center justify-center rounded-md hover:bg-rose-50">
                              <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== DISPOSITION TAB ===== */}
            {activeTab === "disposition" && (
              <div className="space-y-6">
                <h3 className="text-slate-900 font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-xl">swap_horiz</span>
                  Disposition
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { code: "ADMIT", label: "Admit Patient", icon: "hotel" },
                    { code: "DISCHARGE", label: "Discharge", icon: "exit_to_app" },
                    { code: "TRANSFER", label: "Transfer", icon: "swap_horiz" },
                    { code: "REFER", label: "Refer", icon: "send" },
                  ].map((opt) => (
                    <button
                      key={opt.code}
                      onClick={() => setDispositionAction(dispositionAction === opt.code ? "" : opt.code)}
                      className={`p-5 rounded-lg flex flex-col items-center gap-2 transition-all border ${dispositionAction === opt.code
                        ? "bg-slate-900 border-slate-900 text-white"
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900"
                        }`}
                    >
                      <span className={`material-symbols-outlined text-2xl ${dispositionAction === opt.code ? "text-white" : "text-slate-400"}`}>{opt.icon}</span>
                      <span className="text-sm font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
                {dispositionAction && (
                  <div className="pt-4">
                    <label className="text-[10px] text-slate-500 font-semibold mb-2 block uppercase tracking-wider">Disposition Notes</label>
                    <textarea
                      value={dispositionNote}
                      onChange={(e) => setDispositionNote(e.target.value)}
                      rows={4}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-3.5 rounded-lg outline-none text-sm resize-none transition-colors"
                      placeholder="Add notes about the disposition..."
                    />
                  </div>
                )}
              </div>
            )}

            {/* ===== NOTES TAB ===== */}
            {activeTab === "notes" && (
              <div className="space-y-6">
                <h3 className="text-slate-900 font-semibold text-sm uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-xl">edit_note</span>
                  Consultation Notes
                </h3>
                <textarea
                  value={consultationNotes}
                  onChange={(e) => setConsultationNotes(e.target.value)}
                  rows={14}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-4 rounded-lg outline-none text-sm resize-none leading-relaxed transition-colors"
                  placeholder="Type your consultation notes here... These will be saved as part of the encounter."
                />
                <p className="text-slate-500 font-medium text-xs">
                  Notes are saved as observations under the Consultation Note concept.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Save Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-5xl bg-white/95 backdrop-blur-md border border-slate-200 rounded-lg p-4 flex items-center justify-between shadow-sm z-50">
        <div className="flex items-center gap-5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {diagnoses.length > 0 && <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] text-slate-400">diagnosis</span> {diagnoses.length} diagnosis(es)</span>}
          {drugOrders.length > 0 && <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] text-slate-400">medication</span> {drugOrders.length} medication(s)</span>}
          {labOrders.length > 0 && <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] text-slate-400">biotech</span> {labOrders.length} lab order(s)</span>}
          {dispositionAction && <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] text-slate-400">swap_horiz</span> {dispositionAction}</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-8 py-2.5 rounded-lg flex items-center gap-2 text-sm disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-lg animate-spin">progress_activity</span> Saving...</span>
          ) : (
            <span className="flex items-center gap-2"><span className="material-symbols-outlined text-lg">save</span> Save Consultation</span>
          )}
        </button>
      </div>
        </div>

        <aside className="mt-8 space-y-4 xl:mt-0 xl:sticky xl:top-8 xl:self-start">
          <ScribePanel
            layout="embedded"
            patientUuid={patientUuid}
            doctorUuid={provider?.uuid}
            onDraftAccepted={handleScribeAccepted}
          />
        </aside>
      </div>
    </div>
  );
}
