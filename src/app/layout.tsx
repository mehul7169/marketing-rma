import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Funnel Dashboard",
  description: "Meta Ads & site analytics internal dashboard"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {/* TODO: This is an internal tool. Add basic-auth/login later if needed. */}
        <div className="min-h-screen">
          <header className="border-b border-slate-200">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <div className="text-sm font-medium text-slate-900">
                Funnel Dashboard
              </div>
              <nav className="flex gap-4 text-sm">
                <a
                  className="text-slate-600 hover:text-slate-900"
                  href="/"
                >
                  Home
                </a>
                <a
                  className="text-slate-600 hover:text-slate-900"
                  href="/meta-ads"
                >
                  Meta Ads
                </a>
                <a
                  className="text-slate-600 hover:text-slate-900"
                  href="/website"
                >
                  Website
                </a>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-8">
            {children}
          </main>
          <footer className="mx-auto max-w-6xl px-6 pb-10 pt-6 text-xs text-slate-500">
            Internal tool. Data pulls run hourly via Vercel Cron.
          </footer>
        </div>
      </body>
    </html>
  );
}

