/**
 * ArmorIQ AI Security & Governance Integration
 * 
 * This library provides the sentinel layer for intercepting AI agent actions
 * and enforcing organizational policies before execution.
 */

export interface ArmorPolicy {
  id: string;
  name: string;
  description: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface AgentAction {
  agentId: string;
  actionType: string;
  intent: string;
  payload: any;
  metadata?: Record<string, any>;
}

export interface ArmorDecision {
  allowed: boolean;
  reason?: string;
  auditId: string;
  policyViolations?: ArmorPolicy[];
  suggestedMitigation?: string;
}

// ─── Agent Registry ─────────────────────────────────────────────────────────

export const AEGIS_AGENTS = {
  CHART_PREP: "agent.chart_prep",
  INSURANCE_AUTH: "agent.insurance_auth",
  AMBIENT_SCRIBE: "agent.ambient_scribe",
  CDS: "agent.cds",
  MEDICAL_CODER: "agent.medical_coder",
  CLAIMS_SCRUBBER: "agent.claims_scrubber",
  DENIALS_MANAGER: "agent.denials_manager",
  FOLLOW_UP: "agent.follow_up",
  CARE_COORDINATOR: "agent.care_coordinator",
  TRIAGE: "agent.triage",
  RAG_CHATBOT: "agent.rag_chatbot",
};

// ─── Implementation ──────────────────────────────────────────────────────────

class ArmorIQSentry {
  private apiKey: string | undefined;
  private baseUrl: string = "https://api.armoriq.ai/v1";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEXT_PUBLIC_ARMOURIQ_API_KEY;
  }

  /**
   * Intercept an agent's proposed action and validate it against ArmorIQ policies.
   */
  async validateAction(action: AgentAction): Promise<ArmorDecision> {
    console.log(`[ArmorIQ] Intercepting action from ${action.agentId}: ${action.intent}`);

    // If no API key is provided, run in "Local Simulation Mode"
    if (!this.apiKey) {
      return this.simulateValidation(action);
    }

    try {
      const response = await fetch(`${this.baseUrl}/sentry/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(action),
      });

      if (!response.ok) {
        throw new Error(`ArmorIQ API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[ArmorIQ] Validation failed, falling back to safe mode:", error);
      return {
        allowed: false,
        reason: "Security layer connection error. Failing safe.",
        auditId: `err-${Date.now()}`,
      };
    }
  }

  /**
   * Mock validation for local development and hackathon demonstrations.
   */
  private async simulateValidation(action: AgentAction): Promise<ArmorDecision> {
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate network latency

    // Example Policy: CDS Agent cannot order medications without human review
    if (action.agentId === AEGIS_AGENTS.CDS && action.actionType === "ORDER_MEDICATION") {
      return {
        allowed: false,
        reason: "Policy [MED-001]: Autonomous medication ordering is restricted. Requires Physician-in-the-loop validation.",
        auditId: `sim-${Date.now()}`,
        policyViolations: [
          {
            id: "MED-001",
            name: "Clinical Autonomy Restriction",
            description: "Prevents agents from making unilateral clinical orders.",
            severity: "HIGH",
          },
        ],
        suggestedMitigation: "Route this action to the 'Nurse Review' queue or request doctor signature.",
      };
    }

    // Example Policy: Data Privacy for Insurance Auth
    if (action.agentId === AEGIS_AGENTS.INSURANCE_AUTH && action.payload?.patient?.ssn) {
      return {
        allowed: false,
        reason: "Policy [PRIV-002]: PII (SSN) detected in unencrypted payload. Data exfiltration blocked.",
        auditId: `sim-${Date.now()}`,
        policyViolations: [
          {
            id: "PRIV-002",
            name: "Data Exfiltration Prevention",
            description: "Blocks transmission of raw PII to external insurance interfaces.",
            severity: "CRITICAL",
          },
        ],
      };
    }

    // Default Allow (for demo purposes)
    return {
      allowed: true,
      auditId: `sim-ok-${Date.now()}`,
    };
  }
}

export const armorSentry = new ArmorIQSentry();
