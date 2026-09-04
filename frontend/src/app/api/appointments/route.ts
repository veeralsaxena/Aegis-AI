import { NextRequest, NextResponse } from "next/server";
import {
  createStoredAppointment,
  getAllowedPatientProfile,
  getDefaultLocationProfile,
  getDefaultProviderProfile,
  getErrorMessage,
  listAppointments,
} from "@/lib/appointmentStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const patientUuid = req.nextUrl.searchParams.get("patientUuid");
  const appointments = await listAppointments();
  const filtered = patientUuid
    ? appointments.filter((item) => item.patientUuid === patientUuid)
    : appointments;
  return NextResponse.json({ results: filtered });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const provider = getDefaultProviderProfile();
    const location = getDefaultLocationProfile();
    const allowedPatient = getAllowedPatientProfile();

    if (!body.patient_name || !body.date || !body.time) {
      return NextResponse.json(
        { error: "`patient_name`, `date`, and `time` are required." },
        { status: 400 }
      );
    }

    const appointment = await createStoredAppointment({
      patientUuid: body.patient_uuid || allowedPatient.uuid,
      patientName: body.patient_name,
      patientPhone: body.patient_phone || "",
      patientIdentifier: body.patient_identifier || "",
      providerUuid: body.provider_uuid || provider.uuid,
      providerName: body.provider_name || provider.name,
      locationUuid: body.location_uuid || location.uuid,
      locationName: body.location_name || location.name,
      service: body.service || "General Consultation",
      reason: body.reason || "",
      date: body.date,
      time: body.time,
      durationMinutes:
        typeof body.duration_minutes === "number" ? body.duration_minutes : 30,
      source: "staff_ui",
      notes: body.notes || "",
    });

    return NextResponse.json({ success: true, appointment });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) || "Failed to create appointment." },
      { status: 500 }
    );
  }
}
