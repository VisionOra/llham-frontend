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

  const [showLoader, setShowLoader] = useState(false)
  const cleanupDoneRef = useRef(false)
  const pendingMessageChecked = useRef(false)

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

  useEffect(() => {
    if (!isAuthenticated || pendingMessageChecked.current) return
    
    const pendingMessage = sessionStorage.getItem('pendingMessage')
    if (pendingMessage) {
      pendingMessageChecked.current = true
      sessionStorage.removeItem('pendingMessage')
      handleNewChat(pendingMessage)
    }
  }, [isAuthenticated])

  const handleNewChat = async (message: string) => {
    setShowLoader(true)
    try {
      const requestData: CreateProjectWithSessionRequest = {
        initial_idea: message,
        agent_mode: "conversation"
      }
      const response = await createProjectWithSession(requestData)
    
      await refreshProjects()
      const newProject = response.project
      const newSession = response.session
      setPendingMessage(message)
      sessionStorage.setItem('pendingMessage', message)
      sessionStorage.setItem('pendingSessionId', newSession.id)
      router.push(`/chat/${newSession.id}?project=${newProject.id}`)
    } catch (error) {
      setPendingMessage(null)
      sessionStorage.removeItem('pendingMessage')
      sessionStorage.removeItem('pendingSessionId')
    } finally {
      setShowLoader(false)
    }
  }


  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0a0a0a]">
      {/* Loader overlay */}
      {showLoader && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div className="max-w-2xl w-full mx-auto text-center space-y-2 p-8">
        <h1 className="text-4xl font-extrabold text-white drop-shadow-lg">What do you want to create?</h1>
        <p className="text-lg text-gray-400 mb-4">Start building with a single prompt. No coding needed.</p>
     
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
