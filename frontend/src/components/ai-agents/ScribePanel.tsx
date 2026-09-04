"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { aiFetchUrl } from "@/lib/aiAgentBaseUrl";

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface SpeakerTurn {
  speaker: "doctor" | "patient" | "unknown";
  confidence: "high" | "moderate" | "low";
  text: string;
}

export interface DraftDiagnosis {
  name: string;
  order: "PRIMARY" | "SECONDARY";
  certainty: "CONFIRMED" | "PRESUMED";
  evidence: string;
}

export interface DraftMedication {
  name: string;
  dose: string;
  dose_units: string;
  route: string;
  frequency: string;
  duration: string;
  duration_units: string;
  instructions: string;
  status: "new" | "continue" | "stop" | "unclear";
  evidence: string;
}

export interface DraftLabOrder {
  name: string;
  urgency: "ROUTINE" | "STAT";
  evidence: string;
}

export interface ConsultationDraft {
  visit_summary: string;
  soap: SoapNote;
  speaker_analysis: {
    method: string;
    confidence: "high" | "moderate" | "low";
    notes: string;
  };
  speaker_turns: SpeakerTurn[];
  suggestions: {
    diagnoses: DraftDiagnosis[];
    medications: DraftMedication[];
    lab_orders: DraftLabOrder[];
    disposition: {
      action: "ADMIT" | "DISCHARGE" | "TRANSFER" | "REFER" | "NONE";
      note: string;
    };
    follow_up: string;
    patient_instructions: string[];
    red_flags: string[];
  };
}

export interface ScribeApplyOptions {
  notes: boolean;
  diagnoses: boolean;
  medications: boolean;
  labOrders: boolean;
  disposition: boolean;
}

interface ScribeResponse {
  draft_id: string;
  transcript: string;
  soap: SoapNote;
  draft: ConsultationDraft;
}

interface ScribePanelProps {
  patientUuid: string;
  encounterUuid?: string;
  doctorUuid?: string;
  onDraftAccepted: (
    draft: ConsultationDraft,
    options: ScribeApplyOptions
  ) => Promise<void> | void;
  layout?: "embedded" | "floating";
}

type PanelState = "idle" | "recording" | "processing" | "done" | "error";

const DEFAULT_APPLY_OPTIONS: ScribeApplyOptions = {
  notes: true,
  diagnoses: true,
  medications: true,
  labOrders: true,
  disposition: true,
};

const DOSE_UNITS = ["mg", "ml", "g", "mcg", "IU", "Tablet(s)", "Capsule(s)"];
const ROUTES = [
  "Oral",
  "Intravenous",
  "Intramuscular",
  "Subcutaneous",
  "Topical",
  "Inhalation",
  "Rectal",
];
const FREQUENCIES = [
  "Once a day",
  "Twice a day",
  "Thrice a day",
  "Four times a day",
  "Every 6 hours",
  "Every 8 hours",
  "Every 12 hours",
  "Immediately",
];
const DURATION_UNITS = ["Day(s)", "Week(s)", "Month(s)"];

