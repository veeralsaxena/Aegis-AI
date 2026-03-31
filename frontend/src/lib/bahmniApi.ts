/**
 * Bahmni-specific REST API helpers
 * These wrap the Bahmni coarse-grained APIs layered on top of OpenMRS.
 */

type AuthFetchFn = (url: string, options?: RequestInit) => Promise<Response>;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BahmniPatientSearchResult {
  uuid: string;
  givenName: string;
  middleName?: string;
  familyName: string;
  identifier: string;
  gender: string;
  dateCreated: string;
  activeVisitUuid?: string;
  age: number;
  birthDate: string;
  deathDate?: string;
  personId: number;
  addressFieldValue?: string;
  extraIdentifiers?: Record<string, string>;
}

export interface BahmniObservation {
  uuid: string;
  concept: { uuid: string; name: string; shortName?: string; dataType?: string };
  value: any;
  observationDateTime: string;
  comment?: string;
  groupMembers?: BahmniObservation[];
  encounterUuid?: string;
  providers?: { uuid: string; name: string }[];
}

export interface BahmniDrugOrder {
  uuid: string;
  orderNumber: string;
  drug: { name: string; form?: string; strength?: string; uuid: string };
  dosingInstructions?: {
    dose: number;
    doseUnits: string;
    route: string;
    frequency: string;
    asNeeded: boolean;
  };
  duration?: number;
  durationUnits?: string;
  dateActivated: string;
  dateStopped?: string;
  effectiveStartDate: string;
  effectiveStopDate?: string;
  orderType?: string;
  visit?: { startDateTime: string };
  provider?: { name: string };
}

export interface BahmniLabOrder {
  uuid: string;
  orderNumber: string;
  concept: { name: string; uuid: string };
  dateActivated: string;
  provider?: { name: string };
  result?: any;
  minNormal?: number;
  maxNormal?: number;
}

export interface BedInfo {
  bedId: number;
  bedNumber: string;
  bedType: { displayName: string; description?: string };
  status: string;
  patient?: { uuid: string; display: string };
  ward?: string;
}

export interface BahmniEncounterPayload {
  patientUuid: string;
  encounterTypeUuid: string;
  visitTypeUuid?: string;
  locationUuid?: string;
  providers?: { uuid: string }[];
  observations?: {
    concept: { uuid: string };
    value: any;
    comment?: string;
  }[];
  drugOrders?: any[];
  orders?: any[];
  diagnoses?: any[];
  disposition?: any;
}

// ─── Patient Search ─────────────────────────────────────────────────────────

/** Search patients using Bahmni Lucene search (faster, more flexible than OpenMRS default) */
export async function searchPatientsBahmni(
  authFetch: AuthFetchFn,
  query: string,
  options?: { startIndex?: number; filterOnAllIdentifiers?: boolean; loginLocationUuid?: string }
): Promise<BahmniPatientSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    s: "byIdOrNameOrVillage",
    startIndex: String(options?.startIndex || 0),
    patientAttributes: "",
    programAttributeFieldName: "",
    programAttributeFieldValue: "",
    addressFieldName: "city_village",
    addressFieldValue: "",
    addressSearchResultsConfig: "",
    patientSearchResultsConfig: "",
    filterOnAllIdentifiers: String(options?.filterOnAllIdentifiers ?? false),
  });
  if (options?.loginLocationUuid) {
    params.set("loginLocationUuid", options.loginLocationUuid);
  }
  const res = await authFetch(`/openmrs/ws/rest/v1/bahmnicore/search/patient/lucene?${params}`);
  const data = await res.json();
  return data.pageOfResults || [];
}

// ─── Patient Profile ────────────────────────────────────────────────────────

/** Get a full patient profile (patient + relationships + visits) in one call */
export async function getPatientProfile(authFetch: AuthFetchFn, uuid: string): Promise<any> {
  const res = await authFetch(`/openmrs/ws/rest/v1/bahmnicore/patientprofile/${uuid}?v=full`);
  return res.json();
}

// ─── Clinical Observations ──────────────────────────────────────────────────

/** Get observations for a patient, optionally filtered by concept names */
export async function getObservations(
  authFetch: AuthFetchFn,
  patientUuid: string,
  conceptNames?: string[],
  options?: { numberOfVisits?: number; scope?: string }
): Promise<BahmniObservation[]> {
  const params = new URLSearchParams({ patientUuid });
  if (conceptNames && conceptNames.length > 0) {
    conceptNames.forEach(cn => params.append("concept", cn));
  }
  if (options?.numberOfVisits) params.set("numberOfVisits", String(options.numberOfVisits));
  if (options?.scope) params.set("scope", options.scope);
  const res = await authFetch(`/openmrs/ws/rest/v1/bahmnicore/observations?${params}`);
  return res.json();
}

// ─── Drug Orders ────────────────────────────────────────────────────────────

/** Get drug orders (medications) for a patient */
export async function getDrugOrders(
  authFetch: AuthFetchFn,
  patientUuid: string,
  options?: { includeActiveVisit?: boolean; numberOfVisits?: number }
): Promise<BahmniDrugOrder[]> {
  const params = new URLSearchParams({ patientUuid });
  if (options?.includeActiveVisit) params.set("includeActiveVisit", "true");
  if (options?.numberOfVisits) params.set("numberOfVisits", String(options.numberOfVisits));
  const res = await authFetch(`/openmrs/ws/rest/v1/bahmnicore/drugOrders/active?${params}`);
  return res.json();
}

