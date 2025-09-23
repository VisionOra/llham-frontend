"use client"

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react"
import { TokenManager, getSessionHistory } from "@/lib/api"
import type { ChatMessage } from "@/hooks/use-proposal-socket"

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface WebSocketContextType {
  connectionStatus: ConnectionStatus
  messages: ChatMessage[]
  currentStage: string | null
  progress: number
  isGeneratingProposal: boolean
  currentDocument: any | null
  agentMode: string
  activeSessionId: string | null
  latestEditSuggestion: ChatMessage | null
  isTyping: boolean
  pendingMessage: string | null
  sendMessage: (type: string, message: string, pdfFiles: any[], documentContext?: string | null) => void
  setPendingMessage: (message: string | null) => void
  acceptEdit: (editId: string) => void
  rejectEdit: (editId: string) => void
  requestEdit: (selectedText: string, documentContext: string) => void
  startSession: (sessionId: string, projectId?: string | null) => void
  endSession: () => void
  clearMessages: () => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const lastConnectionAttempt = useRef<number>(0)
  const connectionTimeout = useRef<NodeJS.Timeout | null>(null)
  const fetchedDocumentsRef = useRef<Set<string>>(new Set())
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [currentStage, setCurrentStage] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false)
  const [currentDocument, setCurrentDocument] = useState<any>(null)
  const [agentMode, setAgentMode] = useState<string>('conversation')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [latestEditSuggestion, setLatestEditSuggestion] = useState<ChatMessage | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState<ChatMessage | null>(null)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5
  const currentMessageRef = useRef<string>('')
  const currentMessageIdRef = useRef<string | null>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const messageCounter = useRef(0)
 

  // Function to fetch generated document after workflow completion
  const fetchGeneratedDocument = useCallback(async (sessionId: string) => {
    if (fetchedDocumentsRef.current.has(sessionId)) {
      console.log('📄 Document already fetched for session:', sessionId)
      return
    }

    try {
      console.log('📄 Fetching generated document for session:', sessionId)
      fetchedDocumentsRef.current.add(sessionId)
      const response = await fetch(`${API_BASE_URL}/documents/${sessionId}/`, {
        headers: {
          'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })

      if (response.ok) {
        const documentData = await response.json()
        console.log('📄 Document fetched successfully:', documentData)
        
        // Set the document in the context
        setCurrentDocument({
          id: documentData.id || sessionId,
          title: documentData.title || 'Generated Proposal',
          content: documentData.document || documentData.content,
          created_at: documentData.created_at || new Date().toISOString(),
          updated_at: documentData.updated_at || new Date().toISOString(),
          author: documentData.created_by || 'AI Assistant'
        })
      } else {
        console.error('📄 Failed to fetch document:', response.status)
        fetchedDocumentsRef.current.delete(sessionId)
      }
    } catch (error) {
      console.error('📄 Error fetching generated document:', error)
      fetchedDocumentsRef.current.delete(sessionId)
    }
  }, [API_BASE_URL])

  const connect = useCallback(() => {
    const token = TokenManager.getAccessToken()
    if (!token) {
      console.error('No token available for WebSocket connection')
      return
    }

    // Prevent multiple connection attempts
    if (socket?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected, skipping')
      return
    }

    if (socket?.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket already connecting, skipping')
      return
    }

    // Prevent rapid connection attempts (debounce)
    const now = Date.now()
    if (now - lastConnectionAttempt.current < 2000) {
      console.log('🔄 Connection attempt too soon, debouncing')
      return
    }
    lastConnectionAttempt.current = now

    // Clear any existing timeout
    if (connectionTimeout.current) {
      clearTimeout(connectionTimeout.current)
      connectionTimeout.current = null
    }

    setConnectionStatus('connecting')
    const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || API_BASE_URL.replace(/^http/, "ws");
    const wsUrl = `${WS_BASE_URL}/ws/chat/?token=${token}`
    console.log('[WebSocket] Connecting to:', wsUrl)

    try {
      const ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected')
        setConnectionStatus('connected')
        reconnectAttempts.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('📥 WebSocket message received:', data)
          
          switch(data.type) {
            case 'connection_established':
              console.log('🔗 Connection established')
              break

            case 'ai_message_chunk':
              console.log('📥 AI message chunk received')
              
              // Create unique streaming ID for each new message
              if (!currentMessageIdRef.current) {
                messageCounter.current += 1
                currentMessageIdRef.current = `streaming-${data.session_id}-${messageCounter.current}`
              }
              
              const streamingId = currentMessageIdRef.current
              
              // Always use current_text (full text so far) for consistent display
              const currentContent = data.current_text || ''
              
              setMessages(prev => {
                // Check if streaming message already exists
                const existingIndex = prev.findIndex(msg => msg.id === streamingId)
                
                if (existingIndex >= 0) {
                  // Update existing streaming message
                  const updated = [...prev]
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    content: currentContent,
                    isStreaming: true
                  }
                  return updated
                } else {
                  // Create new streaming message
                  return [...prev, {
                    id: streamingId,
                    type: 'ai' as const,
                    content: currentContent,
                    timestamp: new Date(),
                    sessionId: data.session_id,
                    projectId: data.project_id,
                    isStreaming: true
                  }]
                }
              })
              break

            case 'ai_message_complete':
              console.log('✅ AI message complete')
              
              const completionStreamingId = currentMessageIdRef.current
              
              if (completionStreamingId) {
                // Finalize the streaming message
                setMessages(prev => {
                  const existingIndex = prev.findIndex(msg => msg.id === completionStreamingId)
                  
                  if (existingIndex >= 0) {
                    const updated = [...prev]
                    updated[existingIndex] = {
                      ...updated[existingIndex],
                      content: data.final_text || updated[existingIndex].content,
                      isStreaming: false,
                      suggestions: data.suggested_questions,
                      suggestedQuestions: data.suggested_questions
                    }
                    return updated
                  } else {
                    // Fallback: create new message if streaming message wasn't found
                    return [...prev, {
                      id: Date.now().toString(),
                      type: 'ai' as const,
                      content: data.final_text || '',
                      timestamp: new Date(),
                      sessionId: data.session_id,
                      projectId: data.project_id,
                      suggestions: data.suggested_questions,
                      suggestedQuestions: data.suggested_questions,
                      isStreaming: false
                    }]
                  }
                })
                
                // Reset streaming state for next message
                currentMessageIdRef.current = null
              }
              
              // Clear streaming state
              setCurrentStreamingMessage(null)
              setAgentMode(data.agent_mode || 'conversation')
              break

            case 'ai_message':
              // Handle non-streaming messages (fallback)
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'ai',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id,
                projectId: data.project_id,
                suggestedQuestions: data.suggested_questions,
                suggestions: data.suggested_questions,
                isStreaming: false
              }])
              setAgentMode(data.agent_mode || 'conversation')
              setIsTyping(false)
              break

            case 'ai_message_start':
              // Start of streaming message
              setIsTyping(true)
              currentMessageRef.current = ''
              currentMessageIdRef.current = Date.now().toString()
              break

            case 'ai_message_end':
              // End of streaming message
              setIsTyping(false)
              if (currentMessageIdRef.current) {
                setMessages(prev => prev.map(msg => 
                  msg.id === currentMessageIdRef.current
                    ? { 
                        ...msg, 
                        content: currentMessageRef.current,
                        isStreaming: false,
                        suggestedQuestions: data.suggested_questions,
                        suggestions: data.suggested_questions
                      }
                    : msg
                ))
                currentMessageIdRef.current = null
                currentMessageRef.current = ''
              }
              setAgentMode(data.agent_mode || 'conversation')
              
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current)
                typingTimeoutRef.current = null
              }
              break

            case 'title_generated':
              console.log('📝 Title generated:', data.title)
              break

            case 'proposal_generation_started':
              console.log('🚀 Proposal generation started')
              setIsGeneratingProposal(true)
              setProgress(0)
              setAgentMode('proposal_generation')
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'ai',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id,
                projectId: data.project_id,
                isStreaming: false
              }])
              break

            case 'generation_progress':
              console.log('📊 Generation progress:', data.stage, data.progress)
              setCurrentStage(data.stage)
              setProgress(data.progress)
              break

            case 'workflow_completed':
              console.log('🎉 Workflow completed - fetching generated document')
              setIsGeneratingProposal(false)
              setCurrentStage(null)
              setProgress(100)
              setAgentMode('editor_mode')
              
              // Fetch the generated document from the API
              if (data.session_id) {
                fetchGeneratedDocument(data.session_id)
              }

              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'proposal',
                content: data.message || '🎉 Proposal generation completed successfully! You can now ask me to edit specific sections or make improvements',
                timestamp: new Date(),
                sessionId: data.session_id,
                projectId: data.project_id
              }])
              break

            case 'proposal_completed':
              console.log('🎉 Proposal completed')
              setIsGeneratingProposal(false)
              setCurrentStage(null)
              setProgress(100)
              setAgentMode('editor_mode')
              
              if (data.document) {
                setCurrentDocument({
                  id: data.document_id,
                  title: data.proposal_title,
                  content: data.document,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  author: 'AI Assistant'
                })
              }

              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'proposal',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id,
                projectId: data.project_id,
                documentId: data.document_id,
                proposalTitle: data.proposal_title
              }])
              break

            case 'edit_suggestion':
              console.log('✏️ Edit suggestion received - showing in document overlay only')
              // Don't add to chat messages, will be handled by document overlay
              // Just store the latest edit suggestion for the document viewer
              setLatestEditSuggestion({
                id: Date.now().toString(),
                type: 'edit_suggestion',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id,
                projectId: data.project_id,
                editData: data.edit_data,
                showAcceptReject: data.show_accept_reject
              })
              break

            case 'edit_applied':
              console.log('✅ Edit applied successfully')
              // Fetch the updated document since it's not included in the message
              if (data.session_id) {
                console.log('📄 Fetching updated document after edit_applied')
                fetchGeneratedDocument(data.session_id)
              }
              
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'ai',
                content: data.message || 'Changes have been applied to your document successfully!',
                timestamp: new Date(),
                sessionId: data.session_id,
                isStreaming: false
              }])
              break

            case 'document_updated':
            case 'proposal_updated':
              console.log('📄 Document/Proposal updated:', data)
              if (data.document) {
                setCurrentDocument({
                  id: data.document_id || data.session_id,
                  title: data.proposal_title || data.title || 'Updated Document',
                  content: data.document,
                  created_at: data.created_at || new Date().toISOString(),
                  updated_at: data.updated_at || new Date().toISOString(),
                  author: data.author || 'AI Assistant'
                })
              } else if (data.session_id) {
                fetchGeneratedDocument(data.session_id)
              }
              
              if (data.message) {
                setMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  type: 'ai',
                  content: data.message,
                  timestamp: new Date(),
                  sessionId: data.session_id,
                  isStreaming: false
                }])
              }
              break

            case 'edit_rejected':
              console.log('❌ Edit rejected')
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'ai',
                content: data.message || 'Edit suggestion has been rejected.',
                timestamp: new Date(),
                sessionId: data.session_id,
                isStreaming: false
              }])
              break

            case 'edit_error':
              console.error('❌ Edit error:', data.error)
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'error',
                content: data.message || 'Failed to apply edit to document.',
                timestamp: new Date(),
                sessionId: data.session_id
              }])
              break

            case 'proposal_error':
              console.error('❌ Proposal error:', data.error)
              setIsGeneratingProposal(false)
              setCurrentStage(null)
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'error',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id
              }])
              break

            default:
              console.log('Unknown message type:', data.type, 'Data:', data)
              // Check if this unknown message contains document updates
              if (data.document || data.proposal_content || data.html_content) {
                console.log('📄 Found document content in unknown message type, updating document')
                setCurrentDocument({
                  id: data.document_id || data.session_id || Date.now().toString(),
                  title: data.proposal_title || data.title || currentDocument?.title || 'Updated Document',
                  content: data.document || data.proposal_content || data.html_content,
                  created_at: data.created_at || currentDocument?.created_at || new Date().toISOString(),
                  updated_at: data.updated_at || new Date().toISOString(),
                  author: data.author || currentDocument?.author || 'AI Assistant'
                })
              }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code)
        setConnectionStatus('disconnected')
        
        const reasons: { [key: number]: string } = {
          1000: 'Normal closure',
          1001: 'Going away',
          1006: 'Abnormal closure',
          4001: 'Unauthorized - check your token'
        }
        
        const reason = reasons[event.code] || `Unknown error (${event.code})`
        console.log('Disconnect reason:', reason)
        
        // Only attempt reconnection for certain error codes and if we have an active session
        if (event.code === 4001) {
          console.log('🔑 Token expired, clearing tokens')
          TokenManager.clearTokens()
          setConnectionStatus('error')
        } else if (event.code !== 1000 && event.code !== 1001 && activeSessionId) {
          // Only reconnect for unexpected disconnections and if session is active
          console.log('🔄 Unexpected disconnection, attempting reconnection')
          handleReconnection()
        } else {
          console.log('🔌 Normal closure or no active session, not reconnecting')
        }
      }

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error)
        setConnectionStatus('error')
      }

      setSocket(ws)
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setConnectionStatus('error')
    }
  }, [activeSessionId, API_BASE_URL])

  const handleReconnection = useCallback(() => {
    // Only reconnect if we have an active session
    if (!activeSessionId) {
      console.log('🔄 No active session, skipping reconnection')
      return
    }

    if (reconnectAttempts.current < maxReconnectAttempts) {
      reconnectAttempts.current++
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000) // Exponential backoff, max 30s
      
      console.log(`🔄 Attempting to reconnect (${reconnectAttempts.current}/${maxReconnectAttempts}) in ${delay}ms`)
      
      setTimeout(() => {
        // Double-check we still have an active session before reconnecting
        if (activeSessionId) {
          connect()
        }
      }, delay)
    } else {
      console.error('❌ Max reconnection attempts reached')
      setConnectionStatus('error')
    }
  }, [connect, activeSessionId])

  const sendMessage = useCallback((type: string, message: string, pdfFiles: any[], documentContext: string | null = null) => {
    if (socket?.readyState === WebSocket.OPEN && activeSessionId) {
      const payload = {
        type: type,
        message,
        session_id: activeSessionId,
        pdf_files: pdfFiles,
        project_id: activeProjectId,
        document_context: documentContext
      }
      
      console.log('📤 Sending message:', payload)
      console.log('📤 Active Project ID:', activeProjectId)
      socket.send(JSON.stringify(payload))
      
      // Add user message to chat - show the original input for display
      const displayMessage = documentContext ? `${documentContext} ${message}` : message
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'user',
        content: displayMessage,
        timestamp: new Date(),
        sessionId: activeSessionId || undefined,
        projectId: activeProjectId || undefined,
        isStreaming: false
      }])
    } else {
      console.error('WebSocket not connected or no active session')
    }
  }, [socket, activeSessionId, activeProjectId])

  const acceptEdit = useCallback((editId: string) => {
    if (socket?.readyState === WebSocket.OPEN && activeSessionId) {
      const payload = {
        type: 'edit_request',
        session_id: activeSessionId,
        edit_id: editId,
        action: 'accept'
      }
      
      console.log('✅ Accepting edit:', payload)
      socket.send(JSON.stringify(payload))
      
      // Clear the edit suggestion from overlay
      setLatestEditSuggestion(null)
    }
  }, [socket, activeSessionId])

  const rejectEdit = useCallback((editId: string) => {
    if (socket?.readyState === WebSocket.OPEN && activeSessionId) {
      const payload = {
        type: 'edit_request',
        session_id: activeSessionId,
        edit_id: editId,
        action: 'reject'
      }
      
      console.log('❌ Rejecting edit:', payload)
      socket.send(JSON.stringify(payload))
      
      // Clear the edit suggestion from overlay
      setLatestEditSuggestion(null)
    }
  }, [socket, activeSessionId])

  const requestEdit = useCallback((selectedText: string, documentContext: string) => {
    if (socket?.readyState === WebSocket.OPEN) {
      const message = `Please edit this section: "${selectedText}"`
  sendMessage('chat_message', message, [], documentContext)
    }
  }, [socket, sendMessage])

  const startSession = useCallback(async (sessionId: string, projectId: string | null = null) => {
    console.log('🔌 Starting session:', sessionId, 'Project:', projectId)
    console.log('🔌 ProjectId type:', typeof projectId, 'Value:', projectId)
    
    // If we already have a connection for this session, don't reconnect
    if (activeSessionId === sessionId && socket?.readyState === WebSocket.OPEN) {
      console.log('Session already active with connection, skipping')
      return
    }

    // Close existing connection if different session
    if (socket && activeSessionId !== sessionId) {
      console.log('🔌 Closing existing connection for new session')
      socket.close(1000)
      // Wait a bit before creating new connection
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    setActiveSessionId(sessionId)
    setActiveProjectId(projectId)
    console.log('🔌 Set activeProjectId to:', projectId)
    
    // Clear state for new session
    setMessages([])
    setCurrentDocument(null)
    setIsGeneratingProposal(false)
    setCurrentStage(null)
    setProgress(0)
    setAgentMode('conversation')
    setCurrentStreamingMessage(null)
    setLatestEditSuggestion(null)
    
    // Load previous messages if this is an existing session (not a temp session)
    if (!sessionId.startsWith('temp-')) {
      try {
        console.log('[WebSocket] Loading previous messages for session:', sessionId)
        const sessionData = await getSessionHistory(sessionId)
        
        // Convert conversation history to ChatMessage format
        if (sessionData.conversation_history && Array.isArray(sessionData.conversation_history)) {
          const previousMessages: ChatMessage[] = sessionData.conversation_history.map((msg: any, index: number) => ({
            id: `history-${index}`,
            type: msg.role === 'user' ? 'user' : 'ai',
            content: msg.message,
            timestamp: new Date(msg.timestamp),
            sessionId: sessionId,
            projectId: projectId
          }))
          
          console.log('[WebSocket] Loaded', previousMessages.length, 'previous messages')
          setMessages(previousMessages)
        }
        
        // Set agent mode based on session state
        if (sessionData.agent_mode) {
          setAgentMode(sessionData.agent_mode)
        }
        
        // Check if proposal was generated and fetch document
        if (sessionData.is_proposal_generated) {
          setAgentMode('editor_mode')
          // Fetch the document for this session
          fetchGeneratedDocument(sessionId)
        }
        
      } catch (error) {
        console.error('[WebSocket] Failed to load session history:', error)
        // Continue anyway, user can still chat
      }
    }
    
    // Connect WebSocket
    connect()
  }, [socket, activeSessionId, connect])

  const endSession = useCallback(() => {
    console.log('🔌 Ending session')
    
    if (socket) {
      socket.close(1000)
      setSocket(null)
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
    
    setActiveSessionId(null)
    setActiveProjectId(null)
    setConnectionStatus('disconnected')
    setMessages([])
    setCurrentDocument(null)
    fetchedDocumentsRef.current.clear()
    setIsGeneratingProposal(false)
    setCurrentStage(null)
    setProgress(0)
    setAgentMode('conversation')
    setIsTyping(false)
    currentMessageRef.current = ''
    currentMessageIdRef.current = null
    messageCounter.current = 0

    setCurrentStreamingMessage(null)
    setLatestEditSuggestion(null)
  }, [socket])

  const clearMessages = useCallback(() => {
    setMessages([])
    messageCounter.current = 0
    currentMessageIdRef.current = null
  }, [])

  // Auto-send pending message when session is active and connected
  useEffect(() => {
    if (activeSessionId && pendingMessage && connectionStatus === 'connected' && socket?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Auto-sending pending message:', pendingMessage)
  sendMessage('chat_message', pendingMessage, [], null)
      setPendingMessage(null) // Clear after sending
    }
  }, [activeSessionId, pendingMessage, connectionStatus, socket, sendMessage])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        console.log('🔌 Context cleanup: Closing WebSocket connection')
        socket.close(1000)
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [socket])

  const value: WebSocketContextType = {
    connectionStatus,
    messages,
    currentStage,
    progress,
    isGeneratingProposal,
    currentDocument,
    agentMode,
    activeSessionId,
    latestEditSuggestion,
    isTyping,
    pendingMessage,
  sendMessage,
    setPendingMessage,
    acceptEdit,
    rejectEdit,
    requestEdit,
    startSession,
    endSession,
    clearMessages
  }

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>
}

export function useWebSocket() {
  const context = useContext(WebSocketContext)
  if (context === undefined) {
    throw new Error("useWebSocket must be used within a WebSocketProvider")
  }
  return context
}
