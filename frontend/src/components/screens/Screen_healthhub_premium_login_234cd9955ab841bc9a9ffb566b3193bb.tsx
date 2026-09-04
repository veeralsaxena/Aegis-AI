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
    <>
      <div className="flex min-h-screen w-full font-sans relative overflow-hidden bg-slate-900/40 backdrop-blur-md">
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/50 to-white/3 z-0 pointer-events-none" />
        
  <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-center items-start px-16 xl:px-24 z-10">
    <div className="relative z-10 max-w-lg flex flex-col gap-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl font-bold tracking-tight text-white">Aegis AI</span>
      </div>
      <h1 className="text-white text-6xl xl:text-7xl font-bold leading-[1.05] tracking-[-0.02em]">
        Welcome back.
      </h1>
      <p className="text-slate-300 text-lg xl:text-xl font-light leading-relaxed border-l-[3px] border-white/20 pl-5">
        Log in to access your health dashboard and track your progress in real-time.
      </p>
    </div>
  </div>
  <div className="w-full lg:w-1/2 flex flex-col relative h-screen overflow-y-auto z-10">
    <div className="flex-1 flex items-center justify-center p-6 md:p-12 z-10">
      <div className="w-full max-w-[440px]">
        <div className="flex lg:hidden items-center gap-3 justify-center mb-10">
          <span className="text-2xl font-bold tracking-tight text-white">Aegis AI</span>
        </div>
        <div className="relative p-8 md:p-12 group">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute -inset-24 bg-white/5 rounded-full blur-[120px] opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none" />
          <div className="mb-8">
            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400 text-lg">error</span>
                <p className="text-red-400 text-sm font-medium">{error}</p>
              </div>
            )}
            <h2 className="text-3xl font-semibold text-white mb-2 tracking-tight">Sign in</h2>
            <p className="text-slate-400 text-sm font-light tracking-wide">Enter your Bahmni credentials to access the secure portal.</p>
          </div>
          <form className="flex flex-col gap-5" onSubmit={handleLogin}>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-light tracking-[0.1em] uppercase text-slate-300" htmlFor="username">Username</label>
              <div className="relative flex items-center group">
                <span className="material-symbols-outlined absolute left-4 text-slate-500 group-focus-within:text-white transition-colors">person</span>
                <input
                  className="w-full bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 focus:border-white/40 focus:ring-1 focus:ring-white/20 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-500 transition-all outline-none font-light shadow-inner"
                  id="username"
                  name="username"
                  placeholder="e.g. superman"
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-light tracking-[0.1em] uppercase text-slate-300" htmlFor="password">Password</label>
              </div>
              <div className="relative flex items-center group">
                <span className="material-symbols-outlined absolute left-4 text-slate-500 group-focus-within:text-white transition-colors">lock</span>
                <input
                  className="w-full bg-black/30 backdrop-blur-md border border-white/10 hover:border-white/20 focus:border-white/40 focus:ring-1 focus:ring-white/20 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-slate-500 transition-all outline-none font-light shadow-inner"
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
              className="mt-6 w-full bg-blue-600 hover:bg-blue-500 text-white text-base font-semibold py-4 rounded-xl shadow-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin material-symbols-outlined text-[20px]">progress_activity</span>
                  Authenticating...
                </>
              ) : (
                <>
                  Log In
                  <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                </>
              )}
            </button>
          </form>
          <div className="mt-8 flex items-center justify-center gap-2 text-slate-500 text-xs font-light tracking-wide">
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            <span>Secure, HIPAA-compliant connection</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

    </>
  );
}
