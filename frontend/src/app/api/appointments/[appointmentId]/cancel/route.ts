import { NextRequest, NextResponse } from "next/server";
import { cancelStoredAppointment } from "@/lib/appointmentStore";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ appointmentId: string }> }
) {
  const { appointmentId } = await context.params;
  const appointment = await cancelStoredAppointment(appointmentId);
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true, appointment });
}
