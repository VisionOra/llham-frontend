"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { FileUploadButton } from "@/components/file-upload"
import { Send, User, Bot, FileText, Loader2, Sparkles, Shuffle, Check, X } from "lucide-react"
import { useWebSocket } from "@/contexts/websocket-context"

interface Message {
  id: string
  type: "user" | "ai" | "system" | "file"
  content: string
  timestamp: Date
  suggestions?: string[]
  fileName?: string
  fileSize?: number
}

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  status: "uploading" | "processing" | "completed" | "error"
  progress: number
  content?: string
  error?: string
}

interface FormattedMessage {
  isPastedContent: boolean
  pastedText?: string
  userRequest?: string
  preview?: string
  originalMessage?: string
}

interface ChatInterfaceProps {
  sessionId: string | null
  projectId: string | null
  onNewChat: (message: string) => void
  isDocumentMode: boolean
  isWelcomeMode?: boolean
  onDocumentGenerated?: (document: any) => void
}

export function ChatInterface({
  sessionId,
  projectId,
  onNewChat,
  isDocumentMode,
  isWelcomeMode = false,
  onDocumentGenerated,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Use centralized WebSocket context
  const {
    connectionStatus,
    messages,
    currentStage,
    progress,
    isGeneratingProposal,
    currentDocument,
    agentMode,
    activeSessionId,
    isTyping,
    sendMessage,
    acceptEdit,
    rejectEdit,
    requestEdit,
    startSession,
    endSession
  } = useWebSocket()

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Handle document generation callback
  useEffect(() => {
    if (currentDocument && onDocumentGenerated) {
      onDocumentGenerated(currentDocument);
    }
  }, [currentDocument, onDocumentGenerated])

  // Start session when sessionId is provided
  useEffect(() => {
    if (sessionId && sessionId !== activeSessionId) {
      console.log('[ChatInterface] Starting session:', sessionId)
      startSession(sessionId, projectId)
    } else if (!sessionId && activeSessionId) {
      console.log('[ChatInterface] Ending session')
      endSession()
    }
  }, [sessionId, projectId, activeSessionId, startSession, endSession])

  // Remove auto-send functionality - users will manually paste and request edits

  // Detect if message contains pasted document content
  const detectPastedContent = (message: string) => {
    // Look for specific document patterns that indicate pasted content
    const hasDocumentPatterns = /Essential Features|Advanced Features|Core Features|Project Planning|Technical Specification|Must-Have|Nice-to-Have|Business Analysis|Resource Allocation|Architecture Considerations|Integration Requirements|Security and Compliance|Unique Differentiators|Technology Stack|Frontend|Backend|Database|Infrastructure|Microservices|Scalability|Performance|Authentication|User Management|Responsive Design|Export and Deployment|Target Audience|Small to Medium|Startups|Enterprise|Non-Technical|Developers/i.test(message)
    const hasColons = message.includes(':')
    const hasEditKeywords = /\b(make it|modify|change|edit|improve|update|rewrite|concise|enhance|fix|adjust|refine|optimize)\b/i.test(message)
    const hasLongContent = message.length > 50 // Lower threshold for detection
    
    console.log('[ChatInterface] Detection analysis:', {
      message: message.substring(0, 100),
      hasDocumentPatterns,
      hasColons,
      hasEditKeywords,
      hasLongContent,
      result: hasDocumentPatterns && (hasColons || hasEditKeywords)
    })
    
    // Detect as pasted if it has document patterns AND colons (typical of document sections)
    // OR if it has document patterns AND edit keywords (user pasted + added request)
    return hasDocumentPatterns && (hasColons || hasEditKeywords)
  }

  const formatMessageForDisplay = (message: string): FormattedMessage => {
    console.log('[ChatInterface] Analyzing message:', message)
    console.log('[ChatInterface] Is pasted content:', detectPastedContent(message))
    
    if (detectPastedContent(message)) {
      // Try to separate pasted content from user request
      const editKeywords = /\b(make it|modify|change|edit|improve|update|rewrite|concise|enhance|fix|adjust|refine|optimize)\b/i
      const match = message.match(editKeywords)
      
      if (match) {
        // Split at the edit keyword
        const splitIndex = message.toLowerCase().indexOf(match[0].toLowerCase())
        const pastedContent = message.substring(0, splitIndex).trim()
        const userRequest = message.substring(splitIndex).trim()
        
        console.log('[ChatInterface] Split detected:', {
          pastedContent,
          userRequest,
          splitAt: match[0]
        })
        
        return {
          isPastedContent: true,
          pastedText: pastedContent,
          userRequest: userRequest,
          preview: pastedContent.length > 60 ? pastedContent.substring(0, 60) + '...' : pastedContent
        }
      } else {
        // No clear user request, treat whole message as pasted content
        console.log('[ChatInterface] No edit keyword found, treating as pasted content')
        return {
          isPastedContent: true,
          pastedText: message,
          userRequest: 'Please edit this section',
          preview: message.length > 60 ? message.substring(0, 60) + '...' : message
        }
      }
    }
    
    // For simple messages like "enhance it", treat as regular message
    console.log('[ChatInterface] Treating as regular message')
    return {
      isPastedContent: false,
      originalMessage: message
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    // Handle welcome mode differently
    if (isWelcomeMode) {
      onNewChat(inputValue)
      setInputValue("")
      return
    }

    // Parse the input to separate document context from user message
    const inputText = inputValue.trim()
    const formatted = formatMessageForDisplay(inputText)
    
    setInputValue("")
    
    if (formatted.isPastedContent && formatted.userRequest && formatted.pastedText) {
      // Send with document_context and clean message
      console.log('[ChatInterface] Sending edit request:', {
        message: formatted.userRequest,
        document_context: formatted.pastedText
      })
      sendMessage(formatted.userRequest, formatted.pastedText)
    } else {
      // Send regular message
      sendMessage(inputText)
    }
  }

  const handleFileUploaded = (file: UploadedFile) => {
    // TODO: Implement file upload via WebSocket
    console.log('File uploaded:', file.name);
    
    // Send a message about the file upload
    const uploadMessage = `I've uploaded "${file.name}" (${formatFileSize(file.size)}). Please analyze this document and help me with it.`;
    sendMessage(uploadMessage);
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }


  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isWelcomeMode) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4">
        <div className="relative">
          <div className="relative group">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask v0 to build..."
              className="w-full min-h-[64px] bg-gradient-to-br from-[#1a1a1a] via-[#1e1e1e] to-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] focus:border-[#4a4a4a] text-white placeholder-gray-400 focus:ring-0 text-base sm:text-lg px-6 py-5 pr-24 sm:pr-28 rounded-2xl resize-none transition-all duration-200 shadow-lg hover:shadow-xl backdrop-blur-sm"
              rows={1}
              style={{
                background: "linear-gradient(135deg, #1a1a1a 0%, #1e1e1e 50%, #1a1a1a 100%)",
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
              }}
            />

            {/* <div className="absolute left-4 sm:left-6 top-4 sm:top-5 flex items-center space-x-2">
              <div className="hidden sm:flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  <span className="hidden md:inline">AI</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Shuffle className="w-3 h-3 mr-1" />
                  <span className="hidden md:inline">Random</span>
                </Button>
              </div>
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs px-3 py-1.5 rounded-full flex items-center space-x-1.5 shadow-lg">
                <span>🌙</span>
                <span className="font-medium">Cosmic Night</span>
              </div>
            </div> */}

            <div className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2">
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || connectionStatus !== 'connected' || isGeneratingProposal}
                size="sm"
                className="bg-gradient-to-r from-white to-gray-100 text-black hover:from-gray-100 hover:to-gray-200 rounded-xl px-4 py-2 shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {(connectionStatus !== 'connected' || isGeneratingProposal) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>

            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300 pointer-events-none blur-xl -z-10" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-green-400" />
            <h2 className="text-lg font-semibold text-white">{isDocumentMode ? "Document Assistant" : "Ilham AI"}</h2>
          </div>
          <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? "bg-green-400" : "bg-red-400"}`} />
                <span className="text-xs text-gray-400">{connectionStatus === 'connected' ? "Connected" : "Connecting..."}</span>
          </div>
        </div>

        {sessionId && (
          <Badge variant="outline" className="border-green-700 text-green-300">
            Session Active
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              <div
                className={`flex items-start space-x-3 ${
                  message.type === "user" ? "flex-row-reverse space-x-reverse" : ""
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === "user"
                      ? "bg-green-700"
                      : message.type === "ai"
                        ? "bg-gray-700"
                        : "bg-blue-700"
                  }`}
                >
                  {message.type === "user" ? (
                    <User className="w-4 h-4 text-white" />
                  ) : message.type === "ai" ? (
                    <Bot className="w-4 h-4 text-white" />
                  ) : (
                    <FileText className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Message Content */}
                <div className={`flex-1 max-w-[80%] ${message.type === "user" ? "text-right" : "text-left"}`}>
                  <div
                    className={`inline-block p-3 rounded-lg ${
                      message.type === "user"
                        ? "bg-green-700 text-white"
                        : message.type === "ai"
                          ? "bg-[#1a1a1a] text-white border border-[#2a2a2a]"
                          : message.type === "proposal"
                            ? "bg-blue-900/30 text-blue-300 border border-blue-700"
                            : message.type === "edit_suggestion"
                              ? "bg-purple-900/30 text-purple-300 border border-purple-700"
                              : message.type === "error"
                                ? "bg-red-900/30 text-red-300 border border-red-700"
                                : "bg-blue-900/30 text-blue-300 border border-blue-700"
                    }`}
                  >
                    {/* Cursor AI style display for user messages with pasted content */}
                    {message.type === "user" && (() => {
                      const formatted = formatMessageForDisplay(message.content)
                      if (formatted.isPastedContent && formatted.userRequest && formatted.pastedText && formatted.preview) {
                        return (
                          <div className="space-y-2">
                            {/* User's request */}
                            <p className="text-sm font-medium">{formatted.userRequest}</p>
                            
                            {/* Pasted content preview - Cursor style */}
                            <div className="bg-black/20 border border-white/20 rounded p-2 mt-2">
                              <div className="flex items-center space-x-2 mb-1">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                <span className="text-xs font-medium text-blue-200">SELECTED TEXT</span>
                              </div>
                              <p className="text-xs text-gray-300 font-mono">
                                {formatted.preview}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatted.pastedText.length} characters
                              </p>
                            </div>
                          </div>
                        )
                      } else {
                        return <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      }
                    })()}
                    
                    {/* Regular content for non-user messages */}
                    {message.type !== "user" && (
                      <div className="relative">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        {/* Streaming cursor indicator - only for AI messages */}
                        {/* {message.type === "ai" && message.isStreaming === true && (
                          <span className="inline-block w-2 h-5 bg-blue-400 ml-1 animate-pulse"></span>
                        )} */}
                      </div>
                    )}
                    
                    {/* Edit suggestion with original/proposed content - Cursor AI style */}
                    {message.type === "edit_suggestion" && message.editData && (
                      <div className="mt-4 border border-blue-500/30 rounded-lg overflow-hidden">
                        {/* Header */}
                        <div className="bg-blue-900/20 px-4 py-2 border-b border-blue-500/30">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-300">✨ AI Edit Suggestion</span>
                            <span className="text-xs text-gray-400">
                              Confidence: {Math.round((message.editData.confidence || 0.9) * 100)}%
                            </span>
                          </div>
                        </div>
                        
                        {/* Content comparison */}
                        <div className="p-4 space-y-4">
                          {/* Original content */}
                          <div className="bg-red-900/20 border border-red-500/30 rounded-md p-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                              <span className="text-xs font-medium text-red-300">ORIGINAL</span>
                            </div>
                            <div className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-black/20 p-2 rounded">
                              {message.editData.original}
                            </div>
                          </div>
                          
                          {/* Proposed content */}
                          <div className="bg-green-900/20 border border-green-500/30 rounded-md p-3">
                            <div className="flex items-center space-x-2 mb-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                              <span className="text-xs font-medium text-green-300">PROPOSED</span>
                            </div>
                            <div className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-black/20 p-2 rounded">
                              {message.editData.proposed}
                            </div>
                          </div>
                          
                          {/* Reason */}
                          {message.editData.reason && (
                            <div className="bg-blue-900/20 border border-blue-500/30 rounded-md p-3">
                              <div className="flex items-center space-x-2 mb-2">
                                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                <span className="text-xs font-medium text-blue-300">REASONING</span>
                              </div>
                              <p className="text-sm text-blue-200">{message.editData.reason}</p>
                            </div>
                          )}
                          
                          {/* Accept/Reject buttons - Cursor AI style */}
                          {message.showAcceptReject && (
                            <div className="flex space-x-3 pt-2">
                              <Button
                                size="sm"
                                onClick={() => acceptEdit(message.editData!.edit_id)}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium"
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Accept Change
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => rejectEdit(message.editData!.edit_id)}
                                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-900/20 font-medium"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Reject Change
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatTime(message.timestamp)}</p>
                </div>
              </div>

              {/* Suggestions */}
              {message.suggestions && (
                <div className="ml-11 space-y-2">
                  <p className="text-xs text-gray-400">Suggested questions:</p>
                  <div className="flex flex-wrap gap-2">
                    {message.suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="text-xs px-3 py-1 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-300 rounded-full border border-[#2a2a2a] transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Proposal generation progress */}
          {isGeneratingProposal && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="inline-block p-4 rounded-lg bg-[#1a1a1a] border border-blue-600 min-w-[300px]">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span className="text-sm text-white font-medium">Generating Proposal</span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">
                        {currentStage ? currentStage.replace('_', ' ').toUpperCase() : 'INITIALIZING'}
                      </span>
                      <span className="text-blue-400">{progress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Typing Indicator */}
          {isTyping && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="inline-block p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a]">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-gray-400">AI is typing...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Connection status indicator */}
          {connectionStatus !== 'connected' && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-600 flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              </div>
              <div className="flex-1">
                <div className="inline-block p-3 rounded-lg bg-yellow-900/30 border border-yellow-700">
                  <span className="text-sm text-yellow-300">
                    {connectionStatus === 'connecting' ? 'Connecting...' : 
                     connectionStatus === 'error' ? 'Connection error. Retrying...' : 
                     'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-[#2a2a2a]">
        <div className="flex items-center space-x-2 justify-center">
          <FileUploadButton onFileUploaded={handleFileUploaded} />

          <div className="flex-1">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isDocumentMode ? "Paste selected text and add your request (e.g., 'make it more concise', 'modify this section')..." : "Tell me about your project idea..."
              }
              className="min-h-[44px] max-h-32 resize-none bg-[#1a1a1a] border-[#2a2a2a] text-white placeholder-gray-400  "
              rows={1}
            />
          </div>

          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || connectionStatus !== 'connected' || isGeneratingProposal}
            className="bg-green-700 hover:bg-green-600 text-white disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500">
            {isDocumentMode
              ? "Select text in document → Copy → Paste here with your request • Upload files for reference"
              : "Press Enter to send, Shift+Enter for new line • Upload PDF/Word files"}
          </p>
          
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
              'bg-red-500'
            }`} />
            <span className="text-xs text-gray-500 capitalize">{connectionStatus}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
