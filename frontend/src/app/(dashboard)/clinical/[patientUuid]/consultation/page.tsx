"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import Link from "next/link";
import ObservationForms, { type ObservationFormsHandle } from "@/components/clinical/ObservationForms";
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

type OrderSection = "laboratory" | "radiology";

type OrderConceptSearchResult = {
  uuid: string;
  display: string;
  conceptClass?: string;
};

const LAB_ORDER_CLASSES = new Set(["Test", "LabTest", "LabSet"]);
const RADIOLOGY_ORDER_CLASSES = new Set(["Radiology/Imaging Procedure"]);
const FALLBACK_PROVIDER_UUID = "f9badd80-ab76-11e2-9e96-0800200c9a66";

const ORDER_SEARCH_ALIASES: Record<string, string[]> = {
  WBC: ["White blood cells", "WBC"],
  Urea: ["Blood urea nitrogen", "Urea"],
  "Blood glucose": ["Fasting blood glucose measurement", "Blood glucose"],
  "Urine routine": ["Urinalysis", "Urine routine examination", "Urine analysis"],
  "Urine microscopy": ["Urine microscopy", "Microscopy of urine"],
  "Urine culture": ["Culture and sensitivity, urine", "Urine culture"],
  "Urine protein": ["Protein [presence] in urine", "Urine protein"],
  "Partial Thromboplastin Time": ["PTT", "Partial thromboplastin time"],
  "Ultrasound abdomen": ["Ultrasound, abdomen", "Ultrasound abdomen"],
  "Ultrasound pelvis": ["Ultrasound, pelvis", "Ultrasound pelvis"],
  "Obstetric ultrasound": ["Ultrasound, obstetric", "Obstetric ultrasound"],
  "Electrocardiogram": ["12-lead electrocardiogram", "Electrocardiogram", "ECG"],
  Echocardiogram: ["Echocardiogram", "Echocardiography"],
  "Treadmill test": ["Treadmill test", "Cardiac stress test"],
};

function normalizeOrderText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getAllowedOrderClasses(section: OrderSection, preferStrict = true) {
  if (section === "laboratory") {
    return LAB_ORDER_CLASSES;
  }
  return preferStrict
    ? RADIOLOGY_ORDER_CLASSES
    : new Set([...RADIOLOGY_ORDER_CLASSES, ...LAB_ORDER_CLASSES]);
}

function inferOrderSectionFromName(value: string): OrderSection {
  const normalized = normalizeOrderText(value);
  if (
    /(x ray|xray|ultrasound|ct|computed tomography|mri|magnetic resonance|radiography|echo|echocardiogram|electrocardiogram|ecg|treadmill)/.test(
      normalized
    )
  ) {
    return "radiology";
  }
  return "laboratory";
}

function scoreOrderConceptMatch(result: OrderConceptSearchResult, term: string) {
  const normalizedTerm = normalizeOrderText(term);
  const normalizedDisplay = normalizeOrderText(result.display);
  if (!normalizedDisplay) return -1;
  if (normalizedDisplay === normalizedTerm) return 100;
  if (normalizedDisplay.startsWith(normalizedTerm)) return 80;
  if (normalizedDisplay.includes(normalizedTerm)) return 60;
  const termWords = normalizedTerm.split(" ").filter(Boolean);
  const matchedWords = termWords.filter((word) => normalizedDisplay.includes(word)).length;
  return matchedWords > 0 ? matchedWords * 10 : -1;
}

