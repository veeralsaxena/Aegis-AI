import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Aegis AI",
  description: "Next-generation healthcare management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      </head>
      <body
        className={`${inter.variable} antialiased text-white relative min-h-screen`}
      >
        {/* Global background image */}
        <div 
          className="fixed inset-0 z-[-1] pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(rgba(5, 11, 16, 0.4), rgba(5, 11, 16, 0.4)), url('/bg-hero.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed"
          }}
        />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
