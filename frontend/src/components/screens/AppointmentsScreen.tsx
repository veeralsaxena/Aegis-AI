"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface Appointment {
  uuid: string;
  patient: string;
  provider: string;
  service: string;
  date: string;
  time: string;
  status: string;
}

export default function AppointmentsScreen() {
  const { authFetch } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([
    // Demo data since appointments module may not be installed
    { uuid: "1", patient: "John Doe", provider: "Dr. Neha Anand", service: "General Consultation", date: "2026-03-18", time: "10:00 AM", status: "Scheduled" },
    { uuid: "2", patient: "Jane Smith", provider: "Dr. Neha Anand", service: "Follow-up", date: "2026-03-18", time: "11:30 AM", status: "Checked In" },
    { uuid: "3", patient: "Raj Kumar", provider: "Super Man", service: "Lab Review", date: "2026-03-19", time: "09:00 AM", status: "Scheduled" },
  ]);

  const [newPatient, setNewPatient] = useState("");
  const [newService, setNewService] = useState("General Consultation");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [notification, setNotification] = useState({ type: "", message: "" });

  const addAppointment = () => {
    if (!newPatient || !newDate || !newTime) {
      setNotification({ type: "error", message: "Please fill all fields." });
      return;
    }
    setAppointments(prev => [
      ...prev,
      {
        uuid: Math.random().toString(),
        patient: newPatient,
        provider: "Dr. Neha Anand",
        service: newService,
        date: newDate,
        time: newTime,
        status: "Scheduled",
      },
    ]);
    setNotification({ type: "success", message: "Appointment scheduled successfully." });
    setNewPatient("");
    setNewDate("");
    setNewTime("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Checked In": return "bg-green-500/20 text-green-400";
      case "Completed": return "bg-blue-500/20 text-blue-400";
      case "Cancelled": return "bg-red-500/20 text-red-400";
      default: return "bg-primary/20 text-primary";
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-4xl font-bold tracking-tight">Appointments</h1>
        <p className="text-slate-400 mt-1">Schedule and manage patient appointments.</p>
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
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Patient</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Service</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Provider</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Date</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Time</th>
                  <th className="text-left text-xs text-slate-400 font-bold uppercase tracking-wider pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((apt) => (
                  <tr key={apt.uuid} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 text-white font-medium text-sm">{apt.patient}</td>
                    <td className="py-4 text-slate-300 text-sm">{apt.service}</td>
                    <td className="py-4 text-slate-300 text-sm">{apt.provider}</td>
                    <td className="py-4 text-slate-300 text-sm">{apt.date}</td>
                    <td className="py-4 text-slate-300 text-sm">{apt.time}</td>
                    <td className="py-4"><span className={`text-xs font-medium px-2.5 py-1 rounded ${getStatusColor(apt.status)}`}>{apt.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
