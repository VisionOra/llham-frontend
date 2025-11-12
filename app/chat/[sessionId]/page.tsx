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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Download, FileText, FileCode, FileType, Maximize2, Minimize2 } from "lucide-react"


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
  const loadProposedHtml = useCallback(async (sessionId: string, projectId: string | null) => {
    if (!projectId || loadedProposedHtmlRef.current.has(sessionId)) {
      return
    }

    try {
      loadedProposedHtmlRef.current.add(sessionId)
      const response = await getProposedHtml(projectId, sessionId)
      
      if (response.html_content) {
        setProposalHtml(response.html_content)
        setProposalTitle(response.proposal_title || 'Proposal Preview')
        setShowProposalPanel(true)
      }
    } catch (error) {
      // If proposal not generated yet (404), silently fail
      if (error instanceof Error && error.message.includes("not generated")) {
        // Don't show error, just don't load proposal
        return
      }
      console.error("Error loading proposed HTML:", error)
    }
  }, [])

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
        
        // Load proposed HTML on page refresh/load
        if (projectId && !loadedProposedHtmlRef.current.has(sessionId)) {
          loadProposedHtml(sessionId, projectId)
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
  }, [sessionId, projectId, activeSessionId, startSession, endSession, loadSessionDocument, loadProposedHtml])

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
    setShowProposalPanel(false)
    setProposalHtml(null)
    setProposalTitle(null)
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

  // HTML to Markdown converter
  const htmlToMarkdown = (html: string): string => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
    const processElement = (element: Element | Node): string => {
      if (element.nodeType === Node.TEXT_NODE) {
        return element.textContent || ''
      }
      
      if (element.nodeType !== Node.ELEMENT_NODE) return ''
      
      const el = element as Element
      const tagName = el.tagName.toLowerCase()
      const textContent = el.textContent || ''
      
      switch (tagName) {
        case 'h1': return `# ${textContent}\n\n`
        case 'h2': return `## ${textContent}\n\n`
        case 'h3': return `### ${textContent}\n\n`
        case 'h4': return `#### ${textContent}\n\n`
        case 'p': return `${textContent}\n\n`
        case 'strong':
        case 'b': return `**${textContent}**`
        case 'em':
        case 'i': return `*${textContent}*`
        case 'ul':
        case 'ol': {
          const items = Array.from(el.children)
          return items.map((item, idx) => 
            tagName === 'ol' ? `${idx + 1}. ${item.textContent || ''}\n` : `- ${item.textContent || ''}\n`
          ).join('') + '\n'
        }
        case 'li': return el.textContent || ''
        case 'a': {
          const href = el.getAttribute('href') || ''
          return `[${textContent}](${href})`
        }
        case 'code': return `\`${textContent}\``
        case 'pre': return `\`\`\`\n${textContent}\n\`\`\`\n\n`
        case 'br': return '\n'
        case 'hr': return '---\n\n'
        case 'table': {
          const rows = Array.from(el.querySelectorAll('tr'))
          if (rows.length === 0) return ''
          
          let markdown = '\n'
          rows.forEach((row, rowIdx) => {
            const cells = Array.from(row.querySelectorAll('td, th'))
            const cellTexts = cells.map(cell => cell.textContent?.trim() || '')
            markdown += `| ${cellTexts.join(' | ')} |\n`
            
            if (rowIdx === 0) {
              markdown += `| ${cellTexts.map(() => '---').join(' | ')} |\n`
            }
          })
          return markdown + '\n'
        }
        default: {
          const children = Array.from(el.childNodes)
          return children.map(processElement).join('')
        }
      }
    }
    
    const children = Array.from(tempDiv.childNodes)
    return children.map(processElement).join('').trim()
  }

  // Export functions
  const handleExportPDF = () => {
    if (!proposalHtml || !proposalTitle) return
    
    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank')
      if (!printWindow) return
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${proposalTitle}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
              h1 { color: #111827; font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.75rem; }
              h2 { color: #1f2937; font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 1rem; }
              h3 { color: #374151; font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
              p { color: #4b5563; margin-bottom: 1.25rem; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }
              th, td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; }
              th { background-color: #f9fafb; font-weight: 600; }
              @media print {
                body { margin: 0; padding: 20px; }
              }
            </style>
          </head>
          <body>
            <h1>${proposalTitle}</h1>
            ${proposalHtml}
          </body>
        </html>
      `)
      
      printWindow.document.close()
      
      setTimeout(() => {
        printWindow.print()
      }, 250)
    } catch (error) {
      console.error('PDF export failed:', error)
      alert('PDF export failed. Please try again.')
    }
  }

  const handleExportHTML = () => {
    if (!proposalHtml || !proposalTitle) return
    
    try {
      const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>${proposalTitle}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; max-width: 900px; margin: 0 auto; }
      h1 { color: #111827; font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.75rem; }
      h2 { color: #1f2937; font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 1rem; }
      h3 { color: #374151; font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
      p { color: #4b5563; margin-bottom: 1.25rem; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }
      th, td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; }
      th { background-color: #f9fafb; font-weight: 600; }
    </style>
  </head>
  <body>
    <h1>${proposalTitle}</h1>
    ${proposalHtml}
  </body>
</html>`
      
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${proposalTitle.replace(/[^a-zA-Z0-9]/g, "_")}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('HTML export failed:', error)
      alert('HTML export failed. Please try again.')
    }
  }

  const handleExportMD = () => {
    if (!proposalHtml || !proposalTitle) return
    
    try {
      const markdownContent = htmlToMarkdown(proposalHtml)
      const fullMarkdown = `# ${proposalTitle}\n\n${markdownContent}`
      
      const blob = new Blob([fullMarkdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${proposalTitle.replace(/[^a-zA-Z0-9]/g, "_")}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Markdown export failed:', error)
      alert('Markdown export failed. Please try again.')
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
              {showProposalPanel && proposalHtml && (
                <>
                  {/* Mobile/Tablet: Full Screen Overlay */}
                  <div
                    className={`lg:hidden fixed inset-0 z-50 bg-white flex flex-col ${showProposalPanel ? 'block' : 'hidden'}`}
                  >
                    {/* Mobile Header */}
                    <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white shadow-sm flex-shrink-0">
                      <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate flex-1 mr-2 sm:mr-3 min-w-0">
                        {proposalTitle || 'Proposal Preview'}
                      </h2>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        {/* Export Button - Mobile */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-300 flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                            >
                              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-white border-gray-200">
                            <DropdownMenuItem
                              onClick={handleExportPDF}
                              className="cursor-pointer hover:bg-gray-100"
                            >
                              <FileText className="w-4 h-4 mr-2" />
                              Export as PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={handleExportHTML}
                              className="cursor-pointer hover:bg-gray-100"
                            >
                              <FileCode className="w-4 h-4 mr-2" />
                              Export as HTML
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={handleExportMD}
                              className="cursor-pointer hover:bg-gray-100"
                            >
                              <FileType className="w-4 h-4 mr-2" />
                              Export as Markdown
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        
                        {/* Close Button - Mobile */}
                        <button
                          onClick={handleCloseProposalPanel}
                          className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1.5 transition-colors flex-shrink-0"
                          aria-label="Close proposal panel"
                        >
                          <svg
                            className="w-4 h-4 sm:w-5 sm:h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Mobile Content */}
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 bg-white">
                      <style dangerouslySetInnerHTML={{
                        __html: `
                          .proposal-panel-content {
                            max-width: 100%;
                            line-height: 1.6;
                            word-wrap: break-word;
                            overflow-wrap: break-word;
                            word-break: break-word;
                            font-size: 14px;
                          }
                          @media (min-width: 640px) {
                            .proposal-panel-content {
                              font-size: 16px;
                              line-height: 1.7;
                            }
                          }
                          .proposal-panel-content * {
                            max-width: 100%;
                            word-wrap: break-word;
                            overflow-wrap: break-word;
                          }
                          .proposal-panel-content h1 {
                            font-size: 1.5rem;
                            margin-top: 0;
                            margin-bottom: 1rem;
                            padding-bottom: 0.5rem;
                            border-bottom: 2px solid #e5e7eb;
                          }
                          @media (min-width: 640px) {
                            .proposal-panel-content h1 {
                              font-size: 2rem;
                              margin-bottom: 1.5rem;
                              padding-bottom: 0.75rem;
                            }
                          }
                          .proposal-panel-content h2 {
                            font-size: 1.25rem;
                            margin-top: 1.5rem;
                            margin-bottom: 0.75rem;
                          }
                          @media (min-width: 640px) {
                            .proposal-panel-content h2 {
                              font-size: 1.5rem;
                              margin-top: 2rem;
                              margin-bottom: 1rem;
                            }
                          }
                          .proposal-panel-content h3 {
                            font-size: 1.1rem;
                            margin-top: 1.25rem;
                            margin-bottom: 0.5rem;
                          }
                          @media (min-width: 640px) {
                            .proposal-panel-content h3 {
                              font-size: 1.25rem;
                              margin-top: 1.5rem;
                              margin-bottom: 0.75rem;
                            }
                          }
                          .proposal-panel-content p {
                            margin-bottom: 1rem;
                          }
                          @media (min-width: 640px) {
                            .proposal-panel-content p {
                              margin-bottom: 1.25rem;
                            }
                          }
                          .proposal-panel-content table {
                            max-width: 100%;
                            table-layout: fixed;
                            font-size: 0.875rem;
                          }
                          @media (min-width: 640px) {
                            .proposal-panel-content table {
                              font-size: 1rem;
                            }
                          }
                          .proposal-panel-content img {
                            max-width: 100%;
                            height: auto;
                          }
                          .proposal-panel-content ul, .proposal-panel-content ol {
                            padding-left: 1.25rem;
                            margin-bottom: 1rem;
                          }
                          @media (min-width: 640px) {
                            .proposal-panel-content ul, .proposal-panel-content ol {
                              padding-left: 1.5rem;
                              margin-bottom: 1.5rem;
                            }
                          }
                        `
                      }} />
                      <div
                        className="proposal-panel-content"
                        dangerouslySetInnerHTML={{ __html: proposalHtml }}
                      />
                    </div>
                  </div>

                  {/* Desktop: Side Panel */}
                  <div
                    className={`hidden lg:flex flex-col h-full border-l border-gray-200 bg-white shadow-xl relative ${!isResizingProposal ? 'transition-all duration-200' : ''} min-w-0`}
                    style={{ 
                      width: isProposalPanelExpanded 
                        ? `calc(100vw - ${sidebarWidth}px - ${chatWidth}px - 100px)` 
                        : `${proposalPanelWidth}px`, 
                      maxWidth: '100%' 
                    }}
                >
                  {/* Resize Handle - Left side */}
                  <div
                    className={`absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize z-50 transition-all duration-200 ${
                      isResizingProposal ? 'bg-green-500 w-2' : 'hover:bg-green-500/60 hover:w-2'
                    }`}
                    onMouseDown={handleProposalResizeStart}
                    title="Drag to resize proposal panel"
                  />
                  
                  {/* Resize Handle - Right side (for easier resizing) */}
                  <div
                    className={`absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize z-50 transition-all duration-200 ${
                      isResizingProposal ? 'bg-green-500' : 'hover:bg-green-500/60'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setIsResizingProposal(true)
                      // Store initial mouse position and panel width
                      const startX = e.clientX
                      const startWidth = proposalPanelWidth
                      const viewportWidth = window.innerWidth
                      
                      const handleMove = (moveEvent: MouseEvent) => {
                        const deltaX = startX - moveEvent.clientX // Inverted because we're resizing from right
                        const newWidth = Math.min(viewportWidth * 0.6, Math.max(300, startWidth + deltaX))
                        setProposalPanelWidth(newWidth)
                      }
                      
                      const handleUp = () => {
                        setIsResizingProposal(false)
                        document.body.style.cursor = 'default'
                        document.body.style.userSelect = 'auto'
                        document.removeEventListener('mousemove', handleMove)
                        document.removeEventListener('mouseup', handleUp)
                      }
                      
                      document.body.style.cursor = 'ew-resize'
                      document.body.style.userSelect = 'none'
                      document.addEventListener('mousemove', handleMove)
                      document.addEventListener('mouseup', handleUp)
                    }}
                    title="Drag to resize proposal panel"
                  />

                  {/* Panel Header */}
                  <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white shadow-sm min-w-0 flex-shrink-0">
                    <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 truncate flex-1 min-w-0 mr-2 sm:mr-3">
                      {proposalTitle || 'Proposal Preview'}
                    </h2>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      {/* Expand/Collapse Button */}
                      <button
                        onClick={handleToggleProposalPanelExpand}
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1.5 transition-colors flex-shrink-0"
                        aria-label={isProposalPanelExpanded ? "Collapse panel" : "Expand panel"}
                        title={isProposalPanelExpanded ? "Collapse panel" : "Expand panel"}
                      >
                        {isProposalPanelExpanded ? (
                          <Minimize2 className="w-5 h-5" />
                        ) : (
                          <Maximize2 className="w-5 h-5" />
                        )}
                      </button>
                      
                      {/* Export Button */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-300 flex-shrink-0"
                          >
                            <Download className="w-4 h-4 mr-1.5" />
                            Export
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white border-gray-200">
                          <DropdownMenuItem
                            onClick={handleExportPDF}
                            className="cursor-pointer hover:bg-gray-100"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Export as PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={handleExportHTML}
                            className="cursor-pointer hover:bg-gray-100"
                          >
                            <FileCode className="w-4 h-4 mr-2" />
                            Export as HTML
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={handleExportMD}
                            className="cursor-pointer hover:bg-gray-100"
                          >
                            <FileType className="w-4 h-4 mr-2" />
                            Export as Markdown
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      
                      {/* Close Button */}
                    <button
                      onClick={handleCloseProposalPanel}
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1.5 transition-colors flex-shrink-0"
                      aria-label="Close proposal panel"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                    </div>
                  </div>

                  {/* Panel Content */}
                  <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-white">
                    <style dangerouslySetInnerHTML={{
                      __html: `
                        .proposal-panel-content {
                          max-width: 100%;
                          line-height: 1.7;
                          word-wrap: break-word;
                          overflow-wrap: break-word;
                          word-break: break-word;
                        }
                        .proposal-panel-content * {
                          max-width: 100%;
                          word-wrap: break-word;
                          overflow-wrap: break-word;
                        }
                        .proposal-panel-content table {
                          max-width: 100%;
                          table-layout: fixed;
                        }
                        .proposal-panel-content img {
                          max-width: 100%;
                          height: auto;
                        }
                        .proposal-panel-content h1 {
                          color: #111827;
                          font-size: 2rem;
                          font-weight: 700;
                          margin-top: 0;
                          margin-bottom: 1.5rem;
                          padding-bottom: 0.75rem;
                          border-bottom: 2px solid #e5e7eb;
                        }
                        .proposal-panel-content h2 {
                          color: #1f2937;
                          font-size: 1.5rem;
                          font-weight: 600;
                          margin-top: 2rem;
                          margin-bottom: 1rem;
                          padding-top: 1rem;
                        }
                        .proposal-panel-content h3 {
                          color: #374151;
                          font-size: 1.25rem;
                          font-weight: 600;
                          margin-top: 1.5rem;
                          margin-bottom: 0.75rem;
                        }
                        .proposal-panel-content h4 {
                          color: #4b5563;
                          font-size: 1.1rem;
                          font-weight: 600;
                          margin-top: 1.25rem;
                          margin-bottom: 0.5rem;
                        }
                        .proposal-panel-content p {
                          color: #4b5563;
                          margin-bottom: 1.25rem;
                          line-height: 1.8;
                        }
                        .proposal-panel-content ul, .proposal-panel-content ol {
                          color: #4b5563;
                          margin-bottom: 1.5rem;
                          padding-left: 1.5rem;
                        }
                        .proposal-panel-content li {
                          color: #4b5563;
                          margin-bottom: 0.75rem;
                          line-height: 1.7;
                        }
                        .proposal-panel-content strong {
                          color: #111827;
                          font-weight: 600;
                        }
                        .proposal-panel-content a {
                          color: #2563eb;
                          text-decoration: underline;
                          transition: color 0.2s;
                        }
                        .proposal-panel-content a:hover {
                          color: #1d4ed8;
                        }
                        .proposal-panel-content table {
                          color: #4b5563;
                          border-collapse: collapse;
                          width: 100%;
                          margin-bottom: 1.5rem;
                          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                          border-radius: 0.5rem;
                          overflow: hidden;
                        }
                        .proposal-panel-content th, .proposal-panel-content td {
                          border: 1px solid #e5e7eb;
                          padding: 0.75rem;
                          text-align: left;
                        }
                        .proposal-panel-content th {
                          background-color: #f9fafb;
                          color: #111827;
                          font-weight: 600;
                        }
                        .proposal-panel-content tr:nth-child(even) {
                          background-color: #f9fafb;
                        }
                        .proposal-panel-content tr:hover {
                          background-color: #f3f4f6;
                        }
                        .proposal-panel-content section {
                          margin-bottom: 2rem;
                        }
                        .proposal-panel-content .agent-section {
                          background-color: #f9fafb;
                          padding: 1.5rem;
                          border-radius: 0.75rem;
                          margin-bottom: 1.5rem;
                          border-left: 4px solid #10b981;
                        }
                      `
                    }} />
                    <div
                      className="proposal-panel-content"
                      dangerouslySetInnerHTML={{ __html: proposalHtml }}
                    />
                  </div>
                </div>
                </>
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
          {!hasDocument && showProposalPanel && proposalHtml && (
            <>
              {/* Mobile/Tablet: Full Screen Overlay */}
              <div
                className={`lg:hidden fixed inset-0 z-50 bg-white flex flex-col ${showProposalPanel ? 'block' : 'hidden'}`}
              >
                {/* Mobile Header */}
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white shadow-sm flex-shrink-0">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate flex-1 mr-2 sm:mr-3 min-w-0">
                    {proposalTitle || 'Proposal Preview'}
                  </h2>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    {/* Export Button - Mobile */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-300 flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                        >
                          <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-white border-gray-200">
                        <DropdownMenuItem
                          onClick={handleExportPDF}
                          className="cursor-pointer hover:bg-gray-100"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Export as PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleExportHTML}
                          className="cursor-pointer hover:bg-gray-100"
                        >
                          <FileCode className="w-4 h-4 mr-2" />
                          Export as HTML
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={handleExportMD}
                          className="cursor-pointer hover:bg-gray-100"
                        >
                          <FileType className="w-4 h-4 mr-2" />
                          Export as Markdown
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    
                    {/* Close Button - Mobile */}
                    <button
                      onClick={handleCloseProposalPanel}
                      className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1.5 transition-colors flex-shrink-0"
                      aria-label="Close proposal panel"
                    >
                      <svg
                        className="w-4 h-4 sm:w-5 sm:h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Mobile Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 bg-white">
                  <style dangerouslySetInnerHTML={{
                    __html: `
                      .proposal-panel-content {
                        max-width: 100%;
                        line-height: 1.6;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                        word-break: break-word;
                        font-size: 14px;
                      }
                      @media (min-width: 640px) {
                        .proposal-panel-content {
                          font-size: 16px;
                          line-height: 1.7;
                        }
                      }
                      .proposal-panel-content * {
                        max-width: 100%;
                        word-wrap: break-word;
                        overflow-wrap: break-word;
                      }
                      .proposal-panel-content h1 {
                        font-size: 1.5rem;
                        margin-top: 0;
                        margin-bottom: 1rem;
                        padding-bottom: 0.5rem;
                        border-bottom: 2px solid #e5e7eb;
                      }
                      @media (min-width: 640px) {
                        .proposal-panel-content h1 {
                          font-size: 2rem;
                          margin-bottom: 1.5rem;
                          padding-bottom: 0.75rem;
                        }
                      }
                      .proposal-panel-content h2 {
                        font-size: 1.25rem;
                        margin-top: 1.5rem;
                        margin-bottom: 0.75rem;
                      }
                      @media (min-width: 640px) {
                        .proposal-panel-content h2 {
                          font-size: 1.5rem;
                          margin-top: 2rem;
                          margin-bottom: 1rem;
                        }
                      }
                      .proposal-panel-content h3 {
                        font-size: 1.1rem;
                        margin-top: 1.25rem;
                        margin-bottom: 0.5rem;
                      }
                      @media (min-width: 640px) {
                        .proposal-panel-content h3 {
                          font-size: 1.25rem;
                          margin-top: 1.5rem;
                          margin-bottom: 0.75rem;
                        }
                      }
                      .proposal-panel-content p {
                        margin-bottom: 1rem;
                      }
                      @media (min-width: 640px) {
                        .proposal-panel-content p {
                          margin-bottom: 1.25rem;
                        }
                      }
                      .proposal-panel-content table {
                        max-width: 100%;
                        table-layout: fixed;
                        font-size: 0.875rem;
                      }
                      @media (min-width: 640px) {
                        .proposal-panel-content table {
                          font-size: 1rem;
                        }
                      }
                      .proposal-panel-content img {
                        max-width: 100%;
                        height: auto;
                      }
                      .proposal-panel-content ul, .proposal-panel-content ol {
                        padding-left: 1.25rem;
                        margin-bottom: 1rem;
                      }
                      @media (min-width: 640px) {
                        .proposal-panel-content ul, .proposal-panel-content ol {
                          padding-left: 1.5rem;
                          margin-bottom: 1.5rem;
                        }
                      }
                    `
                  }} />
                  <div
                    className="proposal-panel-content"
                    dangerouslySetInnerHTML={{ __html: proposalHtml }}
                  />
                </div>
              </div>

              {/* Desktop: Side Panel */}
              <div
                className={`hidden lg:flex flex-col h-full border-l border-gray-200 bg-white shadow-xl relative ${!isResizingProposal ? 'transition-all duration-200' : ''} min-w-0`}
                style={{ 
                  width: isProposalPanelExpanded 
                    ? `calc(100vw - ${sidebarWidth}px - ${chatWidth}px - 100px)` 
                    : `${proposalPanelWidth}px`, 
                  maxWidth: '100%',
                  minWidth: '300px'
                }}
            >
              {/* Resize Handle - Left side */}
              <div
                className={`absolute top-0 bottom-0 left-0 w-1 cursor-ew-resize z-50 transition-all duration-200 ${
                  isResizingProposal ? 'bg-green-500 w-2' : 'hover:bg-green-500/60 hover:w-2'
                }`}
                onMouseDown={handleProposalResizeStart}
                title="Drag to resize proposal panel"
              />
              
              {/* Resize Handle - Right side (for easier resizing) */}
              <div
                className={`absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize z-50 transition-all duration-200 ${
                  isResizingProposal ? 'bg-green-500' : 'hover:bg-green-500/60'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setIsResizingProposal(true)
                  // Store initial mouse position and panel width
                  const startX = e.clientX
                  const startWidth = proposalPanelWidth
                  const viewportWidth = window.innerWidth
                  
                  const handleMove = (moveEvent: MouseEvent) => {
                    const deltaX = startX - moveEvent.clientX // Inverted because we're resizing from right
                    const newWidth = Math.min(viewportWidth * 0.6, Math.max(300, startWidth + deltaX))
                    setProposalPanelWidth(newWidth)
                  }
                  
                  const handleUp = () => {
                    setIsResizingProposal(false)
                    document.body.style.cursor = 'default'
                    document.body.style.userSelect = 'auto'
                    document.removeEventListener('mousemove', handleMove)
                    document.removeEventListener('mouseup', handleUp)
                  }
                  
                  document.body.style.cursor = 'ew-resize'
                  document.body.style.userSelect = 'none'
                  document.addEventListener('mousemove', handleMove)
                  document.addEventListener('mouseup', handleUp)
                }}
                title="Drag to resize proposal panel"
              />

              {/* Panel Header */}
              <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white shadow-sm min-w-0 flex-shrink-0">
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 truncate flex-1 min-w-0 mr-2 sm:mr-3">
                  {proposalTitle || 'Proposal Preview'}
                </h2>
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  {/* Expand/Collapse Button */}
                  <button
                    onClick={handleToggleProposalPanelExpand}
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1.5 transition-colors flex-shrink-0"
                    aria-label={isProposalPanelExpanded ? "Collapse panel" : "Expand panel"}
                    title={isProposalPanelExpanded ? "Collapse panel" : "Expand panel"}
                  >
                    {isProposalPanelExpanded ? (
                      <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    ) : (
                      <Maximize2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                  </button>
                  
                  {/* Export Button */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-gray-600 hover:text-gray-900 hover:bg-gray-100 border-gray-300 flex-shrink-0"
                      >
                        <Download className="w-4 h-4 mr-1.5" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-gray-200">
                      <DropdownMenuItem
                        onClick={handleExportPDF}
                        className="cursor-pointer hover:bg-gray-100"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleExportHTML}
                        className="cursor-pointer hover:bg-gray-100"
                      >
                        <FileCode className="w-4 h-4 mr-2" />
                        Export as HTML
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleExportMD}
                        className="cursor-pointer hover:bg-gray-100"
                      >
                        <FileType className="w-4 h-4 mr-2" />
                        Export as Markdown
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  {/* Close Button */}
                <button
                  onClick={handleCloseProposalPanel}
                    className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full p-1.5 transition-colors flex-shrink-0"
                  aria-label="Close proposal panel"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
                </div>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-white">
                <style dangerouslySetInnerHTML={{
                  __html: `
                    .proposal-panel-content {
                      max-width: 100%;
                      line-height: 1.7;
                    }
                    .proposal-panel-content h1 {
                      color: #111827;
                      font-size: 2rem;
                      font-weight: 700;
                      margin-top: 0;
                      margin-bottom: 1.5rem;
                      padding-bottom: 0.75rem;
                      border-bottom: 2px solid #e5e7eb;
                    }
                    .proposal-panel-content h2 {
                      color: #1f2937;
                      font-size: 1.5rem;
                      font-weight: 600;
                      margin-top: 2rem;
                      margin-bottom: 1rem;
                      padding-top: 1rem;
                    }
                    .proposal-panel-content h3 {
                      color: #374151;
                      font-size: 1.25rem;
                      font-weight: 600;
                      margin-top: 1.5rem;
                      margin-bottom: 0.75rem;
                    }
                    .proposal-panel-content h4 {
                      color: #4b5563;
                      font-size: 1.1rem;
                      font-weight: 600;
                      margin-top: 1.25rem;
                      margin-bottom: 0.5rem;
                    }
                    .proposal-panel-content p {
                      color: #4b5563;
                      margin-bottom: 1.25rem;
                      line-height: 1.8;
                    }
                    .proposal-panel-content ul, .proposal-panel-content ol {
                      color: #4b5563;
                      margin-bottom: 1.5rem;
                      padding-left: 1.5rem;
                    }
                    .proposal-panel-content li {
                      color: #4b5563;
                      margin-bottom: 0.75rem;
                      line-height: 1.7;
                    }
                    .proposal-panel-content strong {
                      color: #111827;
                      font-weight: 600;
                    }
                    .proposal-panel-content a {
                      color: #2563eb;
                      text-decoration: underline;
                      transition: color 0.2s;
                    }
                    .proposal-panel-content a:hover {
                      color: #1d4ed8;
                    }
                    .proposal-panel-content table {
                      color: #4b5563;
                      border-collapse: collapse;
                      width: 100%;
                      margin-bottom: 1.5rem;
                      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                      border-radius: 0.5rem;
                      overflow: hidden;
                    }
                    .proposal-panel-content th, .proposal-panel-content td {
                      border: 1px solid #e5e7eb;
                      padding: 0.75rem;
                      text-align: left;
                    }
                    .proposal-panel-content th {
                      background-color: #f9fafb;
                      color: #111827;
                      font-weight: 600;
                    }
                    .proposal-panel-content tr:nth-child(even) {
                      background-color: #f9fafb;
                    }
                    .proposal-panel-content tr:hover {
                      background-color: #f3f4f6;
                    }
                    .proposal-panel-content section {
                      margin-bottom: 2rem;
                    }
                    .proposal-panel-content .agent-section {
                      background-color: #f9fafb;
                      padding: 1.5rem;
                      border-radius: 0.75rem;
                      margin-bottom: 1.5rem;
                      border-left: 4px solid #10b981;
                    }
                  `
                }} />
                <div
                  className="proposal-panel-content"
                  dangerouslySetInnerHTML={{ __html: proposalHtml }}
                />
              </div>
            </div>
            </>
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