const ORDER_CATALOG: Record<OrderSection, Record<string, string[]>> = {
  laboratory: {
    Blood: [
      "Complete blood count",
      "Platelets",
      "WBC",
      "Peripheral smear for RBC morphology",
      "Malarial smear",
      "Partial Thromboplastin Time",
      "INR",
      "Blood glucose",
      "Blood typing",
      "Culture and sensitivity, blood",
    ],
    Serum: [
      "Creatinine",
      "Urea",
      "Sodium",
      "Potassium",
      "Bilirubin (total)",
      "ALT",
      "AST",
      "Albumin",
      "Troponin T measurement",
      "HbA1c",
    ],
    Urine: [
      "Urine routine",
      "Urine microscopy",
      "Urine culture",
      "Urine pregnancy test",
      "Urine protein",
    ],
    Sputum: [
      "AFB test",
      "Gram stain",
      "Culture and sensitivity, sputum",
    ],
    Stool: [
      "Stool routine examination",
      "Stool occult blood",
      "Stool culture",
    ],
    Pus: [
      "Pus culture and sensitivity",
      "Gram stain",
      "Pus microscopy",
    ],
  },
  radiology: {
    "X-Ray": [
      "X-ray, chest",
      "Chest x-ray, single view",
      "Diagnostic radiography of chest, combined PA and lateral",
      "X-ray of unilateral ribs and single view chest",
      "X-ray of chest, 4 views, PA/LAT with right and left oblique",
    ],
    Ultrasound: [
      "Ultrasound scan",
      "Ultrasound abdomen",
      "Ultrasound pelvis",
      "Obstetric ultrasound",
    ],
    CT: [
      "Computed tomography of chest without contrast",
      "Computed tomography of chest with intravenous contrast",
      "Computed tomography of abdomen",
      "Computed tomography of head or brain",
    ],
    MRI: [
      "Magnetic resonance imaging of brain",
      "Magnetic resonance imaging of spine",
      "Magnetic resonance imaging of chest",
    ],
    Cardiology: [
      "Electrocardiogram",
      "Echocardiogram",
      "Treadmill test",
    ],
  },
};

