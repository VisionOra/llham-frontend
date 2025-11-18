"use client"

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react"
import { TokenManager } from "@/lib/api"
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
  activeProjectId: string | null
  initialIdea: string | null
  latestEditSuggestion: ChatMessage | null
  isTyping: boolean
  pendingMessage: string | null
  sendMessage: (type: string, message: string, pdfFiles: any[], documentContext?: string | null) => void
  sendRawMessage: (message: any) => boolean
  setPendingMessage: (message: string | null) => void
  addMessage: (message: ChatMessage) => void
  acceptEdit: (editId: string) => void
  rejectEdit: (editId: string) => void
  requestEdit: (selectedText: string, documentContext: string) => void
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
  const [initialIdea, setInitialIdea] = useState<string | null>(null)
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
  const loadingSessionRef = useRef<Set<string>>(new Set())
 

  const fetchGeneratedDocument = useCallback(async (sessionId: string) => {
    if (fetchedDocumentsRef.current.has(sessionId)) {
      return
    }

    try {
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
        
        setCurrentDocument({
          id: documentData.id || sessionId,
          title: documentData.title || 'Generated Proposal',
          content: documentData.document || documentData.content,
          created_at: documentData.created_at || new Date().toISOString(),
          updated_at: documentData.updated_at || new Date().toISOString(),
          author: documentData.created_by || 'Artilence'
        })
      } else {
        fetchedDocumentsRef.current.delete(sessionId)
      }
    } catch (error) {
      fetchedDocumentsRef.current.delete(sessionId)
    }
  }, [API_BASE_URL])

  const connect = useCallback(() => {
    const token = TokenManager.getAccessToken()
    if (!token) {
      return
    }

    if (socket?.readyState === WebSocket.OPEN) {
      return
    }

    if (socket?.readyState === WebSocket.CONNECTING) {
      return
    }

    const now = Date.now()
    if (now - lastConnectionAttempt.current < 2000) {
      return
    }
    lastConnectionAttempt.current = now

    if (connectionTimeout.current) {
      clearTimeout(connectionTimeout.current)
      connectionTimeout.current = null
    }

    setConnectionStatus('connecting')
    const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_BASE_URL || API_BASE_URL.replace(/^http/, "ws");
    const wsUrl = `${WS_BASE_URL}/ws/chat/?token=${token}`

    try {
      const ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        setConnectionStatus('connected')
        reconnectAttempts.current = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // Handle action-based messages (like "conversation")
          if (data.action === 'conversation' && data.message) {
            // console.log("WebSocket: Received conversation action message", data)
            setMessages(prev => {
              // Check if this message already exists to prevent duplicates
              // Remove timestamp check as conversation history may have different timestamps
              const isDuplicate = prev.some(msg => 
                msg.type === 'ai' && 
                msg.content === data.message && 
                msg.sessionId === data.session_id
              )
              
              if (isDuplicate) {
                // console.log("WebSocket: Duplicate message detected, skipping")
                return prev // Don't add duplicate
              }
              
              // console.log("WebSocket: Adding conversation message to chat", data.message)
              return [...prev, {
                id: `conversation-${Date.now()}`,
                type: 'ai',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id,
                projectId: data.project_id,
                isStreaming: false
              }]
            })
            setAgentMode(data.agent_mode || 'conversation')
            setIsTyping(false)
            return // Exit early after handling action-based message
          }
          
          switch(data.type) {
            case 'connection_established':
              break

            case 'ai_message_chunk':
                            if (!currentMessageIdRef.current) {
                messageCounter.current += 1
                currentMessageIdRef.current = `streaming-${data.session_id}-${messageCounter.current}`
              }
              
              const streamingId = currentMessageIdRef.current
              
              const currentContent = data.current_text || ''
              
              setMessages(prev => {
                const existingIndex = prev.findIndex(msg => msg.id === streamingId)
                
                if (existingIndex >= 0) {
                  const updated = [...prev]
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    content: currentContent,
                    isStreaming: true
                  }
                  return updated
                } else {
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
              
              const completionStreamingId = currentMessageIdRef.current
              
              if (completionStreamingId) {
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
                
                currentMessageIdRef.current = null
              }
              
              setCurrentStreamingMessage(null)
              setAgentMode(data.agent_mode || 'conversation')
              setIsTyping(false)
              break

            case 'ai_message':
              setMessages(prev => {
                // Check if this AI message already exists to prevent duplicates
                const isDuplicate = prev.some(msg => 
                  msg.type === 'ai' && 
                  msg.content === data.message && 
                  msg.sessionId === data.session_id &&
                  // Check if message was added within last 5 seconds
                  Math.abs(new Date(msg.timestamp).getTime() - Date.now()) < 5000
                )
                
                if (isDuplicate) {
                  return prev // Don't add duplicate
                }
                
                return [...prev, {
                  id: Date.now().toString(),
                  type: 'ai',
                  content: data.message,
                  timestamp: new Date(),
                  sessionId: data.session_id,
                  projectId: data.project_id,
                  suggestedQuestions: data.suggested_questions,
                  suggestions: data.suggested_questions,
                  isStreaming: false
                }]
              })
              setAgentMode(data.agent_mode || 'conversation')
              setIsTyping(false)
              break

            case 'ai_message_start':
              setIsTyping(true)
              currentMessageRef.current = ''
              currentMessageIdRef.current = Date.now().toString()
              break

            case 'ai_message_end':
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
              break

            case 'agent_started':
              setCurrentStage(data.stage)
              setProgress(0)
              break

            case 'agent_progress':
              setCurrentStage(data.stage)
              setProgress(data.progress)
              break

            case 'content_streaming':
              setCurrentStage(data.stage)
              setProgress(data.progress)
              break

            case 'proposal_generation_started':
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
              setCurrentStage(data.stage)
              setProgress(data.progress)
              break

            case 'workflow_completed':
              setIsGeneratingProposal(false)
              setCurrentStage(null)
              setProgress(100)
              setAgentMode('editor_mode')
              
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
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'edit_suggestion',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id,
                projectId: data.project_id,
                editData: data.edit_data,
                showAcceptReject: data.show_accept_reject
              }])
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
              setIsTyping(false)
              break

            case 'edit_applied':
              if (data.session_id) {
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
              setIsTyping(false)
              break

            case 'document_updated':
            case 'proposal_updated':
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
                setIsTyping(false)
              }
              break

            case 'edit_rejected':
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'ai',
                content: data.message || 'Edit suggestion has been rejected.',
                timestamp: new Date(),
                sessionId: data.session_id,
                isStreaming: false
              }])
              setIsTyping(false)
              break

            case 'edit_error':
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'error',
                content: data.message || 'Failed to apply edit to document.',
                timestamp: new Date(),
                sessionId: data.session_id
              }])
              setIsTyping(false)
              break

            case 'proposal_error':
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
              if (data.document || data.proposal_content || data.html_content) {
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
        }
      }

      ws.onclose = (event) => {
        setConnectionStatus('disconnected')
        
        const reasons: { [key: number]: string } = {
          1000: 'Normal closure',
          1001: 'Going away',
          1006: 'Abnormal closure',
          4001: 'Unauthorized - check your token'
        }
        
        const reason = reasons[event.code] || `Unknown error (${event.code})`
        
        if (event.code === 4001) {
          TokenManager.clearTokens()
          setConnectionStatus('error')
        } else if (event.code !== 1000 && event.code !== 1001 && activeSessionId) {
          handleReconnection()
        } else {
        }
      }

      ws.onerror = (error) => {
        setConnectionStatus('error')
      }

      setSocket(ws)
    } catch (error) {
      setConnectionStatus('error')
    }
  }, [activeSessionId, API_BASE_URL])

  const handleReconnection = useCallback(() => {
    if (!activeSessionId) {
      return
    }

    if (reconnectAttempts.current < maxReconnectAttempts) {
      reconnectAttempts.current++
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000) // Exponential backoff, max 30s
      
      
      setTimeout(() => {
        if (activeSessionId) {
          connect()
        }
      }, delay)
    } else {
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
      
      socket.send(JSON.stringify(payload))
      
      const displayMessage = documentContext ? `${documentContext} ${message}` : message
      
      setMessages(prev => {
        // Check if this user message already exists to prevent duplicates
        const isDuplicate = prev.some(msg => 
          msg.type === 'user' && 
          msg.content === displayMessage && 
          msg.sessionId === activeSessionId &&
          // Check if message was added within last 5 seconds
          Math.abs(new Date(msg.timestamp).getTime() - Date.now()) < 5000
        )
        
        if (isDuplicate) {
          return prev // Don't add duplicate
        }
        
        return [...prev, {
          id: Date.now().toString(),
          type: 'user',
          content: displayMessage,
          timestamp: new Date(),
          sessionId: activeSessionId || undefined,
          projectId: activeProjectId || undefined,
          isStreaming: false
        }]
      })
    } else {
    }
  }, [socket, activeSessionId, activeProjectId])

  const sendRawMessage = useCallback((message: any): boolean => {
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message))
        return true
      } catch (error) {
        return false
      }
    } else {
      return false
    }
  }, [socket])

  const acceptEdit = useCallback((editId: string) => {
    if (socket?.readyState === WebSocket.OPEN && activeSessionId) {
      const payload = {
        type: 'edit_request',
        session_id: activeSessionId,
        edit_id: editId,
        action: 'accept'
      }
      
      socket.send(JSON.stringify(payload))
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


  const clearMessages = useCallback(() => {
    setMessages([])
    messageCounter.current = 0
    currentMessageIdRef.current = null
  }, [])

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      // First check by ID (most reliable)
      const existsById = prev.some(msg => msg.id === message.id)
      if (existsById) {
        return prev // Don't add duplicate by ID
      }
      
      // Then check by content, type, and sessionId to prevent duplicates
      // For same session, same type, and same content, consider it duplicate
      // Remove timestamp check as conversation history may have different timestamps
      const isDuplicate = prev.some(msg => 
        msg.type === message.type && 
        msg.content === message.content && 
        msg.sessionId === message.sessionId
      )
      
      if (isDuplicate) {
        return prev // Don't add duplicate
      }
      
      return [...prev, message]
    })
    setIsTyping(false)
  }, [])

  // Auto-connect WebSocket when component mounts
  useEffect(() => {
    if (connectionStatus === 'disconnected' && !socket) {
      connect()
    }
  }, [connectionStatus, socket, connect])

  useEffect(() => {
    if (activeSessionId && pendingMessage && connectionStatus === 'connected' && socket?.readyState === WebSocket.OPEN) {
  sendMessage('chat_message', pendingMessage, [], null)
      setPendingMessage(null) // Clear after sending
    }
  }, [activeSessionId, pendingMessage, connectionStatus, socket, sendMessage])

  useEffect(() => {
    return () => {
      if (socket) {
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
    activeProjectId,
    initialIdea,
    latestEditSuggestion,
    isTyping,
    pendingMessage,
    sendMessage,
    sendRawMessage,
    setPendingMessage,
    addMessage,
    acceptEdit,
    rejectEdit,
    requestEdit,
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
