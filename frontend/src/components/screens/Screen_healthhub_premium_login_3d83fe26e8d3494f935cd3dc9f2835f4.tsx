"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { registerPatient } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function Screen_healthhub_premium_login_3d83fe26e8d3494f935cd3dc9f2835f4() {
  const { authFetch } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    phone: "",
    email: "",
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.dob || !form.gender) {
      setMessage({ type: "error", text: "Please fill in all required fields (First Name, Last Name, DOB, Gender)" });
      return;
    }
    setSaving(true);
    setMessage(null);

    try {
      const result = await registerPatient(authFetch, {
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender.toUpperCase().charAt(0),
        birthdate: form.dob,
        phone: form.phone,
        email: form.email,
      });

      if (result.ok) {
        setMessage({ type: "success", text: `Patient ${form.firstName} ${form.lastName} registered successfully!` });
        setForm({ firstName: "", lastName: "", dob: "", gender: "", phone: "", email: "" });
        // Redirect to patient queue after a short delay
        setTimeout(() => router.push("/patients"), 2000);
      } else {
        setMessage({ type: "error", text: result.data?.error?.message || "Failed to register patient" });
      }
    } catch {
      setMessage({ type: "error", text: "Network error — could not register patient" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div>
  <div className="absolute inset-0 bg-cover bg-center z-0 opacity-20" data-alt="Abstract midnight blue mesh pattern" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuC-HaSwB-iBEftYAyerdJJhFf3jLPAwL_GDX3tbskIdeFjVXSodJ2-76kfR5FMbXKmel4xaT51ooAbgPWhk5BRaAGhhFhuNHtm2gK236-au1VoVVk4p-h1YyPsM2awpryTVI3DrxoSDx-XE-bJtIgBQwQgKYYTaVXt8nyET_0ZFzawrdPzYVIxkUYZ5ozydYBxl_8YXmrSs8dJpA2O57741XVExWumueI7NM8S6N7tbJEsQ9_7yI_kdW6vAXDus6Wmw1Qr8ygXLm8Jh")'}} />
  <div className="absolute inset-0 bg-gradient-to-br from-background-dark/95 via-background-dark/80 to-primary/10 z-0" />
  <div className="relative z-10 w-full max-w-5xl mx-auto mt-12 backdrop-blur-[20px] bg-slate-900/60 border border-primary/20 rounded-2xl shadow-lg overflow-hidden flex flex-col md:flex-row">
    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/70 to-transparent shadow-lg" />
    <div className="w-full md:w-1/3 bg-black/40 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-700/50">
      <div className="flex flex-col items-center mb-10 text-center">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-primary text-3xl" style={{filter: 'drop-shadow(0 0 8px rgba(37,192,244,0.5))'}}>ecg_heart</span>
          <span className="text-2xl font-bold tracking-tight text-white">Aegis AI</span>
        </div>
        <p className="text-slate-400 text-xs font-light tracking-[0.1em] uppercase">Secure Intake</p>
      </div>
      <div className="w-full flex flex-col gap-6">
        <div className="border-2 border-dashed border-slate-600 hover:border-primary/60 transition-colors rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 cursor-pointer group bg-black/20 hover:bg-black/40">
          <span className="material-symbols-outlined text-4xl mb-3 text-slate-500 group-hover:text-primary transition-colors">account_circle</span>
          <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Upload Profile Photo</span>
          <span className="text-xs font-light mt-1">JPEG, PNG up to 5MB</span>
        </div>
        <div className="border-2 border-dashed border-slate-600 hover:border-primary/60 transition-colors rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 cursor-pointer group bg-black/20 hover:bg-black/40">
          <span className="material-symbols-outlined text-4xl mb-3 text-slate-500 group-hover:text-primary transition-colors">badge</span>
          <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">Scan Patient ID</span>
          <span className="text-xs font-light mt-1">Front and back required</span>
        </div>
      </div>
    </div>
    <div className="w-full md:w-2/3 p-8 md:p-12 flex flex-col justify-center">
      <div className="mb-8">
        <h2 className="text-3xl font-semibold text-white mb-2 tracking-tight">Patient Registration</h2>
        <p className="text-slate-400 text-sm font-light tracking-wide">Enter demographic information to create a new health record.</p>
      </div>

      {message && (
        <div className={`mb-6 px-4 py-3 rounded-xl flex items-center gap-2 ${message.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
          <span className={`material-symbols-outlined text-lg ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {message.type === "success" ? "check_circle" : "error"}
          </span>
          <p className={`text-sm font-medium ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>
        </div>
      )}

      <form className="flex flex-col gap-6" onSubmit={handleRegister}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-light tracking-[0.1em] uppercase text-slate-300" htmlFor="firstName">First Name</label>
            <div className="relative flex items-center group">
              <span className="material-symbols-outlined absolute left-4 text-slate-500 group-focus-within:text-primary transition-colors">person</span>
              <input className="w-full bg-black/50 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 transition-all outline-none font-light" id="firstName" placeholder="e.g. Jane" type="text"
                value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-light tracking-[0.1em] uppercase text-slate-300" htmlFor="lastName">Last Name</label>
            <div className="relative flex items-center group">
              <span className="material-symbols-outlined absolute left-4 text-slate-500 group-focus-within:text-primary transition-colors">person</span>
              <input className="w-full bg-black/50 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 transition-all outline-none font-light" id="lastName" placeholder="e.g. Doe" type="text"
                value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-light tracking-[0.1em] uppercase text-slate-300" htmlFor="dob">Date of Birth</label>
            <div className="relative flex items-center group">
              <span className="material-symbols-outlined absolute left-4 text-slate-500 group-focus-within:text-primary transition-colors">calendar_month</span>
              <input className="w-full bg-black/50 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 transition-all outline-none font-light" id="dob" type="date"
                value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-light tracking-[0.1em] uppercase text-slate-300" htmlFor="gender">Gender</label>
            <div className="relative flex items-center group">
              <span className="material-symbols-outlined absolute left-4 text-slate-500 group-focus-within:text-primary transition-colors">wc</span>
              <select className="w-full bg-black/50 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-white transition-all outline-none font-light appearance-none" id="gender"
                value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))} required>
                <option className="text-slate-600" disabled value="">Select gender</option>
                <option className="text-slate-900" value="F">Female</option>
                <option className="text-slate-900" value="M">Male</option>
                <option className="text-slate-900" value="O">Other</option>
              </select>
              <span className="material-symbols-outlined absolute right-4 text-slate-500 pointer-events-none">expand_more</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-light tracking-[0.1em] uppercase text-slate-300" htmlFor="phone">Contact Number</label>
            <div className="relative flex items-center group">
              <span className="material-symbols-outlined absolute left-4 text-slate-500 group-focus-within:text-primary transition-colors">call</span>
              <input className="w-full bg-black/50 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 transition-all outline-none font-light" id="phone" placeholder="(555) 000-0000" type="tel"
                value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-light tracking-[0.1em] uppercase text-slate-300" htmlFor="email">Email Address</label>
            <div className="relative flex items-center group">
              <span className="material-symbols-outlined absolute left-4 text-slate-500 group-focus-within:text-primary transition-colors">mail</span>
              <input className="w-full bg-black/50 border border-slate-700/50 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-white placeholder-slate-600 transition-all outline-none font-light" id="email" placeholder="name@example.com" type="email"
                value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
        </div>
        <button
          className="mt-4 w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-background-dark text-lg font-semibold py-4 rounded-xl shadow-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
          type="submit"
          disabled={saving}
        >
          {saving ? (
            <>
              <span className="animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
              Registering...
            </>
          ) : (
            <>
              Register Patient
              <span className="material-symbols-outlined text-[24px] group-hover:translate-x-1 transition-transform">how_to_reg</span>
            </>
          )}
        </button>
      </form>
      <div className="mt-6 flex items-center justify-center gap-2 text-slate-500 text-xs font-light tracking-wide">
        <span className="material-symbols-outlined text-[16px]">verified_user</span>
        <span>Encrypted &amp; HIPAA-compliant transmission</span>
      </div>
    </div>
  </div>
</div>

    </>
  );
}
