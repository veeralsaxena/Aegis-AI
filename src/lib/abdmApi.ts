/**
 * ABDM (Ayushman Bharat Digital Mission) API helpers
 * 
 * This module provides stubs for ABDM HIP (Health Information Provider)
 * integration via the Bahmni hip-service container.
 * 
 * Requires:
 * - hip-service Docker container running
 * - openmrs-module-hip deployed
 * - ABDM Gateway sandbox credentials configured
 * 
 * Environment variables (set in .env.local):
 * - NEXT_PUBLIC_ABDM_ENABLED: "true" to enable ABDM features
 * - NEXT_PUBLIC_ABDM_HIP_URL: URL of the HIP service (default: http://localhost:8000)
 */

const ABDM_ENABLED = process.env.NEXT_PUBLIC_ABDM_ENABLED === "true";
const HIP_BASE_URL = process.env.NEXT_PUBLIC_ABDM_HIP_URL || "http://localhost:8000";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AbhaVerificationResult {
  valid: boolean;
  healthId?: string;
  name?: string;
  gender?: string;
  yearOfBirth?: string;
  dayOfBirth?: string;
  monthOfBirth?: string;
  healthIdNumber?: string;
  address?: string;
}

export interface ConsentRequest {
  patientUuid: string;
  purpose: string;
  hiTypes: string[];  // e.g., ["DiagnosticReport", "Prescription", "OPConsultation"]
  dateRange: { from: string; to: string };
}

export interface HealthRecord {
  type: string;
  date: string;
  content: any;  // FHIR Bundle
}

// ─── Feature Check ──────────────────────────────────────────────────────────

/** Check if ABDM features are enabled */
export function isAbdmEnabled(): boolean {
  return ABDM_ENABLED;
}

// ─── ABHA Verification ──────────────────────────────────────────────────────

/** Verify an ABHA (Ayushman Bharat Health Account) ID */
export async function verifyAbhaId(abhaId: string): Promise<AbhaVerificationResult> {
  if (!ABDM_ENABLED) {
    return { valid: false };
  }

  try {
    const res = await fetch(`${HIP_BASE_URL}/v1/patients/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ healthId: abhaId }),
    });
    if (!res.ok) return { valid: false };
    return res.json();
  } catch {
    console.warn("[ABDM] HIP service not reachable:", HIP_BASE_URL);
    return { valid: false };
  }
}

// ─── Link ABHA to Patient ────────────────────────────────────────────────────

/** Link an ABHA ID to an OpenMRS patient */
export async function linkAbhaToPatient(
  patientUuid: string,
  abhaId: string,
  authFetch: (url: string, options?: RequestInit) => Promise<Response>
): Promise<{ success: boolean; error?: string }> {
  if (!ABDM_ENABLED) {
    return { success: false, error: "ABDM is not enabled" };
  }

  try {
    // Store ABHA ID as a patient attribute in OpenMRS
    const res = await authFetch(`/openmrs/ws/rest/v1/patient/${patientUuid}/attribute`, {
      method: "POST",
      body: JSON.stringify({
        attributeType: "ABHA_ID_ATTRIBUTE_UUID", // Must be configured in OpenMRS
        value: abhaId,
      }),
    });
    return { success: res.ok };
  } catch {
    return { success: false, error: "Failed to link ABHA ID" };
  }
}

// ─── Consent Management ─────────────────────────────────────────────────────

/** Request consent from a patient for health record access */
export async function requestConsent(request: ConsentRequest): Promise<{ consentRequestId?: string; error?: string }> {
  if (!ABDM_ENABLED) {
    return { error: "ABDM is not enabled" };
  }

  try {
    const res = await fetch(`${HIP_BASE_URL}/v1/consent-requests/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const data = await res.json();
    return { consentRequestId: data.consentRequestId };
  } catch {
    return { error: "HIP service not reachable" };
  }
}

// ─── Health Records ─────────────────────────────────────────────────────────

/** Fetch health records for a patient (FHIR bundles) */
export async function fetchHealthRecords(
  patientUuid: string,
  consentId: string
): Promise<HealthRecord[]> {
  if (!ABDM_ENABLED) return [];

  try {
    const res = await fetch(`${HIP_BASE_URL}/v1/health-information/${consentId}`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
