"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

const NAV_ITEMS = [
  { label: "Register Patient", href: "/patients", icon: "person_add", exact: false },
  { label: "Clinical", href: "/clinical", icon: "stethoscope", exact: false },
  { label: "Timeline", href: "/timeline", icon: "timeline", exact: true },
  { label: "Vitals", href: "/vitals", icon: "monitor_heart", exact: true },
  { label: "Medications", href: "/medications", icon: "medication", exact: true },
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
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-blue-600 text-5xl animate-spin">progress_activity</span>
          <p className="text-black/50 text-sm font-bold uppercase tracking-wider">Verifying session...</p>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-black/5">
        <div className="p-2 rounded-xl bg-black/5 shadow-inner flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-blue-600 text-xl">ecg_heart</span>
        </div>
        <span className="text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60 whitespace-nowrap">
          Aegis AI
        </span>
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="ml-auto text-black/40 hover:text-black transition-colors shrink-0 hidden md:block"
        >
          <span className="material-symbols-outlined text-xl">
            {sidebarOpen ? "chevron_left" : "chevron_right"}
          </span>
        </button>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto text-black/40 hover:text-black transition-colors shrink-0 md:hidden"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all group ${isActive
                ? "bg-blue-600 shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] text-white"
                : "text-black/50 hover:text-black hover:bg-black/5"
                }`}
            >
              <span
                className={`material-symbols-outlined text-xl shrink-0 ${isActive ? "text-white" : "text-black/40 group-hover:text-blue-600"
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
      <div className="border-t border-black/5 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center shrink-0 shadow-inner">
            <span className="material-symbols-outlined text-blue-600 text-lg">person</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-black font-bold text-sm truncate">{user?.display || "User"}</p>
            <p className="text-black/40 font-semibold text-[10px] uppercase tracking-wider truncate">{locationName || "Bahmni Clinic"}</p>
          </div>
          <button
            onClick={logout}
            className="text-black/30 hover:text-red-500 transition-colors shrink-0 p-2 rounded-xl hover:bg-red-50"
            title="Logout"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-white text-black relative overflow-hidden">
      {/* Subtle Grid Background for extreme depth */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(black 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      ></div>
      {/* Spotlight glow behind the page */}
      <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

      {/* Mobile Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-white/80 backdrop-blur-2xl border-b border-black/5 flex items-center px-4 py-3 shadow-sm">
        <button onClick={() => setMobileOpen(true)} className="text-black/60 hover:text-black transition-colors">
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
        <span className="ml-3 text-xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-black to-black/60">Aegis AI</span>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 h-full flex flex-col bg-white border-r border-black/5 shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden md:flex flex-col bg-white/80 backdrop-blur-2xl border-r border-black/5 shadow-[20px_0_60px_-15px_rgba(0,0,0,0.05)] transition-all duration-300 ${sidebarOpen ? "w-72" : "w-[88px]"
          }`}
      >
        {sidebarOpen ? (
          sidebarContent
        ) : (
          <>
            {/* Collapsed Logo */}
            <div className="flex items-center justify-center px-2 py-5 border-b border-black/5">
              <div className="p-2 rounded-xl bg-black/5 shadow-inner flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-600 text-xl">ecg_heart</span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="mx-auto mt-4 text-black/40 hover:text-black transition-colors"
            >
              <span className="material-symbols-outlined text-xl">chevron_right</span>
            </button>
            {/* Collapsed nav icons */}
            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
              {NAV_ITEMS.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex items-center justify-center p-3 rounded-2xl transition-all ${isActive
                      ? "bg-blue-600 shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] text-white"
                      : "text-black/40 hover:text-black hover:bg-black/5"
                      }`}
                  >
                    <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  </Link>
                );
              })}
            </nav>
            {/* Collapsed user */}
            <div className="border-t border-black/5 px-2 py-5 flex flex-col items-center gap-4">
              <div className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-blue-600 text-lg">person</span>
              </div>
              <button onClick={logout} className="text-black/30 hover:text-red-500 transition-colors p-2 rounded-xl hover:bg-red-50" title="Logout">
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Main Content */}
      <main
        className={`flex-1 transition-all duration-300 pt-16 md:pt-0 relative z-10 ${sidebarOpen ? "md:ml-72" : "md:ml-[88px]"}`}
      >
        {children}
      </main>
    </div>
  );
}
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardGuard>{children}</DashboardGuard>;
}
