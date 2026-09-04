"use client";

import { useState } from "react";
import { aiFetchUrl } from "@/lib/aiAgentBaseUrl";

interface Differential {
  rank: number;
  diagnosis: string;
  icd10_code?: string;
  confidence: string;
  reasoning: string;
  red_flags: string;
  recommended_investigations: string;
}

interface DifferentialPanelProps {
  patientUuid: string;
  chiefComplaint: string;
  encounterUuid?: string;
  onDiagnosisSelected: (diagnosis: string, icd10: string) => void;
}

export function DifferentialPanel({
  patientUuid,
  chiefComplaint,
  encounterUuid,
  onDiagnosisSelected,
}: DifferentialPanelProps) {
  const [differentials, setDifferentials] = useState<Differential[]>([]);
  const [clinicalNote, setClinicalNote] = useState("");
  const [suggestionId, setSuggestionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const fetchSuggestions = async () => {
    if (!chiefComplaint || chiefComplaint.length < 5) return;
    setLoading(true);
    setVisible(true);
    setFetchError("");
    try {
      const res = await fetch(aiFetchUrl("/api/differential/suggest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_uuid: patientUuid,
          chief_complaint: chiefComplaint,
          encounter_uuid: encounterUuid,
        }),
      });
      const raw = await res.text();
      if (!res.ok) {
        let msg = raw;
        try {
          const j = JSON.parse(raw) as { detail?: string | unknown };
          if (typeof j.detail === "string") msg = j.detail;
          else if (Array.isArray(j.detail)) msg = j.detail.map((x) => JSON.stringify(x)).join("; ");
        } catch {
          /* keep raw */
        }
        throw new Error(msg.slice(0, 500));
      }
      const data = JSON.parse(raw) as {
        differentials?: Differential[];
        clinical_note?: string;
        suggestion_id?: string;
      };
      setDifferentials(data.differentials || []);
      setClinicalNote(data.clinical_note || "");
      setSuggestionId(data.suggestion_id || null);
    } catch (e) {
      setDifferentials([]);
      setClinicalNote("");
      setSuggestionId(null);
      setFetchError(
        e instanceof Error
          ? e.message
          : "Could not load suggestions. Ensure ai-agents is running and GOOGLE_API_KEY is set in ai-agents/.env."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (diff: Differential) => {
    onDiagnosisSelected(diff.diagnosis, diff.icd10_code || "");
    if (suggestionId) {
      await fetch(aiFetchUrl(`/api/differential/${suggestionId}/select`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selected_diagnosis: diff.diagnosis }),
      });
    }
    setVisible(false);
  };

  const handleDismiss = async () => {
    if (suggestionId) {
      await fetch(aiFetchUrl(`/api/differential/${suggestionId}/dismiss`), { method: "PATCH" });
    }
    setVisible(false);
    setDifferentials([]);
    setFetchError("");
  };

  const confStyles: Record<string, string> = {
    High: "bg-emerald-500/15 text-emerald-300",
    Medium: "bg-amber-500/15 text-amber-200",
    Med: "bg-amber-500/15 text-amber-200",
    Low: "bg-slate-500/15 text-slate-400",
  };

  return (
    <div className="mt-4 space-y-2">
      <button
        type="button"
        onClick={fetchSuggestions}
        disabled={loading || chiefComplaint.length < 5}
        className="rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-xs font-medium text-indigo-200 disabled:opacity-40"
      >
        {loading ? "Generating…" : "Suggest differential diagnoses"}
      </button>
      {chiefComplaint.length < 5 && (
        <p className="text-[10px] text-slate-500">Enter at least 5 characters in chief complaint.</p>
      )}

      {visible && !loading && fetchError && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100 whitespace-pre-wrap break-words">
          {fetchError}
        </div>
      )}

      {visible && !loading && differentials.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-slate-900/60">
          <div className="flex items-center justify-between border-b border-white/5 bg-indigo-500/10 px-3 py-2">
            <span className="text-xs font-semibold text-indigo-200">AI differential suggestions</span>
            <button type="button" onClick={handleDismiss} className="text-[10px] text-slate-400 hover:text-white">
              Dismiss
            </button>
          </div>
          {clinicalNote && (
            <div className="border-b border-white/5 bg-black/20 px-3 py-2 text-[11px] text-slate-400">
              {clinicalNote}
            </div>
          )}
          {differentials.map((diff) => (
            <div key={diff.rank} className="border-b border-white/5 last:border-0">
              <div className="flex w-full items-start gap-3 px-3 py-3 hover:bg-white/5">
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === diff.rank ? null : diff.rank)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-200">
                    {diff.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white">
                      {diff.diagnosis}
                      {diff.icd10_code ? (
                        <span className="ml-2 font-mono text-[10px] text-slate-500">{diff.icd10_code}</span>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      confStyles[diff.confidence] || confStyles.Low
                    }`}
                  >
                    {diff.confidence}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect(diff)}
                  className="shrink-0 rounded-lg bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white"
                >
                  Set diagnosis
                </button>
              </div>
              {expanded === diff.rank && (
                <div className="space-y-2 border-t border-white/5 px-3 pb-3 pl-14 text-[11px] text-slate-400">
                  <p>
                    <span className="font-medium text-slate-300">Reasoning: </span>
                    {diff.reasoning}
                  </p>
                  {diff.red_flags ? (
                    <p className="text-red-300">
                      <span className="font-medium">Red flags: </span>
                      {diff.red_flags}
                    </p>
                  ) : null}
                  <p>
                    <span className="font-medium text-slate-300">Investigations: </span>
                    {diff.recommended_investigations}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
