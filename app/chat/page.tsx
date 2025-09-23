"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { AuthGuard } from "@/components/auth-guard"

function ChatPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (!isAuthenticated) return

    const sessionId = searchParams.get('sessionId')
    const projectId = searchParams.get('project')

    if (sessionId) {
      // If sessionId is provided, redirect to the session route
      router.replace(`/chat/${sessionId}`)
    } else if (projectId) {
      // If only projectId is provided, create a new session for that project
      // For now, redirect to dashboard to handle project selection
      router.replace(`/dashboard`)
    } else {
      // No parameters, redirect to dashboard
      router.replace('/dashboard')
    }
  }, [router, searchParams, isAuthenticated])

  // Show loading while redirecting
  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 bg-white rounded mx-auto mb-4 flex items-center justify-center">
          <span className="text-black text-sm font-bold">v0</span>
        </div>
        <p className="text-gray-400">Loading chat...</p>
      </div>
    </div>
  )
}

export default function ChatPage() {
  return (
    <AuthGuard>
      <ChatPageContent />
    </AuthGuard>
  )
}
