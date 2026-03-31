"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";

interface PatientResult {
  uuid: string;
  display: string;
  identifiers: { display: string }[];
  person: {
    display: string;
    gender: string;
    age: number;
  };
}

interface PatientSearchProps {
  onSelect: (patient: PatientResult) => void;
  label?: string;
}

export default function PatientSearch({ onSelect, label = "Patient" }: PatientSearchProps) {
  const { authFetch } = useAuth();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<PatientResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Auto-load patient from URL query param
  useEffect(() => {
    const patientUuid = searchParams.get("patient");
    if (patientUuid && !selected) {
      authFetch(`/openmrs/ws/rest/v1/patient/${patientUuid}?v=default`)
        .then(r => r.json())
        .then(data => {
          if (data.uuid) {
            setSelected(data);
            onSelect(data);
            setQuery(data.person?.display || data.display);
          }
        })
        .catch(console.error);
    }
  }, [searchParams, authFetch, onSelect, selected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await authFetch(`/openmrs/ws/rest/v1/patient?q=${encodeURIComponent(q)}&v=default&limit=10`);
      const data = await res.json();
      setResults(data.results || []);
      setShowDropdown(true);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (selected) return; // Don't search if already selected
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search, selected]);

  const handleSelect = (patient: PatientResult) => {
    setSelected(patient);
    setQuery(patient.person?.display || patient.display);
    setShowDropdown(false);
    onSelect(patient);
  };

  const clearSelection = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs font-light tracking-[0.1em] uppercase text-slate-300 mb-2 block">{label}</label>
      <div className="relative flex items-center">
        <span className="material-symbols-outlined absolute left-3 text-slate-500 text-lg">person_search</span>
        <input
          type="text"
          placeholder="Search by patient name..."
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setSelected(null);
          }}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          className="w-full bg-black/50 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-10 pr-10 text-white placeholder-slate-600 transition-all outline-none text-sm"
        />
        {searching && (
          <span className="material-symbols-outlined absolute right-3 text-primary text-lg animate-spin">progress_activity</span>
        )}
        {selected && (
          <button onClick={clearSelection} className="absolute right-3 text-slate-500 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {/* Selected indicator */}
      {selected && (
        <div className="mt-2 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
          <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
          <span className="text-primary text-xs font-medium">{selected.person?.display || selected.display}</span>
          <span className="text-slate-500 text-xs">• {selected.identifiers?.[0]?.display?.split("= ")?.[1] || selected.uuid.slice(0, 8)}</span>
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && results.length > 0 && !selected && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
          {results.map(p => {
            const id = p.identifiers?.[0]?.display?.split("= ")?.[1] || "N/A";
            return (
              <button
                key={p.uuid}
                onClick={() => handleSelect(p)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors text-left border-b border-white/5 last:border-0"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-sm">person</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.person?.display || p.display}</p>
                  <p className="text-slate-500 text-xs">{id} • {p.person?.gender === "M" ? "Male" : "Female"} • {p.person?.age} yrs</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
