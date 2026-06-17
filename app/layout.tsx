import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { DashboardProvider } from "./providers";
import XpHeader from "./components/XpHeader";
import BottomNav from "./components/BottomNav";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
    <html lang="en" className={`${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <DashboardProvider>
          <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg text-ink">
            <XpHeader />
            <main className="flex-1 px-5 pb-24 pt-4">{children}</main>
            <BottomNav />
          </div>
        </DashboardProvider>
      </body>
    </html>
  );
}
