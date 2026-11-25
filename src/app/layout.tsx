import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import AppShell from "@/components/AppShell";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { THEME_COOKIE, THEME_INIT_SCRIPT, parseThemePreference } from "@/lib/ui/theme";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Funnel Dashboard",
  description: "Meta Ads & site analytics internal dashboard",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }]
  }
};

export const viewport: Viewport = {
  colorScheme: "light dark"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const preference = parseThemePreference(cookies().get(THEME_COOKIE)?.value);
  const dataTheme = preference === "system" ? undefined : preference;
  const colorScheme = preference === "system" ? "light dark" : preference;

  return (
    <html
      lang="en"
      className={`h-full ${inter.variable}`}
      data-theme={dataTheme}
      style={{ colorScheme }}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${inter.className} h-full bg-page text-fg antialiased`}>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
