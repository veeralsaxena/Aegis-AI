/**
 * Bahmni patientprofile / person payloads must use person-attribute type UUIDs (not display names).
 * Set NEXT_PUBLIC_BAHMNI_EMAIL_ATTRIBUTE_TYPE_UUID from GET /openmrs/ws/rest/v1/personattributetype
 * if you need email persisted (optional).
 */
const BAHMNI_PHONE_ATTRIBUTE_TYPE_UUID = "c1f4239f-3f10-11e4-adec-0800271c1b75";

export function buildBahmniPersonAttributes(phone?: string, email?: string): { attributeType: string; value: string }[] {
  const attrs: { attributeType: string; value: string }[] = [];
  const p = phone?.trim();
  if (p) attrs.push({ attributeType: BAHMNI_PHONE_ATTRIBUTE_TYPE_UUID, value: p });
  const emailUuid = process.env.NEXT_PUBLIC_BAHMNI_EMAIL_ATTRIBUTE_TYPE_UUID?.trim();
  const em = email?.trim();
  if (em && emailUuid) attrs.push({ attributeType: emailUuid, value: em });
  return attrs;
}

/** Drop empty Bahmni address fields; avoid sending [{}] on create (often 400). */
export function buildBahmniAddresses(
  fields: Record<string, string | undefined>,
  existingUuid?: string
): Record<string, string>[] | undefined {
  const row: Record<string, string> = {};
  if (existingUuid) row.uuid = existingUuid;
  for (const [k, v] of Object.entries(fields)) {
    if (v != null && String(v).trim() !== "") row[k] = String(v).trim();
  }
  if (Object.keys(row).length === 0) return undefined;
  return [row];
}
