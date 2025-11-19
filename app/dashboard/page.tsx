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
    activeSessionId,
    sendMessage,
    setPendingMessage
  } = useWebSocket()

  const [showLoader, setShowLoader] = useState(false)
  const cleanupDoneRef = useRef(false)
  const pendingMessageChecked = useRef(false)
  const isCreatingSessionRef = useRef(false)

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

  const handleNewChat = useCallback(async (message: string) => {
    if (!message.trim()) {
      return
    }

    // Prevent duplicate calls
    if (isCreatingSessionRef.current) {
      return
    }

    isCreatingSessionRef.current = true
    setShowLoader(true)
    
    try {
      const requestData: CreateProjectWithSessionRequest = {
        agent_mode: "conversation"
      }
      const response = await createProjectWithSession(requestData)
    
      await refreshProjects()
      const newProject = response.project
      const newSession = response.session

      // Store user message and session info for chat interface
      sessionStorage.setItem('pendingMessage', message.trim())
      sessionStorage.setItem('pendingSessionId', newSession.id)
      sessionStorage.setItem('pendingProjectId', newProject.id)
      
      // Close loader and navigate immediately after createProjectWithSession completes
      setShowLoader(false)
      router.push(`/chat/${newSession.id}?project=${newProject.id}`)
      
      // Note: communicateWithMasterAgent will be called in the chat interface
      // to show the response there instead of waiting here
    } catch (error) {
      console.error("Error creating project:", error)
      sessionStorage.removeItem('pendingMessage')
      sessionStorage.removeItem('pendingSessionId')
      sessionStorage.removeItem('pendingProjectId')
      setShowLoader(false)
      isCreatingSessionRef.current = false
    }
  }, [router, refreshProjects])

  useEffect(() => {
    if (!isAuthenticated || pendingMessageChecked.current || isCreatingSessionRef.current) return
    
    const pendingMessage = sessionStorage.getItem('pendingMessage')
    if (pendingMessage) {
      pendingMessageChecked.current = true
      sessionStorage.removeItem('pendingMessage')
      handleNewChat(pendingMessage)
    }
  }, [isAuthenticated, handleNewChat])

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#0a0a0a]">
      {/* Full Screen Loader */}
      {showLoader && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a]/95 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center space-y-6">
            {/* Large Spinner */}
            <div className="relative">
              <div className="w-20 h-20 border-4 border-green-600/30 rounded-full"></div>
              <div className="w-20 h-20 border-4 border-green-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
            
            {/* Loading Text */}
            <div className="flex flex-col items-center space-y-2">
              <h2 className="text-xl font-semibold text-white">Creating your session...</h2>
              <p className="text-sm text-gray-400">Please wait while we set everything up</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content Area - No Container Background */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="w-full max-w-4xl mx-auto p-8 md:p-12">
          {/* Greeting Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-300 mb-2">
              Hi, {user?.first_name || user?.username || 'there'}
            </h2>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
              What can I help you with?
            </h1>
            <p className="text-base text-gray-400">
              Write your message below to start chatting with Ilham AI.
            </p>
          </div>

          {/* Input Area */}
          <div className="mb-8">
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

      {/* Footer - Fixed at bottom */}
      <div className="w-full text-center text-sm text-gray-500 py-4 border-t border-[#2a2a2a] mt-auto">
        <p>2024 Ilham AI · Privacy Policy · Support</p>
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
