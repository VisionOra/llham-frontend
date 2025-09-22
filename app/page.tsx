"use client"

import { useState } from "react"
import { ProjectSidebar } from "@/components/project-sidebar"
import { ChatInterface } from "@/components/chat-interface"
import { DocumentViewer } from "@/components/document-viewer"
import { AIEditSuggestion } from "@/components/ai-edit-suggestion"
import { useProjects } from "@/contexts/project-context"
import { useAIEditing } from "@/hooks/use-ai-editing"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, User, Clock, LogOut, MessageSquare, FileText } from "lucide-react"
import Link from "next/link"
import { getProjectSessions, getDocumentContent, createSession, createProjectWithSession, type Session as ApiSession, type ProjectWithSessions, type CreateSessionRequest, type CreateProjectWithSessionRequest } from "@/lib/api"
import { useWebSocket } from "@/contexts/websocket-context"
import { useEffect } from "react"

// Local Session interface that matches what ProjectSidebar expects
interface LocalSession {
  id: string
  project_id: string
  title: string
  initial_idea: string
  agent_mode: string
  has_document: boolean
  document?: any
  created_at: string
  updated_at: string
  proposal_title?: string
  current_stage: string
  is_proposal_generated: boolean
  conversation_history: Array<{
    role: string;
    message: string;
    timestamp: string;
  }>
  user: string
}

