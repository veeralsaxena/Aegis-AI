"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  patientUuid: string;
  providerName: string;
  service: string;
  date: string;
  time: string;
  status: string;
  source: string;
  reason: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error";
}

export default function AppointmentsScreen() {
  const searchParams = useSearchParams();
  const patientUuid = searchParams.get("patientUuid") || "";
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const [newPatient, setNewPatient] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newService, setNewService] = useState("General Consultation");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newReason, setNewReason] = useState("");
  const [notification, setNotification] = useState({ type: "", message: "" });

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const query = patientUuid ? `?patientUuid=${encodeURIComponent(patientUuid)}` : "";
      const response = await fetch(`/api/appointments${query}`, { cache: "no-store" });
      const data = await response.json();
      setAppointments(data.results || []);
    } catch {
      setNotification({ type: "error", message: "Failed to load appointments." });
    } finally {
      setLoading(false);
    }
  }, [patientUuid]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const addAppointment = async () => {
    if (!newPatient || !newDate || !newTime) {
      setNotification({ type: "error", message: "Please fill all fields." });
      return;
    }
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_name: newPatient,
          patient_phone: newPhone,
          service: newService,
          date: newDate,
          time: newTime,
          reason: newReason,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to schedule appointment.");
      }
      setNotification({ type: "success", message: "Appointment scheduled successfully." });
      setNewPatient("");
      setNewPhone("");
      setNewDate("");
      setNewTime("");
      setNewReason("");
      await loadAppointments();
    } catch (error: unknown) {
      setNotification({ type: "error", message: getErrorMessage(error) || "Failed to schedule appointment." });
    }
  };

  const cancelAppointment = async (appointmentId: string) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}/cancel`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel appointment.");
      }
      setNotification({ type: "success", message: "Appointment cancelled." });
      await loadAppointments();
    } catch (error: unknown) {
      setNotification({ type: "error", message: getErrorMessage(error) || "Failed to cancel appointment." });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Checked In": return "bg-green-500/20 text-green-400";
      case "Completed": return "bg-blue-500/20 text-blue-400";
      case "Cancelled": return "bg-red-500/20 text-red-400";
      default: return "bg-primary/20 text-primary";
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "patient_app":
        return "Patient App";
      case "voice_bot":
        return "Voice Bot";
      case "staff_ui":
        return "Staff UI";
      default:
        return source;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-4xl font-bold tracking-tight">Appointments</h1>
        <p className="text-slate-400 mt-1">
          {patientUuid ? "Showing appointments for the selected patient." : "Schedule and manage patient appointments."}
        </p>
      </div>

      {notification.message && (
        <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${notification.type === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>{notification.message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Schedule New */}
        <div className="glass-panel rounded-xl p-8">
          <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">event_available</span>
            Schedule New
          </h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Patient Name</label>
              <input type="text" className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary outline-none" placeholder="Patient name..." value={newPatient} onChange={e => setNewPatient(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Phone</label>
              <input type="text" className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary outline-none" placeholder="Phone number..." value={newPhone} onChange={e => setNewPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Service</label>
              <select value={newService} onChange={e => setNewService(e.target.value)} className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white outline-none">
                <option>General Consultation</option>
                <option>Follow-up</option>
                <option>Lab Review</option>
                <option>Emergency</option>
                <option>Radiology</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Date</label>
              <input type="date" className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white outline-none" value={newDate} onChange={e => setNewDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Time</label>
              <input type="time" className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white outline-none" value={newTime} onChange={e => setNewTime(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Reason</label>
              <textarea className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary outline-none resize-none" rows={3} placeholder="Reason for visit..." value={newReason} onChange={e => setNewReason(e.target.value)} />
            </div>
            <button onClick={addAppointment} className="w-full py-3 bg-primary text-background-dark font-bold rounded-lg hover:bg-primary/90 transition-all mt-2">
              Schedule Appointment
            </button>
          </div>
        </div>

        {/* Appointment List */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-8">
          <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">calendar_month</span>
            Upcoming Appointments
          </h3>
          <div className="mb-4 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-slate-200">
            {patientUuid
              ? "This view is filtered to the selected patient. Patient-facing app bookings and voice-bot bookings will appear here automatically."
              : "Patient-facing app bookings and voice-bot bookings will appear here automatically."}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Patient</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Service</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Provider</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Date</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Time</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Source</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Status</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 text-sm">Loading appointments...</td>
                  </tr>
                ) : appointments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400 text-sm">No appointments booked yet.</td>
                  </tr>
                ) : (
                  appointments.map((apt) => (
                    <tr key={apt.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 text-white font-medium text-sm">
                        <div>{apt.patientName}</div>
                        {apt.patientPhone && <div className="text-xs text-slate-500 mt-1">{apt.patientPhone}</div>}
                      </td>
                      <td className="py-4 text-slate-300 text-sm">{apt.service}</td>
                      <td className="py-4 text-slate-300 text-sm">{apt.providerName}</td>
                      <td className="py-4 text-slate-300 text-sm">{apt.date}</td>
                      <td className="py-4 text-slate-300 text-sm">{apt.time}</td>
                      <td className="py-4 text-slate-300 text-sm">{getSourceLabel(apt.source)}</td>
                      <td className="py-4"><span className={`text-xs font-medium px-2.5 py-1 rounded ${getStatusColor(apt.status)}`}>{apt.status}</span></td>
                      <td className="py-4">
                        {apt.status === "Scheduled" ? (
                          <button onClick={() => cancelAppointment(apt.id)} className="text-xs px-3 py-1.5 rounded border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors">
                            Cancel
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
