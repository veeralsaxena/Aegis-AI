import { NextRequest, NextResponse } from "next/server";
import {
  cancelStoredAppointment,
  createStoredAppointment,
  getAllowedPatientProfile,
  getAvailableSlots,
  getDefaultLocationProfile,
  getDefaultProviderProfile,
  getErrorMessage,
} from "@/lib/appointmentStore";

/**
 * Handle POST from Retell AI
 * Retell sends a body like:
 * {
 *   "args": { "date": "2026-04-06" },
 *   "name": "get_availability"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const { args, name } = await req.json();
    const patient = getAllowedPatientProfile();
    const provider = getDefaultProviderProfile();
    const location = getDefaultLocationProfile();

    console.log(`[Retell Tool Call] ${name}`, args);

    if (name === "get_availability") {
      const slots = await getAvailableSlots(args.date);
      const available = slots.filter(s => s.available).map(s => s.start);
      return NextResponse.json({ 
        availability: available.length > 0 ? available.join(", ") : "no slots available" 
      });
    }

    if (name === "book_appointment") {
      const result = await createStoredAppointment({
        patientUuid: patient.uuid,
        patientName: args.name || patient.name,
        patientPhone: args.phone || "",
        patientIdentifier: patient.identifier,
        providerUuid: provider.uuid,
        providerName: provider.name,
        locationUuid: location.uuid,
        locationName: location.name,
        service: args.service || "General Consultation",
        reason: args.reason || "",
        date: args.date,
        time: args.time,
        source: "voice_bot",
      });
      return NextResponse.json({ resonance: `Great, I've booked your appointment. Your confirmation ID is ${result.id}.` });
    }

    if (name === "cancel_appointment") {
      await cancelStoredAppointment(args.appointment_id);
      return NextResponse.json({ resonance: "Your appointment has been cancelled successfully." });
    }

    return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
  } catch (error: unknown) {
    console.error("[Retell API Error]", error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