export default function IlhamApp() {
  const { user, isAuthenticated, logout } = useAuth()
  const { projects, currentProject, selectProject, createProject } = useProjects()
  const { 
    currentDocument: wsCurrentDocument, 
    messages: wsMessages,
    latestEditSuggestion,
    connectionStatus,
    startSession, 
    endSession,
    activeSessionId,
    acceptEdit,
    rejectEdit,
    sendMessage
  } = useWebSocket()
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [hasDocument, setHasDocument] = useState(false)
  const [currentDocument, setCurrentDocument] = useState<any>(null)
  const [showWelcome, setShowWelcome] = useState(true)
  const [projectSessions, setProjectSessions] = useState<LocalSession[]>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [showSessionsList, setShowSessionsList] = useState(false)
  const [loadingDocument, setLoadingDocument] = useState(false)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)

  const {
    suggestions,
    isLoading: isEditLoading,
    requestEdit,
    acceptSuggestion,
    rejectSuggestion,
    regenerateSuggestion,
  } = useAIEditing()

  // Send pending message when session is active and connected
  useEffect(() => {
    console.log("[v0] useEffect for pending message:", {
      activeSessionId,
      pendingMessage: !!pendingMessage,
      selectedSession,
      connectionStatus,
      match: selectedSession === activeSessionId
    })

    if (activeSessionId && pendingMessage && selectedSession === activeSessionId && connectionStatus === 'connected') {
      console.log("[v0] Sending pending message:", pendingMessage)
      sendMessage(pendingMessage)
      setPendingMessage(null) // Clear after sending
    }
  }, [activeSessionId, pendingMessage, selectedSession, sendMessage, connectionStatus])

  // Fallback: Send pending message after a delay if connection doesn't happen quickly
  useEffect(() => {
    if (activeSessionId && pendingMessage && selectedSession === activeSessionId) {
      const timeoutId = setTimeout(() => {
        if (pendingMessage) { // Check if message is still pending
          console.log("[v0] Timeout fallback: sending pending message regardless of connection status")
          sendMessage(pendingMessage)
          setPendingMessage(null)
        }
      }, 3000) // 3 second timeout

      return () => clearTimeout(timeoutId)
    }
  }, [activeSessionId, pendingMessage, selectedSession, sendMessage])

  const handleNewChat = async (message: string) => {
    try {
      // Store the message to send after session is created
      setPendingMessage(message)
      
      // Create project and session together using the new endpoint
      const projectTitle = message.length > 50 ? message.substring(0, 47) + "..." : message
      
      console.log("[v0] Creating project with session:", projectTitle)
      
      const requestData: CreateProjectWithSessionRequest = {
        title: projectTitle,
        initial_idea: message,
        agent_mode: "conversation"
      }
      
      const response = await createProjectWithSession(requestData)
      console.log("[v0] Project and session created:", response)
      
      // Update the projects context with the new project
      const newProject = response.project
      const newSession = response.session
      
      setSelectedProject(newProject.id)
      selectProject(newProject)
      setSelectedSession(newSession.id)
      setShowWelcome(false)
      setShowSessionsList(false)
      setHasDocument(false)
      setCurrentDocument(null)
      
      // Start WebSocket session with the real session ID
      // The pending message will be sent automatically via useEffect when session becomes active
      startSession(newSession.id, newProject.id)
      
      console.log("[v0] New chat started with real session:", newSession.id, "project:", newProject.id, "message:", message)
      
    } catch (error) {
      console.error("[v0] Failed to create project with session:", error)
      
      // Fallback to old behavior if the new endpoint fails
      try {
        const projectTitle = message.length > 50 ? message.substring(0, 47) + "..." : message
        
        console.log("[v0] Fallback: Creating project:", projectTitle)
        await createProject(projectTitle)
        
        // Wait for project context to update
        setTimeout(async () => {
          const currentProj = currentProject
          if (currentProj) {
            setSelectedProject(currentProj.id)
            
            try {
              // Create session in the project
              const sessionData: CreateSessionRequest = {
                initial_idea: message,
                agent_mode: "conversation"
              }
              
              const newSession = await createSession(currentProj.id, sessionData)
              
              setSelectedSession(newSession.id)
              setShowWelcome(false)
              setShowSessionsList(false)
              setHasDocument(false)
              setCurrentDocument(null)
              
              startSession(newSession.id, currentProj.id)
              
              console.log("[v0] Fallback successful with session:", newSession.id)
            } catch (sessionError) {
              console.error("[v0] Fallback session creation failed:", sessionError)
              
              // Ultimate fallback to temp session
              const tempSessionId = `temp-${Date.now()}`
              setSelectedSession(tempSessionId)
              setShowWelcome(false)
              setShowSessionsList(false)
              setHasDocument(false)
              setCurrentDocument(null)
              startSession(tempSessionId, currentProj.id)
            }
          }
        }, 100)
      } catch (projectError) {
        console.error("[v0] Complete fallback failed:", projectError)
        
        // Ultimate fallback to temp session
        const tempSessionId = `temp-${Date.now()}`
        setSelectedSession(tempSessionId)
        setShowWelcome(false)
        setShowSessionsList(false)
        setHasDocument(false)
        setCurrentDocument(null)
        startSession(tempSessionId, selectedProject)
      }
    }
  }

  const handleProjectSelect = async (projectId: string) => {
    const project = projects.find((p) => p.id === projectId)
    if (project) {
      selectProject(project)
      setSelectedProject(projectId)
      setSelectedSession(null)
      setHasDocument(false)
      setCurrentDocument(null)
      setShowWelcome(false)
      setShowSessionsList(true)
      
      // Fetch sessions for this project
      setLoadingSessions(true)
      try {
        const projectWithSessions = await getProjectSessions(projectId)
        // Map API Session to component Session format
        const mappedSessions: LocalSession[] = projectWithSessions.sessions.map((session) => ({
          id: session.id,
          project_id: session.project.id,
          title: session.proposal_title || session.initial_idea || 'Untitled Session',
          initial_idea: session.initial_idea,
          agent_mode: session.agent_mode,
          has_document: !!session.document || session.is_proposal_generated,
          document: session.document,
          created_at: session.created_at,
          updated_at: session.updated_at,
          proposal_title: session.proposal_title,
          current_stage: session.current_stage,
          is_proposal_generated: session.is_proposal_generated,
          conversation_history: session.conversation_history,
          user: session.user
        }))
        setProjectSessions(mappedSessions)
      } catch (error) {
        console.error('Failed to load project sessions:', error)
        setProjectSessions([])
      } finally {
        setLoadingSessions(false)
      }
    }
  }

  const handleSessionSelect = (sessionId: string, document?: any) => {
    console.log("[v0] Session selected:", sessionId)
    console.log("[v0] Document data:", document)

    // Find the session object to get all its data
    const session = projectSessions.find(s => s.id === sessionId)
    if (session) {
      // Use the same logic as handleSessionCardClick
      handleSessionCardClick(session)
    } else {
      // Fallback to old behavior if session not found
      setSelectedSession(sessionId)
      setShowWelcome(false)
      setShowSessionsList(false)

      if (document && (document.content || document.id)) {
        console.log("[v0] Setting hasDocument to true with document:", document)
        setHasDocument(true)
        
        const documentForViewer = {
          id: document.id || sessionId,
          title: document.title || 'Document',
          content: document.content || '<p>Document content is loading...</p>',
          created_at: document.created_at,
          updated_at: document.updated_at,
          author: document.author
        }
        
        setCurrentDocument(documentForViewer)
      } else {
        console.log("[v0] No document found, staying in chat mode")
        setHasDocument(false)
        setCurrentDocument(null)
      }
    }
  }

  const handleSessionCardClick = async (session: LocalSession) => {
    console.log("[v0] Session card clicked:", session.id)
    console.log("[v0] Session document:", session.document)
    console.log("[v0] Session has document:", !!session.document)
    console.log("[v0] Session is_proposal_generated:", session.is_proposal_generated)
    
    // Clear any pending message since we're loading an existing session
    setPendingMessage(null)
    
    setSelectedSession(session.id)
    setShowSessionsList(false)
    setShowWelcome(false)
    
    // Start WebSocket session (this will load previous messages)
    startSession(session.id, selectedProject)
    
    // Check if session has a document with content
    if (session.document && session.document.document && session.document.document.trim() !== '') {
      console.log("[v0] Session has document with HTML content - showing document center + chat sidebar")
      console.log("[v0] Document content length:", session.document.document.length)
      setHasDocument(true)
      
      // Create a properly formatted document object for the DocumentViewer
      const documentForViewer = {
        id: session.document.id || session.id,
        title: session.document.title || session.proposal_title || session.initial_idea || 'Document',
        content: session.document.document,
        created_at: session.document.created_at || session.created_at,
        updated_at: session.document.updated_at || session.updated_at,
        author: session.user
      }
      
      setCurrentDocument(documentForViewer)
    } else if (session.document && session.document.id) {
      console.log("[v0] Session has document ID but no content - fetching document content")
      setHasDocument(true)
      setLoadingDocument(true)
      
      // Show loading state first
      const loadingDocument = {
        id: session.document.id || session.id,
        title: session.proposal_title || session.initial_idea || 'Document',
        content: '<div style="text-align: center; padding: 40px;"><p>Loading document content...</p></div>',
        created_at: session.created_at,
        updated_at: session.updated_at,
        author: session.user
      }
      setCurrentDocument(loadingDocument)
      
      try {
        const documentContent = await getDocumentContent(session.id)
        console.log("[v0] Fetched document content:", documentContent)
        
        // Update with actual content
        const documentForViewer = {
          id: session.document.id || session.id,
          title: documentContent.title || session.proposal_title || session.initial_idea || 'Document',
          content: documentContent.document || documentContent.content || documentContent.html_content || documentContent.body || '<p>Document content could not be loaded.</p>',
          created_at: documentContent.created_at || session.created_at,
          updated_at: documentContent.updated_at || session.updated_at,
          author: session.user
        }
        
        setCurrentDocument(documentForViewer)
      } catch (error) {
        console.error("[v0] Failed to fetch document content:", error)
        
        // Show error state
        const errorDocument = {
          id: session.document.id || session.id,
          title: session.proposal_title || session.initial_idea || 'Document',
          content: '<div style="text-align: center; padding: 40px; color: #ef4444;"><p>Failed to load document content. Please try again.</p></div>',
          created_at: session.created_at,
          updated_at: session.updated_at,
          author: session.user
        }
        
        setCurrentDocument(errorDocument)
      } finally {
        setLoadingDocument(false)
      }
    } else if (session.is_proposal_generated) {
      console.log("[v0] Session has proposal generated but no document - trying to fetch content")
      setHasDocument(true)
      setLoadingDocument(true)
      
      // Show loading state first
      const loadingDocument = {
        id: session.id,
        title: session.proposal_title || session.initial_idea || 'Generated Proposal',
        content: '<div style="text-align: center; padding: 40px;"><p>Loading generated proposal...</p></div>',
        created_at: session.created_at,
        updated_at: session.updated_at,
        author: session.user
      }
      setCurrentDocument(loadingDocument)
      
      try {
        const documentContent = await getDocumentContent(session.id)
        console.log("[v0] Fetched generated proposal content:", documentContent)
        
        // Update with actual content
        const documentForViewer = {
          id: session.id,
          title: documentContent.title || session.proposal_title || session.initial_idea || 'Generated Proposal',
          content: documentContent.document || documentContent.content || documentContent.html_content || documentContent.body || `
            <h1>${session.proposal_title || session.initial_idea}</h1>
            <p><strong>Status:</strong> ${session.current_stage}</p>
            <p><strong>Created:</strong> ${new Date(session.created_at).toLocaleDateString()}</p>
            <p><strong>Last Updated:</strong> ${new Date(session.updated_at).toLocaleDateString()}</p>
            <p><em>This proposal has been generated but the content could not be loaded.</em></p>
          `,
          created_at: documentContent.created_at || session.created_at,
          updated_at: documentContent.updated_at || session.updated_at,
          author: session.user
        }
        
        setCurrentDocument(documentForViewer)
      } catch (error) {
        console.error("[v0] Failed to fetch generated proposal:", error)
        
        // Create a placeholder document for generated proposals without content
        const placeholderDocument = {
          id: session.id,
          title: session.proposal_title || session.initial_idea || 'Generated Proposal',
          content: `
            <h1>${session.proposal_title || session.initial_idea}</h1>
            <p><strong>Status:</strong> ${session.current_stage}</p>
            <p><strong>Created:</strong> ${new Date(session.created_at).toLocaleDateString()}</p>
            <p><strong>Last Updated:</strong> ${new Date(session.updated_at).toLocaleDateString()}</p>
            <p><em>This proposal has been generated. The full document content may need to be loaded from the server.</em></p>
          `,
          created_at: session.created_at,
          updated_at: session.updated_at,
          author: session.user
        }
        
        setCurrentDocument(placeholderDocument)
      } finally {
        setLoadingDocument(false)
      }
    } else {
      console.log("[v0] Session has no document - showing chat center")
      setHasDocument(false)
      setCurrentDocument(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getSessionStatusBadge = (session: LocalSession) => {
    // Check if session has a document (either with content or just an ID)
    if (session.document && (session.document.content || session.document.id)) {
      return (
        <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700">
          <FileText className="w-3 h-3 mr-1" />
          Document
        </Badge>
      )
    }

    // Check if proposal has been generated (even without document content)
    if (session.is_proposal_generated) {
      return (
        <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700">
          <FileText className="w-3 h-3 mr-1" />
          Document
        </Badge>
      )
    }

    switch (session.current_stage) {
      case "conversation":
        return (
          <Badge variant="outline" className="border-blue-700 text-blue-300">
            <MessageSquare className="w-3 h-3 mr-1" />
            Chat
          </Badge>
        )
      case "proposal_generation":
        return (
          <Badge variant="outline" className="border-yellow-700 text-yellow-300">
            Generating
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="border-green-700 text-green-300">
            Completed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-gray-700 text-gray-300">
            {session.current_stage}
          </Badge>
        )
    }
  }

  const handleTextSelect = (selectedText: string, element: HTMLElement) => {
    // This is now just for logging, no auto-send
    console.log("[v0] Text selected in document:", selectedText.substring(0, 100) + '...')
  }

  const handleDocumentGenerated = (document: any) => {
    console.log("[v0] Document generated via WebSocket:", document)
    setCurrentDocument(document)
    setHasDocument(true)
    setShowWelcome(false)
    setShowSessionsList(false)
  }

  // Use WebSocket document if available, otherwise use local document
  const documentToDisplay = wsCurrentDocument || currentDocument

  // Use the latest edit suggestion from WebSocket context (no longer from messages)

  const handleNewChatClick = () => {
    // End any active WebSocket session
    endSession()
    
    // Clear any pending message
    setPendingMessage(null)
    
    setSelectedProject(null)
    setSelectedSession(null)
    setHasDocument(false)
    setCurrentDocument(null)
    setShowWelcome(true)
    setShowSessionsList(false)
    setProjectSessions([])
  }

  const handleNewSessionInProject = async () => {
    if (selectedProject) {
      try {
        console.log('[v0] Creating new session in project:', selectedProject)
        
        // Create a real session in the selected project
        const sessionData: CreateSessionRequest = {
          initial_idea: "New conversation",
          agent_mode: "conversation"
        }
        
        const newSession = await createSession(selectedProject, sessionData)
        console.log('[v0] New session created:', newSession)
        
        setSelectedSession(newSession.id)
        setHasDocument(false)
        setCurrentDocument(null)
        setShowWelcome(false)
        setShowSessionsList(false)
        
        // Start WebSocket session with the real session ID
        startSession(newSession.id, selectedProject)
        
        console.log('[v0] New session started:', newSession.id, 'in project:', selectedProject)
      } catch (error) {
        console.error('[v0] Failed to create new session:', error)
        
        // Fallback to temporary session
        const tempSessionId = `temp-${Date.now()}`
        
        setSelectedSession(tempSessionId)
        setHasDocument(false)
        setCurrentDocument(null)
        setShowWelcome(false)
        setShowSessionsList(false)
        
        startSession(tempSessionId, selectedProject)
        
        console.log('[v0] Fallback to temp session:', tempSessionId, 'in project:', selectedProject)
      }
    }
  }

  const handleLogout = () => {
    // End any active WebSocket session
    endSession()
    
    logout()
    setSelectedProject(null)
    setSelectedSession(null)
    setHasDocument(false)
    setCurrentDocument(null)
    setShowWelcome(true)
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white">
      {/* Left Sidebar - Exact v0.dev style */}
      <div className="w-64 bg-[#0a0a0a] border-r border-[#2a2a2a] flex flex-col ">
        {/* Header */}
        <div className="p-4 border-b border-[#2a2a2a]">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
              <span className="text-black text-xs font-bold">v0</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium">Ilham</span>
            </div>
          </div>

          <Button
            onClick={handleNewChatClick}
            className="w-full bg-transparent border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white justify-start"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        {/* Navigation */}
        <div className="p-4 space-y-2">
          <div className="flex items-center space-x-2 p-2 text-gray-400 hover:text-white cursor-pointer">
            <Search className="w-4 h-4" />
            <span className="text-sm">Search</span>
          </div>
          <div className="flex items-center space-x-2 p-2 text-gray-400 hover:text-white cursor-pointer">
            <div className="w-4 h-4 border border-gray-400 rounded"></div>
            <span className="text-sm">Projects</span>
          </div>
          <div className="flex items-center space-x-2 p-2 text-gray-400 hover:text-white cursor-pointer">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Recent Chats</span>
          </div>
        </div>

        {/* Projects List */}
        <div className="flex-1 h-[60dvh] px-4">
          <ProjectSidebar
            sessions={projectSessions}
            selectedProject={selectedProject}
            selectedSession={selectedSession}
            onProjectSelect={handleProjectSelect}
            onSessionSelect={handleSessionSelect}
            onNewSession={handleNewSessionInProject}
          />
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2a2a2a] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-400" />
            {isAuthenticated && user ? (
              <span className="text-sm text-gray-400">{user.first_name || user.username}</span>
            ) : (
              <span className="text-sm text-gray-400">Guest</span>
            )}
          </div>
          {isAuthenticated ? (
            <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Link href="/login">
                <Button size="sm" variant="ghost" className="text-gray-400 hover:text-black text-xs">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" variant="ghost" className="text-gray-400 hover:text-black text-xs">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex h-full min-h-0">
        {showSessionsList && selectedProject && !selectedSession ? (
          /* Sessions List View */
          <div className="flex-1 p-8">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-white mb-2">
                  {projects.find(p => p.id === selectedProject)?.title}
                </h1>
                <p className="text-gray-400">Choose a session to continue or start a new conversation</p>
              </div>

              {loadingSessions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-400">Loading sessions...</div>
                </div>
              ) : projectSessions.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-500" />
                  <h3 className="text-lg font-medium text-white mb-2">No sessions yet</h3>
                  <p className="text-gray-400 mb-6">Start your first conversation in this project</p>
                  <Button 
                    onClick={handleNewSessionInProject}
                    className="bg-white text-black hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Session
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projectSessions.map((session) => (
                    <Card 
                      key={session.id} 
                      className="bg-[#1a1a1a] border-[#2a2a2a] hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                      onClick={() => handleSessionCardClick(session)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-white text-base truncate">
                            {session.proposal_title || session.initial_idea || 'Untitled Session'}
                          </CardTitle>
                          {getSessionStatusBadge(session)}
                        </div>
                        <CardDescription className="text-gray-400 text-sm">
                          {formatDate(session.updated_at)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-gray-300 text-sm line-clamp-2">
                          {session.initial_idea}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                          <span>{session.conversation_history.length} messages</span>
                          <span>{session.current_stage}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : showWelcome && !selectedSession ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="max-w-2xl text-center space-y-6">
              <h1 className="text-4xl font-semibold text-white">What do you want to create?</h1>
              <p className="text-lg text-gray-400">Start building with a single prompt. No coding needed.</p>

              <div className="w-full max-w-xl">
                <ChatInterface
                  sessionId={selectedSession}
                  projectId={selectedProject}
                  onNewChat={handleNewChat}
                  isDocumentMode={false}
                  isWelcomeMode={true}
                  onDocumentGenerated={handleDocumentGenerated}
                />
              </div>
            </div>
          </div>
        ) : hasDocument && documentToDisplay ? (
          <>
            {/* Document Viewer - Center */}
            <div className="flex-1 min-h-0">
              <DocumentViewer 
                document={documentToDisplay} 
                onTextSelect={handleTextSelect}
                editSuggestion={latestEditSuggestion || undefined}
                onAcceptEdit={acceptEdit}
                onRejectEdit={rejectEdit}
              />
            </div>

            {/* Chat - Right Sidebar */}
            <div className="w-96 border-l border-[#2a2a2a] flex flex-col h-full min-h-0">
              <div className="flex-1 min-h-0 overflow-hidden">
                <ChatInterface
                  sessionId={selectedSession}
                  projectId={selectedProject}
                  onNewChat={handleNewChat}
                  isDocumentMode={true}
                  onDocumentGenerated={handleDocumentGenerated}
                />
              </div>

              {suggestions.length > 0 && (
                <div className="border-t border-[#2a2a2a] p-4 max-h-96 overflow-y-auto">
                  <h3 className="text-sm font-medium text-white mb-3">AI Suggestions</h3>
                  <div className="space-y-3">
                    {suggestions.map((suggestion) => (
                      <AIEditSuggestion
                        key={suggestion.id}
                        suggestion={suggestion}
                        onAccept={acceptSuggestion}
                        onReject={rejectSuggestion}
                        onRegenerate={regenerateSuggestion}
                        isLoading={isEditLoading}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Chat - Full Center */
          <div className="flex-1">
            <ChatInterface
              sessionId={selectedSession}
              projectId={selectedProject}
              onNewChat={handleNewChat}
              isDocumentMode={false}
              onDocumentGenerated={handleDocumentGenerated}
            />
          </div>
        )}
      </div>
    </div>
  )
}
