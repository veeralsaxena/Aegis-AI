"use client";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Login page keeps the original bg-hero.jpg background */}
      <div
        className="fixed inset-0 z-[-1] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(5, 11, 16, 0.4), rgba(5, 11, 16, 0.4)), url('/bg-hero.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
        }}
      />
      {children}
    </>
  );
}
