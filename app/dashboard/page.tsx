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
    
    if (isAuthenticated && projects.length > 0 && !cleanupDoneRef.current) {
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
      
      const newProject = response.project
      const newSession = response.session
      
      // Navigate to the new session
      router.push(`/chat/${newSession.id}`)
      
    } catch (error) {
      console.error("[Dashboard] Failed to create project with session:", error)
      setPendingMessage(null) // Clear pending message on error
    }
  }

  const handleProjectSelect = (projectId: string) => {
    router.push(`/project/${projectId}`)
  }

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-semibold text-white">What do you want to create?</h1>
        <p className="text-lg text-gray-400">Start building with a single prompt. No coding needed.</p>
        
        <div className="w-full max-w-xl">
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