/** Get all drug orders (including stopped) for a patient */
export async function getAllDrugOrders(authFetch: AuthFetchFn, patientUuid: string): Promise<BahmniDrugOrder[]> {
  const params = new URLSearchParams({ patientUuid, numberOfVisits: "10" });
  const res = await authFetch(`/openmrs/ws/rest/v1/bahmnicore/drugOrders?${params}`);
  const data = await res.json();
  return data.visitDrugOrders || [];
}

// ─── Lab Orders ─────────────────────────────────────────────────────────────

/** Get lab orders for a patient */
export async function getLabOrders(
  authFetch: AuthFetchFn,
  patientUuid: string,
  options?: { numberOfVisits?: number }
): Promise<BahmniLabOrder[]> {
  const params = new URLSearchParams({ patientUuid });
  if (options?.numberOfVisits) params.set("numberOfVisits", String(options.numberOfVisits));
  const res = await authFetch(`/openmrs/ws/rest/v1/bahmnicore/labOrders?${params}`);
  return res.json();
}

// ─── Disposition ────────────────────────────────────────────────────────────

/** Get disposition (admit/discharge/transfer) for a patient's visit */
export async function getDisposition(authFetch: AuthFetchFn, patientUuid: string, visitUuid: string): Promise<any> {
  const res = await authFetch(`/openmrs/ws/rest/v1/bahmnicore/disposition?patientUuid=${patientUuid}&visitUuid=${visitUuid}`);
  return res.json();
}

// ─── Bed Management ─────────────────────────────────────────────────────────

/** Get all beds / ward layout */
export async function getBeds(authFetch: AuthFetchFn, locationUuid?: string): Promise<BedInfo[]> {
  let url = `/openmrs/ws/rest/v1/bahmnicore/bedManagement/bed?v=full`;
  if (locationUuid) url += `&locationUuid=${locationUuid}`;
  const res = await authFetch(url);
  const data = await res.json();
  return data.results || [];
}

/** Assign a patient to a bed */
export async function assignBed(
  authFetch: AuthFetchFn,
  bedId: number,
  patientUuid: string,
  encounterUuid: string
): Promise<any> {
  const res = await authFetch(`/openmrs/ws/rest/v1/bahmnicore/bedManagement/bed/${bedId}`, {
    method: "POST",
    body: JSON.stringify({ patientUuid, encounterUuid }),
  });
  return res.json();
}

// ─── Bahmni Encounter (Coarse-grained save) ─────────────────────────────────

/** Create or update a full clinical encounter (vitals, diagnoses, drug orders, lab orders, etc.) */
export async function saveBahmniEncounter(
  authFetch: AuthFetchFn,
  payload: BahmniEncounterPayload
): Promise<any> {
  const res = await authFetch(`/openmrs/ws/rest/v1/bahmnicore/bahmniencounter`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, data: await res.json() };
}

// ─── Diagnoses ──────────────────────────────────────────────────────────────

/** Get diagnoses for a patient */
export async function getDiagnoses(authFetch: AuthFetchFn, patientUuid: string): Promise<any[]> {
  const res = await authFetch(`/openmrs/ws/rest/v1/bahmnicore/diagnosis/search?patientUuid=${patientUuid}`);
  return res.json();
}

// ─── Concept Search (for autocomplete) ──────────────────────────────────────

/** Search concepts by name (used for drug, lab test, diagnosis autocomplete) */
export async function searchConcepts(
  authFetch: AuthFetchFn,
  query: string,
  options?: { classes?: string[]; limit?: number }
): Promise<any[]> {
  const params = new URLSearchParams({ q: query, v: "custom:(uuid,display,names)", limit: String(options?.limit || 20) });
  if (options?.classes) {
    options.classes.forEach(c => params.append("class", c));
  }
  const res = await authFetch(`/openmrs/ws/rest/v1/concept?${params}`);
  const data = await res.json();
  return data.results || [];
}

// ─── Visit Type & Encounter Type ────────────────────────────────────────────

/** Get all visit types */
export async function getVisitTypes(authFetch: AuthFetchFn): Promise<any[]> {
  const res = await authFetch(`/openmrs/ws/rest/v1/visittype?v=default`);
  const data = await res.json();
  return data.results || [];
}

/** Get all encounter types */
export async function getEncounterTypes(authFetch: AuthFetchFn): Promise<any[]> {
  const res = await authFetch(`/openmrs/ws/rest/v1/encountertype?v=default`);
  const data = await res.json();
  return data.results || [];
}

// ─── Start Visit ────────────────────────────────────────────────────────────

/** Start a new visit for a patient */
export async function startVisit(
  authFetch: AuthFetchFn,
  patientUuid: string,
  visitTypeUuid: string,
  locationUuid?: string
): Promise<any> {
  const body: any = {
    patient: patientUuid,
    visitType: visitTypeUuid,
    startDatetime: new Date().toISOString(),
  };
  if (locationUuid) body.location = locationUuid;
  const res = await authFetch(`/openmrs/ws/rest/v1/visit`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json() };
}
