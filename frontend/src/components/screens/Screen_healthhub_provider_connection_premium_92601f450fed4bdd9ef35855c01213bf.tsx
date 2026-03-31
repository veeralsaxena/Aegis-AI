"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { getProviders, Provider } from "@/lib/api";

export default function Screen_healthhub_provider_connection_premium_92601f450fed4bdd9ef35855c01213bf() {
  const { authFetch } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    getProviders(authFetch, 50)
      .then(setProviders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authFetch]);

  const filteredProviders = providers.filter(p =>
    !searchQuery.trim() || (p.display || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleConnect = (uuid: string) => {
    setConnectedIds(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const providerIcons = ["cardiology", "neurology", "pediatrics", "stethoscope", "vaccines", "psychology", "medical_services", "health_and_safety"];
  const providerColors = [
    "from-blue-500/20 to-cyan-500/20 border-blue-500/30",
    "from-emerald-500/20 to-teal-500/20 border-emerald-500/30",
    "from-violet-500/20 to-purple-500/20 border-violet-500/30",
    "from-amber-500/20 to-orange-500/20 border-amber-500/30",
    "from-rose-500/20 to-pink-500/20 border-rose-500/30",
  ];

  // External integrations (static, as per Stitch design)
  const integrations = [
    { name: "Epic MyChart", desc: "Access records from major hospital networks and specialized clinics worldwide.", icon: "local_hospital", connected: true },
    { name: "Cerner Health", desc: "Sync data from Cerner-affiliated healthcare providers seamlessly and securely.", icon: "health_and_safety", connected: false },
    { name: "Quest Diagnostics", desc: "Import detailed lab results and comprehensive diagnostic test history.", icon: "biotech", connected: false },
    { name: "Meditech", desc: "Connect with regional health systems and diverse community hospitals.", icon: "domain", connected: false },
    { name: "Apple Health", desc: "Sync activity, vitals, sleep, and holistic wellness data automatically.", icon: "watch", connected: true },
  ];

  return (
    <div>
  
  <div className="relative z-10 flex flex-col min-h-screen">
    <header className="w-full px-8 py-5 flex items-center justify-between border-b border-white/5 bg-background-dark/50 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary text-3xl" style={{filter: 'drop-shadow(0 0 8px rgba(37,192,244,0.5))'}}>ecg_heart</span>
        <span className="text-2xl font-bold tracking-tight text-white">Aegis AI HealthHub</span>
      </div>
      <div className="flex items-center gap-6">
        {[
          { label: "Dashboard", icon: "dashboard" },
          { label: "Records", icon: "folder_shared" },
          { label: "Connect", icon: "link", active: true },
        ].map(item => (
          <button key={item.label} className={`flex items-center gap-1.5 text-sm font-medium transition-all ${item.active ? "text-primary" : "text-slate-400 hover:text-white"}`}>
            <span className="material-symbols-outlined text-lg">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </header>

    <main className="flex-1 container mx-auto px-6 py-10 max-w-5xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-semibold text-white tracking-tight mb-3">Connect your health provider</h1>
        <p className="text-slate-400 text-base font-light max-w-2xl mx-auto">
          Securely sync your clinical records to empower your personalized AI health insights with HIPAA-grade security.
        </p>
      </div>

      {/* External Integrations */}
      <div className="mb-12">
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">integration_instructions</span>
          Health System Integrations
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map(item => (
            <div key={item.name} className="glass-panel rounded-2xl p-6 relative overflow-hidden group hover:border-primary/20 transition-all">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-xl">{item.icon}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium text-sm mb-1">{item.name}</h3>
                  <p className="text-xs text-slate-400 font-light leading-relaxed">{item.desc}</p>
                </div>
              </div>
              <button className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                item.connected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-400/30"
                  : "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
              }`}>
                <span className="material-symbols-outlined text-sm">{item.connected ? "check_circle" : "add_link"}</span>
                {item.connected ? "Connected" : "Connect"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bahmni Providers */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">group</span>
            Clinical Providers ({providers.length})
          </h2>
          <div className="relative">
            <input className="bg-black/30 border border-slate-700/50 focus:border-primary rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-slate-600 outline-none w-60"
              placeholder="Search providers..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
          </div>
        ) : filteredProviders.length === 0 ? (
          <div className="glass-panel rounded-2xl p-12 text-center">
            <span className="material-symbols-outlined text-slate-600 text-5xl mb-3">person_off</span>
            <p className="text-slate-400 text-sm font-light">No providers found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProviders.map((provider, idx) => (
              <div key={provider.uuid} className={`glass-panel rounded-xl p-5 group hover:border-primary/20 transition-all relative overflow-hidden`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${providerColors[idx % providerColors.length]} opacity-30`} />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-lg">{providerIcons[idx % providerIcons.length]}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium text-sm truncate">{provider.display}</p>
                      <p className="text-xs text-slate-500 font-light">{provider.identifier || "Provider"}</p>
                    </div>
                  </div>
                  <button onClick={() => handleConnect(provider.uuid)}
                    className={`w-full py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                      connectedIds.has(provider.uuid)
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-400/30"
                        : "bg-white/5 text-slate-300 border border-white/10 hover:border-primary/30 hover:text-primary"
                    }`}>
                    <span className="material-symbols-outlined text-sm">{connectedIds.has(provider.uuid) ? "check_circle" : "person_add"}</span>
                    {connectedIds.has(provider.uuid) ? "Connected" : "Connect"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  </div>
</div>
  );
}
