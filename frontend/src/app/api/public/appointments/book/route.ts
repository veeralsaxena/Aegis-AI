import { NextRequest, NextResponse } from "next/server";
import {
  createStoredAppointment,
  getAllowedPatientProfile,
  getDefaultLocationProfile,
  getDefaultProviderProfile,
  getErrorMessage,
  getPatientAppointmentApiKey,
} from "@/lib/appointmentStore";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== getPatientAppointmentApiKey()) {
    return unauthorized();
  }

  try {
    const body = await req.json();
    const patient = getAllowedPatientProfile();
    const provider = getDefaultProviderProfile();
    const location = getDefaultLocationProfile();

    if (body.patient_uuid && body.patient_uuid !== patient.uuid) {
      return NextResponse.json(
        { error: "This endpoint only allows the configured patient to book appointments." },
        { status: 403 }
      );
    }

    if (!body.date) {
      return NextResponse.json(
        { error: "`date` is required." },
        { status: 400 }
      );
    }

    const appointment = await createStoredAppointment({
      patientUuid: patient.uuid,
      patientName: body.patient_name || patient.name,
      patientPhone: body.patient_phone || "",
      patientIdentifier: patient.identifier,
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
      source: "patient_app",
      notes: body.notes || "",
    });

    return NextResponse.json({
      success: true,
      appointment_id: appointment.id,
      appointment,
      ehr_status: "BOOKED_IN_AEGIS_EHR_BRIDGE",
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error) || "Failed to book appointment." },
      { status: 500 }
    );
  }
}
