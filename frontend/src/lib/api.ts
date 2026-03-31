/**
 * Shared OpenMRS/Bahmni REST API helpers
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Patient {
  uuid: string;
  display: string;
  identifiers: { display: string; uuid: string }[];
  person: {
    display: string;
    gender: string;
    age: number;
    birthdate: string;
    preferredAddress?: {
      cityVillage?: string;
      stateProvince?: string;
      country?: string;
      address1?: string;
    };
    attributes?: { display: string }[];
  };
}

export interface Visit {
  uuid: string;
  display: string;
  startDatetime: string;
  stopDatetime: string | null;
  visitType: { display: string };
  location: { display: string };
  patient: { uuid: string; display: string };
}

export interface Encounter {
  uuid: string;
  display: string;
  encounterDatetime: string;
  encounterType: { display: string; uuid: string };
  obs: Obs[];
  patient?: { uuid: string; display: string };
  location?: { display: string };
}

export interface Obs {
  uuid: string;
  display: string;
  concept: { uuid: string; display: string };
  value: any;
  obsDatetime: string;
}

export interface Drug {
  uuid: string;
  display: string;
  name: string;
  dosageForm?: { display: string };
  strength?: string;
}

export interface Order {
  uuid: string;
  display: string;
  type: string;
  dateActivated: string;
  dateStopped?: string;
  concept?: { display: string };
  drug?: { display: string };
  dose?: number;
  doseUnits?: { display: string };
  frequency?: { display: string };
  duration?: number;
  durationUnits?: { display: string };
  patient?: { uuid: string; display: string };
  orderer?: { display: string };
}

export interface Provider {
  uuid: string;
  display: string;
  identifier?: string;
  person?: {
    display: string;
    gender?: string;
    age?: number;
  };
  attributes?: { display: string; value: string; attributeType: { display: string } }[];
}

export interface AdmittedPatient {
  bedNumber: string;
  bedUuid: string;
  patient: Patient;
  visitUuid: string;
}

export interface Location {
  uuid: string;
  display: string;
  childLocations?: Location[];
  tags?: { display: string }[];
}

// ─── API Helpers ────────────────────────────────────────────────────────────

type AuthFetchFn = (url: string, options?: RequestInit) => Promise<Response>;

/** Search patients by name or identifier */
export async function searchPatients(authFetch: AuthFetchFn, query: string, limit = 15): Promise<Patient[]> {
  const res = await authFetch(`/openmrs/ws/rest/v1/patient?q=${encodeURIComponent(query)}&v=default&limit=${limit}`);
  const data = await res.json();
  return data.results || [];
}

/** Get a single patient by UUID */
export async function getPatient(authFetch: AuthFetchFn, uuid: string): Promise<Patient> {
  const res = await authFetch(`/openmrs/ws/rest/v1/patient/${uuid}?v=full`);
  return res.json();
}

/** Get active visits (across all patients or for a specific patient) */
export async function getActiveVisits(authFetch: AuthFetchFn, patientUuid?: string): Promise<Visit[]> {
  let url = `/openmrs/ws/rest/v1/visit?includeInactive=false&v=default&limit=50`;
  if (patientUuid) url += `&patient=${patientUuid}`;
  const res = await authFetch(url);
  const data = await res.json();
  return data.results || [];
}

/** Get encounters for a patient */
export async function getEncounters(authFetch: AuthFetchFn, patientUuid: string, limit = 30): Promise<Encounter[]> {
  const res = await authFetch(`/openmrs/ws/rest/v1/encounter?patient=${patientUuid}&v=default&limit=${limit}&order=desc`);
  const data = await res.json();
  return data.results || [];
}

