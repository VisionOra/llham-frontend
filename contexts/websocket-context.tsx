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
  sendMessage: (message: string, documentContext?: string | null) => void
  acceptEdit: (editId: string) => void
  rejectEdit: (editId: string) => void
  requestEdit: (selectedText: string, documentContext: string) => void
  startSession: (sessionId: string, projectId?: string | null) => void
  endSession: () => void
  clearMessages: () => void
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export function WebSocketProvider({ children }: { children: ReactNode }) {
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
  const [currentStreamingMessage, setCurrentStreamingMessage] = useState<ChatMessage | null>(null)
  
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 3 // Reduced from 5 to 3
  const connectionTimeout = useRef<NodeJS.Timeout | null>(null)
  const lastConnectionAttempt = useRef<number>(0)

  // Function to fetch generated document after workflow completion
  const fetchGeneratedDocument = useCallback(async (sessionId: string) => {
    try {
      console.log('📄 Fetching generated document for session:', sessionId)
      const response = await fetch(`http://192.168.1.105:8000/documents/${sessionId}/`, {
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
      }
    } catch (error) {
      console.error('📄 Error fetching generated document:', error)
    }
  }, [])

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
    // const wsUrl = `wss://api.llham.com/ws/chat/?token=${token}`
    const wsUrl = `ws://192.168.1.105:8000/ws/chat/?token=${token}`
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
              
              const streamingId = `streaming-${data.session_id}`
              
              // Always use current_text (full text so far) for consistent display
              const currentContent = data.current_text || ''
              
              setMessages(prev => {
                // Check if streaming message already exists
                const existingIndex = prev.findIndex(msg => msg.id === streamingId)
                
                if (existingIndex >= 0) {
                  // Update existing streaming message
                  const updatedMessages = [...prev]
                  updatedMessages[existingIndex] = {
                    ...updatedMessages[existingIndex],
                    content: currentContent
                  }
                  return updatedMessages
                } else {
                  // Create new streaming message
                  const newStreamingMessage: ChatMessage = {
                    id: streamingId,
                    type: 'ai',
                    content: currentContent,
                    timestamp: new Date(),
                    sessionId: data.session_id,
                    projectId: activeProjectId || undefined
                  }
                  
                  setCurrentStreamingMessage(newStreamingMessage)
                  return [...prev, newStreamingMessage]
                }
              })
              break

            case 'ai_message_complete':
              console.log('✅ AI message complete')
              
              const completionStreamingId = `streaming-${data.session_id}`
              
              // Finalize the streaming message
              setMessages(prev => {
                const existingIndex = prev.findIndex(msg => msg.id === completionStreamingId)
                
                if (existingIndex >= 0) {
                  // Update the existing streaming message to final version
                  const updatedMessages = [...prev]
                  updatedMessages[existingIndex] = {
                    ...updatedMessages[existingIndex],
                    content: data.message,
                    suggestions: data.suggested_questions,
                    suggestedQuestions: data.suggested_questions
                  }
                  return updatedMessages
                } else {
                  // Fallback if no streaming message was found
                  return [...prev, {
                    id: Date.now().toString(),
                    type: 'ai',
                    content: data.message,
                    timestamp: new Date(),
                    sessionId: data.session_id,
                    projectId: data.project_id,
                    suggestedQuestions: data.suggested_questions,
                    suggestions: data.suggested_questions
                  }]
                }
              })
              
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
                suggestions: data.suggested_questions
              }])
              setAgentMode(data.agent_mode || 'conversation')
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
                projectId: data.project_id
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
              // Document should already be updated locally
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'ai',
                content: data.message || 'Changes have been applied to your document successfully!',
                timestamp: new Date(),
                sessionId: data.session_id
              }])
              break

            case 'edit_rejected':
              console.log('❌ Edit rejected')
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'ai',
                content: data.message || 'Edit suggestion has been rejected.',
                timestamp: new Date(),
                sessionId: data.session_id
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
              console.log('Unknown message type:', data.type)
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
  }, [])

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

  const sendMessage = useCallback((message: string, documentContext: string | null = null) => {
    if (socket?.readyState === WebSocket.OPEN && activeSessionId) {
      const payload = {
        type: 'chat_message',
        message,
        session_id: activeSessionId,
        project_id: activeProjectId,
        document_context: documentContext
      }
      
      console.log('📤 Sending message:', payload)
      socket.send(JSON.stringify(payload))
      
      // Add user message to chat - show the original input for display
      const displayMessage = documentContext ? `${documentContext} ${message}` : message
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'user',
        content: displayMessage,
        timestamp: new Date(),
        sessionId: activeSessionId || undefined,
        projectId: activeProjectId || undefined
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
      
      // Apply the edit to the current document
      if (latestEditSuggestion?.editData && currentDocument) {
        const { original, proposed } = latestEditSuggestion.editData
        
        console.log('📝 Applying edit:', {
          originalLength: original.length,
          proposedLength: proposed.length,
          originalPreview: original.substring(0, 200) + '...',
          proposedPreview: proposed.substring(0, 200) + '...',
          documentContentPreview: currentDocument.content.substring(0, 500) + '...'
        })
        
        // Try to find and replace the original content
        let updatedContent = currentDocument.content
        let replacementSuccessful = false
        
        try {
          // First try exact match
          if (updatedContent.includes(original)) {
            updatedContent = updatedContent.replace(original, proposed)
            replacementSuccessful = true
            console.log('📝 Exact match replacement successful')
          } else {
            // The document might have been processed with selectable-text spans
            // Try removing those spans and then matching
            const cleanDocumentContent = updatedContent.replace(/<span class="selectable-text">(.*?)<\/span>/g, '$1')
            
            if (cleanDocumentContent.includes(original)) {
              // Replace in the clean content, then add spans back
              const replacedContent = cleanDocumentContent.replace(original, proposed)
              // Re-process with selectable spans
              updatedContent = replacedContent
                .replace(/(<h[1-6][^>]*>)(.*?)(<\/h[1-6]>)/g, '$1<span class="selectable-text">$2</span>$3')
                .replace(/(<p[^>]*>)(.*?)(<\/p>)/g, '$1<span class="selectable-text">$2</span>$3')
                .replace(/(<li[^>]*>)(.*?)(<\/li>)/g, '$1<span class="selectable-text">$2</span>$3')
                .replace(/(<td[^>]*>)(.*?)(<\/td>)/g, '$1<span class="selectable-text">$2</span>$3')
                .replace(/(<th[^>]*>)(.*?)(<\/th>)/g, '$1<span class="selectable-text">$2</span>$3')
              
              replacementSuccessful = true
              console.log('📝 Replacement successful after cleaning selectable spans')
            } else {
              // Try to find similar content by converting both to plain text
              const originalText = original.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
              
              // Try to find the text content in the HTML
              const regex = new RegExp(originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
              const matches = cleanDocumentContent.match(regex)
              
              if (matches && matches.length > 0) {
                // Replace the first match
                updatedContent = cleanDocumentContent.replace(matches[0], proposed)
                // Re-process with selectable spans
                updatedContent = updatedContent
                  .replace(/(<h[1-6][^>]*>)(.*?)(<\/h[1-6]>)/g, '$1<span class="selectable-text">$2</span>$3')
                  .replace(/(<p[^>]*>)(.*?)(<\/p>)/g, '$1<span class="selectable-text">$2</span>$3')
                  .replace(/(<li[^>]*>)(.*?)(<\/li>)/g, '$1<span class="selectable-text">$2</span>$3')
                  .replace(/(<td[^>]*>)(.*?)(<\/td>)/g, '$1<span class="selectable-text">$2</span>$3')
                  .replace(/(<th[^>]*>)(.*?)(<\/th>)/g, '$1<span class="selectable-text">$2</span>$3')
                
                replacementSuccessful = true
                console.log('📝 Text-based replacement successful')
              } else {
                console.warn('📝 Could not find original content in document for replacement')
                console.warn('📝 Original text:', originalText)
                console.warn('📝 Clean document preview:', cleanDocumentContent.substring(0, 300))
              }
            }
          }
          
          if (replacementSuccessful) {
            setCurrentDocument({
              ...currentDocument,
              content: updatedContent,
              updated_at: new Date().toISOString()
            })
            
            console.log('📝 Document updated with accepted edit')
          }
        } catch (error) {
          console.error('📝 Error applying edit to document:', error)
        }
      }
      
      // Clear the edit suggestion from overlay
      setLatestEditSuggestion(null)
    }
  }, [socket, activeSessionId, latestEditSuggestion, currentDocument])

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
      sendMessage(message, documentContext)
    }
  }, [socket, sendMessage])

  const startSession = useCallback(async (sessionId: string, projectId: string | null = null) => {
    console.log('🔌 Starting session:', sessionId, 'Project:', projectId)
    
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
        
        // Check if proposal was generated
        if (sessionData.is_proposal_generated) {
          setAgentMode('editor_mode')
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
    
    setActiveSessionId(null)
    setActiveProjectId(null)
    setConnectionStatus('disconnected')
    setMessages([])
    setCurrentDocument(null)
    setIsGeneratingProposal(false)
    setCurrentStage(null)
    setProgress(0)
    setAgentMode('conversation')
    setCurrentStreamingMessage(null)
    setLatestEditSuggestion(null)
  }, [socket])

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socket) {
        console.log('🔌 Context cleanup: Closing WebSocket connection')
        socket.close(1000)
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
    sendMessage,
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