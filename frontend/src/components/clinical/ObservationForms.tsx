"use client";

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";

/* ------------------------------------------------------------------ */
/*  TYPE DEFINITIONS                                                   */
/* ------------------------------------------------------------------ */

interface FormField {
  id: string;
  label: string;
  type: "number" | "text" | "textarea" | "date" | "autocomplete" | "buttonGroup";
  conceptUuid?: string;
  conceptName?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  unit?: string;
}

interface FormSection {
  id: string;
  title: string;
  collapsible?: boolean;
  fields: FormField[];
}

interface FormDefinition {
  id: string;
  name: string;
  icon: string;
  isDefault?: boolean;
  sections: FormSection[];
}

interface ActiveFormInstance {
  formId: string;
  isPinned: boolean;
  isExpanded: boolean;
}

export interface ObservationFormsHandle {
  getObservations: () => any[];
}

interface ObservationFormsProps {
  authFetch: (url: string, options?: any) => Promise<Response>;
}

/* ------------------------------------------------------------------ */
/*  FORM REGISTRY — defines every available observation form           */
/* ------------------------------------------------------------------ */

const FORM_REGISTRY: FormDefinition[] = [
  /* ─── Vitals ─── */
  {
    id: "vitals",
    name: "Vitals",
    icon: "vital_signs",
    isDefault: true,
    sections: [
      {
        id: "vitals-main",
        title: "Vital Signs",
        fields: [
          { id: "pulse", label: "Pulse (beats/min)", type: "number", conceptUuid: "5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", placeholder: "72" },
          { id: "spo2", label: "SpO2 (%)", type: "number", conceptUuid: "5092AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", placeholder: "98" },
          { id: "resp_rate", label: "Respiratory Rate", type: "number", conceptUuid: "5242AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", placeholder: "16" },
          { id: "temperature", label: "Temperature (°F)", type: "number", conceptUuid: "5088AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", placeholder: "98.6" },
        ],
      },
      {
        id: "vitals-bp",
        title: "Blood Pressure",
        collapsible: true,
        fields: [
          { id: "systolic", label: "Systolic BP (mmHg)", type: "number", conceptUuid: "5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", placeholder: "120" },
          { id: "diastolic", label: "Diastolic BP (mmHg)", type: "number", conceptUuid: "5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", placeholder: "80" },
          {
            id: "body_position",
            label: "Body Position",
            type: "buttonGroup",
            conceptName: "Body position",
            options: [
              { value: "sitting", label: "Sitting" },
              { value: "recumbent", label: "Recumbent" },
              { value: "standing", label: "Standing" },
              { value: "unknown", label: "Unknown" },
              { value: "other", label: "Other" },
              { value: "fowlers", label: "Fowler's Position" },
            ],
          },
        ],
      },
      {
        id: "vitals-measurements",
        title: "Measurements",
        collapsible: true,
        fields: [
          { id: "height", label: "Height (cm)", type: "number", conceptUuid: "5090AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", placeholder: "170" },
          { id: "weight", label: "Weight (kg)", type: "number", conceptUuid: "5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", placeholder: "70" },
        ],
      },
    ],
  },

  /* ─── History and Examination ─── */
  {
    id: "history_examination",
    name: "History and Examination",
    icon: "clinical_notes",
    isDefault: true,
    sections: [
      {
        id: "chief-complaint",
        title: "Chief Complaint Data",
        collapsible: true,
        fields: [
          { id: "chief_complaint", label: "Chief Complaint", type: "autocomplete", conceptName: "Chief Complaint", placeholder: "Search complaints…" },
          { id: "symptom_duration", label: "Sign/symptom duration", type: "number", conceptName: "Sign/symptom duration", placeholder: "e.g. 3" },
          {
            id: "duration_units",
            label: "Units",
            type: "buttonGroup",
            conceptName: "Duration Units",
            options: [
              { value: "Hours", label: "Hours" },
              { value: "Days", label: "Days" },
              { value: "Weeks", label: "Weeks" },
              { value: "Months", label: "Months" },
              { value: "Years", label: "Years" },
            ],
          },
        ],
      },
      {
        id: "history",
        title: "History",
        fields: [
          { id: "present_illness", label: "History of present illness", type: "textarea", conceptName: "History of present illness", placeholder: "Describe the history of the presenting complaint…" },
        ],
      },
      {
        id: "smoking",
        title: "Smoking Status",
        fields: [
          {
            id: "smoking_status",
            label: "Smoking status",
            type: "buttonGroup",
            conceptName: "Smoking status",
            options: [
              { value: "Unknown if ever smoked", label: "Unknown if ever smoked" },
              { value: "Current every day smoker", label: "Current every day smoker" },
              { value: "Former smoker", label: "Former smoker" },
              { value: "Current light tobacco smoker", label: "Current light tobacco smoker" },
              { value: "Current heavy tobacco smoker", label: "Current heavy tobacco smoker" },
              { value: "Smoker", label: "Smoker" },
              { value: "Current some day smoker", label: "Current some day smoker" },
              { value: "Never smoker", label: "Never smoker" },
            ],
          },
        ],
      },
    ],
  },

  /* ─── Follow Up ─── */
  {
    id: "follow_up",
    name: "Follow Up",
    icon: "event_upcoming",
    isDefault: true,
    sections: [
      {
        id: "follow-up-main",
        title: "Follow-up Details",
        fields: [
          { id: "return_visit_date", label: "Return visit date", type: "date", conceptName: "Return visit date" },
          { id: "reason_for_visit", label: "Reason for visit", type: "textarea", conceptName: "Reason for visit", placeholder: "Enter the reason for the follow-up visit…" },
        ],
      },
    ],
  },

  /* ─── Generic Template Forms (available via "Add New Obs Form") ─── */
  ...[
    "Admission Letter",
    "Death Note",
    "Diabetes Intake",
    "Diabetes Progress",
    "Hypertension Intake",
    "Hypertension Progress",
    "Immunization Incident Record",
    "Malaria",
    "Obstetrics and Gynaecology",
    "Orthopaedic Examination",
    "Referral letter",
    "Registration Details",
    "Second Vitals",
    "Under Treatment and Fitness Certificate",
  ].map((name) => ({
    id: name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
    name,
    icon: "description",
    isDefault: false,
    sections: [
      {
        id: `${name.toLowerCase().replace(/\s+/g, "-")}-notes`,
        title: name,
        fields: [
          {
            id: "notes",
            label: `${name} Notes`,
            type: "textarea" as const,
            conceptName: name,
            placeholder: `Enter ${name.toLowerCase()} details…`,
          },
        ],
      },
    ],
  })),
];

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

