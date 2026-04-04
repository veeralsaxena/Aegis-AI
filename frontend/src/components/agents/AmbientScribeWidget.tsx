"use client";

import React, { useState } from "react";

interface AmbientScribeWidgetProps {
  encounterId?: string;
  onSOAPGenerated: (soap: any, extractions: any) => void;
}

export default function AmbientScribeWidget({ encounterId, onSOAPGenerated }: AmbientScribeWidgetProps) {
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!transcript.trim()) {
      setError("Please select a sample or paste a transcript.");
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Create fake segments for the API from the raw text
      const segments = [
        {
          speaker: "Speaker",
          text: transcript,
          start_ms: 0,
          end_ms: 60000,
          confidence: 0.99
        }
      ];

      const res = await fetch("/api/agents/ambient-scribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          encounter_id: encounterId || "demo-encounter",
          transcript_segments: segments
        })
      });

      if (!res.ok) {
        throw new Error("Failed to process transcript with AI Agent.");
      }

      const data = await res.json();
      onSOAPGenerated(data.soap_note, data.extracted_entities);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during processing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const loadSample = () => {
    setTranscript("Dr: Good morning. How have you been feeling since your last visit?\nPatient: Not great to be honest. I've had a lot of pain in my right ankle playing basketball.\nDr: I see. How long has this been going on? Rate the pain from 1 to 10.\nPatient: About 2 weeks. It's an 8 when I walk.\nDr: Let's get an X-ray to rule out a fracture. I'll also prescribe Ibuprofen 400mg twice a day for the pain. Rest it and use ice.");
  };

  return (
    <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 backdrop-blur-xl h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary text-sm">mic</span>
          </div>
          Ambient Scribe AI
        </h3>
        <button 
          onClick={loadSample}
          className="text-xs px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 hover:text-white transition-colors"
        >
          Load Sample
        </button>
      </div>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm mb-4">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-[200px] mb-4">
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Paste or type clinical conversation transcript here..."
          className="w-full h-full bg-black/50 border border-slate-700/50 focus:border-primary text-white p-4 rounded-xl outline-none text-sm resize-none"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={isProcessing}
        className="w-full liquid-button text-background-dark font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm"
      >
        {isProcessing ? (
          <><span className="material-symbols-outlined text-lg animate-spin">progress_activity</span> Synthesizing SOAP Note...</>
        ) : (
          <><span className="material-symbols-outlined text-lg">auto_awesome</span> Generate SOAP Note</>
        )}
      </button>

      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 justify-center">
        <span className="material-symbols-outlined text-slate-500 text-sm">lock</span>
        <span>Secure & HIPAA Compliant AI Processing</span>
      </div>
    </div>
  );
}
