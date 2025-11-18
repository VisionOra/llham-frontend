"use client"

import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useRef } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { DocumentViewer } from "@/components/document-viewer"
import { ChatSidebar } from "@/components/chat-sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { useAuth } from "@/contexts/auth-context"
import { useWebSocket } from "@/contexts/websocket-context"
import { getDocumentContent, getProposedHtml, getSessionHistory } from "@/lib/api"
import { ProposalPanel } from "@/components/proposal-panel"


function ChatPageContent() {
  // Tab state for md/mobile
  const [activeTab, setActiveTab] = useState<'proposal' | 'chat'>('proposal')
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

  const loadedSessionsRef = useRef<Set<string>>(new Set())
  const pendingMessageProcessedRef = useRef<Set<string>>(new Set())
  const loadedProposedHtmlRef = useRef<Set<string>>(new Set())
  const loadingProposedHtmlRef = useRef<Set<string>>(new Set()) // Track ongoing loads to prevent duplicates
  const loadedHistoryRef = useRef<Set<string>>(new Set()) // Track loaded conversation history

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

  // Helper function to check if html_content is empty or default "No Proposal Generated Yet" message
  const isDefaultProposalMessage = (htmlContent: string | null | undefined): boolean => {
    if (!htmlContent || !htmlContent.trim()) {
      return true
    }
    
    // Check if it contains the default "No Proposal Generated Yet" message
    const defaultMessagePatterns = [
      'No Proposal Generated Yet',
      'Start a conversation with the master agent',
      'Say something like:'
    ]
    
    const hasDefaultMessage = defaultMessagePatterns.some(pattern => 
      htmlContent.includes(pattern)
    )
    
    return hasDefaultMessage
  }

  // Load proposed HTML on page refresh/load
  const loadProposedHtml = useCallback(async (sessionId: string, projectId: string | null, forceReload: boolean = false) => {
    if (!projectId) {
      return
    }

    // Prevent duplicate concurrent calls for the same session
    const loadKey = `${sessionId}-${projectId}`
    if (loadingProposedHtmlRef.current.has(loadKey)) {
      return // Already loading, skip
    }

    // Only skip if already loaded and not forcing reload
    if (!forceReload && loadedProposedHtmlRef.current.has(loadKey)) {
      return
    }

    try {
      // Mark as loading to prevent duplicates
      loadingProposedHtmlRef.current.add(loadKey)
      setLoadingProposalHtml(true)
      
      const response = await getProposedHtml(projectId, sessionId)
      
      // Mark as loaded
      loadedProposedHtmlRef.current.add(loadKey)
      
      if (response.html_content && !isDefaultProposalMessage(response.html_content)) {
        // Only set proposalHtml if it's actual content (not default message)
        setProposalHtml(response.html_content)
        setProposalTitle(response.proposal_title || 'Proposal Preview')
        setShowProposalPanel(true)
      } else {
        // If content is empty or default message, don't show proposal panel
        setProposalHtml(null)
        setShowProposalPanel(false)
      }
    } catch (error) {
      // If proposal not generated yet (404), don't show panel
      if (error instanceof Error && error.message.includes("not generated")) {
        setProposalHtml(null)
        setShowProposalPanel(false)
        // Still mark as loaded to prevent retrying
        loadedProposedHtmlRef.current.add(loadKey)
      } else {
        console.error("Error loading proposed HTML:", error)
        // Don't show panel on error
        setProposalHtml(null)
        setShowProposalPanel(false)
        // Remove from loaded set on error so it can retry
        loadedProposedHtmlRef.current.delete(loadKey)
      }
    } finally {
      loadingProposedHtmlRef.current.delete(loadKey)
      setLoadingProposalHtml(false)
    }
  }, []) // Removed proposalHtml from dependencies to prevent unnecessary recreations

  // Load conversation history
  const loadConversationHistory = useCallback(async (sessionId: string) => {
    if (!sessionId || !addMessage) return
    
    // Prevent duplicate loads
    if (loadedHistoryRef.current.has(sessionId)) {
      return
    }
    
    try {
      loadedHistoryRef.current.add(sessionId)
      const sessionData = await getSessionHistory(sessionId)
      
      console.log("Loading conversation history for session:", sessionId, sessionData.conversation_history?.length, "messages")
      
      if (sessionData.conversation_history && Array.isArray(sessionData.conversation_history)) {
        // Add all messages from conversation history
        sessionData.conversation_history.forEach((msg: any, index: number) => {
          // Create unique ID using message_hash if available
          const messageId = msg.message_hash 
            ? `history-${sessionId}-${index}-${msg.message_hash}`
            : `history-${sessionId}-${index}-${Date.now()}-${index}`
          
          // Add message - addMessage function will handle duplicate checking
          addMessage({
            id: messageId,
            type: msg.role === 'user' ? 'user' : 'ai',
            content: msg.message,
            timestamp: new Date(msg.timestamp),
            sessionId: sessionId,
            projectId: projectId || undefined,
            isStreaming: false
          })
        })
        
        console.log("Conversation history loaded:", sessionData.conversation_history.length, "messages added")
      }
    } catch (error) {
      console.error("Error loading conversation history:", error)
      loadedHistoryRef.current.delete(sessionId) // Remove on error so it can retry
    }
  }, [addMessage, projectId, sessionId])

  // Load document and proposal HTML when sessionId changes
  useEffect(() => {
    if (sessionId) {
      // Only load document if we haven't loaded it for this session yet
      if (!loadedSessionsRef.current.has(sessionId)) {
        loadedSessionsRef.current.add(sessionId)
        loadSessionDocument(sessionId)
      }
      
      // Load conversation history when WebSocket is connected
      if (!loadedHistoryRef.current.has(sessionId) && connectionStatus === 'connected') {
        loadConversationHistory(sessionId)
      }
      
      // Load proposed HTML when session changes (only once)
      if (projectId) {
        const loadKey = `${sessionId}-${projectId}`
        // Only load if not already loaded or loading
        if (!loadedProposedHtmlRef.current.has(loadKey) && !loadingProposedHtmlRef.current.has(loadKey)) {
          loadProposedHtml(sessionId, projectId, false)
        }
      }
    } else {
      // Clear the loaded sessions when sessionId is null
      setHasDocument(false)
      setCurrentDocument(null)
      loadedSessionsRef.current.clear()
      pendingMessageProcessedRef.current.clear()
      loadedProposedHtmlRef.current.clear()
      loadingProposedHtmlRef.current.clear()
      loadedHistoryRef.current.clear()
    }
  }, [sessionId, projectId, loadSessionDocument, loadProposedHtml])

  // Load conversation history when WebSocket connects
  useEffect(() => {
    if (sessionId && connectionStatus === 'connected' && !loadedHistoryRef.current.has(sessionId)) {
      loadConversationHistory(sessionId)
    }
  }, [sessionId, connectionStatus, loadConversationHistory])

  // Check sessionStorage for pending message and communicate response when session starts
  useEffect(() => {
    if (sessionId && connectionStatus === 'connected') {
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
            
            // Show proposal panel if proposal_html exists and it's actual content (not default message)
            if (response.proposal_html && !isDefaultProposalMessage(response.proposal_html)) {
              setProposalHtml(response.proposal_html)
              setProposalTitle(response.proposal_title || 'Proposal Preview')
              setShowProposalPanel(true)
            } else if (response.proposal_html) {
              // If it's default message, don't show panel
              setProposalHtml(null)
              setShowProposalPanel(false)
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
    router.push('/dashboard')
  }

  const handleProjectSelect = (projectId: string) => {
    router.push(`/project/${projectId}`)
  }

  const handleNewProject = () => {
    router.push('/dashboard')
  }

  const handleLogout = () => {
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
    // Only set proposalHtml if it's actual content (not default message)
    if (html && !isDefaultProposalMessage(html)) {
      setProposalHtml(html)
      setProposalTitle(title || null)
      setShowProposalPanel(true)
    } else {
      // If content is empty or default message, don't show proposal panel
      setProposalHtml(null)
      setShowProposalPanel(false)
    }
  }

  const handleCloseProposalPanel = () => {
    // Keep panel visible per requirement; no action needed now
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
        {/* Check if proposalHtml exists and is not default message - if not, show only chat interface full width */}
        {!proposalHtml || isDefaultProposalMessage(proposalHtml) ? (
          // Only Chat Interface (Full Width) - when proposal_html is not available or is default message
          <div className="flex-1 flex h-full min-h-0 overflow-x-hidden">
            <div className="flex-1 flex flex-col h-full min-h-0 relative overflow-hidden">
              <ChatInterface
                sessionId={sessionId}
                projectId={projectId}
                onNewChat={handleNewChat}
                isDocumentMode={Boolean(hasDocument)}
                isWelcomeMode={false}
                onDocumentGenerated={handleDocumentGenerated}
                onTextSelect={handleTextSelect}
                selectedDocumentText={selectedDocumentText}
                onClearSelectedText={handleClearSelectedText}
                onProposalHtmlReceived={handleProposalHtmlReceived}
              />
            </div>
          </div>
        ) : (
          // Proposal + Chat Layout - when proposal_html is available and is actual content
          <>
            {showProposalPanel && (
              <div className="md:hidden w-full bg-[#18181b] border-b border-[#23232a] flex z-20">
                <button
                  className={`flex-1 py-3 text-center font-semibold transition-colors ${activeTab === 'proposal' ? 'bg-[#23232a] text-green-400' : 'text-gray-300'}`}
                  onClick={() => setActiveTab('proposal')}
                >
                  Proposal
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
              {showProposalPanel ? (
                <div
                  className={`flex-1 min-w-0 ${activeTab === 'proposal' ? 'flex' : 'hidden'} md:flex flex-col`}
                >
                  {hasDocument && currentDocument && (
                    <div className="hidden xl:block border-b border-[#23232a] bg-[#0a0a0a] max-h-[40vh] overflow-y-auto">
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

                  )}
                  <div className="flex-1 min-h-0 flex">
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
                      isResizingProposal={isResizingProposal}
                      onResizeStart={handleProposalResizeStart}
                      onProposalHtmlUpdate={setProposalHtml}
                      isLoading={loadingProposalHtml}
                      forceFullWidth
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                  <p>Proposal is not available yet. Start chatting to generate one.</p>
                </div>
              )}

              <div
                className={`flex flex-col h-full min-h-0 relative overflow-hidden border-l border-[#2a2a2a] ${activeTab === 'chat' ? 'flex' : 'hidden'} md:flex`}
                style={{ width: typeof window !== 'undefined' && window.innerWidth < 850 ? `calc(100vw - ${sidebarWidth}px)` : `${chatWidth}px` }}
              >
                <ChatInterface
                  sessionId={sessionId}
                  projectId={projectId}
                  onNewChat={handleNewChat}
                  isDocumentMode={Boolean(hasDocument)}
                  isWelcomeMode={false}
                  onDocumentGenerated={handleDocumentGenerated}
                  onTextSelect={handleTextSelect}
                  selectedDocumentText={selectedDocumentText}
                  onClearSelectedText={handleClearSelectedText}
                  onProposalHtmlReceived={handleProposalHtmlReceived}
                />
              </div>
            </div>
          </>
        )}
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
