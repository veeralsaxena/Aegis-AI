"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import React from "react";

export default function Screen_healthhub_premium_login_234cd9955ab841bc9a9ffb566b3193bb() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Extract directly from form data to prevent browser autofill bypassing React state
    const formData = new FormData(e.currentTarget);
    const submittedUsername = (formData.get("username") as string) || email;
    const submittedPassword = (formData.get("password") as string) || password;

    setError("");
    setIsLoading(true);

    const result = await login(submittedUsername, submittedPassword);

    if (result.success) {
      router.push("/patients");
    } else {
      setError(result.error || "Login failed");
    }
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen w-full font-sans items-center justify-center bg-white relative overflow-hidden">
      {/* Subtle Grid Background for extreme depth */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(black 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      ></div>

      {/* Spotlight glow behind the card */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md p-10 bg-white text-black rounded-[2.5rem] ring-1 ring-black/5 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.15),_0_0_40px_rgba(37,99,235,0.05)] relative z-10 backdrop-blur-2xl">
        <div className="flex flex-col items-center mb-12">
          <div className="flex items-center gap-3 mb-3 p-4 rounded-2xl bg-black/5 shadow-inner">
            <span className="material-symbols-outlined text-blue-600 text-4xl">ecg_heart</span>
          </div>
          <span className="text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 mb-1">Aegis AI</span>
          <p className="text-black/50 text-sm font-semibold uppercase tracking-widest">Secure Portal</p>
        </div>

        {error && (
          <div className="mb-8 px-5 py-4 bg-black text-white text-sm rounded-2xl flex items-center gap-3 shadow-lg transform transition-all animate-in fade-in slide-in-from-top-2">
            <span className="material-symbols-outlined text-red-400">error</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form className="flex flex-col gap-6" onSubmit={handleLogin}>
          <div className="flex flex-col gap-2 relative">
            <label className="text-xs font-bold text-black/70 uppercase tracking-wide ml-1" htmlFor="username">Username</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-black/30 group-focus-within:text-blue-600 transition-colors">
                <span className="material-symbols-outlined text-xl">person</span>
              </div>
              <input
                className="w-full bg-black/[0.02] border-2 border-transparent focus:bg-white focus:border-blue-600 pl-11 pr-4 py-3.5 text-black placeholder-black/30 transition-all outline-none text-sm rounded-2xl hover:bg-black/[0.04] focus:shadow-[0_8px_30px_-6px_rgba(37,99,235,0.2)]"
                id="username"
                name="username"
                placeholder="Enter your username"
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 relative">
            <label className="text-xs font-bold text-black/70 uppercase tracking-wide ml-1" htmlFor="password">Password</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-black/30 group-focus-within:text-blue-600 transition-colors">
                <span className="material-symbols-outlined text-xl">lock</span>
              </div>
              <input
                className="w-full bg-black/[0.02] border-2 border-transparent focus:bg-white focus:border-blue-600 pl-11 pr-4 py-3.5 text-black placeholder-black/30 transition-all outline-none text-sm rounded-2xl hover:bg-black/[0.04] focus:shadow-[0_8px_30px_-6px_rgba(37,99,235,0.2)]"
                id="password"
                name="password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            className="mt-8 w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-4 text-[15px] transition-all rounded-2xl shadow-[0_10px_40px_-10px_rgba(37,99,235,0.6)] hover:shadow-[0_15px_50px_-10px_rgba(37,99,235,0.8)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1 active:translate-y-0 active:shadow-none"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>
                Authenticating...
              </>
            ) : (
              "Secure Login"
            )}
          </button>
        </form>

        <div className="mt-12 pt-6 flex flex-col items-center justify-center gap-2 relative">
          <div className="absolute top-0 w-16 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent"></div>
          <div className="flex items-center gap-1.5 text-black/40 text-[11px] font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[13px]">verified_user</span>
            <span>Powered by Bahmni & OpenMRS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
