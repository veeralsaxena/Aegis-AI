"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import Dropdown from "@/components/Dropdown";

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
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  const [newPatient, setNewPatient] = useState("");
  const [newPatientUuid, setNewPatientUuid] = useState("");
  const [newService, setNewService] = useState("");
  const [services, setServices] = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [notification, setNotification] = useState({ type: "", message: "" });
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const handlePatientSearch = (query: string) => {
    setNewPatient(query);
    setNewPatientUuid("");
    setShowResults(true);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (query.trim().length < 2) {
      setPatientResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await authFetch(`/openmrs/ws/rest/v1/patient?q=${encodeURIComponent(query)}&v=default&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setPatientResults(data.results || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const loadAppointments = useCallback(async () => {
    try {
      const today = new Date();
      const startString = today.toISOString().split('T')[0] + "T00:00:00.000Z";
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      const endString = end.toISOString().split('T')[0] + "T23:59:59.999Z";

      const res = await authFetch(`/openmrs/ws/rest/v1/appointment?startDate=${encodeURIComponent(startString)}&endDate=${encodeURIComponent(endString)}&v=full`);
      if (res.ok) {
        const data = await res.json();
        setAppointments((data.results || []).map((a: any) => {
          let aptDate = "Unknown";
          let aptTime = "Unknown";
          if (a.timeSlot?.appointmentBlock?.startDate) {
            const dateObj = new Date(a.timeSlot.appointmentBlock.startDate);
            aptDate = dateObj.toLocaleDateString();
            aptTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
          return {
            uuid: a.uuid,
            patient: a.patient?.person?.display || a.patient?.display || "Unknown",
            provider: a.provider?.person?.display || a.provider?.display || "Unassigned",
            service: a.appointmentType?.display || "General Consultation",
            date: aptDate,
            time: aptTime,
            status: a.status || "Scheduled",
          };
        }));
      }
    } catch (err) {
      console.error("Failed to load appointments:", err);
    }
  }, [authFetch]);

  const loadServices = useCallback(async () => {
    try {
      setServicesLoading(true);
      // Trying ?all=true since /all gave a 404, and no params threw uuid required.
      const res = await authFetch(`/openmrs/ws/rest/v1/appointmentService?all=true&v=default`);
      if (res.ok) {
        const data = await res.json();
        const loadedServices = data.results || data || [];
        setServices(loadedServices);
        if (loadedServices.length > 0) {
          setNewService(loadedServices[0].uuid);
        }
      }
    } catch (err) {
      console.error("Failed to load appointment services:", err);
    } finally {
      setServicesLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadAppointments();
    loadServices();
  }, [loadAppointments, loadServices]);

  const addAppointment = async () => {
    if (!newPatientUuid || !newDate || !newTime) {
      setNotification({ type: "error", message: "Please select a valid patient from the dropdown and fill all fields." });
      return;
    }

    try {
      // In a strict OpenMRS Appointments module, we'd need timeSlot and appointmentType UUIDs.
      // We attempt to POST basic data; depending on the module version, it may accept this
      // or require more specific scheduling block setups.
      const startDateTime = new Date(`${newDate}T${newTime}:00`).toISOString();
      const endDateTime = new Date(new Date(startDateTime).getTime() + 30 * 60000).toISOString();

      const payload = {
        patientUuid: newPatientUuid,
        serviceUuid: newService,
        status: "Scheduled",
        startDateTime: startDateTime,
        endDateTime: endDateTime,
        appointmentKind: "Scheduled"
      };

      const res = await authFetch(`/openmrs/ws/rest/v1/appointment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setNotification({ type: "success", message: "Appointment scheduled successfully." });
        setNewPatient("");
        setNewPatientUuid("");
        setNewDate("");
        setNewTime("");
        loadAppointments();
      } else {
        const errorData = await res.json();
        setNotification({ type: "error", message: errorData.error?.message || "Failed to schedule appointment. Time slots might not be configured." });
      }
    } catch (err) {
      setNotification({ type: "error", message: "Network error occurred while scheduling." });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Checked In": return "bg-green-50 text-green-700 border border-green-200";
      case "Completed": return "bg-blue-50 text-blue-700 border border-blue-200";
      case "Cancelled": return "bg-rose-50 text-rose-700 border border-rose-200";
      default: return "bg-slate-50 text-slate-700 border border-slate-200";
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-slate-900">Appointments</h1>
          <p className="text-slate-500 mt-1 text-sm">Schedule and manage patient appointments.</p>
        </div>
      </div>

      {notification.message && (
        <div className={`mb-6 p-4 rounded-xl text-sm font-medium flex items-center gap-2 ${notification.type === "error" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          <span className="material-symbols-outlined text-lg">{notification.type === "error" ? "error" : "check_circle"}</span>
          {notification.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Schedule New */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden p-6 lg:col-span-1 h-fit">
          <h3 className="text-slate-900 text-lg font-semibold mb-6 flex items-center gap-2 tracking-tight">
            <span className="material-symbols-outlined text-slate-500 text-xl">event_available</span>
            Schedule New
          </h3>
          <div className="space-y-4">
            <div className="relative">
              <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Patient Name</label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100"
                placeholder="Patient name..."
                value={newPatient}
                onChange={e => handlePatientSearch(e.target.value)}
                onFocus={() => { if (newPatient.length > 1) setShowResults(true) }}
                onBlur={() => setTimeout(() => setShowResults(false), 200)}
              />
              {showResults && (newPatient.length > 1) && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-xl max-h-60 overflow-y-auto overflow-hidden">
                  {isSearching ? (
                    <div className="p-4 text-center text-sm text-slate-500">Searching...</div>
                  ) : patientResults.length > 0 ? (
                    <ul>
                      {patientResults.map(p => {
                        const nameOnly = p.display.includes(" - ") ? p.display.split(" - ").slice(1).join(" - ") : p.display;
                        const idOnly = p.display.includes(" - ") ? p.display.split(" - ")[0] : "";
                        return (
                          <li
                            key={p.uuid}
                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                            onClick={() => {
                              setNewPatient(nameOnly);
                              setNewPatientUuid(p.uuid);
                              setShowResults(false);
                            }}
                          >
                            <div className="text-sm font-medium text-slate-900">{nameOnly}</div>
                            {idOnly && <div className="text-[10px] text-slate-500">{idOnly}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="p-4 text-center text-sm text-slate-500">No patients found</div>
                  )}
                </div>
              )}
            </div>
            <div>
              <Dropdown
                label="Service"
                value={newService}
                onChange={(value) => setNewService(value)}
                options={
                  servicesLoading
                    ? [{ label: "Loading services...", value: "" }]
                    : services.length > 0
                      ? services.map(s => ({ label: s.name || s.display, value: s.uuid }))
                      : [{ label: "No services configured in database", value: "" }]
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Date</label>
                <input type="date" className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" value={newDate} onChange={e => setNewDate(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-semibold mb-1 block uppercase tracking-wider">Time</label>
                <input type="time" className="w-full bg-slate-50 border border-slate-200 focus:border-slate-400 text-slate-900 font-medium p-3 rounded-xl outline-none text-sm transition-all shadow-sm hover:bg-slate-100" value={newTime} onChange={e => setNewTime(e.target.value)} />
              </div>
            </div>
            <button onClick={addAppointment} className="w-full py-3 px-6 mt-4 bg-slate-900 text-white font-medium text-sm rounded-lg hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-lg">calendar_add_on</span>
              Schedule Appointment
            </button>
          </div>
        </div>

        {/* Appointment List */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden p-0 lg:col-span-2">
          <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-2">
            <span className="material-symbols-outlined text-slate-500 text-xl">calendar_month</span>
            <h3 className="text-slate-900 text-lg font-semibold tracking-tight">Upcoming Appointments</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-6 py-3">Patient</th>
                  <th className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-6 py-3">Service</th>
                  <th className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-6 py-3">Provider</th>
                  <th className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-6 py-3">Date</th>
                  <th className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-6 py-3">Time</th>
                  <th className="text-left text-[10px] text-slate-500 font-semibold uppercase tracking-wider px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((apt) => (
                  <tr key={apt.uuid} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-900 font-medium text-sm">{apt.patient}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{apt.service}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{apt.provider}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{apt.date}</td>
                    <td className="px-6 py-4 text-slate-600 text-sm">{apt.time}</td>
                    <td className="px-6 py-4"><span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${getStatusColor(apt.status)}`}>{apt.status}</span></td>
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
