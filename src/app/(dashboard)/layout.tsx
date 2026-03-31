"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

const NAV_ITEMS = [
  { label: "Register Patient", href: "/patients", icon: "person_add", exact: false },
  { label: "Timeline", href: "/timeline", icon: "timeline", exact: true },
  { label: "Vitals", href: "/vitals", icon: "monitor_heart", exact: true },
  { label: "Medications", href: "/medications", icon: "medication", exact: true },
  { label: "Prescriptions", href: "/prescriptions", icon: "pill", exact: true },
  { label: "Lab Results", href: "/lab-results", icon: "biotech", exact: true },
  { label: "Routine Panel", href: "/routine-panel", icon: "labs", exact: true },
  { label: "Ward Map", href: "/ward-map", icon: "bed", exact: true },
  { label: "Providers", href: "/providers", icon: "group_add", exact: true },
  { label: "Billing", href: "/billing", icon: "receipt_long", exact: true },
];

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { authenticated, loading, user, logout, locationName } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !authenticated) {
      router.push("/login");
    }
  }, [loading, authenticated, router]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !authenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-transparent text-foreground">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
          <p className="text-slate-400 text-sm">Verifying session...</p>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
        <span
          className="material-symbols-outlined text-primary text-2xl shrink-0"
          style={{ filter: "drop-shadow(0 0 6px rgba(37,192,244,0.5))" }}
        >
          ecg_heart
        </span>
        <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
          Aegis AI
        </span>
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="ml-auto text-slate-500 hover:text-white transition-colors shrink-0 hidden md:block"
        >
          <span className="material-symbols-outlined text-xl">
            {sidebarOpen ? "chevron_left" : "chevron_right"}
          </span>
        </button>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto text-slate-500 hover:text-white transition-colors shrink-0 md:hidden"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(37,192,244,0.2)]"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <span
                className={`material-symbols-outlined text-xl shrink-0 ${
                  isActive ? "text-primary" : "text-slate-500 group-hover:text-white"
                }`}
              >
                {item.icon}
              </span>
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className="border-t border-white/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-sm">person</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.display || "User"}</p>
            <p className="text-slate-500 text-[10px] truncate">{locationName || "Bahmni Clinic"}</p>
          </div>
          <button
            onClick={logout}
            className="text-slate-500 hover:text-red-400 transition-colors shrink-0"
            title="Logout"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-transparent text-foreground">
      {/* Mobile Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-slate-900/40 backdrop-blur-2xl border-b border-white/5 flex items-center px-4 py-3">
        <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
        <span className="ml-3 text-lg font-bold text-white">Aegis AI</span>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 h-full flex flex-col bg-slate-900/60 backdrop-blur-2xl border-r border-white/5">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden md:flex flex-col bg-slate-900/40 backdrop-blur-2xl border-r border-white/5 transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-[72px]"
        }`}
      >
        {sidebarOpen ? (
          sidebarContent
        ) : (
          <>
            {/* Collapsed Logo */}
            <div className="flex items-center justify-center px-2 py-5 border-b border-white/5">
              <span
                className="material-symbols-outlined text-primary text-2xl"
                style={{ filter: "drop-shadow(0 0 6px rgba(37,192,244,0.5))" }}
              >
                ecg_heart
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="mx-auto mt-3 text-slate-500 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-xl">chevron_right</span>
            </button>
            {/* Collapsed nav icons */}
            <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex items-center justify-center p-2.5 rounded-lg transition-all ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-slate-500 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  </Link>
                );
              })}
            </nav>
            {/* Collapsed user */}
            <div className="border-t border-white/5 px-2 py-4 flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-sm">person</span>
              </div>
              <button onClick={logout} className="text-slate-500 hover:text-red-400 transition-colors" title="Logout">
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 pt-14 md:pt-0 ${sidebarOpen ? "md:ml-64" : "md:ml-[72px]"}`}
      >
        {children}
      </main>
    </div>
  );
}
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardGuard>{children}</DashboardGuard>;
}
