"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

const NAV_ITEMS = [
  { label: "Register Patient", href: "/patients", icon: "person_add", exact: false },
  { label: "Clinical", href: "/clinical", icon: "stethoscope", exact: false },
  { label: "Appointments", href: "/appointments", icon: "calendar_month", exact: false },
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
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200">
        <span className="text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap">
          Saarthi
        </span>
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="ml-auto text-slate-400 hover:text-slate-900 transition-colors shrink-0 hidden md:block"
        >
          <span className="material-symbols-outlined text-xl">
            {sidebarOpen ? "chevron_left" : "chevron_right"}
          </span>
        </button>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="ml-auto text-slate-400 hover:text-slate-900 transition-colors shrink-0 md:hidden"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group ${isActive
                ? "bg-slate-900 text-white font-medium shadow-sm"
                : "text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50"
                }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] shrink-0 transition-colors ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-900"
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
      <div className="border-t border-slate-200 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-slate-600 text-lg">person</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-900 font-semibold text-sm truncate">{user?.display || "User"}</p>
            <p className="text-slate-500 font-medium text-[10px] uppercase tracking-wider truncate">{locationName || "Bahmni Clinic"}</p>
          </div>
          <button
            onClick={logout}
            className="text-slate-400 hover:text-rose-600 transition-colors shrink-0 p-2 rounded-lg hover:bg-rose-50"
            title="Logout"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#FDFDFD] text-slate-900 relative">
      {/* Mobile Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-white border-b border-slate-200 flex items-center px-4 py-3">
        <button onClick={() => setMobileOpen(true)} className="text-slate-500 hover:text-slate-900 transition-colors">
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
        <span className="ml-3 text-lg font-bold tracking-tight text-slate-900">Saarthi</span>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 h-full flex flex-col bg-white border-r border-slate-200 shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 hidden md:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ${sidebarOpen ? "w-72" : "w-[88px]"
          }`}
      >
        {sidebarOpen ? (
          sidebarContent
        ) : (
          <>
            {/* Collapsed Logo */}
            <div className="flex items-center justify-center px-2 py-5 border-b border-slate-200">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-700 text-xl">ecg_heart</span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="mx-auto mt-4 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">chevron_right</span>
            </button>
            {/* Collapsed nav icons */}
            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5">
              {NAV_ITEMS.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={`flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all ${isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                      }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  </Link>
                );
              })}
            </nav>
            {/* Collapsed user */}
            <div className="border-t border-slate-200 px-2 py-5 flex flex-col items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-slate-600 text-lg">person</span>
              </div>
              <button
                onClick={logout}
                className="text-slate-400 hover:text-rose-600 transition-colors p-2 rounded-lg hover:bg-rose-50"
                title="Logout"
              >
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
