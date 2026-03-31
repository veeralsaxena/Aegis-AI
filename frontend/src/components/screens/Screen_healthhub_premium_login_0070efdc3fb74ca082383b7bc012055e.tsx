"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { getEncounters, Encounter } from "@/lib/api";
import { searchPatientsBahmni, BahmniPatientSearchResult } from "@/lib/bahmniApi";
import { listInvoices, CraterInvoice } from "@/lib/craterApi";

export default function Screen_healthhub_premium_login_0070efdc3fb74ca082383b7bc012055e() {
  const { authFetch } = useAuth();
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<BahmniPatientSearchResult[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<BahmniPatientSearchResult | null>(null);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(false);

  const handlePatientSearch = useCallback(async (q: string) => {
    setPatientQuery(q);
    if (q.trim().length < 2) { setPatientResults([]); return; }
    const results = await searchPatientsBahmni(authFetch, q);
    setPatientResults(results);
  }, [authFetch]);

  const selectPatient = (p: BahmniPatientSearchResult) => {
    setSelectedPatient(p);
    setPatientQuery(`${p.givenName} ${p.familyName}`);
    setPatientResults([]);
  };

  useEffect(() => {
    if (!selectedPatient) { setEncounters([]); return; }
    setLoading(true);
    getEncounters(authFetch, selectedPatient.uuid)
      .then(setEncounters)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedPatient, authFetch]);

  const totalOutstanding = encounters.length * 150;
  const dueNow = Math.min(350, totalOutstanding);
  const ledgerItems = encounters.map(enc => ({
    uuid: enc.uuid,
    description: enc.encounterType?.display || "Consultation",
    date: new Date(enc.encounterDatetime).toLocaleDateString(),
    provider: enc.location?.display || "OmniCare Main",
    amount: 150,
    status: Math.random() > 0.3 ? "pending" : "paid",
  }));

  return (
    <div>
  
  <div className="relative z-10 flex min-h-screen">
    {/* Sidebar */}
    <aside className="hidden lg:flex w-72 border-r border-white/5 bg-background-dark/70 backdrop-blur-xl flex-col">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3 mb-6">
          <span className="material-symbols-outlined text-primary text-2xl" style={{filter: 'drop-shadow(0 0 8px rgba(37,192,244,0.5))'}}>ecg_heart</span>
          <span className="text-xl font-bold tracking-tight text-white">Aegis AI</span>
        </div>
        {/* Patient Search */}
        <div className="relative">
          <input className="w-full bg-black/30 border border-slate-700/50 focus:border-primary rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none"
            placeholder="Search patient..." type="text" value={patientQuery}
            onChange={e => handlePatientSearch(e.target.value)} />
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
          {patientResults.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-2xl max-h-48 overflow-y-auto">
              {patientResults.map(p => (
                <button key={p.uuid} onClick={() => selectPatient(p)}
                  className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-primary/10 transition-colors border-b border-white/5 last:border-0">
                  {p.givenName} {p.familyName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {selectedPatient && (
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">person</span>
            </div>
            <div>
              <p className="text-white font-medium text-sm">{selectedPatient.givenName} {selectedPatient.familyName}</p>
              <p className="text-xs text-slate-500">Patient ID: {selectedPatient.identifier || "N/A"}</p>
            </div>
          </div>
        </div>
      )}
      <nav className="p-4 flex-1">
        <p className="text-xs text-slate-500 font-light uppercase tracking-wider mb-3 px-2">Navigation</p>
        {[
          { icon: "dashboard", label: "Dashboard" },
          { icon: "account_balance_wallet", label: "Financial & Billing", active: true },
          { icon: "folder_shared", label: "Health Records" },
          { icon: "calendar_month", label: "Appointments" },
        ].map(item => (
          <div key={item.label} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all mb-1 ${item.active ? "bg-primary/10 text-primary" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            {item.label}
          </div>
        ))}
      </nav>
    </aside>

    {/* Main Content */}
    <main className="flex-1 overflow-y-auto p-6 lg:p-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold text-white tracking-tight">Financial & Billing</h1>
          <p className="text-slate-400 text-sm font-light mt-1">
            {selectedPatient ? `Manage accounts and review statements for ${selectedPatient.givenName} ${selectedPatient.familyName}.` : "Select a patient to view billing information."}
          </p>
        </div>

        {!selectedPatient ? (
          <div className="glass-panel rounded-2xl p-16 flex flex-col items-center text-center">
            <span className="material-symbols-outlined text-slate-600 text-6xl mb-4">account_balance_wallet</span>
            <p className="text-slate-400 font-light">Search and select a patient from the sidebar</p>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
                <p className="text-xs text-slate-500 font-light uppercase tracking-wider mb-2">Total Outstanding</p>
                <p className="text-4xl font-bold text-white">${totalOutstanding.toLocaleString()}.00</p>
                <p className="text-xs text-slate-500 mt-2 font-light">{encounters.length} items pending</p>
              </div>
              <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-red-400/60 to-transparent" />
                <p className="text-xs text-slate-500 font-light uppercase tracking-wider mb-2">Due Now</p>
                <p className="text-4xl font-bold text-white">${dueNow.toLocaleString()}.00</p>
                <p className="text-xs text-red-400 mt-2 font-light flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  Payment due within 7 days
                </p>
              </div>
            </div>

            {/* Itemized Ledger */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
                Itemized Ledger
              </h2>
              {ledgerItems.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6 font-light">No billing entries found</p>
              ) : (
                <div className="space-y-3">
                  {ledgerItems.map(item => (
                    <div key={item.uuid} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${item.status === "paid" ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
                          <span className={`material-symbols-outlined text-sm ${item.status === "paid" ? "text-emerald-400" : "text-amber-400"}`}>
                            {item.status === "paid" ? "check_circle" : "pending"}
                          </span>
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{item.description}</p>
                          <p className="text-xs text-slate-500 font-light">{item.provider} • {item.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${item.status === "paid" ? "text-emerald-400" : "text-white"}`}>
                          {item.status === "paid" ? "-" : ""}${item.amount}.00
                        </p>
                        <p className={`text-[10px] font-medium ${item.status === "paid" ? "text-emerald-400" : "text-amber-400"}`}>
                          {item.status === "paid" ? "PAID" : "PENDING"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Action */}
            <div className="glass-panel rounded-2xl p-6 mt-6">
              <div className="flex items-center gap-2 text-primary mb-4">
                <span className="material-symbols-outlined" style={{filter: 'drop-shadow(0 0 5px rgba(37,192,244,0.5))'}}>payments</span>
                <h3 className="font-medium tracking-wide">Payment Action</h3>
              </div>
              <div className="bg-black/30 rounded-xl p-4 mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-slate-400">credit_card</span>
                  <div>
                    <p className="text-white text-sm font-medium">Payment Method</p>
                    <p className="text-xs text-slate-500 font-light">Visa ending in •••• 4242</p>
                  </div>
                </div>
                <button className="text-primary text-xs font-medium hover:underline">Change</button>
              </div>
              <button className="w-full bg-primary hover:bg-primary/90 text-background-dark font-semibold py-3.5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-lg">shopping_cart_checkout</span>
                Proceed to Checkout — ${dueNow}.00
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  </div>
</div>
  );
}
