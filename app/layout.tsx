import type React from "react"
import type { Metadata } from "next"
import { IBM_Plex_Sans } from "next/font/google"
import { LayoutWrapper } from "@/components/layout-wrapper"
import { ChunkLoadRecovery } from "@/components/chunk-load-recovery"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-ibm-plex-sans",
})

export const metadata: Metadata = {
  title: "SolarEPC - Installation Management",
  description: "Solar rooftop installation EPC workflow management system",
    generator: 'v0.app'
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
      </body>
    </html>
  )
}
