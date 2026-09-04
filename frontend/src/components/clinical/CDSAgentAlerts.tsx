"use client";

import React, { useState, useEffect } from "react";
import { armorSentry, AEGIS_AGENTS, ArmorDecision } from "@/lib/armouriq";

interface CDSAgentAlertsProps {
  patientUuid: string;
}

export default function CDSAgentAlerts({ patientUuid }: CDSAgentAlertsProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [decision, setDecision] = useState<ArmorDecision | null>(null);

  const simulateCDSCheck = async () => {
    setAnalyzing(true);
    setDecision(null);

    // Proposed Agent Action: Order a high-risk medication
    const action = {
      agentId: AEGIS_AGENTS.CDS,
      actionType: "ORDER_MEDICATION",
      intent: "Prescribe Warfarin (5mg) due to suspected AFib",
      payload: {
        patientUuid,
        medication: "Warfarin",
        dosage: "5mg",
        route: "Oral",
      },
      metadata: {
        confidence: 0.92,
        reasoning: "Patient showing irregular heart rhythm in latest ECG obs.",
      }
    };

    // Intercept with ArmorIQ
    const res = await armorSentry.validateAction(action);
    setDecision(res);
    setAnalyzing(false);
  };

  useEffect(() => {
    // Auto-trigger analysis for demo purposes
    const timer = setTimeout(simulateCDSCheck, 2000);
    return () => clearTimeout(timer);
  }, [patientUuid]);

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl backdrop-blur-xl p-6 relative overflow-hidden group">
      {/* ArmorIQ Branding Watermark */}
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
        <span className="text-xs font-bold tracking-widest uppercase">Secured by ArmorIQ</span>
      </div>

      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
          analyzing ? "bg-primary/20 animate-pulse" : 
          decision?.allowed ? "bg-green-500/20" : "bg-red-500/20"
        }`}>
          <span className={`material-symbols-outlined ${
            analyzing ? "text-primary animate-spin" : 
            decision?.allowed ? "text-green-400" : "text-red-400"
          }`}>
            {analyzing ? "clinical_notes" : decision?.allowed ? "verified_user" : "gpp_maybe"}
          </span>
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-slate-900 font-semibold flex items-center gap-2">
              Clinical Decision Support
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase tracking-tighter">AI Agent</span>
            </h3>
            {decision && (
              <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                decision.allowed ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}>
                {decision.allowed ? "Policy Passed" : "Action Blocked"}
              </span>
            )}
          </div>

          <p className="text-slate-500 text-sm leading-relaxed">
            {analyzing ? "Analyzing latest patient vitals and medications for potential interactions..." : 
             decision?.allowed ? "No contraindications found for proposed care plan." : 
             decision?.reason}
          </p>

          {!analyzing && decision && !decision.allowed && (
            <div className="mt-4 space-y-3">
              <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                <p className="text-xs text-red-300 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  ArmorIQ Sentry Intercept
                </p>
                <p className="text-[11px] text-slate-500 mt-1 italic">
                  Audit ID: {decision.auditId}
                </p>
              </div>

              {decision.suggestedMitigation && (
                <button 
                  onClick={simulateCDSCheck}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-900 text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">escalator_warning</span>
                  {decision.suggestedMitigation}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
