"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface AllergyEntry {
  uuid: string;
  allergen: string;
  severity: string;
  reaction: string;
  comment: string;
}

export default function AllergiesScreen() {
  const { authFetch } = useAuth();
  const [patientUuid, setPatientUuid] = useState("");
  const [allergies, setAllergies] = useState<AllergyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [allergenName, setAllergenName] = useState("");
  const [severity, setSeverity] = useState("Moderate");
  const [reaction, setReaction] = useState("");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState({ type: "", message: "" });

  const fetchAllergies = async () => {
    if (!patientUuid) return;
    setIsLoading(true);
    try {
      const res = await authFetch(`/openmrs/ws/rest/v1/patient/${patientUuid}/allergy`);
      if (!res.ok) throw new Error("Failed to fetch allergies");
      const data = await res.json();
      const items = (data.results || data || []).map((a: any) => ({
        uuid: a.uuid || Math.random().toString(),
        allergen: a.allergen?.codedAllergen?.display || a.allergen?.nonCodedAllergen || a.display || "Unknown",
        severity: a.severity?.display || "Unknown",
        reaction: a.reactions?.map((r: any) => r.reaction?.display).join(", ") || "-",
        comment: a.comment || "",
      }));
      setAllergies(items);
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to fetch allergies" });
    } finally {
      setIsLoading(false);
    }
  };

  const submitAllergy = async () => {
    if (!patientUuid || !allergenName) {
      setNotification({ type: "error", message: "Enter patient UUID and allergen name." });
      return;
    }
    setIsSubmitting(true);
    try {
      // Search for the allergen concept
      const searchRes = await authFetch(`/openmrs/ws/rest/v1/concept?q=${encodeURIComponent(allergenName)}&limit=1`);
      const searchData = await searchRes.json();
      const conceptUuid = searchData.results?.[0]?.uuid;

      if (!conceptUuid) {
        setNotification({ type: "error", message: "Could not find allergen concept. Try a different term." });
        setIsSubmitting(false);
        return;
      }

      const payload = {
        allergen: { allergenType: "DRUG", codedAllergen: { uuid: conceptUuid } },
        severity: { uuid: severity === "Severe" ? "1500AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" : severity === "Mild" ? "1498AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" : "1499AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
        comment: comment || `Allergy to ${allergenName}`,
      };

      const res = await authFetch(`/openmrs/ws/rest/v1/patient/${patientUuid}/allergy`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || "Failed to record allergy");
      }

      setNotification({ type: "success", message: `Allergy "${allergenName}" recorded.` });
      setAllergenName("");
      setComment("");
      fetchAllergies();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Failed to submit allergy" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-4xl font-bold tracking-tight">Allergies</h1>
        <p className="text-slate-400 mt-1">Manage patient allergy records for clinical safety.</p>
      </div>

      <div className="glass-panel border-l-4 border-l-primary p-6 rounded-r-xl bg-white/5 mb-8">
        <label className="block text-slate-300 text-sm font-bold uppercase tracking-wider mb-2">Patient UUID</label>
        <div className="flex gap-4">
          <input type="text" className="flex-1 bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none" placeholder="Enter Patient UUID..." value={patientUuid} onChange={(e) => setPatientUuid(e.target.value)} />
          <button onClick={fetchAllergies} className="px-6 py-3 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-all font-medium">Load</button>
        </div>
      </div>

      {notification.message && (
        <div className={`mb-6 p-4 rounded-lg text-sm font-medium ${notification.type === "error" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-green-500/10 text-green-400 border border-green-500/20"}`}>{notification.message}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Record Allergy */}
        <div className="glass-panel rounded-xl p-8">
          <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">add_circle</span>
            Record Allergy
          </h3>
          <div className="space-y-5">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Allergen Name</label>
              <input type="text" className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary outline-none" placeholder="e.g. Penicillin, Aspirin..." value={allergenName} onChange={(e) => setAllergenName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Severity</label>
              <select value={severity} onChange={e => setSeverity(e.target.value)} className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white outline-none">
                <option value="Mild">Mild</option>
                <option value="Moderate">Moderate</option>
                <option value="Severe">Severe</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Reaction (optional)</label>
              <input type="text" className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary outline-none" placeholder="e.g. Rash, Anaphylaxis..." value={reaction} onChange={(e) => setReaction(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">Comment</label>
              <textarea className="w-full bg-black/20 border border-primary/30 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-primary outline-none resize-none h-20" placeholder="Additional notes..." value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <button onClick={submitAllergy} disabled={isSubmitting || !allergenName} className="w-full py-3 bg-primary text-background-dark font-bold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50">
              {isSubmitting ? "Recording..." : "Record Allergy"}
            </button>
          </div>
        </div>

        {/* Allergy List */}
        <div className="glass-panel rounded-xl p-8">
          <h3 className="text-white text-xl font-bold mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">warning</span>
            Active Allergies
          </h3>
          {isLoading ? (
            <div className="text-center py-8"><span className="material-symbols-outlined text-primary text-3xl animate-spin">progress_activity</span></div>
          ) : allergies.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2 block">health_and_safety</span>
              No allergies recorded.
            </div>
          ) : (
            <div className="space-y-3">
              {allergies.map((a) => (
                <div key={a.uuid} className="p-4 bg-white/5 rounded-lg border border-white/5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-medium">{a.allergen}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${a.severity === "Severe" ? "bg-red-500/20 text-red-400" : a.severity === "Mild" ? "bg-yellow-500/20 text-yellow-400" : "bg-orange-500/20 text-orange-400"}`}>{a.severity}</span>
                        {a.reaction && <span className="text-xs text-slate-400">Reaction: {a.reaction}</span>}
                      </div>
                    </div>
                  </div>
                  {a.comment && <p className="text-slate-500 text-xs mt-2">{a.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