/** Get obs for a patient, optionally filtered by concept */
export async function getObs(authFetch: AuthFetchFn, patientUuid: string, conceptUuid?: string, limit = 50): Promise<Obs[]> {
  let url = `/openmrs/ws/rest/v1/obs?patient=${patientUuid}&v=default&limit=${limit}`;
  if (conceptUuid) url += `&concept=${conceptUuid}`;
  const res = await authFetch(url);
  const data = await res.json();
  return data.results || [];
}

/** Create an encounter (vitals, medications, etc.) */
export async function createEncounter(
  authFetch: AuthFetchFn,
  patientUuid: string,
  encounterType: string,
  obs: { concept: string; value: any }[],
  locationUuid?: string
): Promise<any> {
  const body: any = {
    patient: patientUuid,
    encounterType,
    obs: obs.filter(o => o.value !== "" && o.value !== null && o.value !== undefined),
  };
  if (locationUuid) body.location = locationUuid;
  const res = await authFetch("/openmrs/ws/rest/v1/encounter", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: await res.json() };
}

/** Register a new patient */
export async function registerPatient(
  authFetch: AuthFetchFn,
  data: {
    firstName: string;
    lastName: string;
    gender: string;
    birthdate: string;
    phone?: string;
    email?: string;
    address?: string;
  }
): Promise<{ ok: boolean; data: any }> {
  const personPayload: any = {
    names: [{ givenName: data.firstName, familyName: data.lastName }],
    gender: data.gender,
    birthdate: data.birthdate,
  };
  if (data.address) {
    personPayload.addresses = [{ address1: data.address }];
  }

  const patientPayload = {
    person: personPayload,
    identifiers: [
      {
        identifier: `OC-${Date.now()}`,
        identifierType: "05a29f94-c0ed-11e2-94be-8c13b969e334", // OpenMRS ID
        location: "aff27d58-a15c-49a6-9beb-d30dcfc0c66e", // Default location
        preferred: true,
      },
    ],
  };

  const res = await authFetch("/openmrs/ws/rest/v1/patient", {
    method: "POST",
    body: JSON.stringify(patientPayload),
  });
  return { ok: res.ok, data: await res.json() };
}

/** Search drugs */
export async function searchDrugs(authFetch: AuthFetchFn, query: string, limit = 10): Promise<Drug[]> {
  const res = await authFetch(`/openmrs/ws/rest/v1/drug?q=${encodeURIComponent(query)}&v=default&limit=${limit}`);
  const data = await res.json();
  return data.results || [];
}

/** Get orders for a patient */
export async function getOrders(authFetch: AuthFetchFn, patientUuid: string, limit = 30): Promise<Order[]> {
  const res = await authFetch(`/openmrs/ws/rest/v1/order?patient=${patientUuid}&v=default&limit=${limit}`);
  const data = await res.json();
  return data.results || [];
}

/** Get all providers */
export async function getProviders(authFetch: AuthFetchFn, limit = 50): Promise<Provider[]> {
  const res = await authFetch(`/openmrs/ws/rest/v1/provider?v=default&limit=${limit}`);
  const data = await res.json();
  return data.results || [];
}

/** Get locations (wards) */
export async function getLocations(authFetch: AuthFetchFn, tag?: string): Promise<Location[]> {
  let url = `/openmrs/ws/rest/v1/location?v=default&limit=50`;
  if (tag) url += `&tag=${encodeURIComponent(tag)}`;
  const res = await authFetch(url);
  const data = await res.json();
  return data.results || [];
}

/** Get admitted patients (Bahmni-specific) */
export async function getAdmittedPatients(authFetch: AuthFetchFn, locationUuid?: string): Promise<any[]> {
  let url = `/openmrs/ws/rest/v1/visit?includeInactive=false&v=full&limit=50`;
  if (locationUuid) url += `&location=${locationUuid}`;
  const res = await authFetch(url);
  const data = await res.json();
  // Filter visits that have admission encounters
  return (data.results || []).filter((v: any) =>
    v.encounters?.some((e: any) => e.encounterType?.display?.toLowerCase().includes("admission"))
  );
}
