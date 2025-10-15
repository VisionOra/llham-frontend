"use client"

import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useRef } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { DocumentViewer } from "@/components/document-viewer"
import { ChatSidebar } from "@/components/chat-sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { useAuth } from "@/contexts/auth-context"
import { useWebSocket } from "@/contexts/websocket-context"
import { getDocumentContent } from "@/lib/api"


function ChatPageContent() {
  // Tab state for md/mobile
  const [activeTab, setActiveTab] = useState<'document' | 'chat'>('document')
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { 
    currentDocument: wsCurrentDocument, 
    latestEditSuggestion,
    pendingMessage,
    setPendingMessage,
    acceptEdit, 
    rejectEdit, 
    startSession, 
    endSession,
    activeSessionId,
    messages: wsMessages,
    connectionStatus,
    sendRawMessage
  } = useWebSocket()

  const [chatWidth, setChatWidth] = useState(450) // Chat width in pixels
  const [isResizing, setIsResizing] = useState(false)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const sidebarWidth = sidebarCollapsed ? 64 : 256

  const documentWidth = `calc(100vw - ${sidebarWidth}px - ${chatWidth}px)`

  const [hasDocument, setHasDocument] = useState(false)
  const [currentDocument, setCurrentDocument] = useState<any>(null)
  const [loadingDocument, setLoadingDocument] = useState(false)

  const [selectedDocumentText, setSelectedDocumentText] = useState<string>("")

  const loadedSessionsRef = useRef<Set<string>>(new Set())

  const sessionIdParam = params.sessionId
  const sessionId = sessionIdParam === 'new' ? null : 
                   Array.isArray(sessionIdParam) ? sessionIdParam[0] : sessionIdParam

  const projectId = searchParams.get('project')

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      e.preventDefault()
      const viewportWidth = window.innerWidth
      const mouseX = e.clientX

      const newWidth = Math.min(viewportWidth * 0.5, Math.max(250, viewportWidth - mouseX))
      setChatWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }

    if (isResizing) {
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  const handleResizeStart = () => {
    setIsResizing(true)
  }

  // Start session when sessionId changes (like in old code)
  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      startSession(sessionId, projectId)
      
      // Only load document if we haven't loaded it for this session yet
      if (!loadedSessionsRef.current.has(sessionId)) {
        loadSessionDocument(sessionId)
      }
    } else if (!sessionId && activeSessionId) {
      endSession()
      setHasDocument(false)
      setCurrentDocument(null)
      // Clear the loaded sessions when ending session
      loadedSessionsRef.current.clear()
    }
  }, [sessionId, projectId, activeSessionId])

  // Check sessionStorage for pending message when session starts
  useEffect(() => {
    if (sessionId && connectionStatus === 'connected') {
      const storedMessage = sessionStorage.getItem('pendingMessage')
      const storedSessionId = sessionStorage.getItem('pendingSessionId')
      
      if (storedMessage && storedSessionId === sessionId && !pendingMessage) {
        // Set the pending message in context so it gets sent
        setPendingMessage(storedMessage)
        // Clean up sessionStorage
        sessionStorage.removeItem('pendingMessage')
        sessionStorage.removeItem('pendingSessionId')
      }
    }
  }, [sessionId, connectionStatus, pendingMessage, setPendingMessage])

  // Load document for session (using exact logic from old working code)
  const loadSessionDocument = useCallback(async (sessionId: string) => {
    if (loadingDocument || loadedSessionsRef.current.has(sessionId)) {
      return
    }

    try {
      setLoadingDocument(true)
      loadedSessionsRef.current.add(sessionId)
      
      const documentContent = await getDocumentContent(sessionId)
      
      if (!documentContent || documentContent.error || documentContent.message) {
        setHasDocument(false)
        setCurrentDocument(null)
        setLoadingDocument(false)
        return
      }
      
      let content
      if (documentContent?.document && typeof documentContent.document === 'object') {
        content = documentContent.document.content || 
                 documentContent.document.html_content || 
                 documentContent.document.body ||
                 documentContent.document.document
      } else {
        content = documentContent?.document || 
                 documentContent?.content || 
                 documentContent?.html_content || 
                 documentContent?.body ||
                 documentContent?.proposal_content
      }
      
           const hasActualContent = content && typeof content === 'string' && content.trim().length > 0
      
      if (hasActualContent) {
        setHasDocument(true)
        
        const documentForViewer = {
          id: documentContent.id || sessionId,
          title: documentContent.title || documentContent.proposal_title || 'Document',
          content: content,
          created_at: documentContent.created_at,
          updated_at: documentContent.updated_at,
          author:  'Artilence'
        }
        
        setCurrentDocument(documentForViewer)
      } else {
        setHasDocument(false)
        setCurrentDocument(null)
      }
    } catch (error) {
      
      loadedSessionsRef.current.delete(sessionId)
     
      setHasDocument(false)
      setCurrentDocument(null)
    } finally {
      setLoadingDocument(false)
    }
  }, [loadingDocument])

  // Function to refresh document content from API (exact from old working code)
  const refreshDocumentContent = useCallback(async () => {
    if (!sessionId || !hasDocument) return
    
    try {
      const documentContent = await getDocumentContent(sessionId)      
      const refreshedDocument = {
        id: documentContent.id || sessionId,
        title: documentContent.title || currentDocument?.title || 'Document',
        content: documentContent.document || documentContent.content || documentContent.html_content || documentContent.body,
        created_at: documentContent.created_at || currentDocument?.created_at,
        updated_at: documentContent.updated_at || new Date().toISOString(),
        author: documentContent.created_by || currentDocument?.author || 'Artilence'
      }
      
      setCurrentDocument(refreshedDocument)
    } catch (error) {
    }
  }, [sessionId, hasDocument])

  useEffect(() => {
    if (hasDocument && wsMessages.length > 0) {
      const lastMessage = wsMessages[wsMessages.length - 1]
      if (lastMessage.type === 'ai' && !lastMessage.isStreaming) {
        setTimeout(() => {
          refreshDocumentContent()
        }, 1000)
      }
    }
  }, [wsMessages, hasDocument, refreshDocumentContent])

  const documentToDisplay = wsCurrentDocument || currentDocument

  useEffect(() => {
    if (wsCurrentDocument && !hasDocument) {
      setHasDocument(true)
    }
  }, [wsCurrentDocument, hasDocument])

  useEffect(() => {
    if (wsCurrentDocument && hasDocument) {
      setCurrentDocument(wsCurrentDocument)
    }
  }, [wsCurrentDocument, hasDocument])





  const handleNewChat = (message: string) => {
    // This should not be called from chat page in welcome mode
    // Welcome mode should only be on dashboard
  }

  const handleBackToDashboard = () => {
    endSession()
    router.push('/dashboard')
  }

  const handleProjectSelect = (projectId: string) => {
    endSession()
    router.push(`/project/${projectId}`)
  }

  const handleNewProject = () => {
    endSession()
    router.push('/dashboard')
  }

  const handleLogout = () => {
    endSession()
    logout()
  }

  const handleTextSelect = (selectedText: string, element: HTMLElement) => {
   
    setSelectedDocumentText(selectedText)
  }

  const handleClearSelectedText = () => {
    setSelectedDocumentText("")
  }

  const handleDocumentGenerated = (document: any) => {
    setCurrentDocument(document)
    setHasDocument(true)
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white">
      {/* Left Sidebar */}
      <ChatSidebar 
        user={user || undefined}
        onBackToDashboard={handleBackToDashboard}
        onLogout={handleLogout}
        showProjects={true}
        onProjectSelect={handleProjectSelect}
        onNewProject={handleNewProject}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full min-h-0">
        {hasDocument && currentDocument && (
          <div className="md:hidden w-full bg-[#18181b] border-b border-[#23232a] flex z-20">
            <button
              className={`flex-1 py-3 text-center font-semibold transition-colors ${activeTab === 'document' ? 'bg-[#23232a] text-blue-400' : 'text-gray-300'}`}
              onClick={() => setActiveTab('document')}
            >
              Document
            </button>
            <button
              className={`flex-1 py-3 text-center font-semibold transition-colors ${activeTab === 'chat' ? 'bg-[#23232a] text-green-400' : 'text-gray-300'}`}
              onClick={() => setActiveTab('chat')}
            >
              Chat
            </button>
          </div>
        )}

        <div className="flex-1 flex h-full min-h-0">
          {hasDocument && currentDocument ? (
            <>
              {/* Document Panel */}
              <div
                className={
                  `min-h-0 overflow-x-hidden flex-shrink ` +
                  (activeTab === 'document' ? 'block' : 'hidden') +
                  ' md:block md:min-w-[0] md:w-auto md:flex-1'
                }
                style={{ 
                  width: typeof window !== 'undefined' && window.innerWidth < 860 ? `calc(100vw - ${sidebarWidth}px)` : documentWidth,
                  maxWidth: '100%'
                }}
              >
                <DocumentViewer
                  document={currentDocument}
                  onTextSelect={handleTextSelect}
                  editSuggestion={latestEditSuggestion || undefined}
                  onAcceptEdit={acceptEdit}
                  onRejectEdit={rejectEdit}
                  sessionId={activeSessionId || undefined}
                  sendMessage={sendRawMessage}
                />
              </div>

              {/* Chat Panel */}
              <div
                className={
                  `flex flex-col h-full min-h-0 relative ` +
                  (activeTab === 'chat' ? 'block' : 'hidden') +
                  ' md:block md:border-l md:border-[#2a2a2a]'
                }
                style={{ width: typeof window !== 'undefined' && window.innerWidth < 850 ? `calc(100vw - ${sidebarWidth}px)` : `${chatWidth}px` }}
              >
                {/* Resize Handle (desktop only) */}
                <div
                  className={`absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize z-50 transition-all duration-200 hidden md:block ${
                    isResizing ? 'bg-blue-500 w-2' : 'hover:bg-blue-500/60 hover:w-2'
                  }`}
                  onMouseDown={handleResizeStart}
                  title="Drag to resize chat panel"
                />

                {/* Resize Indicator (desktop only) */}
                {isResizing && (
                  <div className="absolute top-4 left-4 bg-black/80 text-white text-sm px-3 py-2 rounded z-50 hidden md:block">
                    <div>Chat: {Math.round(chatWidth)}px</div>
                    <div>Document: Auto</div>
                  </div>
                )}

                <ChatInterface
                  sessionId={sessionId}
                  projectId={projectId}
                  onNewChat={handleNewChat}
                  isDocumentMode={true}
                  isWelcomeMode={false}
                  onDocumentGenerated={handleDocumentGenerated}
                  onTextSelect={handleTextSelect}
                  selectedDocumentText={selectedDocumentText}
                  onClearSelectedText={handleClearSelectedText}
                />
              </div>
            </>
          ) : (
            // Chat only (no document)
            <div className="flex-1">
              {loadingDocument ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-400">Loading document...</div>
                </div>
              ) : (
                <ChatInterface
                  sessionId={sessionId}
                  projectId={projectId}
                  onNewChat={handleNewChat}
                  isDocumentMode={false}
                  isWelcomeMode={false}
                  onDocumentGenerated={handleDocumentGenerated}
                  selectedDocumentText=""
                  onClearSelectedText={handleClearSelectedText}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Chat() {
  return (
    <AuthGuard>
      <ChatPageContent />
    </AuthGuard>
  )
}
