"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ProjectSidebar } from "@/components/project-sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { MainLayout } from "@/components/main-layout"
import { useProjects } from "@/contexts/project-context"
import { useAuth } from "@/contexts/auth-context"
import { createProjectWithSession, type CreateProjectWithSessionRequest, communicateWithMasterAgent } from "@/lib/api"
import { useWebSocket } from "@/contexts/websocket-context"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"


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
  const [showPopup, setShowPopup] = useState(false)
  const [popupInitialIdea, setPopupInitialIdea] = useState("")
  const [popupMessage, setPopupMessage] = useState("")
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null)
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
    // Store the message and show popup first
    setPendingUserMessage(message)
    setPopupMessage(message)
    setShowPopup(true)
  }

  const handlePopupSubmit = async () => {
    if (!popupInitialIdea.trim() || !popupMessage.trim()) {
      return
    }

    setShowPopup(false)
    setShowLoader(true)
    
    try {
      const requestData: CreateProjectWithSessionRequest = {
        initial_idea: popupInitialIdea.trim(),
        agent_mode: "conversation"
      }
      const response = await createProjectWithSession(requestData)
    
      await refreshProjects()
      const newProject = response.project
      const newSession = response.session

      // Call communicate API after project and session are created with popup values
      try {
        const communicateResponse = await communicateWithMasterAgent({
          session_id: newSession.id,
          project_id: newProject.id,
          message: popupMessage.trim(),
          initial_idea: popupInitialIdea.trim()
        })
        
        // Store communicate response in sessionStorage to handle it on chat page
        if (communicateResponse) {
          sessionStorage.setItem('pendingCommunicateResponse', JSON.stringify({
            message: communicateResponse.message,
            proposal_html: communicateResponse.proposal_html,
            proposal_title: communicateResponse.proposal_title,
            session_id: communicateResponse.session_id
          }))
        }
      } catch (communicateError) {
        console.error("Error calling communicate API:", communicateError)
        // Continue even if communicate API fails
      }

      // Store user message in sessionStorage to display it in chat
      sessionStorage.setItem('pendingMessage', popupMessage.trim())
      sessionStorage.setItem('pendingSessionId', newSession.id)
      
      // Clear popup state
      setPopupInitialIdea("")
      setPopupMessage("")
      setPendingUserMessage(null)
      
      router.push(`/chat/${newSession.id}?project=${newProject.id}`)
    } catch (error) {
      setPendingMessage(null)
      sessionStorage.removeItem('pendingMessage')
      sessionStorage.removeItem('pendingSessionId')
    } finally {
      setShowLoader(false)
    }
  }

  const handlePopupCancel = () => {
    setShowPopup(false)
    setPopupInitialIdea("")
    setPopupMessage("")
    setPendingUserMessage(null)
  }

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen bg-[#0a0a0a]">
      {/* Initial Idea & Message Popup */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">Project Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              Please provide your initial idea and message to continue
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="initial_idea" className="text-sm font-medium text-gray-300">
                Initial Idea *
              </Label>
              <Textarea
                id="initial_idea"
                value={popupInitialIdea}
                onChange={(e) => setPopupInitialIdea(e.target.value)}
                placeholder="Describe your project idea..."
                rows={4}
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20 resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message" className="text-sm font-medium text-gray-300">
                Message *
              </Label>
              <Textarea
                id="message"
                value={popupMessage}
                onChange={(e) => setPopupMessage(e.target.value)}
                placeholder="Enter your message..."
                rows={3}
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handlePopupCancel}
                className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePopupSubmit}
                disabled={!popupInitialIdea.trim() || !popupMessage.trim()}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
