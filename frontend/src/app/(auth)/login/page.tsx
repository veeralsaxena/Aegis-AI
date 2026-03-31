"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ScreenLogin from "@/components/screens/Screen_healthhub_premium_login_234cd9955ab841bc9a9ffb566b3193bb";

export default function LoginPage() {
  const { authenticated, loading } = useAuth();
  const router = useRouter();

  // If already authenticated (e.g. after page reload), redirect to dashboard
  useEffect(() => {
    if (!loading && authenticated) {
      router.replace("/patients");
    }
  }, [loading, authenticated, router]);

  // Show nothing while checking auth state to avoid flash
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <span className="animate-spin material-symbols-outlined text-primary text-4xl">progress_activity</span>
      </div>
    );
  }

  // Only render login form if not authenticated
  if (authenticated) return null;

  return <ScreenLogin />;
}
