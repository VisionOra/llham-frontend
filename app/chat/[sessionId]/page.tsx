"use client"

import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useRef } from "react"
import { ChatInterface } from "@/components/chat-interface"
import { DocumentViewer } from "@/components/document-viewer"
import { ChatSidebar } from "@/components/chat-sidebar"
import { AuthGuard } from "@/components/auth-guard"
import { useAuth } from "@/contexts/auth-context"
import { useWebSocket } from "@/contexts/websocket-context"
import { getDocumentContent, getProposedHtml, communicateWithMasterAgent } from "@/lib/api"
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
    addMessage,
    isTyping,
    setIsTyping
  } = useWebSocket()

  const [chatWidth, setChatWidth] = useState(450) // Chat width in pixels
  const [isResizing, setIsResizing] = useState(false)
  const [isResizingProposal, setIsResizingProposal] = useState(false)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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
  const [isPageReady, setIsPageReady] = useState(false)

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

  // Load document for session - disabled to prevent unnecessary GET calls
  // WebSocket handles document updates via wsCurrentDocument
  const loadSessionDocument = useCallback(async (sessionId: string) => {
    // Disabled - unnecessary GET call, WebSocket handles document updates
    return
  }, [])

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
  // This endpoint is needed to restore proposal view after page refresh
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
      
      // Load conversation history from response if available
      if (response.conversation_history && Array.isArray(response.conversation_history) && addMessage) {
        response.conversation_history.forEach((msg: any, index: number) => {
          // Create unique ID using message_hash if available
          const messageId = msg.message_hash 
            ? `proposed-html-${sessionId}-${index}-${msg.message_hash}`
            : `proposed-html-${sessionId}-${index}-${Date.now()}-${index}`
          
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
      }
      
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
  }, [isDefaultProposalMessage, addMessage])

  // Load conversation history - removed (resume endpoint no longer used)
  const loadConversationHistory = useCallback(async (sessionId: string) => {
    // Function disabled - resume endpoint removed
    return
  }, [])

  // Load document and proposal HTML when sessionId changes
  useEffect(() => {
    if (sessionId) {
      // Only load document if we haven't loaded it for this session yet
      if (!loadedSessionsRef.current.has(sessionId)) {
        loadedSessionsRef.current.add(sessionId)
        loadSessionDocument(sessionId)
      }
      
      // Conversation history loading removed (resume endpoint no longer used)
      
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

  // Conversation history loading removed (resume endpoint no longer used)

  // Mark page as ready when WebSocket is connected and session is loaded
  useEffect(() => {
    if (sessionId && connectionStatus === 'connected') {
      // Small delay to ensure everything is initialized
      const timer = setTimeout(() => {
        setIsPageReady(true)
      }, 300) // 300ms delay to ensure smooth transition
      return () => clearTimeout(timer)
    } else {
      setIsPageReady(false)
    }
  }, [sessionId, connectionStatus])

  // Function to handle communicate response
  const handleCommunicateResponse = useCallback(() => {
    if (!sessionId || connectionStatus !== 'connected') return
    
    const storedResponse = sessionStorage.getItem('pendingCommunicateResponse')
    if (!storedResponse) return
    
    try {
      const response = JSON.parse(storedResponse)
      
      // Only process if it's for the current session
      if (response.session_id === sessionId) {
        // Hide typing indicator when response is processed
        setIsTyping(false)
        
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
      // Hide typing indicator on error
      setIsTyping(false)
      console.error("Error parsing communicate response:", error)
      sessionStorage.removeItem('pendingCommunicateResponse')
    }
  }, [sessionId, connectionStatus, wsMessages, addMessage, projectId, isDefaultProposalMessage, setIsTyping])

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
        
        // Add user message instantly to chat with unique ID
        const storedMessageId = `user-stored-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        addMessage({
          id: storedMessageId,
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
        
        // Call communicateWithMasterAgent API in the background
        // This will show the response in chat interface
        if (projectId && storedMessage) {
          // Show typing indicator
          setIsTyping(true)
          
          communicateWithMasterAgent({
            session_id: sessionId,
            project_id: projectId,
            message: storedMessage.trim()
          }).then((communicateResponse) => {
            // Hide typing indicator when response arrives
            setIsTyping(false)
            
            // Store communicate response to handle it below
            if (communicateResponse) {
              sessionStorage.setItem('pendingCommunicateResponse', JSON.stringify({
                message: communicateResponse.message,
                proposal_html: communicateResponse.proposal_html,
                proposal_title: communicateResponse.proposal_title,
                session_id: communicateResponse.session_id
              }))
              // Trigger a re-check of pendingCommunicateResponse
              // by setting a flag or re-running the effect logic
              const event = new Event('communicateResponseReady')
              window.dispatchEvent(event)
            }
          }).catch((error) => {
            // Hide typing indicator on error
            setIsTyping(false)
            console.error("Error calling communicate API:", error)
            // Continue even if communicate API fails
          })
        }
      } else if (storedMessage && storedSessionId === sessionId && hasUserMessage) {
        // Message already exists, just clean up sessionStorage
        pendingMessageProcessedRef.current.add(sessionId)
        sessionStorage.removeItem('pendingMessage')
        sessionStorage.removeItem('pendingSessionId')
      }
      
      // Then, handle communicate response (AI message) if it exists
      if (storedResponse) {
        handleCommunicateResponse()
      }
    }
  }, [sessionId, activeSessionId, connectionStatus, projectId, addMessage, wsMessages, handleCommunicateResponse])

  // Listen for communicate response ready event
  useEffect(() => {
    const handleCommunicateResponseReady = () => {
      handleCommunicateResponse()
    }
    
    window.addEventListener('communicateResponseReady', handleCommunicateResponseReady)
    
    return () => {
      window.removeEventListener('communicateResponseReady', handleCommunicateResponseReady)
    }
  }, [handleCommunicateResponse])

  // Function to refresh document content from API - removed to prevent unnecessary GET calls
  // WebSocket already provides document updates via wsCurrentDocument
  const refreshDocumentContent = useCallback(async () => {
    // Disabled - unnecessary GET call, WebSocket handles document updates
    return
  }, [])

  // Removed useEffect that was calling refreshDocumentContent on every message
  // WebSocket already provides document updates via wsCurrentDocument

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

  // Map WebSocket html_content updates to proposalHtml
  useEffect(() => {
    if (wsCurrentDocument?.content && sessionId === activeSessionId) {
      const htmlContent = wsCurrentDocument.content
      // Check if this is proposal HTML (contains proposal-like structure)
      // If it has html_content or looks like proposal HTML, map it to proposalHtml
      if (htmlContent && typeof htmlContent === 'string' && htmlContent.trim().length > 0) {
        // Check if it's not a default message and looks like HTML content
        if (!isDefaultProposalMessage(htmlContent) && 
            (htmlContent.includes('<h1>') || htmlContent.includes('<h2>') || htmlContent.includes('<section'))) {
          setProposalHtml(htmlContent)
          if (wsCurrentDocument.title) {
            setProposalTitle(wsCurrentDocument.title)
          }
          setShowProposalPanel(true)
        }
      }
    }
  }, [wsCurrentDocument, sessionId, activeSessionId])





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
      {/* Loading Overlay - Show until page is ready */}
      {!isPageReady && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a]/95 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center space-y-6">
            {/* Large Spinner */}
            <div className="relative">
              <div className="w-20 h-20 border-4 border-green-600/30 rounded-full"></div>
              <div className="w-20 h-20 border-4 border-green-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
            
            {/* Loading Text */}
            <div className="flex flex-col items-center space-y-2">
              <h2 className="text-xl font-semibold text-white">Loading chat...</h2>
              <p className="text-sm text-gray-400">Please wait while we set everything up</p>
            </div>
          </div>
        </div>
      )}

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
        activeProjectId={projectId}
        activeSessionId={sessionId}
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
              {/* Proposal Panel - Show on desktop always, on mobile/tablet only when activeTab is 'proposal' */}
              {showProposalPanel && (
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
                      forceFullWidth={false}
                    />
                  </div>
                </div>
              )}

              {/* Chat Interface - Show on desktop always, on mobile/tablet only when activeTab is 'chat' */}
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
