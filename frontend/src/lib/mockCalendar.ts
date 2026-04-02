/**
 * Mock Calendar Service
 * In a real app, this would talk to Google Calendar, Outlook, or Bahmni Appointments.
 */

export interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

const MOCK_SLOTS: Record<string, TimeSlot[]> = {
  "2026-04-06": [
    { start: "09:00", end: "09:30", available: true },
    { start: "10:00", end: "10:30", available: false },
    { start: "11:00", end: "11:30", available: true },
    { start: "14:00", end: "14:30", available: true },
  ],
  "2026-04-07": [
    { start: "10:00", end: "10:30", available: true },
    { start: "11:00", end: "11:30", available: true },
  ]
};

export async function getAvailableSlots(date: string): Promise<TimeSlot[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return MOCK_SLOTS[date] || [
    { start: "09:00", end: "09:30", available: true },
    { start: "10:00", end: "10:30", available: true },
    { start: "11:00", end: "11:30", available: true },
  ];
}

export async function bookAppointment(data: { name: string, phone: string, date: string, time: string }) {
  // In reality, this would create a row in a DB or an entry in OpenMRS
  console.log("Booking appointment:", data);
  return { success: true, appointment_id: `APP-${Math.floor(Math.random() * 10000)}` };
}

export async function cancelAppointment(id: string) {
  console.log("Cancelling appointment:", id);
  return { success: true };
}
