import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { DashboardProvider } from "./providers";
import XpHeader from "./components/XpHeader";
import BottomNav from "./components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Matt's Dashboard",
  description: "Personal life OS — health, habits, finance, relationships.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <DashboardProvider>
          <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-slate-100">
            <XpHeader />
            <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
            <BottomNav />
          </div>
        </DashboardProvider>
      </body>
    </html>
  );
}
