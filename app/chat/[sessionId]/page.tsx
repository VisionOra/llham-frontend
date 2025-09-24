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
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { 
    currentDocument: wsCurrentDocument, 
    latestEditSuggestion,
    pendingMessage,
    acceptEdit, 
    rejectEdit, 
    startSession, 
    endSession,
    activeSessionId,
    messages: wsMessages,
    connectionStatus 
  } = useWebSocket()

  // Chat panel resize state
  const [chatWidth, setChatWidth] = useState(350) // Chat width in pixels
  const [isResizing, setIsResizing] = useState(false)

  // Sidebar collapsed state and width
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const sidebarWidth = sidebarCollapsed ? 64 : 256

  // Calculate document width: total width - sidebar - chat width
  const documentWidth = `calc(100vw - ${sidebarWidth}px - ${chatWidth}px)`

  // Local state for document management (like in old code)
  const [hasDocument, setHasDocument] = useState(false)
  const [currentDocument, setCurrentDocument] = useState<any>(null)
  const [loadingDocument, setLoadingDocument] = useState(false)

  // State for text selection
  const [selectedDocumentText, setSelectedDocumentText] = useState<string>("")

  // Track loaded sessions to prevent recursive calls
  const loadedSessionsRef = useRef<Set<string>>(new Set())

  // Extract sessionId from params
  const sessionIdParam = params.sessionId
  const sessionId = sessionIdParam === 'new' ? null : 
                   Array.isArray(sessionIdParam) ? sessionIdParam[0] : sessionIdParam

  // Extract projectId from search params
  const projectId = searchParams.get('project')

  // Handle chat panel resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return

      e.preventDefault()
      const viewportWidth = window.innerWidth
      const mouseX = e.clientX

      // Calculate new chat width (min 250px, max 50% of viewport)
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
      console.log("[Chat] Starting session:", sessionId, "Project:", projectId)
      startSession(sessionId, projectId)
      
      // Only load document if we haven't loaded it for this session yet
      if (!loadedSessionsRef.current.has(sessionId)) {
        loadSessionDocument(sessionId)
      }
    } else if (!sessionId && activeSessionId) {
      console.log("[Chat] Ending session")
      endSession()
      setHasDocument(false)
      setCurrentDocument(null)
      // Clear the loaded sessions when ending session
      loadedSessionsRef.current.clear()
    }
  }, [sessionId, projectId, activeSessionId])

  // Load document for session (using exact logic from old working code)
  const loadSessionDocument = useCallback(async (sessionId: string) => {
    if (loadingDocument || loadedSessionsRef.current.has(sessionId)) {
      console.log("[Chat] Already loading document or already loaded, skipping")
      return
    }

    try {
      setLoadingDocument(true)
      loadedSessionsRef.current.add(sessionId)
      console.log("[Chat] Loading document for session:", sessionId)
      
      const documentContent = await getDocumentContent(sessionId)
      console.log("[Chat] Raw API response:", documentContent)
      console.log("[Chat] Response type:", typeof documentContent)
      console.log("[Chat] Response keys:", documentContent ? Object.keys(documentContent) : 'null')
      
      // Check if the API response indicates "no document" vs "document with content"
      if (!documentContent || documentContent.error || documentContent.message) {
        console.log("[Chat] No document for this session - API returned error or empty")
        setHasDocument(false)
        setCurrentDocument(null)
        setLoadingDocument(false)
        return
      }
      
      // Check multiple possible content fields (exact from old working code)
      // Handle case where document field is an object with nested content
      let content
      if (documentContent?.document && typeof documentContent.document === 'object') {
        // Document is an object, look for content fields within it
        content = documentContent.document.content || 
                 documentContent.document.html_content || 
                 documentContent.document.body ||
                 documentContent.document.document
      } else {
        // Document is a string or use other top-level fields
        content = documentContent?.document || 
                 documentContent?.content || 
                 documentContent?.html_content || 
                 documentContent?.body ||
                 documentContent?.proposal_content
      }
      
      console.log("[Chat] Content field analysis:", {
        hasDocument: !!documentContent?.document,
        documentType: typeof documentContent?.document,
        documentKeys: documentContent?.document && typeof documentContent?.document === 'object' ? Object.keys(documentContent.document) : 'not object',
        hasContent: !!documentContent?.content,
        hasHtmlContent: !!documentContent?.html_content,
        hasBody: !!documentContent?.body,
        hasProposalContent: !!documentContent?.proposal_content,
        finalContent: !!content,
        contentType: typeof content,
        contentLength: content ? content.length : 0
      })
      
      // Only show document viewer if there's actual content
      const hasActualContent = content && typeof content === 'string' && content.trim().length > 0
      
      // Check if session has a document with content (from old working code)
      if (hasActualContent) {
        console.log("[Chat] Session has document with content - showing document center + chat sidebar")
        console.log("[Chat] Document content length:", content.length)
        setHasDocument(true)
        
        // Create a properly formatted document object for the DocumentViewer (exact from old working code)
        const documentForViewer = {
          id: documentContent.id || sessionId,
          title: documentContent.title || documentContent.proposal_title || 'Document',
          content: content,
          created_at: documentContent.created_at,
          updated_at: documentContent.updated_at,
          author: documentContent.created_by || documentContent.author || 'AI Assistant'
        }
        
        setCurrentDocument(documentForViewer)
        console.log("[Chat] Document set successfully:", documentForViewer.title)
      } else {
        console.log("[Chat] Session has no document content - showing chat center")
        setHasDocument(false)
        setCurrentDocument(null)
      }
    } catch (error) {
      console.error("[Chat] Failed to load document:", error)
      
      // Remove from loaded sessions so it can be retried
      loadedSessionsRef.current.delete(sessionId)
      
      // Only show error if the API returned something indicating a document should exist
      // Don't show document viewer for sessions that simply don't have documents
      console.log("[Chat] Document loading failed - showing chat only mode")
      setHasDocument(false)
      setCurrentDocument(null)
    } finally {
      setLoadingDocument(false)
    }
  }, [loadingDocument])

  // Function to refresh document content from API (exact from old working code)
  const refreshDocumentContent = useCallback(async () => {
    if (!sessionId || !hasDocument) return
    
    console.log("[Chat] Refreshing document content for session:", sessionId)
    try {
      const documentContent = await getDocumentContent(sessionId)
      console.log("[Chat] Refreshed document content:", documentContent)
      
      const refreshedDocument = {
        id: documentContent.id || sessionId,
        title: documentContent.title || currentDocument?.title || 'Document',
        content: documentContent.document || documentContent.content || documentContent.html_content || documentContent.body,
        created_at: documentContent.created_at || currentDocument?.created_at,
        updated_at: documentContent.updated_at || new Date().toISOString(),
        author: documentContent.created_by || currentDocument?.author || 'AI Assistant'
      }
      
      setCurrentDocument(refreshedDocument)
      console.log("[Chat] Document refreshed successfully")
    } catch (error) {
      console.error("[Chat] Failed to refresh document:", error)
    }
  }, [sessionId, hasDocument])

  // Watch for new AI messages and refresh document if in document mode (exact from old working code)
  useEffect(() => {
    if (hasDocument && wsMessages.length > 0) {
      const lastMessage = wsMessages[wsMessages.length - 1]
      if (lastMessage.type === 'ai' && !lastMessage.isStreaming) {
        console.log("[Chat] AI message completed, refreshing document")
        // Small delay to ensure backend has processed the update (exact from old working code)
        setTimeout(() => {
          refreshDocumentContent()
        }, 1000)
      }
    }
  }, [wsMessages, hasDocument, refreshDocumentContent])

  // Use WebSocket document if available, otherwise use local document (exact from old working code)
  const documentToDisplay = wsCurrentDocument || currentDocument

  // Watch for WebSocket document generation and switch layout (exact from old working code)
  useEffect(() => {
    if (wsCurrentDocument && !hasDocument) {
      console.log('[Chat] WebSocket document generated, switching to document view')
      setHasDocument(true)
    }
  }, [wsCurrentDocument, hasDocument])

  // Watch for WebSocket document updates and refresh local document (exact from old working code)
  useEffect(() => {
    if (wsCurrentDocument && hasDocument) {
      console.log('[Chat] WebSocket document updated, refreshing document viewer')
      console.log('[Chat] New document content:', wsCurrentDocument)
      // Force update by updating the local currentDocument (exact from old working code)
      setCurrentDocument(wsCurrentDocument)
    }
  }, [wsCurrentDocument, hasDocument])

  // Debug: Log document changes (exact from old working code)
  useEffect(() => {
    console.log('[Chat] Document state changed:')
    console.log('  - wsCurrentDocument:', !!wsCurrentDocument, wsCurrentDocument?.id)
    console.log('  - currentDocument:', !!currentDocument, currentDocument?.id)
    console.log('  - documentToDisplay:', !!documentToDisplay, documentToDisplay?.id)
  }, [wsCurrentDocument, currentDocument, documentToDisplay])

  // Debug logging for document state
  useEffect(() => {
    console.log('[Chat] Document state debug:', {
      hasDocument,
      currentDocument: !!currentDocument,
      wsCurrentDocument: !!wsCurrentDocument,
      documentToDisplay: !!documentToDisplay
    })
  }, [hasDocument, currentDocument, wsCurrentDocument, documentToDisplay])

  const handleNewChat = (message: string) => {
    // Let ChatInterface handle session creation and navigation
    console.log("[Chat] New chat:", message)
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
    console.log("[Chat] Text selected in document:", {
      text: selectedText,
      length: selectedText.length,
      preview: selectedText.substring(0, 100) + (selectedText.length > 100 ? '...' : ''),
      type: typeof selectedText
    })
    setSelectedDocumentText(selectedText)
  }

  const handleClearSelectedText = () => {
    setSelectedDocumentText("")
  }

  const handleDocumentGenerated = (document: any) => {
    console.log("[Chat] Document generated via WebSocket:", document)
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
      <div className="flex-1 flex h-full min-h-0">
        {(() => {
          console.log('[Chat] Layout render check:', { hasDocument, currentDocument: !!currentDocument })
          return hasDocument && currentDocument ? (
            <>
              {/* Document Viewer - Calculated Width */}
              <div 
                className="min-h-0"
                style={{ width: documentWidth }}
              >
                <DocumentViewer 
                  document={currentDocument} 
                  onTextSelect={handleTextSelect}
                  editSuggestion={latestEditSuggestion || undefined}
                  onAcceptEdit={acceptEdit}
                  onRejectEdit={rejectEdit}
                />
              </div>

              {/* Chat - Right Sidebar with Resize Handle */}
              <div 
                className="border-l border-[#2a2a2a] flex flex-col h-full min-h-0 relative"
                style={{ width: `${chatWidth}px` }}
              >
                {/* Resize Handle */}
                <div
                  className={`absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize z-50 transition-all duration-200 ${
                    isResizing ? 'bg-blue-500 w-2' : 'hover:bg-blue-500/60 hover:w-2'
                  }`}
                  onMouseDown={handleResizeStart}
                  title="Drag to resize chat panel"
                />
                
                {/* Resize Indicator */}
                {isResizing && (
                  <div className="absolute top-4 left-4 bg-black/80 text-white text-sm px-3 py-2 rounded z-50">
                    <div>Chat: {Math.round(chatWidth)}px</div>
                    <div>Document: Auto</div>
                  </div>
                )}
                
                <ChatInterface
                  sessionId={sessionId}
                  projectId={projectId}
                  onNewChat={handleNewChat}
                  isDocumentMode={true}
                  isWelcomeMode={sessionId === null}
                  onDocumentGenerated={handleDocumentGenerated}
                  onTextSelect={handleTextSelect}
                  selectedDocumentText={selectedDocumentText}
                  onClearSelectedText={handleClearSelectedText}
                />
              </div>
            </>
          ) : (
            /* Chat - Full Center */
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
                  isWelcomeMode={sessionId === null}
                  onDocumentGenerated={handleDocumentGenerated}
                  selectedDocumentText=""
                  onClearSelectedText={handleClearSelectedText}
                />
              )}
            </div>
          )
        })()}
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