export default function ConsultationPage() {
  const { authFetch, provider, locationUuid } = useAuth();
  const params = useParams();
  const patientUuid = params.patientUuid as string;

  const [activeTab, setActiveTab] = useState<ConsultationTab>("observations");
  const [patient, setPatient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: string; message: string } | null>(null);

  // --- Observation Forms ref ---
  const obsFormsRef = useRef<ObservationFormsHandle>(null);

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
  const [labSearchQuery, setLabSearchQuery] = useState("");
  const [labSearchResults, setLabSearchResults] = useState<OrderConceptSearchResult[]>([]);
  const [labSearching, setLabSearching] = useState(false);
  const [orderSection, setOrderSection] = useState<OrderSection>("laboratory");
  const [labCategory, setLabCategory] = useState<string>("Blood");
  const [radiologyCategory, setRadiologyCategory] = useState<string>("X-Ray");
  const [resolvingOrderName, setResolvingOrderName] = useState<string | null>(null);

  // --- Disposition state ---
  const [dispositionAction, setDispositionAction] = useState("");
  const [dispositionNote, setDispositionNote] = useState("");

  // --- Consultation Notes ---
  const [consultationNotes, setConsultationNotes] = useState("");

  // --- AI sidecar: chief complaint text for differential agent (separate from structured obs form) ---
  const [chiefComplaintForAi, setChiefComplaintForAi] = useState("");

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
      const res = await authFetch(
        `/openmrs/ws/rest/v1/drug?s=default&q=${encodeURIComponent(q)}&v=default&limit=15`
      );
      if (res.ok) {
        const data = await res.json();
        setDrugSearchResults(data.results || []);
        return;
      }

      const conceptRes = await authFetch(
        `/openmrs/ws/rest/v1/concept?q=${encodeURIComponent(q)}&limit=15&v=custom:(uuid,name,display)&class=Drug`
      );
      if (!conceptRes.ok) {
        setDrugSearchResults([]);
        return;
      }
      const conceptData = await conceptRes.json();
      setDrugSearchResults(
        (conceptData.results || []).map((item: any) => ({
          uuid: item.uuid,
          display: item.display || item.name?.display || "",
          name: item.name?.display || item.display || "",
        }))
      );
    } catch { setDrugSearchResults([]); }
    finally { setDrugSearching(false); }
  }, [authFetch]);

  useEffect(() => {
    const timer = setTimeout(() => searchDrugs(drugSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [drugSearchQuery, searchDrugs]);

  const runDrugSafetyCheck = useCallback(
    async (drugLabel: string) => {
      const name = (drugLabel || "").trim();
      if (!name || !patientUuid) return;
      try {
        await fetch(aiFetchUrl("/api/alerts/check-drug"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient_uuid: patientUuid,
            drug_name: name,
          }),
        });
      } catch (e) {
        console.error("Drug safety check failed:", e);
      }
    },
    [patientUuid]
  );

  const resolveDrugSuggestion = useCallback(
    async (name: string) => {
      if (!name.trim()) return null;
      try {
        const res = await authFetch(
          `/openmrs/ws/rest/v1/drug?s=default&q=${encodeURIComponent(name)}&v=default&limit=1`
        );
        if (res.ok) {
          const data = await res.json();
          return Array.isArray(data.results) ? data.results[0] || null : null;
        }
        const conceptRes = await authFetch(
          `/openmrs/ws/rest/v1/concept?q=${encodeURIComponent(name)}&limit=1&v=custom:(uuid,name,display)&class=Drug`
        );
        if (!conceptRes.ok) return null;
        const conceptData = await conceptRes.json();
        if (!Array.isArray(conceptData.results)) return null;
        const item = conceptData.results[0];
        return item
          ? {
              uuid: item.uuid,
              display: item.display || item.name?.display || "",
              name: item.name?.display || item.display || "",
            }
          : null;
      } catch {
        return null;
      }
    },
    [authFetch]
  );

  const resolveLabSuggestion = useCallback(
    async (name: string, preferredSection?: OrderSection) => {
      const baseName = name.trim();
      if (!baseName) return null;

      const section = preferredSection || inferOrderSectionFromName(baseName);
      const aliases = [baseName, ...(ORDER_SEARCH_ALIASES[baseName] || [])];

      try {
        const searchConcepts = async (term: string, strict = true) => {
          const res = await authFetch(
            `/openmrs/ws/rest/v1/concept?q=${encodeURIComponent(term)}&limit=15&v=custom:(uuid,display,name,conceptClass:(display))`
          );
          if (!res.ok) return [];
          const data = await res.json();
          const allowedClasses = getAllowedOrderClasses(section, strict);
          return (Array.isArray(data.results) ? data.results : [])
            .map((item: any) => ({
              uuid: item.uuid,
              display: item.display || item.name?.display || "",
              conceptClass: item.conceptClass?.display || "",
            }))
            .filter((item: OrderConceptSearchResult) => {
              if (!item.display || !item.conceptClass) return false;
              return allowedClasses.has(item.conceptClass);
            });
        };

        for (const alias of aliases) {
          const exactOrClose = await searchConcepts(alias, true);
          const ranked = exactOrClose
            .map((item) => ({ item, score: scoreOrderConceptMatch(item, alias) }))
            .filter(({ score }) => score >= 0)
            .sort((a, b) => b.score - a.score);
          if (ranked.length > 0) {
            return ranked[0].item;
          }
        }

        if (section === "radiology") {
          for (const alias of aliases) {
            const fallbackMatches = await searchConcepts(alias, false);
            const ranked = fallbackMatches
              .map((item) => ({ item, score: scoreOrderConceptMatch(item, alias) }))
              .filter(({ score }) => score >= 0)
              .sort((a, b) => b.score - a.score);
            if (ranked.length > 0) {
              return ranked[0].item;
            }
          }
        }

        return null;
      } catch {
        return null;
      }
    },
    [authFetch]
  );

  const resolveEncounterProviderUuid = useCallback(async () => {
    if (provider?.uuid) return provider.uuid;

    try {
      const sessionRes = await authFetch("/openmrs/ws/rest/v1/session");
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        if (sessionData.currentProvider?.uuid) {
          return sessionData.currentProvider.uuid as string;
        }

        const username =
          sessionData.user?.username || sessionData.user?.display || sessionData.user?.uuid || "";

        const providerRes = await authFetch("/openmrs/ws/rest/v1/provider?v=full&limit=50");
        if (providerRes.ok) {
          const providerData = await providerRes.json();
          const providers = Array.isArray(providerData.results) ? providerData.results : [];
          const matchedProvider = providers.find((item: any) => {
            const display = `${item.display || ""}`.toLowerCase();
            const person = `${item.person?.display || ""}`.toLowerCase();
            const normalizedUsername = `${username}`.toLowerCase();
            return normalizedUsername && (display.includes(normalizedUsername) || person.includes(normalizedUsername));
          });
          if (matchedProvider?.uuid) {
            return matchedProvider.uuid as string;
          }
        }
      }
    } catch {
      // Fall back to a valid provider UUID so orders can still be persisted.
    }

    return FALLBACK_PROVIDER_UUID;
  }, [authFetch, provider?.uuid]);

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

  const addDrugOrder = (drug: { uuid: string; name: string; display: string }) => {
    const label = drug.name || drug.display;
    setDrugOrders((prev) => [
      ...prev,
      { drug: { uuid: drug.uuid, name: label }, dose: "", doseUnits: "mg", route: "Oral", frequency: "Once a day", duration: "", durationUnits: "Day(s)", asNeeded: false, instructions: "" },
    ]);
    setDrugSearchQuery("");
    setDrugSearchResults([]);
    void runDrugSafetyCheck(label);
  };

  const updateDrugOrder = (index: number, field: string, value: any) => {
    setDrugOrders((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  };

  const removeDrugOrder = (index: number) => {
    setDrugOrders((prev) => prev.filter((_, i) => i !== index));
  };

  const addLabOrder = useCallback(
    (
      concept: { uuid: string; display: string; conceptClass?: string },
      meta?: { section?: "Laboratory" | "Radiology"; category?: string }
    ) => {
      setLabOrders((prev) => {
        if (prev.some((l) => l.concept.uuid === concept.uuid)) return prev;
        return [
          ...prev,
          {
            concept: { uuid: concept.uuid, name: concept.display, conceptClass: (concept as { conceptClass?: string }).conceptClass },
            urgency: "ROUTINE",
            section: meta?.section,
            category: meta?.category,
            requestedName: concept.display,
          },
        ];
      });
    },
    []
  );

  const removeLabOrder = (index: number) => {
    setLabOrders((prev) => prev.filter((_, i) => i !== index));
  };

  const searchLabConcepts = useCallback(async (q: string) => {
    if (q.length < 2) {
      setLabSearchResults([]);
      return;
    }
    setLabSearching(true);
    try {
      const res = await authFetch(
        `/openmrs/ws/rest/v1/concept?q=${encodeURIComponent(q)}&limit=20&v=custom:(uuid,display,name,conceptClass:(display))`
      );
      const data = await res.json();
      const allowedClasses = getAllowedOrderClasses(orderSection, false);
      const results = (data.results || [])
        .map((item: any) => ({
          uuid: item.uuid,
          display: item.display || item.name?.display || "",
          conceptClass: item.conceptClass?.display || "",
        }))
        .filter((item: OrderConceptSearchResult) => item.display && allowedClasses.has(item.conceptClass || ""))
        .sort((a: OrderConceptSearchResult, b: OrderConceptSearchResult) => {
          const scoreA = scoreOrderConceptMatch(a, q);
          const scoreB = scoreOrderConceptMatch(b, q);
          return scoreB - scoreA;
        });
      setLabSearchResults(results);
    } catch {
      setLabSearchResults([]);
    } finally {
      setLabSearching(false);
    }
  }, [authFetch, orderSection]);

  const addCatalogOrder = useCallback(
    async (displayName: string, section: "Laboratory" | "Radiology", category: string) => {
      setResolvingOrderName(displayName);
      try {
        const concept = await resolveLabSuggestion(
          displayName,
          section === "Radiology" ? "radiology" : "laboratory"
        );
        if (!concept) {
          setNotification({
            type: "error",
            message: `Could not resolve “${displayName}” to a Bahmni/OpenMRS concept.`,
          });
          return;
        }
        addLabOrder(
          {
            uuid: concept.uuid,
            display: concept.display || displayName,
            conceptClass: concept.conceptClass,
          },
          { section, category }
        );
      } finally {
        setResolvingOrderName(null);
      }
    },
    [addLabOrder, resolveLabSuggestion]
  );

  const currentOrderCategory = orderSection === "laboratory" ? labCategory : radiologyCategory;
  const currentOrderItems = ORDER_CATALOG[orderSection][currentOrderCategory] || [];
  const orderSearchNormalized = labSearchQuery.trim().toLowerCase();
  const filteredCatalogItems = orderSearchNormalized
    ? Object.entries(ORDER_CATALOG).flatMap(([sectionKey, categories]) =>
        Object.entries(categories).flatMap(([category, items]) =>
          items
            .filter((item) => item.toLowerCase().includes(orderSearchNormalized))
            .map((item) => ({
              item,
              section: sectionKey as OrderSection,
              category,
            }))
        )
      )
    : currentOrderItems.map((item) => ({
        item,
        section: orderSection,
        category: currentOrderCategory,
      }));

  useEffect(() => {
    const timer = setTimeout(() => searchLabConcepts(labSearchQuery), 300);
    return () => clearTimeout(timer);
  }, [labSearchQuery, searchLabConcepts]);

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
      const encounterProviderUuid = await resolveEncounterProviderUuid();

      const ordersPayload = labOrders.map((l) => ({
        concept: { uuid: l.concept.uuid },
        orderType:
          l.concept.conceptClass === "Radiology/Imaging Procedure" ||
          (!l.concept.conceptClass &&
            l.section === "Radiology" &&
            /(x ray|xray|ultrasound|ct|computed tomography|mri|magnetic resonance|radiography)/.test(
              normalizeOrderText(l.requestedName || l.concept.name)
            ))
            ? "Radiology Order"
            : "Lab Order",
        urgency: l.urgency,
      }));

      // Build disposition
      const dispositionPayload = dispositionAction
        ? { code: dispositionAction, additionalObs: dispositionNote ? [{ value: dispositionNote }] : [] }
        : undefined;

      // The big JSON — Bahmni coarse-grained save
      const encounterPayload: any = {
        patientUuid,
        encounterTypeUuid: "b9ccceaa-f496-11ed-b02c-0242ac150003", // Consultation encounter type
        locationUuid: locationUuid || "833d0c66-e29a-4d31-ac13-ca9050d1bfa9",
        providers: encounterProviderUuid ? [{ uuid: encounterProviderUuid }] : [],
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
          <p className="text-slate-400 text-sm">Loading consultation...</p>
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
    <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-4">
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-8 xl:items-start">
        <div className="min-w-0 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href={`/clinical/${patientUuid}`} className="text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-xl">arrow_back</span>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
              Consultation — {fullName}
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">
              ID: <span className="text-primary font-mono">{patientId}</span>
              {person?.gender && <> • {person.gender === "M" ? "Male" : "Female"}</>}
              {person?.age != null && <> • {person.age} yrs</>}
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="liquid-button text-background-dark font-bold px-6 py-3 rounded-xl flex items-center gap-2 text-sm disabled:opacity-50"
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
        <div className={`px-4 py-3 rounded-xl flex items-center gap-2 ${notification.type === "success" ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
          <span className={`material-symbols-outlined text-lg ${notification.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {notification.type === "success" ? "check_circle" : "error"}
          </span>
          <p className={`text-sm font-medium ${notification.type === "success" ? "text-green-400" : "text-red-400"}`}>{notification.message}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-xl">
        <div className="flex overflow-x-auto border-b border-white/5 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "text-primary border-b-2 border-primary bg-primary/5"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              {tab.label}
              {tab.key === "diagnoses" && diagnoses.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-bold">{diagnoses.length}</span>
              )}
              {tab.key === "medications" && drugOrders.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-bold">{drugOrders.length}</span>
              )}
              {tab.key === "orders" && labOrders.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full font-bold">{labOrders.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* ===== OBSERVATIONS TAB ===== */}
          {activeTab === "observations" && (
            <div className="space-y-6">
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <label className="mb-2 block text-xs font-medium text-slate-400">
                  Chief complaint (for AI differential suggestions)
                </label>
                <textarea
                  value={chiefComplaintForAi}
                  onChange={(e) => setChiefComplaintForAi(e.target.value)}
                  rows={3}
                  placeholder="Free-text chief complaint; used only by the AI sidecar…"
                  className="w-full resize-none rounded-xl border border-slate-700/50 bg-black/50 p-3 text-sm text-white outline-none focus:border-primary/50"
                />
                <DifferentialPanel
                  patientUuid={patientUuid}
                  chiefComplaint={chiefComplaintForAi}
                  onDiagnosisSelected={(diagnosis, _icd10) => {
                    setDiagnoses((prev) => [
                      ...prev,
                      {
                        codedAnswer: null,
                        freeTextAnswer: diagnosis,
                        order: "PRIMARY",
                        certainty: "PRESUMED",
                        isNew: true,
                      },
                    ]);
                    setActiveTab("diagnoses");
                  }}
                />
              </div>
              <ObservationForms ref={obsFormsRef} authFetch={authFetch} />
            </div>
          )}

          {/* ===== DIAGNOSES TAB ===== */}
          {activeTab === "diagnoses" && (
            <div className="space-y-6">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">diagnosis</span>
                Diagnoses
              </h3>

              {/* Search */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
                <input
                  type="text"
                  value={diagSearchQuery}
                  onChange={(e) => setDiagSearchQuery(e.target.value)}
                  placeholder="Search diagnosis (e.g., Malaria, Diabetes, Hypertension)..."
                  className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-3 pl-10 rounded-xl outline-none text-sm"
                />
                {diagSearching && (
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary text-lg animate-spin">progress_activity</span>
                )}
                {diagSearchResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {diagSearchResults.map((c) => (
                      <button
                        key={c.uuid}
                        onClick={() => addDiagnosis(c)}
                        className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors border-b border-white/5 last:border-0"
                      >
                        {c.display}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Added diagnoses */}
              {diagnoses.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No diagnoses added yet. Use the search above to add one.</p>
              ) : (
                <div className="space-y-3">
                  {diagnoses.map((d, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{d.codedAnswer?.name || d.freeTextAnswer}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <select
                            value={d.order}
                            onChange={(e) => {
                              const updated = [...diagnoses];
                              updated[i].order = e.target.value as "PRIMARY" | "SECONDARY";
                              setDiagnoses(updated);
                            }}
                            className="bg-black/50 border border-slate-700/50 text-white text-xs px-3 py-1.5 rounded-lg outline-none"
                          >
                            <option value="PRIMARY">Primary</option>
                            <option value="SECONDARY">Secondary</option>
                          </select>
                          <select
                            value={d.certainty}
                            onChange={(e) => {
                              const updated = [...diagnoses];
                              updated[i].certainty = e.target.value as "CONFIRMED" | "PRESUMED";
                              setDiagnoses(updated);
                            }}
                            className="bg-black/50 border border-slate-700/50 text-white text-xs px-3 py-1.5 rounded-lg outline-none"
                          >
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="PRESUMED">Presumed</option>
                          </select>
                        </div>
                      </div>
                      <button onClick={() => removeDiagnosis(i)} className="text-slate-500 hover:text-red-400 transition-colors">
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
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">medication</span>
                Medications
              </h3>

              <DrugSafetyAlertPanel patientUuid={patientUuid} doctorUuid={provider?.uuid} />

              {/* Drug Search */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
                <input
                  type="text"
                  value={drugSearchQuery}
                  onChange={(e) => setDrugSearchQuery(e.target.value)}
                  placeholder="Search for a medication (e.g., Paracetamol, Amoxicillin)..."
                  className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-3 pl-10 rounded-xl outline-none text-sm"
                />
                {drugSearching && (
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary text-lg animate-spin">progress_activity</span>
                )}
                {drugSearchResults.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                    {drugSearchResults.map((d) => (
                      <button
                        key={d.uuid}
                        onClick={() => addDrugOrder(d)}
                        className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors border-b border-white/5 last:border-0"
                      >
                        {d.display || d.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Drug Order Forms */}
              {drugOrders.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">No medications added yet. Search and add a drug above.</p>
              ) : (
                <div className="space-y-4">
                  {drugOrders.map((d, i) => (
                    <div key={i} className="p-5 bg-white/5 rounded-xl border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-white font-medium text-sm flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-lg">pill</span>
                          {d.drug?.name}
                        </h4>
                        <button onClick={() => removeDrugOrder(i)} className="text-slate-500 hover:text-red-400 transition-colors">
                          <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Dose</label>
                          <input type="number" value={d.dose} onChange={(e) => updateDrugOrder(i, "dose", e.target.value)}
                            className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-2.5 rounded-lg outline-none text-sm" placeholder="e.g., 500" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Units</label>
                          <select value={d.doseUnits} onChange={(e) => updateDrugOrder(i, "doseUnits", e.target.value)}
                            className="w-full bg-black/50 border border-slate-700/50 text-white p-2.5 rounded-lg outline-none text-sm">
                            <option>mg</option><option>ml</option><option>g</option><option>mcg</option><option>IU</option><option>Tablet(s)</option><option>Capsule(s)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Route</label>
                          <select value={d.route} onChange={(e) => updateDrugOrder(i, "route", e.target.value)}
                            className="w-full bg-black/50 border border-slate-700/50 text-white p-2.5 rounded-lg outline-none text-sm">
                            <option>Oral</option><option>Intravenous</option><option>Intramuscular</option><option>Subcutaneous</option><option>Topical</option><option>Inhalation</option><option>Rectal</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Frequency</label>
                          <select value={d.frequency} onChange={(e) => updateDrugOrder(i, "frequency", e.target.value)}
                            className="w-full bg-black/50 border border-slate-700/50 text-white p-2.5 rounded-lg outline-none text-sm">
                            <option>Once a day</option><option>Twice a day</option><option>Thrice a day</option><option>Four times a day</option><option>Every 6 hours</option><option>Every 8 hours</option><option>Every 12 hours</option><option>Immediately</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Duration</label>
                          <input type="number" value={d.duration} onChange={(e) => updateDrugOrder(i, "duration", e.target.value)}
                            className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-2.5 rounded-lg outline-none text-sm" placeholder="e.g., 5" />
                        </div>
                        <div>
                          <label className="text-xs text-slate-400 mb-1 block">Duration Unit</label>
                          <select value={d.durationUnits} onChange={(e) => updateDrugOrder(i, "durationUnits", e.target.value)}
                            className="w-full bg-black/50 border border-slate-700/50 text-white p-2.5 rounded-lg outline-none text-sm">
                            <option>Day(s)</option><option>Week(s)</option><option>Month(s)</option>
                          </select>
                        </div>
                        <div className="col-span-2 flex items-center gap-3 pt-5">
                          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                            <input type="checkbox" checked={d.asNeeded} onChange={(e) => updateDrugOrder(i, "asNeeded", e.target.checked)}
                              className="rounded border-slate-600 bg-black/50 text-primary w-4 h-4" />
                            SOS / As Needed
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Additional Instructions</label>
                        <input type="text" value={d.instructions} onChange={(e) => updateDrugOrder(i, "instructions", e.target.value)}
                          className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-2.5 rounded-lg outline-none text-sm" placeholder="e.g., After food, with water..." />
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
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">biotech</span>
                Orders
              </h3>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="min-w-0 space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setOrderSection("laboratory")}
                      className={`rounded-2xl border px-5 py-4 text-left transition-all ${
                        orderSection === "laboratory"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                      }`}
                    >
                      <div className="text-lg font-semibold">Laboratory</div>
                      <p className="mt-1 text-xs text-slate-400">Blood, serum, urine and microbiology orders</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderSection("radiology")}
                      className={`rounded-2xl border px-5 py-4 text-left transition-all ${
                        orderSection === "radiology"
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                      }`}
                    >
                      <div className="text-lg font-semibold">Radiology</div>
                      <p className="mt-1 text-xs text-slate-400">X-ray, ultrasound, CT, MRI and cardiac imaging</p>
                    </button>
                  </div>

                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
                    <input
                      type="text"
                      value={labSearchQuery}
                      onChange={(e) => setLabSearchQuery(e.target.value)}
                      placeholder="Search orders or concepts (e.g., CBC, platelets, chest x-ray, creatinine)..."
                      className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-3 pl-10 rounded-xl outline-none text-sm"
                    />
                    {labSearching && (
                      <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-primary text-lg animate-spin">progress_activity</span>
                    )}
                    {labSearchResults.length > 0 && (
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                        {labSearchResults.map((c) => (
                          <button
                            key={c.uuid}
                            onClick={() => {
                              addLabOrder(c, {
                                section: orderSection === "laboratory" ? "Laboratory" : "Radiology",
                                category: currentOrderCategory,
                              });
                              setLabSearchQuery("");
                              setLabSearchResults([]);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors border-b border-white/5 last:border-0"
                          >
                            <div className="font-medium">{c.display}</div>
                            {c.conceptClass && (
                              <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                                {c.conceptClass}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {orderSection === "laboratory" ? "Laboratory Sections" : "Radiology Sections"}
                      </div>
                      <div className="space-y-2">
                        {Object.keys(ORDER_CATALOG[orderSection]).map((category) => {
                          const active = currentOrderCategory === category;
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() =>
                                orderSection === "laboratory"
                                  ? setLabCategory(category)
                                  : setRadiologyCategory(category)
                              }
                              className={`w-full rounded-xl px-3 py-3 text-left text-sm transition-all ${
                                active
                                  ? "bg-primary/15 text-primary border border-primary/30"
                                  : "bg-white/5 text-slate-300 border border-white/5 hover:bg-white/10"
                              }`}
                            >
                              {category}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-white">{currentOrderCategory}</div>
                          <p className="text-xs text-slate-500">
                            Click a card to add it to selected orders. Save the consultation to persist the orders.
                          </p>
                        </div>
                        {resolvingOrderName && (
                          <div className="text-xs text-primary">Resolving {resolvingOrderName}…</div>
                        )}
                      </div>
                      {filteredCatalogItems.length === 0 ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
                          No matching catalog orders. Use the search box above to find a Bahmni/OpenMRS concept directly.
                        </div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                          {filteredCatalogItems.map(({ item, section, category }) => {
                            const isSelected = labOrders.some((order) =>
                              (order.requestedName || order.concept.name).toLowerCase() === item.toLowerCase()
                            );
                            return (
                              <button
                                key={`${section}-${category}-${item}`}
                                type="button"
                                onClick={() =>
                                  isSelected
                                    ? removeLabOrder(
                                        labOrders.findIndex(
                                          (order) =>
                                            (order.requestedName || order.concept.name).toLowerCase() === item.toLowerCase()
                                        )
                                      )
                                    : void addCatalogOrder(
                                        item,
                                        section === "laboratory" ? "Laboratory" : "Radiology",
                                        category
                                      )
                                }
                                className={`min-w-0 overflow-hidden rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                                  isSelected
                                    ? "border-primary/30 bg-primary/10 text-primary"
                                    : "border-white/10 bg-black/20 text-slate-200 hover:bg-white/10"
                                }`}
                              >
                                <div className="flex items-start gap-2">
                                  <span className="material-symbols-outlined text-base">
                                    {isSelected ? "check_circle" : "add_circle"}
                                  </span>
                                  <span className="min-w-0 break-words leading-5">{item}</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="xl:sticky xl:top-6">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-white">Selected Orders</div>
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                        {labOrders.length}
                      </span>
                    </div>
                    {labOrders.length === 0 ? (
                      <p className="text-sm text-slate-500">Selected orders are empty.</p>
                    ) : (
                      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                        {labOrders.map((l, i) => (
                          <div key={`${l.concept.uuid}-${i}`} className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white break-words">
                                  {l.requestedName || l.concept.name}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {l.section || "Order"}{l.category ? ` • ${l.category}` : ""}
                                </p>
                              </div>
                              <button
                                onClick={() => removeLabOrder(i)}
                                className="text-slate-500 hover:text-red-400 transition-colors"
                              >
                                <span className="material-symbols-outlined text-lg">close</span>
                              </button>
                            </div>
                            <select
                              value={l.urgency}
                              onChange={(e) => {
                                const updated = [...labOrders];
                                updated[i].urgency = e.target.value;
                                setLabOrders(updated);
                              }}
                              className="mt-3 w-full bg-black/50 border border-slate-700/50 text-white text-xs px-3 py-2 rounded-lg outline-none"
                            >
                              <option value="ROUTINE">Routine</option>
                              <option value="STAT">Stat (Urgent)</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== DISPOSITION TAB ===== */}
          {activeTab === "disposition" && (
            <div className="space-y-6">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">swap_horiz</span>
                Disposition
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { code: "ADMIT", label: "Admit Patient", icon: "hotel", color: "blue" },
                  { code: "DISCHARGE", label: "Discharge", icon: "exit_to_app", color: "green" },
                  { code: "TRANSFER", label: "Transfer", icon: "swap_horiz", color: "amber" },
                  { code: "REFER", label: "Refer", icon: "send", color: "purple" },
                ].map((opt) => (
                  <button
                    key={opt.code}
                    onClick={() => setDispositionAction(dispositionAction === opt.code ? "" : opt.code)}
                    className={`p-5 rounded-xl flex flex-col items-center gap-2 transition-all border ${
                      dispositionAction === opt.code
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    <span className="material-symbols-outlined text-2xl">{opt.icon}</span>
                    <span className="text-sm font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
              {dispositionAction && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Disposition Notes</label>
                  <textarea
                    value={dispositionNote}
                    onChange={(e) => setDispositionNote(e.target.value)}
                    rows={3}
                    className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-3 rounded-xl outline-none text-sm resize-none"
                    placeholder="Add notes about the disposition..."
                  />
                </div>
              )}
            </div>
          )}

          {/* ===== NOTES TAB ===== */}
          {activeTab === "notes" && (
            <div className="space-y-6">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">edit_note</span>
                Consultation Notes
              </h3>
              <textarea
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                rows={12}
                className="w-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-4 rounded-xl outline-none text-sm resize-none leading-relaxed"
                placeholder="Type your consultation notes here... These will be saved as part of the encounter."
              />
              <p className="text-slate-500 text-xs">
                Notes are saved as observations under the Consultation Note concept.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Floating Save Bar */}
      <div className="sticky bottom-4 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {diagnoses.length > 0 && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm text-primary">diagnosis</span> {diagnoses.length} diagnosis(es)</span>}
          {drugOrders.length > 0 && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm text-primary">medication</span> {drugOrders.length} medication(s)</span>}
          {labOrders.length > 0 && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm text-primary">biotech</span> {labOrders.length} lab order(s)</span>}
          {dispositionAction && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm text-primary">swap_horiz</span> {dispositionAction}</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="liquid-button text-background-dark font-bold px-8 py-3 rounded-xl flex items-center gap-2 text-sm disabled:opacity-50"
        >
          {saving ? (
            <><span className="material-symbols-outlined text-lg animate-spin">progress_activity</span> Saving...</>
          ) : (
            <><span className="material-symbols-outlined text-lg">save</span> Save Consultation</>
          )}
        </button>
      </div>
        </div>

        <aside className="mt-8 space-y-4 xl:mt-0 xl:sticky xl:top-24 xl:self-start">
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
