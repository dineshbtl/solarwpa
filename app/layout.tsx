import type React from "react"
import type { Metadata, Viewport } from "next"
import { IBM_Plex_Sans } from "next/font/google"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { ChunkLoadRecovery } from "@/components/chunk-load-recovery"
import { Toaster } from "@/components/ui/toaster"
import { PWAInstallPrompt } from "@/components/pwa-install-prompt"
import "./globals.css"

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-sans",
})

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: "Skyvolts",
  description: "Skyvolts Solar installation EPC workflow management system",
  generator: 'v0.app',
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Skyvolts",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${ibmPlexSans.variable} font-sans antialiased bg-page`}>
        {/* Intentionally no next-themes ThemeProvider: it injects an inline script that
            strict CSP / Safari Private often block and can crash the whole app on `/`. */}
        <ChunkLoadRecovery />
        <LayoutWrapper>{children}</LayoutWrapper>
        <Toaster />
        <PWAInstallPrompt />
        {/* Fatal Offline Fallback UI (hidden by default) */}
        <div id="offline-fatal-fallback" style={{ display: "none", position: "fixed", inset: 0, backgroundColor: "#f3f4f6", zIndex: 99999, padding: "2rem", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: "sans-serif" }}>
          <svg style={{ width: "64px", height: "64px", color: "#d97706", marginBottom: "1rem" }} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#111827", marginBottom: "0.5rem" }}>Update Required</h2>
          <p style={{ color: "#4b5563", marginBottom: "1.5rem", maxWidth: "400px" }}>The application has been updated, but some required files are missing. Please reconnect to the internet to finish the update.</p>
          <a href="/" style={{ padding: "0.75rem 1.5rem", backgroundColor: "#f59e0b", color: "white", textDecoration: "none", borderRadius: "0.5rem", fontWeight: "bold", cursor: "pointer" }}>Reload App</a>
        </div>
      </body>
    </html>
  )
}

