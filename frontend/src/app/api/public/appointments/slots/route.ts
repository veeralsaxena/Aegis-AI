import { NextRequest, NextResponse } from "next/server";
import {
  getAllowedPatientProfile,
  getAvailableSlots,
  getDefaultLocationProfile,
  getDefaultProviderProfile,
  getPatientAppointmentApiKey,
} from "@/lib/appointmentStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey || apiKey !== getPatientAppointmentApiKey()) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }

  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "`date` is required." }, { status: 400 });
  }

  const slots = await getAvailableSlots(date);
  return NextResponse.json({
    patient: getAllowedPatientProfile(),
    provider: getDefaultProviderProfile(),
    location: getDefaultLocationProfile(),
    date,
    slots,
  });
}
