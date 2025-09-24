"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ProjectSidebar } from "@/components/project-sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { MainLayout } from "@/components/main-layout"
import { useProjects } from "@/contexts/project-context"
import { useAuth } from "@/contexts/auth-context"
import { createProjectWithSession, type CreateProjectWithSessionRequest } from "@/lib/api"
import { useWebSocket } from "@/contexts/websocket-context"

function DashboardContent() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const { projects, createProject, refreshProjects } = useProjects()
  const { 
    startSession, 
    endSession,
    activeSessionId,
    sendMessage,
    setPendingMessage
  } = useWebSocket()
  
  const cleanupDoneRef = useRef(false)

  useEffect(() => {
    const cleanupEmptyProjects = async () => {
      if (!projects || projects.length === 0 || !isAuthenticated || cleanupDoneRef.current) return
      cleanupDoneRef.current = true
      // Cleanup logic here if needed
    }
    
  if (isAuthenticated && Array.isArray(projects) && projects.length > 0 && !cleanupDoneRef.current) {
      cleanupEmptyProjects()
    }
  }, [projects, isAuthenticated])

  const handleNewChat = async (message: string) => {
    try {
      setPendingMessage(message)
      const projectTitle = message.length > 50 ? message.substring(0, 47) + "..." : message
      console.log("[Dashboard] Creating project with session:", projectTitle)
      const requestData: CreateProjectWithSessionRequest = {
        title: projectTitle,
        initial_idea: message,
        agent_mode: "conversation"
      }
      const response = await createProjectWithSession(requestData)
      console.log("[Dashboard] Project and session created:", response)
      // Refresh sidebar projects so new project appears
      await refreshProjects()
      const newProject = response.project
      const newSession = response.session
      // Navigate to the new session with project ID
      router.push(`/chat/${newSession.id}?project=${newProject.id}`)
    } catch (error) {
      console.error("[Dashboard] Failed to create project with session:", error)
      setPendingMessage(null) // Clear pending message on error
    }
  }


  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0a0a0a]">
      <div className="max-w-2xl w-full mx-auto text-center space-y-8 p-8 rounded-2xl shadow-2xl bg-[#18181b]/90 border border-[#23232a] backdrop-blur-md">
        <h1 className="text-4xl font-extrabold text-white drop-shadow-lg">What do you want to create?</h1>
        <p className="text-lg text-gray-400 mb-2">Start building with a single prompt. No coding needed.</p>
        <div className="flex items-center justify-center mb-6">
          <span className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-green-600 via-blue-700 to-green-700 text-white text-xs font-semibold shadow-lg border border-green-700/60 drop-shadow-[0_0_8px_rgba(34,197,94,0.4)] animate-pulse">
            <span className="mr-1">✨</span>AI-powered project creation
          </span>
        </div>
        <div className="w-full max-w-xl mx-auto">
          <ChatInterface
            sessionId={null}
            projectId={null}
            onNewChat={handleNewChat}
            isDocumentMode={false}
            isWelcomeMode={true}
            onDocumentGenerated={undefined}
          />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <MainLayout>
      <DashboardContent />
    </MainLayout>
  )
}
