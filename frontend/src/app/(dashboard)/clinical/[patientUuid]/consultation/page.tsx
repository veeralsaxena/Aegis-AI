"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import ObservationForms, { type ObservationFormsHandle } from "@/components/clinical/ObservationForms";

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
  concept: { uuid: string; name: string };
  urgency: string;
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
      const res = await authFetch(`/openmrs/ws/rest/v1/drug?q=${encodeURIComponent(q)}&v=default&limit=15`);
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
        ? { code: dispositionAction, additionalObs: dispositionNote ? [{ value: dispositionNote }] : [] }
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
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
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
            <ObservationForms ref={obsFormsRef} authFetch={authFetch} />
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
                Lab Orders
              </h3>

              {labLoading ? (
                <div className="flex items-center justify-center py-8">
                  <span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span>
                </div>
              ) : labPanels.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {labPanels.map((panel) => {
                    const isOrdered = labOrders.some((l) => l.concept.uuid === panel.uuid);
                    return (
                      <button
                        key={panel.uuid}
                        onClick={() => isOrdered ? removeLabOrder(labOrders.findIndex(l => l.concept.uuid === panel.uuid)) : addLabOrder(panel)}
                        className={`p-4 rounded-xl text-left text-sm transition-all border ${
                          isOrdered
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-lg">{isOrdered ? "check_circle" : "add_circle_outline"}</span>
                          <span className="truncate">{panel.display}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center py-6">
                  Lab test panels could not be loaded from the server. Tests will still be saved if you add them manually.
                </p>
              )}

              {/* Ordered lab tests */}
              {labOrders.length > 0 && (
                <div>
                  <h4 className="text-white font-medium text-sm mb-3">Ordered Tests ({labOrders.length})</h4>
                  <div className="space-y-2">
                    {labOrders.map((l, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/20">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary text-lg">science</span>
                          <span className="text-white text-sm">{l.concept.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <select
                            value={l.urgency}
                            onChange={(e) => {
                              const updated = [...labOrders];
                              updated[i].urgency = e.target.value;
                              setLabOrders(updated);
                            }}
                            className="bg-black/50 border border-slate-700/50 text-white text-xs px-3 py-1.5 rounded-lg outline-none"
                          >
                            <option value="ROUTINE">Routine</option>
                            <option value="STAT">Stat (Urgent)</option>
                          </select>
                          <button onClick={() => removeLabOrder(i)} className="text-slate-500 hover:text-red-400 transition-colors">
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
  );
}
