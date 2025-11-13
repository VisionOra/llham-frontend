import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
// import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { AuthProvider } from "@/contexts/auth-context"
import { ProjectProvider } from "@/contexts/project-context"
import { WebSocketProvider } from "@/contexts/websocket-context"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "Ilham - AI Proposal Generator",
  description: "AI-powered project proposal generator with document editing",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} bg-[#0a0a0a]` }>
        <AuthProvider>
          <ProjectProvider>
            <WebSocketProvider>
              <Suspense fallback={null}>{children}</Suspense>
            </WebSocketProvider>
          </ProjectProvider>
        </AuthProvider>
        <Toaster position="top-right" richColors />
        {/* <Analytics /> */}
      </body>
    </html>
  )
}