export function ScribePanel({
  patientUuid,
  encounterUuid,
  doctorUuid,
  onDraftAccepted,
  layout = "embedded",
}: ScribePanelProps) {
  const [state, setState] = useState<PanelState>("idle");
  const [draft, setDraft] = useState<ConsultationDraft | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [pastedTranscript, setPastedTranscript] = useState("");
  const [inputMode, setInputMode] = useState<"record" | "paste">("record");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [applyOptions, setApplyOptions] =
    useState<ScribeApplyOptions>(DEFAULT_APPLY_OPTIONS);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array.from({ length: 16 }, () => 0.12));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);

  const stopLevelMeter = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    audioSourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    audioSourceRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevels(Array.from({ length: 16 }, () => 0.12));
  }, []);

  useEffect(() => stopLevelMeter, [stopLevelMeter]);

  const resetDraftState = useCallback(() => {
    setDraft(null);
    setDraftId(null);
    setTranscript("");
    setReviewOpen(false);
    setApplyOptions(DEFAULT_APPLY_OPTIONS);
  }, []);

  const updateDraft = useCallback(
    (updater: (current: ConsultationDraft) => ConsultationDraft) => {
      setDraft((prev) => (prev ? updater(prev) : prev));
    },
    []
  );

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      liveStreamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      const audioContext = new window.AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      audioSourceRef.current = source;

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const renderLevels = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(buffer);
        const chunkSize = Math.max(1, Math.floor(buffer.length / 16));
        const nextLevels = Array.from({ length: 16 }, (_, index) => {
          const start = index * chunkSize;
          const slice = buffer.slice(start, start + chunkSize);
          const average =
            slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
          return Math.max(0.08, average / 255);
        });
        setAudioLevels(nextLevels);
        animationFrameRef.current = requestAnimationFrame(renderLevels);
      };
      renderLevels();

      mediaRecorder.start(1000);
      setError("");
      setState("recording");
    } catch {
      setError("Microphone access denied. Use “Paste transcript” instead.");
      setState("error");
    }
  };

  const postScribe = async (formData: FormData) => {
    const res = await fetch(aiFetchUrl("/api/scribe/transcribe-and-generate"), {
      method: "POST",
      body: formData,
    });
    const textBody = await res.text();
    if (!res.ok) {
      let detail = textBody;
      try {
        const j = JSON.parse(textBody) as { detail?: string | unknown };
        if (typeof j.detail === "string") detail = j.detail;
        else if (Array.isArray(j.detail)) detail = JSON.stringify(j.detail);
      } catch {
        /* use raw */
      }
      throw new Error(detail || `HTTP ${res.status}`);
    }
    return JSON.parse(textBody) as ScribeResponse;
  };

  const applyScribeResponse = useCallback((data: ScribeResponse) => {
    setDraft(data.draft);
    setDraftId(data.draft_id);
    setTranscript(data.transcript);
    setApplyOptions(DEFAULT_APPLY_OPTIONS);
    setReviewOpen(true);
    setState("done");
  }, []);

  const stopRecordingAndProcess = async () => {
    const mediaRecorder = mediaRecorderRef.current;
    if (!mediaRecorder) return;
    setState("processing");

    await new Promise<void>((resolve) => {
      mediaRecorder.onstop = () => resolve();
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
    });
    stopLevelMeter();
    liveStreamRef.current = null;

    const audioBlob = new Blob(chunksRef.current, {
      type: mediaRecorder.mimeType || "audio/webm",
    });
    mediaRecorderRef.current = null;

    const formData = new FormData();
    formData.append("audio", audioBlob, "consultation.webm");
    formData.append("patient_uuid", patientUuid);
    if (encounterUuid) formData.append("encounter_uuid", encounterUuid);
    if (doctorUuid) formData.append("doctor_uuid", doctorUuid);

    try {
      const data = await postScribe(formData);
      applyScribeResponse(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Processing failed");
      setState("error");
    }
  };

  const generateFromPaste = async () => {
    const t = pastedTranscript.trim();
    if (t.length < 20) {
      setError("Enter at least 20 characters of consultation text.");
      setState("error");
      return;
    }
    setState("processing");
    const formData = new FormData();
    formData.append("patient_uuid", patientUuid);
    formData.append("transcript", t);
    if (encounterUuid) formData.append("encounter_uuid", encounterUuid);
    if (doctorUuid) formData.append("doctor_uuid", doctorUuid);
    try {
      const data = await postScribe(formData);
      applyScribeResponse(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Processing failed");
      setState("error");
    }
  };

  const updateSoapField = useCallback((field: keyof SoapNote, value: string) => {
    updateDraft((current) => ({
      ...current,
      soap: { ...current.soap, [field]: value },
    }));
  }, [updateDraft]);

  const updateDiagnosisField = useCallback(
    (
      index: number,
      field: keyof DraftDiagnosis,
      value: DraftDiagnosis[keyof DraftDiagnosis]
    ) => {
      updateDraft((current) => ({
        ...current,
        suggestions: {
          ...current.suggestions,
          diagnoses: current.suggestions.diagnoses.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
          ),
        },
      }));
    },
    [updateDraft]
  );

  const updateMedicationField = useCallback(
    (
      index: number,
      field: keyof DraftMedication,
      value: DraftMedication[keyof DraftMedication]
    ) => {
      updateDraft((current) => ({
        ...current,
        suggestions: {
          ...current.suggestions,
          medications: current.suggestions.medications.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
          ),
        },
      }));
    },
    [updateDraft]
  );

  const updateLabField = useCallback(
    (
      index: number,
      field: keyof DraftLabOrder,
      value: DraftLabOrder[keyof DraftLabOrder]
    ) => {
      updateDraft((current) => ({
        ...current,
        suggestions: {
          ...current.suggestions,
          lab_orders: current.suggestions.lab_orders.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
          ),
        },
      }));
    },
    [updateDraft]
  );

  const removeDiagnosis = useCallback((index: number) => {
    updateDraft((current) => ({
      ...current,
      suggestions: {
        ...current.suggestions,
        diagnoses: current.suggestions.diagnoses.filter((_, i) => i !== index),
      },
    }));
  }, [updateDraft]);

  const removeMedication = useCallback((index: number) => {
    updateDraft((current) => ({
      ...current,
      suggestions: {
        ...current.suggestions,
        medications: current.suggestions.medications.filter((_, i) => i !== index),
      },
    }));
  }, [updateDraft]);

  const removeLabOrder = useCallback((index: number) => {
    updateDraft((current) => ({
      ...current,
      suggestions: {
        ...current.suggestions,
        lab_orders: current.suggestions.lab_orders.filter((_, i) => i !== index),
      },
    }));
  }, [updateDraft]);

  const updateStringList = useCallback(
    (
      key: "patient_instructions" | "red_flags",
      text: string
    ) => {
      updateDraft((current) => ({
        ...current,
        suggestions: {
          ...current.suggestions,
          [key]: text
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        },
      }));
    },
    [updateDraft]
  );

  const handleAccept = async () => {
    if (!draft || !draftId) return;
    setAccepting(true);
    setError("");
    try {
      const res = await fetch(aiFetchUrl(`/api/scribe/${draftId}/accept`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      if (!res.ok) {
        throw new Error(`Unable to persist reviewed draft (HTTP ${res.status})`);
      }
      await onDraftAccepted(draft, applyOptions);
      setState("idle");
      resetDraftState();
      setPastedTranscript("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to apply scribe draft");
      setState("error");
    } finally {
      setAccepting(false);
    }
  };

  const handleDiscard = async () => {
    if (draftId) {
      try {
        await fetch(aiFetchUrl(`/api/scribe/${draftId}/discard`), { method: "PATCH" });
      } catch {
        /* ignore */
      }
    }
    setState("idle");
    resetDraftState();
  };

  const shellClass =
    layout === "floating"
      ? "fixed top-20 right-4 z-[100] w-[min(100vw-2rem,380px)] rounded-2xl border border-white/10 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl"
      : "w-full rounded-2xl border border-cyan-500/25 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 p-5 shadow-[0_0_40px_-12px_rgba(34,211,238,0.25)] backdrop-blur-xl";

  return (
    <>
      <div className={shellClass}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300">
                <span className="material-symbols-outlined text-xl">graphic_eq</span>
              </span>
              <div>
                <div className="text-sm font-semibold tracking-tight">Ambient scribe</div>
                <p className="text-[11px] text-slate-500">
                  Record or paste the consultation, then review before charting
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 flex rounded-xl bg-black/40 p-1">
          <button
            type="button"
            onClick={() => {
              setInputMode("record");
              setError("");
              if (state !== "done") setState("idle");
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
              inputMode === "record"
                ? "bg-cyan-500/20 text-cyan-200 shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Record audio
          </button>
          <button
            type="button"
            onClick={() => {
              setInputMode("paste");
              setError("");
              if (state !== "done") setState("idle");
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
              inputMode === "paste"
                ? "bg-cyan-500/20 text-cyan-200 shadow-sm"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Paste transcript
          </button>
        </div>

        {inputMode === "record" && state === "idle" && (
          <button
            type="button"
            onClick={startRecording}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
          >
            Start recording
          </button>
        )}

        {inputMode === "record" && state === "recording" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="text-sm font-medium text-red-300">Recording…</span>
            </div>
            <div className="flex h-16 items-end gap-1 rounded-xl border border-cyan-500/15 bg-black/35 px-3 py-3">
              {audioLevels.map((level, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-full bg-gradient-to-t from-cyan-500 via-sky-400 to-cyan-200 transition-[height] duration-75"
                  style={{ height: `${Math.max(12, Math.round(level * 100))}%` }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={stopRecordingAndProcess}
              className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-500"
            >
              Stop &amp; generate draft
            </button>
          </div>
        )}

        {inputMode === "paste" && state === "idle" && (
          <div className="space-y-3">
            <textarea
              value={pastedTranscript}
              onChange={(e) => setPastedTranscript(e.target.value)}
              rows={6}
              placeholder="Paste or type the consultation dialogue (20+ characters). Works without Whisper."
              className="w-full resize-y rounded-xl border border-white/10 bg-black/50 p-3 text-xs leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-500/40"
            />
            <button
              type="button"
              onClick={generateFromPaste}
              disabled={pastedTranscript.trim().length < 20}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:opacity-40"
            >
              Generate clinical draft
            </button>
          </div>
        )}

        {state === "processing" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <span className="material-symbols-outlined animate-spin text-3xl text-cyan-400">
              progress_activity
            </span>
            <p className="text-center text-sm text-slate-400">
              Transcribing, structuring SOAP, and preparing review draft…
            </p>
          </div>
        )}

        {state === "done" && draft && (
          <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-emerald-200">Draft ready for review</div>
                <p className="mt-1 text-xs leading-relaxed text-emerald-100/75">
                  SOAP, inferred speaker turns, and structured suggestions are ready.
                </p>
              </div>
              <span className="rounded-full bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase text-emerald-100">
                {draft.speaker_analysis.confidence} confidence
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReviewOpen(true)}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950"
            >
              Open review
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <p className="whitespace-pre-wrap break-words">{error}</p>
            <button
              type="button"
              onClick={() => {
                setState(draft ? "done" : "idle");
                setError("");
              }}
              className="mt-3 text-xs font-medium text-cyan-300 underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {reviewOpen && draft && (
        <div className="fixed inset-0 z-[140] bg-slate-950/85 p-3 pt-20 backdrop-blur-sm md:left-[72px] md:p-6 md:pt-6 lg:left-64">
          <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
              <div>
                <h3 className="text-lg font-semibold text-white">Review ambient scribe draft</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Edit what the agent inferred, then choose what to apply into this consultation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-300"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-cyan-100">Encounter summary</div>
                    <span className="rounded-full bg-black/25 px-2 py-1 text-[10px] font-semibold uppercase text-cyan-100">
                      {draft.speaker_analysis.confidence} role inference
                    </span>
                  </div>
                  <textarea
                    value={draft.visit_summary}
                    onChange={(e) =>
                      updateDraft((current) => ({
                        ...current,
                        visit_summary: e.target.value,
                      }))
                    }
                    rows={4}
                    className="w-full resize-y rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                  />
                  <p className="mt-3 text-xs leading-relaxed text-slate-400">
                    {draft.speaker_analysis.notes || "Role attribution was inferred from conversational cues."}
                  </p>
                </section>

                <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-sm font-semibold text-white">Apply to consultation</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ["notes", "Notes + SOAP"],
                      ["diagnoses", "Diagnoses"],
                      ["medications", "Medications"],
                      ["labOrders", "Lab orders"],
                      ["disposition", "Disposition"],
                    ].map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={applyOptions[key as keyof ScribeApplyOptions]}
                          onChange={(e) =>
                            setApplyOptions((prev) => ({
                              ...prev,
                              [key]: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 rounded border-slate-600 bg-black/50 text-cyan-400"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </section>
              </div>

              {draft.speaker_turns.length > 0 && (
                <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="mb-3 text-sm font-semibold text-white">Inferred speaker turns</div>
                  <div className="space-y-2">
                    {draft.speaker_turns.map((turn, index) => (
                      <div
                        key={`${turn.speaker}-${index}`}
                        className="rounded-xl border border-white/5 bg-black/25 p-3"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              turn.speaker === "doctor"
                                ? "bg-sky-500/15 text-sky-200"
                                : turn.speaker === "patient"
                                  ? "bg-emerald-500/15 text-emerald-200"
                                  : "bg-slate-500/15 text-slate-300"
                            }`}
                          >
                            {turn.speaker}
                          </span>
                          <span className="text-[10px] uppercase tracking-wide text-slate-500">
                            {turn.confidence}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-slate-200">{turn.text}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 text-sm font-semibold text-white">SOAP</div>
                <div className="grid gap-3 md:grid-cols-2">
                  {(["subjective", "objective", "assessment", "plan"] as const).map((field) => (
                    <div key={field}>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        {field}
                      </div>
                      <textarea
                        value={draft.soap[field]}
                        onChange={(e) => updateSoapField(field, e.target.value)}
                        className="min-h-[110px] w-full resize-y rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white">Diagnoses</div>
                  <span className="text-xs text-slate-500">
                    Remove anything you do not want applied
                  </span>
                </div>
                {draft.suggestions.diagnoses.length === 0 ? (
                  <p className="text-sm text-slate-500">No diagnoses were confidently inferred.</p>
                ) : (
                  <div className="space-y-3">
                    {draft.suggestions.diagnoses.map((item, index) => (
                      <div
                        key={`diagnosis-${index}`}
                        className="rounded-2xl border border-white/5 bg-black/25 p-4"
                      >
                        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_140px_auto]">
                          <input
                            value={item.name}
                            onChange={(e) =>
                              updateDiagnosisField(index, "name", e.target.value)
                            }
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                          />
                          <select
                            value={item.order}
                            onChange={(e) =>
                              updateDiagnosisField(
                                index,
                                "order",
                                e.target.value as DraftDiagnosis["order"]
                              )
                            }
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none"
                          >
                            <option value="PRIMARY">Primary</option>
                            <option value="SECONDARY">Secondary</option>
                          </select>
                          <select
                            value={item.certainty}
                            onChange={(e) =>
                              updateDiagnosisField(
                                index,
                                "certainty",
                                e.target.value as DraftDiagnosis["certainty"]
                              )
                            }
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none"
                          >
                            <option value="CONFIRMED">Confirmed</option>
                            <option value="PRESUMED">Presumed</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeDiagnosis(index)}
                            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300"
                          >
                            Remove
                          </button>
                        </div>
                        {item.evidence ? (
                          <textarea
                            value={item.evidence}
                            onChange={(e) =>
                              updateDiagnosisField(index, "evidence", e.target.value)
                            }
                            rows={2}
                            className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300 outline-none focus:border-cyan-500/40"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 text-sm font-semibold text-white">Medication suggestions</div>
                {draft.suggestions.medications.length === 0 ? (
                  <p className="text-sm text-slate-500">No medication changes were confidently inferred.</p>
                ) : (
                  <div className="space-y-3">
                    {draft.suggestions.medications.map((item, index) => (
                      <div
                        key={`medication-${index}`}
                        className="rounded-2xl border border-white/5 bg-black/25 p-4"
                      >
                        <div className="mb-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_140px_auto]">
                          <input
                            value={item.name}
                            onChange={(e) =>
                              updateMedicationField(index, "name", e.target.value)
                            }
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                          />
                          <input
                            value={item.dose}
                            onChange={(e) =>
                              updateMedicationField(index, "dose", e.target.value)
                            }
                            placeholder="Dose"
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                          />
                          <select
                            value={item.status}
                            onChange={(e) =>
                              updateMedicationField(
                                index,
                                "status",
                                e.target.value as DraftMedication["status"]
                              )
                            }
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none"
                          >
                            <option value="new">new</option>
                            <option value="continue">continue</option>
                            <option value="stop">stop</option>
                            <option value="unclear">unclear</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => removeMedication(index)}
                            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
                          <select
                            value={item.dose_units}
                            onChange={(e) =>
                              updateMedicationField(index, "dose_units", e.target.value)
                            }
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none"
                          >
                            <option value="">Units</option>
                            {DOSE_UNITS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <select
                            value={item.route}
                            onChange={(e) =>
                              updateMedicationField(index, "route", e.target.value)
                            }
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none"
                          >
                            <option value="">Route</option>
                            {ROUTES.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <select
                            value={item.frequency}
                            onChange={(e) =>
                              updateMedicationField(index, "frequency", e.target.value)
                            }
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none"
                          >
                            <option value="">Frequency</option>
                            {FREQUENCIES.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <input
                            value={item.duration}
                            onChange={(e) =>
                              updateMedicationField(index, "duration", e.target.value)
                            }
                            placeholder="Duration"
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                          />
                          <select
                            value={item.duration_units}
                            onChange={(e) =>
                              updateMedicationField(index, "duration_units", e.target.value)
                            }
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none"
                          >
                            <option value="">Duration unit</option>
                            {DURATION_UNITS.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                          <input
                            value={item.instructions}
                            onChange={(e) =>
                              updateMedicationField(index, "instructions", e.target.value)
                            }
                            placeholder="Instructions"
                            className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                          />
                        </div>

                        <textarea
                          value={item.evidence}
                          onChange={(e) =>
                            updateMedicationField(index, "evidence", e.target.value)
                          }
                          rows={2}
                          className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300 outline-none focus:border-cyan-500/40"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 text-sm font-semibold text-white">Lab orders and disposition</div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="space-y-3">
                    {draft.suggestions.lab_orders.length === 0 ? (
                      <p className="text-sm text-slate-500">No investigations were confidently inferred.</p>
                    ) : (
                      draft.suggestions.lab_orders.map((item, index) => (
                        <div
                          key={`lab-${index}`}
                          className="rounded-2xl border border-white/5 bg-black/25 p-4"
                        >
                          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                            <input
                              value={item.name}
                              onChange={(e) =>
                                updateLabField(index, "name", e.target.value)
                              }
                              className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                            />
                            <select
                              value={item.urgency}
                              onChange={(e) =>
                                updateLabField(
                                  index,
                                  "urgency",
                                  e.target.value as DraftLabOrder["urgency"]
                                )
                              }
                              className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none"
                            >
                              <option value="ROUTINE">Routine</option>
                              <option value="STAT">Stat</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeLabOrder(index)}
                              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-300"
                            >
                              Remove
                            </button>
                          </div>
                          <textarea
                            value={item.evidence}
                            onChange={(e) =>
                              updateLabField(index, "evidence", e.target.value)
                            }
                            rows={2}
                            className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300 outline-none focus:border-cyan-500/40"
                          />
                        </div>
                      ))
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-black/25 p-4">
                    <div className="mb-3 text-sm font-semibold text-white">Disposition</div>
                    <select
                      value={draft.suggestions.disposition.action}
                      onChange={(e) =>
                        updateDraft((current) => ({
                          ...current,
                          suggestions: {
                            ...current.suggestions,
                            disposition: {
                              ...current.suggestions.disposition,
                              action: e.target.value as ConsultationDraft["suggestions"]["disposition"]["action"],
                            },
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-sm text-slate-100 outline-none"
                    >
                      <option value="NONE">None</option>
                      <option value="ADMIT">Admit</option>
                      <option value="DISCHARGE">Discharge</option>
                      <option value="TRANSFER">Transfer</option>
                      <option value="REFER">Refer</option>
                    </select>
                    <textarea
                      value={draft.suggestions.disposition.note}
                      onChange={(e) =>
                        updateDraft((current) => ({
                          ...current,
                          suggestions: {
                            ...current.suggestions,
                            disposition: {
                              ...current.suggestions.disposition,
                              note: e.target.value,
                            },
                          },
                        }))
                      }
                      rows={4}
                      placeholder="Disposition note"
                      className="mt-3 w-full resize-y rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                    />
                  </div>
                </div>
              </section>

              <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="lg:col-span-1">
                    <div className="mb-2 text-sm font-semibold text-white">Follow-up</div>
                    <textarea
                      value={draft.suggestions.follow_up}
                      onChange={(e) =>
                        updateDraft((current) => ({
                          ...current,
                          suggestions: {
                            ...current.suggestions,
                            follow_up: e.target.value,
                          },
                        }))
                      }
                      rows={6}
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-semibold text-white">Patient instructions</div>
                    <textarea
                      value={draft.suggestions.patient_instructions.join("\n")}
                      onChange={(e) =>
                        updateStringList("patient_instructions", e.target.value)
                      }
                      rows={6}
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-sm font-semibold text-white">Red flags</div>
                    <textarea
                      value={draft.suggestions.red_flags.join("\n")}
                      onChange={(e) => updateStringList("red_flags", e.target.value)}
                      rows={6}
                      className="w-full resize-y rounded-xl border border-white/10 bg-black/35 p-3 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                    />
                  </div>
                </div>
              </section>

              <section className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 text-sm font-semibold text-white">Transcript</div>
                <textarea
                  value={transcript}
                  readOnly
                  rows={10}
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 text-sm leading-relaxed text-slate-300 outline-none"
                />
              </section>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4 md:px-6">
              <div className="text-xs text-slate-400">
                The doctor remains the final decision maker. Nothing is charted until you apply it and save the consultation.
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="rounded-xl border border-white/10 px-4 py-2 text-sm font-medium text-slate-300"
                >
                  Discard draft
                </button>
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={accepting}
                  className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                >
                  {accepting ? "Applying…" : "Approve and apply"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
