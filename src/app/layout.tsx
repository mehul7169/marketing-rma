import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppNav from "@/components/AppNav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Funnel Dashboard",
  description: "Meta Ads & site analytics internal dashboard",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }]
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen">
          <header className="nav-brand-bar bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <a href="/" className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/run-more-ads-logo.svg"
                  alt="Run More Ads"
                  className="h-8 w-auto"
                  height={32}
                />
                <span className="text-xs font-medium tracking-wide text-slate-500">
                  Dashboard
                </span>
              </a>
              <AppNav />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
          <footer className="mx-auto max-w-6xl px-6 pb-10 pt-6 text-xs text-slate-500">
            Internal tool. Data pulls run hourly via Vercel Cron.
          </footer>
        </div>
      </body>
    </html>
  );
}
