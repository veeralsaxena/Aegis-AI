import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export interface StoredAppointment {
  id: string;
  patientUuid: string;
  patientName: string;
  patientPhone: string;
  patientIdentifier: string;
  providerUuid: string;
  providerName: string;
  locationUuid: string;
  locationName: string;
  service: string;
  reason: string;
  source: "patient_app" | "voice_bot" | "staff_ui";
  status: "Scheduled" | "Cancelled" | "Completed" | "Checked In";
  date: string;
  time: string;
  startDateTime: string;
  endDateTime: string;
  createdAt: string;
  notes: string;
}

export interface AppointmentSlot {
  start: string;
  end: string;
  available: boolean;
}

export interface CreateAppointmentInput {
  patientUuid: string;
  patientName: string;
  patientPhone?: string;
  patientIdentifier?: string;
  providerUuid: string;
  providerName: string;
  locationUuid: string;
  locationName: string;
  service: string;
  reason?: string;
  date: string;
  time?: string;
  durationMinutes?: number;
  source: "patient_app" | "voice_bot" | "staff_ui";
  notes?: string;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

const APPOINTMENT_STORE_DIR = path.join(process.cwd(), "data");
const APPOINTMENT_STORE_FILE = path.join(APPOINTMENT_STORE_DIR, "appointments.json");

const DEFAULT_API_KEY = "aegis-patient-booking-demo-key";
const DEFAULT_ALLOWED_PATIENT_UUID = "2eb8305a-4529-4db5-a0ec-088cc6c30fd4";
const DEFAULT_ALLOWED_PATIENT_NAME = "Veeral Saxena";
const DEFAULT_ALLOWED_PATIENT_IDENTIFIER = "ABC200005";
const DEFAULT_PROVIDER_UUID = "db10348a-f496-11ed-b179-0242ac150003";
const DEFAULT_PROVIDER_NAME = "Dr. Neha Anand";
const DEFAULT_LOCATION_UUID = "833d0c66-e29a-4d31-ac13-ca9050d1bfa9";
const DEFAULT_LOCATION_NAME = "Bahmni Clinic";

export function getPatientAppointmentApiKey() {
  return process.env.PATIENT_APPOINTMENT_API_KEY || DEFAULT_API_KEY;
}

export function getAllowedPatientProfile() {
  return {
    uuid: process.env.PATIENT_APPOINTMENT_ALLOWED_PATIENT_UUID || DEFAULT_ALLOWED_PATIENT_UUID,
    name: process.env.PATIENT_APPOINTMENT_ALLOWED_PATIENT_NAME || DEFAULT_ALLOWED_PATIENT_NAME,
    identifier:
      process.env.PATIENT_APPOINTMENT_ALLOWED_PATIENT_IDENTIFIER || DEFAULT_ALLOWED_PATIENT_IDENTIFIER,
  };
}

export function getDefaultProviderProfile() {
  return {
    uuid: process.env.PATIENT_APPOINTMENT_PROVIDER_UUID || DEFAULT_PROVIDER_UUID,
    name: process.env.PATIENT_APPOINTMENT_PROVIDER_NAME || DEFAULT_PROVIDER_NAME,
  };
}

export function getDefaultLocationProfile() {
  return {
    uuid: process.env.PATIENT_APPOINTMENT_LOCATION_UUID || DEFAULT_LOCATION_UUID,
    name: process.env.PATIENT_APPOINTMENT_LOCATION_NAME || DEFAULT_LOCATION_NAME,
  };
}

async function ensureStoreFile() {
  await mkdir(APPOINTMENT_STORE_DIR, { recursive: true });
  try {
    await readFile(APPOINTMENT_STORE_FILE, "utf8");
  } catch {
    await writeFile(APPOINTMENT_STORE_FILE, "[]\n", "utf8");
  }
}

async function readAppointments(): Promise<StoredAppointment[]> {
  await ensureStoreFile();
  try {
    const raw = await readFile(APPOINTMENT_STORE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAppointments(appointments: StoredAppointment[]) {
  await ensureStoreFile();
  await writeFile(APPOINTMENT_STORE_FILE, `${JSON.stringify(appointments, null, 2)}\n`, "utf8");
}

function pad(value: number) {
  return `${value}`.padStart(2, "0");
}

function addMinutes(time: string, minutes: number) {
  const [hourRaw, minuteRaw] = time.split(":").map((part) => Number(part || 0));
  const total = hourRaw * 60 + minuteRaw + minutes;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `${pad(hours)}:${pad(mins)}`;
}

function toIsoDateTime(date: string, time: string) {
  return `${date}T${time}:00+05:30`;
}

function buildDefaultSlots(): AppointmentSlot[] {
  const slots: AppointmentSlot[] = [];
  const workingWindows = [
    { startHour: 9, endHour: 13 },
    { startHour: 14, endHour: 17 },
  ];

  for (const window of workingWindows) {
    for (let hour = window.startHour; hour < window.endHour; hour += 1) {
      for (const minute of [0, 30]) {
        const start = `${pad(hour)}:${pad(minute)}`;
        slots.push({
          start,
          end: addMinutes(start, 30),
          available: true,
        });
      }
    }
  }

  return slots;
}

export async function listAppointments() {
  const appointments = await readAppointments();
  return appointments.sort((a, b) => {
    const left = `${a.date} ${a.time}`;
    const right = `${b.date} ${b.time}`;
    return left.localeCompare(right);
  });
}

export async function getAvailableSlots(date: string): Promise<AppointmentSlot[]> {
  const baseSlots = buildDefaultSlots();
  const appointments = await listAppointments();
  const bookedTimes = new Set(
    appointments
      .filter((item) => item.date === date && item.status !== "Cancelled")
      .map((item) => item.time)
  );

  return baseSlots.map((slot) => ({
    ...slot,
    available: !bookedTimes.has(slot.start),
  }));
}

export async function createStoredAppointment(input: CreateAppointmentInput) {
  const appointments = await listAppointments();
  const durationMinutes = input.durationMinutes || 30;
  
  let finalTime = input.time;

  if (!finalTime) {
    const slots = await getAvailableSlots(input.date);
    const firstAvailable = slots.find((item) => item.available);
    if (!firstAvailable) {
      throw new Error(`No available slots for date ${input.date}.`);
    }
    finalTime = firstAvailable.start;
  } else {
    const slots = await getAvailableSlots(input.date);
    const slot = slots.find((item) => item.start === finalTime);

    if (!slot) {
      throw new Error("Requested time is outside clinic working hours.");
    }
    if (!slot.available) {
      throw new Error("Requested slot is already booked.");
    }
  }

  const appointment: StoredAppointment = {
    id: `APT-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
      .toString(36)
      .slice(2, 8)
      .toUpperCase()}`,
    patientUuid: input.patientUuid,
    patientName: input.patientName,
    patientPhone: input.patientPhone || "",
    patientIdentifier: input.patientIdentifier || "",
    providerUuid: input.providerUuid,
    providerName: input.providerName,
    locationUuid: input.locationUuid,
    locationName: input.locationName,
    service: input.service,
    reason: input.reason || "",
    source: input.source,
    status: "Scheduled",
    date: input.date,
    time: finalTime,
    startDateTime: toIsoDateTime(input.date, finalTime),
    endDateTime: toIsoDateTime(input.date, addMinutes(finalTime, durationMinutes)),
    createdAt: new Date().toISOString(),
    notes: input.notes || "",
  };

  appointments.push(appointment);
  await writeAppointments(appointments);
  return appointment;
}

export async function cancelStoredAppointment(id: string) {
  const appointments = await listAppointments();
  const next = appointments.map((item) =>
    item.id === id ? { ...item, status: "Cancelled" as const } : item
  );
  await writeAppointments(next);
  return next.find((item) => item.id === id) || null;
}
