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


  // Suggested prompts
  const suggestedPrompts = [
    { text: "Generate a comprehensive project proposal" },
    { text: "Create a business plan document" },
    { text: "Build a detailed project timeline" },
    { text: "Develop a project scope document" },
    { text: "Create a requirements specification" },
    { text: "Design a technical architecture" },
    { text: "Generate a project budget estimate" },
    { text: "Create a project roadmap" }
  ]

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0a0a0a]">
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
              <h2 className="text-xl font-semibold text-white">Creating your project...</h2>
              <p className="text-sm text-gray-400">Please wait while we set everything up</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content Area - No Container Background */}
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
            Choose a prompt below or write your own to start chatting with Ilham AI.
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

        {/* Suggested Prompts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {suggestedPrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => handleNewChat(prompt.text)}
              className="flex items-center gap-3 p-4 bg-[#1a1a1a] hover:bg-[#232326] border border-[#2a2a2a] rounded-xl text-left transition-all duration-200 hover:border-green-600 group"
            >
              <span className="text-sm font-medium text-gray-300 group-hover:text-white">
                {prompt.text}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 pt-4 border-t border-[#2a2a2a]">
          <p>2024 Ilham AI · Privacy Policy · Support</p>
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
