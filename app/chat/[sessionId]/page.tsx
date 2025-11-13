"use client"

import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useRef } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { DocumentViewer } from "@/components/document-viewer"
import { ChatSidebar } from "@/components/chat-sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { useAuth } from "@/contexts/auth-context"
import { useWebSocket } from "@/contexts/websocket-context"
import { getDocumentContent, getProposedHtml } from "@/lib/api"
import { ProposalPanel } from "@/components/proposal-panel"


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
    sendRawMessage,
    addMessage
  } = useWebSocket()

  const [chatWidth, setChatWidth] = useState(450) // Chat width in pixels
  const [isResizing, setIsResizing] = useState(false)
  const [isResizingProposal, setIsResizingProposal] = useState(false)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const sidebarWidth = sidebarCollapsed ? 64 : 256

  const [hasDocument, setHasDocument] = useState(false)
  const [currentDocument, setCurrentDocument] = useState<any>(null)
  const [loadingDocument, setLoadingDocument] = useState(false)

  const [selectedDocumentText, setSelectedDocumentText] = useState<string>("")
  const [proposalHtml, setProposalHtml] = useState<string | null>(null)
  const [proposalTitle, setProposalTitle] = useState<string | null>(null)
  const [showProposalPanel, setShowProposalPanel] = useState(false)
  const [loadingProposalHtml, setLoadingProposalHtml] = useState(false)
  const [proposalPanelWidth, setProposalPanelWidth] = useState(500)
  const [isProposalPanelExpanded, setIsProposalPanelExpanded] = useState(false)
  const savedProposalPanelWidth = useRef(500)

  const proposalPanelWidthCalc = showProposalPanel 
    ? (isProposalPanelExpanded ? `calc(100vw - ${sidebarWidth}px - ${chatWidth}px - 100px)` : proposalPanelWidth) 
    : 0
  const actualProposalWidth = showProposalPanel 
    ? (isProposalPanelExpanded ? `calc(100vw - ${sidebarWidth}px - ${chatWidth}px - 100px)` : proposalPanelWidth)
    : 0
  const documentWidth = showProposalPanel && isProposalPanelExpanded 
    ? '0px' 
    : `calc(100vw - ${sidebarWidth}px - ${chatWidth}px - ${typeof actualProposalWidth === 'number' ? actualProposalWidth : 0}px)`

  const loadedSessionsRef = useRef<Set<string>>(new Set())
  const startedSessionsRef = useRef<Set<string>>(new Set())
  const pendingMessageProcessedRef = useRef<Set<string>>(new Set())
  const loadedProposedHtmlRef = useRef<Set<string>>(new Set())

  const sessionIdParam = params.sessionId
  const sessionId = sessionIdParam === 'new' ? null : 
                   Array.isArray(sessionIdParam) ? sessionIdParam[0] : sessionIdParam

  const projectId = searchParams.get('project')

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing) {
        e.preventDefault()
        const viewportWidth = window.innerWidth
        const mouseX = e.clientX

        const newWidth = Math.min(viewportWidth * 0.5, Math.max(250, viewportWidth - mouseX))
        setChatWidth(newWidth)
      } else if (isResizingProposal) {
        e.preventDefault()
        const viewportWidth = window.innerWidth
        const mouseX = e.clientX
        
        // Calculate width from right edge
        const newWidth = Math.min(viewportWidth * 0.6, Math.max(300, viewportWidth - mouseX))
        setProposalPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      setIsResizingProposal(false)
      document.body.style.cursor = 'default'
      document.body.style.userSelect = 'auto'
    }

    if (isResizing || isResizingProposal) {
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, isResizingProposal, sidebarWidth, chatWidth])

  const handleResizeStart = () => {
    setIsResizing(true)
  }

  const handleProposalResizeStart = () => {
    setIsResizingProposal(true)
  }

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

  // Load proposed HTML on page refresh/load
  const loadProposedHtml = useCallback(async (sessionId: string, projectId: string | null, forceReload: boolean = false) => {
    if (!projectId) {
      return
    }

    // Only skip if already loaded and not forcing reload
    if (!forceReload && loadedProposedHtmlRef.current.has(sessionId)) {
      // If we already have proposal HTML, ensure panel is shown
      if (proposalHtml) {
        setShowProposalPanel(true)
      }
      return
    }

    try {
      // Panel should already be shown before calling this function
      // Just ensure loading state is set
      setLoadingProposalHtml(true)
      loadedProposedHtmlRef.current.add(sessionId)
      const response = await getProposedHtml(projectId, sessionId)
      
      if (response.html_content) {
        setProposalHtml(response.html_content)
        setProposalTitle(response.proposal_title || 'Proposal Preview')
        setShowProposalPanel(true) // Ensure panel is shown
      } else {
        // If no content, keep panel visible but show empty state
        setShowProposalPanel(true)
      }
    } catch (error) {
      // If proposal not generated yet (404), keep panel visible with error state
      if (error instanceof Error && error.message.includes("not generated")) {
        // Keep panel visible but show that proposal is not generated yet
        setShowProposalPanel(true)
        return
      }
      console.error("Error loading proposed HTML:", error)
      // Keep panel visible even on error
      setShowProposalPanel(true)
    } finally {
      setLoadingProposalHtml(false)
    }
  }, [proposalHtml])

  // Start session when sessionId changes (like in old code)
  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      // Prevent duplicate startSession calls for the same session
      if (!startedSessionsRef.current.has(sessionId)) {
        startedSessionsRef.current.add(sessionId)
        startSession(sessionId, projectId)
        
        // Only load document if we haven't loaded it for this session yet
        if (!loadedSessionsRef.current.has(sessionId)) {
          loadSessionDocument(sessionId)
        }
        
        // Always show panel and load proposed HTML when session changes (force reload when coming back)
        if (projectId) {
          // Show panel immediately with loader
          setShowProposalPanel(true)
          setLoadingProposalHtml(true)
          // Clear the ref for this session to allow reload
          loadedProposedHtmlRef.current.delete(sessionId)
          loadProposedHtml(sessionId, projectId, true)
        }
      } else {
        // Session already started, but ensure proposal HTML is loaded if we have projectId
        if (projectId) {
          // Show panel immediately
          setShowProposalPanel(true)
          // If we already have proposal HTML, show it, otherwise load
          if (proposalHtml) {
            setLoadingProposalHtml(false)
          } else {
            setLoadingProposalHtml(true)
            // Try to load it again
            loadedProposedHtmlRef.current.delete(sessionId)
            loadProposedHtml(sessionId, projectId, true)
          }
        }
      }
    } else if (sessionId && sessionId === activeSessionId) {
      // Session is already active (e.g., coming back from settings)
      // Ensure proposal panel is shown immediately if we have projectId
      if (projectId) {
        // Show panel immediately
        setShowProposalPanel(true)
        if (proposalHtml) {
          // If we have proposal HTML, ensure panel is shown
          setLoadingProposalHtml(false)
        } else {
          // Show loader and try to load proposal HTML again
          setLoadingProposalHtml(true)
          loadedProposedHtmlRef.current.delete(sessionId)
          loadProposedHtml(sessionId, projectId, true)
        }
      }
    } else if (!sessionId && activeSessionId) {
      endSession()
      setHasDocument(false)
      setCurrentDocument(null)
      // Clear the loaded sessions when ending session
      loadedSessionsRef.current.clear()
      startedSessionsRef.current.clear()
      pendingMessageProcessedRef.current.clear()
      loadedProposedHtmlRef.current.clear()
    }
  }, [sessionId, projectId, activeSessionId, startSession, endSession, loadSessionDocument, loadProposedHtml, proposalHtml])

  // Check sessionStorage for pending message and communicate response when session starts
  useEffect(() => {
    if (sessionId && activeSessionId === sessionId && connectionStatus === 'connected') {
      // Prevent processing the same session's pending messages multiple times
      if (pendingMessageProcessedRef.current.has(sessionId)) {
        return
      }

      const storedMessage = sessionStorage.getItem('pendingMessage')
      const storedSessionId = sessionStorage.getItem('pendingSessionId')
      const storedResponse = sessionStorage.getItem('pendingCommunicateResponse')
      
      // Check if messages are already loaded from session history
      const hasUserMessage = wsMessages.some(msg => 
        msg.type === 'user' && 
        msg.content === storedMessage && 
        msg.sessionId === sessionId
      )
      
      // First, add user message to chat if it exists and not already in messages
      if (storedMessage && storedSessionId === sessionId && addMessage && !hasUserMessage) {
        // Mark as processed before adding to prevent duplicates
        pendingMessageProcessedRef.current.add(sessionId)
        
        // Add user message instantly to chat
        addMessage({
          id: `user-${Date.now()}`,
          type: 'user',
          content: storedMessage,
          timestamp: new Date(),
          sessionId: sessionId,
          projectId: projectId || undefined,
          isStreaming: false
        })
        
        // Clean up user message from sessionStorage
        sessionStorage.removeItem('pendingMessage')
        sessionStorage.removeItem('pendingSessionId')
      } else if (storedMessage && storedSessionId === sessionId && hasUserMessage) {
        // Message already exists, just clean up sessionStorage
        pendingMessageProcessedRef.current.add(sessionId)
        sessionStorage.removeItem('pendingMessage')
        sessionStorage.removeItem('pendingSessionId')
      }
      
      // Then, handle communicate response (AI message) after a small delay to ensure user message is added first
      if (storedResponse) {
        try {
          const response = JSON.parse(storedResponse)
          
          // Only process if it's for the current session
          if (response.session_id === sessionId) {
            // Check if AI message already exists in messages
            const hasAiMessage = wsMessages.some(msg => 
              msg.type === 'ai' && 
              msg.content === response.message && 
              msg.sessionId === sessionId
            )
            
            if (!hasAiMessage) {
              // Use setTimeout to ensure user message is added first
              setTimeout(() => {
                // Add AI message to chat if it exists
                if (response.message && addMessage) {
                  addMessage({
                    id: `communicate-${Date.now()}`,
                    type: 'ai',
                    content: response.message,
                    timestamp: new Date(),
                    sessionId: sessionId,
                    projectId: projectId || undefined,
                    isStreaming: false
                  })
                }
              }, 100) // Small delay to ensure user message is added first
            }
            
            // Show proposal panel if proposal_html exists (always show, even if message already exists)
            if (response.proposal_html) {
              setProposalHtml(response.proposal_html)
              setProposalTitle(response.proposal_title || 'Proposal Preview')
              setShowProposalPanel(true)
            }
            
            // Clean up sessionStorage
            sessionStorage.removeItem('pendingCommunicateResponse')
          }
        } catch (error) {
          console.error("Error parsing pending communicate response:", error)
          sessionStorage.removeItem('pendingCommunicateResponse')
        }
      }
    }
  }, [sessionId, activeSessionId, connectionStatus, projectId, addMessage, wsMessages])

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

  const handleProposalHtmlReceived = (html: string, title?: string) => {
    setProposalHtml(html)
    setProposalTitle(title || null)
    setShowProposalPanel(true)
  }

  const handleCloseProposalPanel = () => {
    // Don't actually close the panel, just keep it visible
    // User requested that proposal panel should never be closed
    // setShowProposalPanel(false)
    // setProposalHtml(null)
    // setProposalTitle(null)
    setIsProposalPanelExpanded(false)
  }

  const handleToggleProposalPanelExpand = () => {
    if (isProposalPanelExpanded) {
      // Collapse: restore saved width
      setIsProposalPanelExpanded(false)
      setProposalPanelWidth(savedProposalPanelWidth.current)
    } else {
      // Expand: save current width and expand
      savedProposalPanelWidth.current = proposalPanelWidth
      setIsProposalPanelExpanded(true)
    }
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
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
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-x-hidden">
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

        <div className="flex-1 flex h-full min-h-0 overflow-x-hidden">
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
                  `flex flex-col h-full min-h-0 relative overflow-hidden ` +
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
                  onProposalHtmlReceived={handleProposalHtmlReceived}
                />
              </div>

              {/* Proposal Panel (Right Side) - Desktop */}
              {showProposalPanel && (
                <ProposalPanel
                  proposalHtml={proposalHtml}
                  proposalTitle={proposalTitle}
                  showProposalPanel={showProposalPanel}
                  onClose={handleCloseProposalPanel}
                  sessionId={sessionId}
                  projectId={projectId}
                  sidebarWidth={sidebarWidth}
                  chatWidth={chatWidth}
                  proposalPanelWidth={proposalPanelWidth}
                  onProposalPanelWidthChange={setProposalPanelWidth}
                  isProposalPanelExpanded={isProposalPanelExpanded}
                  onToggleExpand={handleToggleProposalPanelExpand}
                  isResizingProposal={isResizingProposal}
                  onResizeStart={handleProposalResizeStart}
                  onProposalHtmlUpdate={setProposalHtml}
                  isLoading={loadingProposalHtml}
                />
              )}
            </>
          ) : (
            // Chat only (no document)
            <div className="flex-1 min-w-0 overflow-hidden">
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
                  onProposalHtmlReceived={handleProposalHtmlReceived}
                />
              )}
            </div>
          )}

          {/* Proposal Panel (Right Side) - For chat only mode */}
          {!hasDocument && showProposalPanel && (
            <ProposalPanel
              proposalHtml={proposalHtml}
              proposalTitle={proposalTitle}
              showProposalPanel={showProposalPanel}
              onClose={handleCloseProposalPanel}
              sessionId={sessionId}
              projectId={projectId}
              sidebarWidth={sidebarWidth}
              chatWidth={chatWidth}
              proposalPanelWidth={proposalPanelWidth}
              onProposalPanelWidthChange={setProposalPanelWidth}
              isProposalPanelExpanded={isProposalPanelExpanded}
              onToggleExpand={handleToggleProposalPanelExpand}
              isResizingProposal={isResizingProposal}
              onResizeStart={handleProposalResizeStart}
              onProposalHtmlUpdate={setProposalHtml}
              isLoading={loadingProposalHtml}
            />
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
