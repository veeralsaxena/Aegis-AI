import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots, bookAppointment, cancelAppointment } from "@/lib/mockCalendar";

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

    console.log(`[Retell Tool Call] ${name}`, args);

    if (name === "get_availability") {
      const slots = await getAvailableSlots(args.date);
      const available = slots.filter(s => s.available).map(s => s.start);
      return NextResponse.json({ 
        availability: available.length > 0 ? available.join(", ") : "no slots available" 
      });
    }

    if (name === "book_appointment") {
      const result = await bookAppointment({
        name: args.name,
        phone: args.phone,
        date: args.date,
        time: args.time
      });
      return NextResponse.json({ resonance: `Great, I've booked your appointment. Your confirmation ID is ${result.appointment_id}.` });
    }

    if (name === "cancel_appointment") {
      await cancelAppointment(args.appointment_id);
      return NextResponse.json({ resonance: "Your appointment has been cancelled successfully." });
    }

    return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
  } catch (error: any) {
    console.error("[Retell API Error]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
