"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface ProgramEnrollment {
  uuid: string;
  program: string;
  dateEnrolled: string;
  dateCompleted: string | null;
  outcome: string | null;
}

export default function ProgramsScreen() {
  const { authFetch } = useAuth();
  const [patientUuid, setPatientUuid] = useState("");
  const [enrollments, setEnrollments] = useState<ProgramEnrollment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [availablePrograms, setAvailablePrograms] = useState<{ uuid: string; display: string }[]>([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [enrollDate, setEnrollDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ type: "", message: "" });

  const fetchEnrollments = async () => {
    if (!patientUuid) return;
    setIsLoading(true);
    try {
      // Fetch programs list
      const progRes = await authFetch("/openmrs/ws/rest/v1/program?v=ref");
      const progData = await progRes.json();
      setAvailablePrograms(progData.results || []);

      // Fetch enrollments
      const res = await authFetch(`/openmrs/ws/rest/v1/programenrollment?patient=${patientUuid}&v=full`);
      const data = await res.json();
      const items = (data.results || []).map((e: any) => ({
        uuid: e.uuid,
        program: e.program?.display || "Unknown",
        dateEnrolled: e.dateEnrolled ? new Date(e.dateEnrolled).toLocaleDateString() : "-",
        dateCompleted: e.dateCompleted ? new Date(e.dateCompleted).toLocaleDateString() : null,
        outcome: e.outcome?.display || null,
      }));
      setEnrollments(items);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to fetch programs" });
    } finally {
      setIsLoading(false);
    }
  };

  const enrollPatient = async () => {
    if (!patientUuid || !selectedProgram || !enrollDate) {
      setNotification({ type: "error", message: "Select patient, program, and date." });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        patient: patientUuid,
        program: selectedProgram,
        dateEnrolled: enrollDate,
        location: "833d0c66-e29a-4d31-ac13-ca9050d1bfa9", // Bahmni Clinic
      };
      const res = await authFetch("/openmrs/ws/rest/v1/programenrollment", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || "Failed to enroll");
      }
      setNotification({ type: "success", message: "Patient enrolled successfully!" });
      fetchEnrollments();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Enrollment failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-4xl font-bold tracking-tight">Clinical Programs</h1>
        <p className="text-slate-400 mt-1">Enroll patients in clinical programs and track program outcomes.</p>
      </div>

      <div className="glass-panel border-l-4 border-l-primary p-6 rounded-r-xl bg-white/5 mb-8">
        <label className="block text-slate-300 text-sm font-bold uppercase tracking-wider mb-2">Patient UUID</label>
        <div className="flex gap-4">
          <input type="text" className="flex-1 bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Enter Patient UUID..." value={patientUuid} onChange={(e) => setPatientUuid(e.target.value)} />
          <button onClick={fetchEnrollments} className="px-6 py-3 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-all font-medium">Load</button>
        </div>
      </div>

      {notification.message && (
        <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${notification.type === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>{notification.message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Enroll */}
        <div className="glass-panel rounded-xl p-8">
          <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">playlist_add</span>
            Enroll in Program
          </h3>
          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Program</label>
              {availablePrograms.length > 0 ? (
                <select value={selectedProgram} onChange={e => setSelectedProgram(e.target.value)} className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white outline-none">
                  <option value="">Select program...</option>
                  {availablePrograms.map(p => (
                    <option key={p.uuid} value={p.uuid}>{p.display}</option>
                  ))}
                </select>
              ) : (
                <p className="text-slate-500 text-sm">Load a patient first to see available programs.</p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Enrollment Date</label>
              <input type="date" className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white outline-none" value={enrollDate} onChange={e => setEnrollDate(e.target.value)} />
            </div>
            <button onClick={enrollPatient} disabled={isSubmitting || !selectedProgram} className="w-full py-3 bg-primary text-background-dark font-bold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50">
              {isSubmitting ? "Enrolling..." : "Enroll Patient"}
            </button>
          </div>
        </div>

        {/* Enrollment List */}
        <div className="lg:col-span-2 glass-panel rounded-xl p-8">
          <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">assignment</span>
            Program Enrollments
          </h3>
          {isLoading ? (
            <div className="text-center py-8"><span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span></div>
          ) : enrollments.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2 block">folder_off</span>
              No program enrollments found.
            </div>
          ) : (
            <div className="space-y-3">
              {enrollments.map((e) => (
                <div key={e.uuid} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                  <div>
                    <p className="text-white font-medium">{e.program}</p>
                    <p className="text-slate-400 text-xs mt-1">Enrolled: {e.dateEnrolled}</p>
                  </div>
                  <div className="text-right">
                    {e.dateCompleted ? (
                      <span className="text-xs bg-green-500/20 text-green-400 px-2.5 py-1 rounded">Completed {e.dateCompleted}</span>
                    ) : (
                      <span className="text-xs bg-primary/20 text-primary px-2.5 py-1 rounded">Active</span>
                    )}
                    {e.outcome && <p className="text-slate-500 text-xs mt-1">Outcome: {e.outcome}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