const ObservationForms = forwardRef<ObservationFormsHandle, ObservationFormsProps>(
  function ObservationForms({ authFetch }, ref) {
    /* ── state ── */
    const [activeForms, setActiveForms] = useState<ActiveFormInstance[]>(() =>
      FORM_REGISTRY.filter((f) => f.isDefault).map((f) => ({
        formId: f.id,
        isPinned: false,
        isExpanded: true,
      }))
    );
    const [formData, setFormData] = useState<Record<string, Record<string, any>>>({});
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showFormPicker, setShowFormPicker] = useState(false);
    const [formSearchQuery, setFormSearchQuery] = useState("");
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

    // Chief complaint autocomplete
    const [ccQuery, setCcQuery] = useState("");
    const [ccResults, setCcResults] = useState<{ uuid: string; display: string }[]>([]);
    const [ccSearching, setCcSearching] = useState(false);
    const [activeAutocomplete, setActiveAutocomplete] = useState<string | null>(null);

    const formRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const pickerRef = useRef<HTMLDivElement | null>(null);

    /* ── expose getObservations() to parent via ref ── */
    useImperativeHandle(
      ref,
      () => ({
        getObservations: () => {
          const observations: any[] = [];
          for (const instance of activeForms) {
            const formDef = FORM_REGISTRY.find((f) => f.id === instance.formId);
            if (!formDef) continue;
            const data = formData[instance.formId] || {};
            for (const section of formDef.sections) {
              for (const field of section.fields) {
                const value = data[field.id];
                if (value === undefined || value === "" || value === null) continue;
                const conceptRef = field.conceptUuid
                  ? { uuid: field.conceptUuid }
                  : field.conceptName
                  ? { name: field.conceptName }
                  : null;
                if (!conceptRef) continue;
                observations.push({
                  concept: conceptRef,
                  value: field.type === "number" ? parseFloat(value) : value,
                });
              }
            }
          }
          return observations;
        },
      }),
      [activeForms, formData]
    );

    /* ── field updater ── */
    const updateField = useCallback((formId: string, fieldId: string, value: any) => {
      setFormData((prev) => ({
        ...prev,
        [formId]: { ...(prev[formId] || {}), [fieldId]: value },
      }));
    }, []);

    /* ── form management ── */
    const addForm = (formId: string) => {
      if (activeForms.some((f) => f.formId === formId)) return;
      setActiveForms((prev) => [...prev, { formId, isPinned: false, isExpanded: true }]);
      setShowFormPicker(false);
      setFormSearchQuery("");
      // scroll after render
      setTimeout(() => formRefs.current[formId]?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    };

    const removeForm = (formId: string) => {
      setActiveForms((prev) => prev.filter((f) => f.formId !== formId));
      // clean up data
      setFormData((prev) => {
        const next = { ...prev };
        delete next[formId];
        return next;
      });
    };

    const togglePin = (formId: string) => {
      setActiveForms((prev) =>
        prev.map((f) => (f.formId === formId ? { ...f, isPinned: !f.isPinned } : f))
      );
    };

    const toggleExpand = (formId: string) => {
      setActiveForms((prev) =>
        prev.map((f) => (f.formId === formId ? { ...f, isExpanded: !f.isExpanded } : f))
      );
    };

    const toggleSection = (sectionId: string) => {
      setCollapsedSections((prev) => {
        const next = new Set(prev);
        if (next.has(sectionId)) next.delete(sectionId);
        else next.add(sectionId);
        return next;
      });
    };

    const scrollToForm = (formId: string) => {
      formRefs.current[formId]?.scrollIntoView({ behavior: "smooth", block: "start" });
      // close sidebar on mobile
      if (window.innerWidth < 768) setSidebarOpen(false);
    };

    /* ── chief complaint autocomplete ── */
    const searchConcepts = useCallback(
      async (q: string) => {
        if (q.length < 2) {
          setCcResults([]);
          return;
        }
        setCcSearching(true);
        try {
          const res = await authFetch(
            `/openmrs/ws/rest/v1/concept?q=${encodeURIComponent(q)}&limit=10&v=custom:(uuid,display)`
          );
          const data = await res.json();
          setCcResults(data.results || []);
        } catch {
          setCcResults([]);
        } finally {
          setCcSearching(false);
        }
      },
      [authFetch]
    );

    useEffect(() => {
      const t = setTimeout(() => searchConcepts(ccQuery), 300);
      return () => clearTimeout(t);
    }, [ccQuery, searchConcepts]);

    /* ── close picker on outside click ── */
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
          setShowFormPicker(false);
        }
      };
      if (showFormPicker) document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [showFormPicker]);

    /* ── sorting: pinned forms first ── */
    const sortedForms = [...activeForms].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

    const filteredPickerForms = FORM_REGISTRY.filter(
      (f) =>
        !activeForms.some((af) => af.formId === f.id) &&
        f.name.toLowerCase().includes(formSearchQuery.toLowerCase())
    );

    /* ── field renderer ── */
    const renderField = (formId: string, field: FormField) => {
      const value = formData[formId]?.[field.id] ?? "";

      switch (field.type) {
        case "number":
          return (
            <div key={field.id}>
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 block">{field.label}</label>
              <input
                type="number"
                value={value}
                onChange={(e) => updateField(formId, field.id, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-3 rounded-lg outline-none text-sm transition-colors placeholder:text-slate-400"
                placeholder={field.placeholder || "—"}
              />
            </div>
          );

        case "text":
          return (
            <div key={field.id}>
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 block">{field.label}</label>
              <input
                type="text"
                value={value}
                onChange={(e) => updateField(formId, field.id, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-3 rounded-lg outline-none text-sm transition-colors placeholder:text-slate-400"
                placeholder={field.placeholder || ""}
              />
            </div>
          );

        case "textarea":
          return (
            <div key={field.id} className="col-span-full">
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 block">{field.label}</label>
              <textarea
                value={value}
                onChange={(e) => updateField(formId, field.id, e.target.value)}
                rows={4}
                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-3 rounded-lg outline-none text-sm resize-none transition-colors placeholder:text-slate-400 leading-relaxed"
                placeholder={field.placeholder || ""}
              />
            </div>
          );

        case "date":
          return (
            <div key={field.id}>
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 block">{field.label}</label>
              <input
                type="date"
                value={value}
                onChange={(e) => updateField(formId, field.id, e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-3 rounded-lg outline-none text-sm transition-colors"
              />
            </div>
          );

        case "autocomplete":
          return (
            <div key={field.id} className="relative col-span-full">
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 block">{field.label}</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                <input
                  type="text"
                  value={activeAutocomplete === `${formId}.${field.id}` ? ccQuery : value || ""}
                  onChange={(e) => {
                    setActiveAutocomplete(`${formId}.${field.id}`);
                    setCcQuery(e.target.value);
                  }}
                  onFocus={() => setActiveAutocomplete(`${formId}.${field.id}`)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-3 pl-10 rounded-lg outline-none text-sm transition-colors placeholder:text-slate-400"
                  placeholder={field.placeholder || "Search…"}
                />
                {ccSearching && activeAutocomplete === `${formId}.${field.id}` && (
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-base animate-spin">
                    progress_activity
                  </span>
                )}
              </div>
              {activeAutocomplete === `${formId}.${field.id}` && ccResults.length > 0 && (
                <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {ccResults.map((c) => (
                    <button
                      key={c.uuid}
                      onClick={() => {
                        updateField(formId, field.id, c.display);
                        setCcQuery("");
                        setCcResults([]);
                        setActiveAutocomplete(null);
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors border-b border-slate-100 last:border-0"
                    >
                      {c.display}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );

        case "buttonGroup":
          return (
            <div key={field.id} className="col-span-full">
              <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2 block">{field.label}</label>
              <div className="flex flex-wrap gap-2">
                {(field.options || []).map((opt) => {
                  const isSelected = value === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => updateField(formId, field.id, isSelected ? "" : opt.value)}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all ${
                        isSelected
                          ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                          : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      {isSelected && (
                        <span className="material-symbols-outlined text-xs mr-1 align-middle">check</span>
                      )}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          );

        default:
          return null;
      }
    };

    /* ── render ── */
    return (
      <div className="flex gap-0 min-h-[400px] relative">
        {/* ════════════════════════════════════════════
            SIDEBAR — lists active observation forms
            Uses conditional render to avoid overflow-hidden
            which breaks CSS position:sticky
        ════════════════════════════════════════════ */}
        {sidebarOpen && (
          <div className="w-48 lg:w-52 flex-shrink-0 mr-3 lg:mr-4">
            <div className="sticky top-4 bg-white border border-slate-200 rounded-xl shadow-sm py-2 max-h-[calc(100vh-120px)] overflow-y-auto">
              <div className="px-3 py-2 border-b border-slate-200 mb-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Active Forms</p>
              </div>
              {sortedForms.map((instance) => {
                const formDef = FORM_REGISTRY.find((f) => f.id === instance.formId);
                if (!formDef) return null;
                return (
                  <button
                    key={instance.formId}
                    onClick={() => scrollToForm(instance.formId)}
                    className="w-full text-left px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center gap-2 group"
                  >
                    {instance.isPinned && (
                      <span className="material-symbols-outlined text-xs text-slate-400">push_pin</span>
                    )}
                    <span className="material-symbols-outlined text-base text-slate-400 group-hover:text-slate-900 transition-colors">
                      {formDef.icon}
                    </span>
                    <span className="truncate">{formDef.name}</span>
                  </button>
                );
              })}
              {activeForms.length === 0 && (
                <p className="text-xs text-slate-500 px-3 py-4 text-center">No forms active</p>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════
            MAIN CONTENT — form cards
        ════════════════════════════════════════════ */}
        <div className="flex-1 space-y-4">
          {/* ── Top toolbar ── */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title={sidebarOpen ? "Hide sidebar" : "Show form navigation"}
            >
              <span className="material-symbols-outlined text-xl">
                {sidebarOpen ? "left_panel_close" : "left_panel_open"}
              </span>
            </button>

            <div className="relative" ref={pickerRef}>
              <button
                onClick={() => setShowFormPicker(!showFormPicker)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium px-5 py-2.5 rounded-lg flex items-center gap-2 text-sm transition-colors"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Add New Obs Form
              </button>

              {/* ── Form Picker Dropdown ── */}
              {showFormPicker && (
                <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[380px] md:w-[480px] max-h-[420px] bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                  {/* Search bar */}
                  <div className="p-3 border-b border-slate-200">
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
                      <input
                        type="text"
                        value={formSearchQuery}
                        onChange={(e) => setFormSearchQuery(e.target.value)}
                        placeholder="Search Obs Form"
                        className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 p-2.5 pl-10 rounded-lg outline-none text-sm placeholder:text-slate-400"
                        autoFocus
                      />
                    </div>
                  </div>
                  {/* Form grid */}
                  <div className="p-3 overflow-y-auto max-h-[340px] grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {filteredPickerForms.map((form) => (
                      <button
                        key={form.id}
                        onClick={() => addForm(form.id)}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-left text-xs text-slate-600 font-semibold hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 transition-all"
                      >
                        <span className="material-symbols-outlined text-base mb-1 block text-slate-400">{form.icon}</span>
                        {form.name}
                      </button>
                    ))}
                    {filteredPickerForms.length === 0 && (
                      <p className="col-span-3 text-center text-slate-500 text-xs py-4">
                        {formSearchQuery ? "No forms match your search" : "All forms are already active"}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Form Cards ── */}
          {sortedForms.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-symbols-outlined text-5xl text-black/20 mb-4">note_add</span>
              <p className="text-black/60 font-bold text-sm">No observation forms active.</p>
              <p className="text-black/40 text-xs mt-1">
                Click <strong className="text-blue-600">Add New Obs Form</strong> to get started.
              </p>
            </div>
          )}

          {sortedForms.map((instance) => {
            const formDef = FORM_REGISTRY.find((f) => f.id === instance.formId);
            if (!formDef) return null;

            return (
              <div
                key={instance.formId}
                ref={(el) => { formRefs.current[instance.formId] = el; }}
                className={`bg-white border rounded-xl overflow-hidden transition-all shadow-sm ${
                  instance.isPinned ? "border-slate-400" : "border-slate-200"
                }`}
              >
                {/* ── Card Header ── */}
                <div className="flex items-center justify-between px-5 py-4 bg-white border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-slate-400 text-xl">{formDef.icon}</span>
                    <h3 className="text-slate-900 font-semibold uppercase tracking-wider text-sm">{formDef.name}</h3>
                    {instance.isPinned && (
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md font-semibold border border-slate-200">
                        PINNED
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Expand / Collapse all sections */}
                    <button
                      onClick={() => toggleExpand(instance.formId)}
                      className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                      title={instance.isExpanded ? "Collapse" : "Expand"}
                    >
                      <span className="material-symbols-outlined text-xl">
                        {instance.isExpanded ? "unfold_less" : "unfold_more"}
                      </span>
                    </button>
                    {/* Pin / Unpin */}
                    <button
                      onClick={() => togglePin(instance.formId)}
                      className={`p-2 rounded-lg transition-colors ${
                        instance.isPinned
                          ? "text-slate-900 bg-slate-100 hover:bg-slate-200"
                          : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                      title={instance.isPinned ? "Unpin" : "Pin to top"}
                    >
                      <span className="material-symbols-outlined text-xl">push_pin</span>
                    </button>
                    {/* Remove */}
                    <button
                      onClick={() => removeForm(instance.formId)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove form"
                    >
                      <span className="material-symbols-outlined text-xl">delete</span>
                    </button>
                  </div>
                </div>

                {/* ── Card Body — sections ── */}
                {instance.isExpanded && (
                  <div className="p-5 space-y-6">
                    {formDef.sections.map((section) => {
                      const isCollapsed = collapsedSections.has(section.id);
                      return (
                        <div key={section.id}>
                          {/* Section header */}
                          {section.collapsible ? (
                            <button
                              onClick={() => toggleSection(section.id)}
                              className="flex items-center gap-2 mb-4 group"
                            >
                              <span className="material-symbols-outlined text-base text-slate-400 transition-transform group-hover:text-slate-900" style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
                                expand_more
                              </span>
                              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider group-hover:text-slate-900 transition-colors">
                                {section.title}
                              </span>
                            </button>
                          ) : (
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                              <span className="w-1.5 h-4 bg-slate-300 rounded-full inline-block"></span>
                              {section.title}
                            </p>
                          )}

                          {/* Section fields */}
                          {!isCollapsed && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-1">
                              {section.fields.map((field) => renderField(instance.formId, field))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

export default ObservationForms;
