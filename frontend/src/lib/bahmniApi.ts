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
  /** Present on some Lucene rows; OpenMRS fallback sets from `person.uuid` */
  personUuid?: string;
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

function mapOpenmrsPatientToBahmniSearch(p: any): BahmniPatientSearchResult {
  const pref = p.person?.preferredName;
  return {
    uuid: p.uuid,
    givenName: pref?.givenName || p.person?.display?.split(" ")?.[0] || "",
    middleName: pref?.middleName,
    familyName: pref?.familyName || "",
    identifier: p.identifiers?.[0]?.display?.replace(/^.*=\s*/, "") || "",
    gender: p.person?.gender || "",
    dateCreated: p.auditInfo?.dateCreated || "",
    age: p.person?.age ?? 0,
    birthDate: p.person?.birthdate || "",
    personId: p.person?.id ?? 0,
    personUuid: p.person?.uuid,
    activeVisitUuid: undefined,
  };
}

/** Search patients — tries Bahmni Lucene paths, then OpenMRS patient search. */
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
  const qs = params.toString();
  const lucenePaths = [
    `/openmrs/ws/rest/v1/bahmnicore/search/patient/lucene?${qs}`,
    `/openmrs/ws/rest/v1/bahmni/search/patient/lucene?${qs}`,
  ];
  for (const url of lucenePaths) {
    try {
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        const rows = data.pageOfResults ?? data.results;
        if (Array.isArray(rows)) {
          return (rows as Record<string, unknown>[]).map((raw) => {
            const r = raw as unknown as BahmniPatientSearchResult;
            const personUuid =
              r.personUuid ||
              (raw.personUuid as string | undefined) ||
              (raw as { person?: { uuid?: string } }).person?.uuid;
            return { ...r, personUuid: personUuid || r.personUuid };
          });
        }
      }
    } catch {
      /* try next */
    }
  }
  const fr = await authFetch(
    `/openmrs/ws/rest/v1/patient?q=${encodeURIComponent(query)}&v=full&limit=20`
  );
  if (!fr.ok) return [];
  const fd = await fr.json();
  return (fd.results || []).map(mapOpenmrsPatientToBahmniSearch);
}

// ─── Patient Profile ────────────────────────────────────────────────────────

/** Get a full patient profile (patient + relationships + visits) in one call */
export async function getPatientProfile(authFetch: AuthFetchFn, uuid: string): Promise<any> {
  const res = await authFetch(`/openmrs/ws/rest/v1/patient/${uuid}?v=full`);
  return res.json();
}

// ─── Clinical Observations ──────────────────────────────────────────────────

function extractOpenmrsObsValue(o: Record<string, unknown>): unknown {
  if (o.value !== undefined && o.value !== null) return o.value;
  if (o.valueNumeric !== undefined && o.valueNumeric !== null) return o.valueNumeric;
  if (o.valueText !== undefined && o.valueText !== null) return o.valueText;
  const coded = o.valueCoded as { display?: string } | undefined;
  if (coded?.display) return coded.display;
  return null;
}

function mapOpenmrsObsToBahmni(o: any): BahmniObservation {
  const concept = o.concept || {};
  return {
    uuid: o.uuid,
    concept: {
      uuid: concept.uuid,
      name: concept.display || concept.name?.display || "Observation",
      shortName: concept.name?.display || concept.display,
    },
    value: extractOpenmrsObsValue(o),
    observationDateTime: o.obsDatetime || o.observationDateTime || "",
  };
}

/**
 * Bahmni coarse observations, with fallbacks when `scope=latest` returns 500
 * — ends with standard OpenMRS `obs` API.
 */
export async function getObservationsWithFallback(
  authFetch: AuthFetchFn,
  patientUuid: string,
  conceptNames?: string[],
  options?: { numberOfVisits?: number; scope?: string }
): Promise<BahmniObservation[]> {
  const pid = encodeURIComponent(patientUuid);
  const nv = String(options?.numberOfVisits ?? 10);
  const fetchOpenmrsObsFirst = async (): Promise<BahmniObservation[] | null> => {
    try {
      const params = new URLSearchParams({ patient: patientUuid, v: "full", limit: "200" });
      if (conceptNames?.length) {
        conceptNames.forEach((cn) => params.append("concept", cn));
      }
      const obsRes = await authFetch(`/openmrs/ws/rest/v1/obs?${params}`);
      if (!obsRes.ok) return null;
      const obsData = await obsRes.json();
      const results = obsData.results || [];
      const mapped = results.map(mapOpenmrsObsToBahmni);
      mapped.sort(
        (a, b) =>
          new Date(b.observationDateTime).getTime() -
          new Date(a.observationDateTime).getTime()
      );
      return mapped;
    } catch {
      return null;
    }
  };

  const openmrsFirst = await fetchOpenmrsObsFirst();
  if (openmrsFirst && openmrsFirst.length > 0) {
    return openmrsFirst;
  }

  const appendConcepts = (base: URLSearchParams) => {
    if (conceptNames?.length) {
      conceptNames.forEach((cn) => base.append("concept", cn));
    }
  };

  const build = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ patientUuid, ...extra });
    if (!p.has("numberOfVisits")) p.set("numberOfVisits", nv);
    appendConcepts(p);
    return `/openmrs/ws/rest/v1/bahmnicore/observations?${p}`;
  };

  const attempts: string[] = [];
  if (options?.scope) {
    attempts.push(build({ numberOfVisits: nv, scope: options.scope }));
  }
  attempts.push(build({ numberOfVisits: nv, scope: "latest" }));
  attempts.push(build({ numberOfVisits: nv }));
  attempts.push(`/openmrs/ws/rest/v1/bahmnicore/observations?patientUuid=${pid}`);

  const seen = new Set<string>();
  for (const url of attempts) {
    if (seen.has(url)) continue;
    seen.add(url);
    try {
      const res = await authFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data as BahmniObservation[];
      }
    } catch {
      /* next */
    }
  }

  return openmrsFirst || [];
}

/** Get observations for a patient, optionally filtered by concept names */
export async function getObservations(
  authFetch: AuthFetchFn,
  patientUuid: string,
  conceptNames?: string[],
  options?: { numberOfVisits?: number; scope?: string }
): Promise<BahmniObservation[]> {
  return getObservationsWithFallback(authFetch, patientUuid, conceptNames, options);
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
