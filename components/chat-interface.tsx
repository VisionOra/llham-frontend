"use client"

import React from "react"
import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { FileUploadButton } from "@/components/file-upload"
import { Send, User, Bot, FileText, Loader2, Sparkles, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { useWebSocket } from "@/contexts/websocket-context"
import { communicateWithMasterAgent } from "@/lib/api"
import AutoGrowTextarea from "./AutoGrowTextarea"

const SUGGESTED_MESSAGES = [
  "generate proposal",
  "create proposal",
  "make proposal",
  "build proposal",
  "start proposal",
  "proposal generation",
  "generate me a proposal",
  "create me a proposal",
  "make me a proposal",
  "build me a proposal",
  "let's generate",
  "let's create",
  "proceed with proposal",
  "go ahead",
  "create a proposal",
  "make a proposal",
  "build a proposal",
  "let's build a proposal",
  "let's generate a proposal",
  "let's create a proposal",
  "let's make a proposal",
  "let's start a proposal",
  "let's proceed with a proposal",
  "let's go ahead with a proposal",
  "give me estimations",
  "estimations"
]

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
  onTextSelect?: (selectedText: string, element: HTMLElement) => void
  selectedDocumentText?: string
  onClearSelectedText?: () => void
  onProposalHtmlReceived?: (proposalHtml: string, proposalTitle?: string) => void
}

export const ChatInterface = React.memo(function ChatInterface({
  sessionId,
  projectId,
  onNewChat,
  isDocumentMode,
  isWelcomeMode = false,
  onDocumentGenerated,
  onTextSelect,
  selectedDocumentText: externalSelectedText,
  onClearSelectedText,
  onProposalHtmlReceived,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [selectedDocumentText, setSelectedDocumentText] = useState<string>("")
  const [isUserTyping, setIsUserTyping] = useState(false)
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set())
  // const [randomSuggestedMessages, setRandomSuggestedMessages] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Use external selected text if provided, otherwise use internal state
  const currentSelectedText = externalSelectedText || selectedDocumentText
  
  // Function to clear selected text
  const clearSelectedText = () => {
    if (onClearSelectedText) {
      onClearSelectedText()
    } else {
      setSelectedDocumentText("")
    }
  }

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
    activeProjectId,
    initialIdea,
    isTyping,
    sendMessage,
    addMessage,
    acceptEdit,
    rejectEdit,
    requestEdit,
    startSession,
    endSession
  } = useWebSocket()

  // Memoize expensive computations
  const isStreaming = useMemo(() => 
    messages.some(msg => 
      msg.type === 'ai' && 
      msg.id.startsWith('streaming-') && 
      !msg.suggestions // Complete messages have suggestions
    ), [messages])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (isTyping === false && isUserTyping) {
      setIsUserTyping(false)
    }
  }, [isTyping])

  useEffect(() => {
    if (isUserTyping && isDocumentMode && currentDocument) {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
      }
      
      typingTimerRef.current = setTimeout(() => {
        setIsUserTyping(false)
      }, 4000)
    }

    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current)
      }
    }
  }, [isUserTyping, isDocumentMode, currentDocument])

  // Randomly shuffle all suggested messages on mount
  // useEffect(() => {
  //   const shuffleMessages = () => {
  //     const shuffled = [...SUGGESTED_MESSAGES].sort(() => Math.random() - 0.5)
  //     return shuffled
  //   }
  //   setRandomSuggestedMessages(shuffleMessages())
  // }, [])

  // Handle document generation callback
  useEffect(() => {
    if (currentDocument && onDocumentGenerated) {
      onDocumentGenerated(currentDocument);
    }
  }, [currentDocument, onDocumentGenerated])


  const handleTextSelect = useCallback((selectedText: string, element: HTMLElement) => {
    setSelectedDocumentText(selectedText)
    // Call parent's onTextSelect if provided
    if (onTextSelect) {
      onTextSelect(selectedText, element)
    }
  }, [onTextSelect])

  const detectPastedContent = useCallback((message: string) => {
    const hasDocumentPatterns = /Essential Features|Advanced Features|Core Features|Project Planning|Technical Specification|Must-Have|Nice-to-Have|Business Analysis|Resource Allocation|Architecture Considerations|Integration Requirements|Security and Compliance|Unique Differentiators|Technology Stack|Frontend|Backend|Database|Infrastructure|Microservices|Scalability|Performance|Authentication|User Management|Responsive Design|Export and Deployment|Target Audience|Small to Medium|Startups|Enterprise|Non-Technical|Developers|Similar Products|Market Research|Recommendation|Note:|API configuration|comprehensive market research|Direct competitors|Similar apps|Market analysis reports|Industry benchmarks|product positioning|feature prioritization|online tools|market trends|consumer behavior|industry forums/i.test(message)
    const hasColons = message.includes(':')
    const hasEditKeywords = /\b(make it|modify|change|edit|improve|update|rewrite|concise|enhance|fix|adjust|refine|optimize|enhance)\b/i.test(message)
    const hasLongContent = message.length > 100
    const hasStructuredContent = message.includes('•') || message.includes('-') || message.includes('1.') || message.includes('2.')
    
    return false
  }, [])

  const formatMessageForDisplay = useCallback((message: string): FormattedMessage => {
    if (detectPastedContent(message)) {
      const editKeywords = /\b(make it|modify|change|edit|improve|update|rewrite|concise|enhance|fix|adjust|refine|optimize)\b/i
      const match = message.match(editKeywords)
      
      if (match) {
        const splitIndex = message.toLowerCase().indexOf(match[0].toLowerCase())
        const pastedContent = message.substring(0, splitIndex).trim()
        const userRequest = message.substring(splitIndex).trim()
        
        return {
          isPastedContent: true,
          pastedText: pastedContent,
          userRequest: userRequest,
          preview: pastedContent.length > 60 ? pastedContent.substring(0, 60) + '...' : pastedContent
        }
      } else {
        return {
          isPastedContent: true,
          pastedText: message,
          userRequest: 'Please edit this section',
          preview: message.length > 60 ? message.substring(0, 60) + '...' : message
        }
      }
    }
    
    return {
      isPastedContent: false,
      originalMessage: message
    }
  }, [detectPastedContent])

  const handleSuggestedMessageClick = useCallback((message: string) => {
    setInputValue(message)
    textareaRef.current?.focus()
  }, [setInputValue])

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return;

    if (isWelcomeMode) {
      onNewChat(inputValue);
      setInputValue("");
      setUploadedFiles([]);
      return;
    }

    if (!activeSessionId) {
      return;
    }

    const inputText = inputValue.trim();
    const formatted = formatMessageForDisplay(inputText);

    // Prepare PDF files if any
    let pdfFilesToSend: any[] = [];
    if (uploadedFiles.length > 0) {
      pdfFilesToSend = uploadedFiles.map(file => ({
        filename: file.name,
        content: file.content,
        size: file.size
      }));
    }

    setInputValue("");
    setUploadedFiles([]);
    setIsUserTyping(true);

    // Prepare message for communicate API
    const messageToSend = currentSelectedText && currentSelectedText.trim() 
      ? `${currentSelectedText} ${inputText}`
      : formatted.isPastedContent && formatted.userRequest && formatted.pastedText
      ? `${formatted.pastedText} ${formatted.userRequest}`
      : inputText;

    // Add user message instantly to chat (before API call)
    const displayMessage = currentSelectedText && currentSelectedText.trim() 
      ? `${currentSelectedText} ${inputText}`
      : formatted.isPastedContent && formatted.userRequest && formatted.pastedText
      ? `${formatted.pastedText} ${formatted.userRequest}`
      : inputText;

    addMessage({
      id: `user-${Date.now()}`,
      type: 'user',
      content: displayMessage,
      timestamp: new Date(),
      sessionId: activeSessionId || undefined,
      projectId: activeProjectId || undefined,
      isStreaming: false
    });

    // Clear selected text after adding message
    if (currentSelectedText && currentSelectedText.trim()) {
      clearSelectedText();
    }

    try {
      // Call communicate API first
      const response = await communicateWithMasterAgent({
        session_id: activeSessionId,
        project_id: activeProjectId || undefined,
        message: messageToSend,
        initial_idea: initialIdea || undefined
      });

      // Handle message from response - add it to chat messages
      if (response.message) {
        addMessage({
          id: `api-${Date.now()}`,
          type: 'ai',
          content: response.message,
          timestamp: new Date(),
          sessionId: activeSessionId || undefined,
          projectId: activeProjectId || undefined,
          isStreaming: false
        });
      }

      // Handle proposal_html if present in response
      if (response.proposal_html && onProposalHtmlReceived) {
        onProposalHtmlReceived(response.proposal_html, response.proposal_title);
      }

      // Always hide typing indicator after API response is received (whether message exists or not)
      setIsUserTyping(false);

      // Note: User message already added instantly above, so we don't need to send via WebSocket
      // The communicate API handles the message, and we've already displayed the user message
    } catch (error) {
      console.error("Error communicating with master agent:", error);
      setIsUserTyping(false);
      // User message already displayed, so we don't need to send via WebSocket
      // Error handling: message is already shown to user
    }
  }, [inputValue, isWelcomeMode, onNewChat, formatMessageForDisplay, addMessage, currentSelectedText, clearSelectedText, uploadedFiles, activeSessionId, activeProjectId, initialIdea, onProposalHtmlReceived])

  const handleFileUploaded = useCallback((file: UploadedFile) => {
    setUploadedFiles(prev => [...prev, file]);
    
    const fileMessage: Message = {
      id: `file-${file.id}`,
      type: "file",
      content: file.content || `Document uploaded: ${file.name}`,
      timestamp: new Date(),
      fileName: file.name,
      fileSize: file.size
    };
    
    if (!inputValue.trim()) {
      setInputValue(`Please analyze the uploaded document and help me with it.`);
    }
  }, [inputValue, sendMessage])

  const removeUploadedFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }


  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion)
    textareaRef.current?.focus()
  }, [])

  const toggleMessageExpansion = useCallback((messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (isWelcomeMode) {
    return (
      <div className="w-full">
        <div className="relative">
          {/* Selected Text Indicator */}
          {currentSelectedText && (
            <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <span className="text-xs font-medium text-blue-300">SELECTED TEXT CONTEXT</span>
                <button 
                  onClick={clearSelectedText}
                  className="ml-auto text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="text-sm text-gray-300 font-mono whitespace-pre-wrap bg-black/20 p-2 rounded max-h-20 overflow-y-auto border border-[#2a2a2a]">
                {currentSelectedText.length > 200 ? currentSelectedText.substring(0, 200) + '...' : currentSelectedText}
              </div>
            </div>
          )}
          
          {/* Input Container - Dark Background */}
          <div className="relative flex items-center justify-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-2 focus-within:border-green-600 transition-all">
            {/* Attach Button */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <FileUploadButton onFileUploaded={handleFileUploaded} />
            </div>
            
            {/* Text Input */}
            <div className="flex-1 min-w-0 max-w-2xl">
              <AutoGrowTextarea
                value={inputValue}
                setValue={setInputValue}
                placeholder="Ask a question or make a request..."
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
            </div>
            
            {/* Send Button */}
            <div className="flex-shrink-0">
              <Button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || (!isWelcomeMode && (connectionStatus !== 'connected' || isGeneratingProposal))}
                className="bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 rounded-full h-8 w-8 p-0 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!isWelcomeMode && (connectionStatus !== 'connected' || isGeneratingProposal) ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 sm:p-4 border-b border-[#2a2a2a] flex-shrink-0">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          <div className="flex items-center space-x-1.5 sm:space-x-2 min-w-0">
            <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0" />
            <h2 className="text-base sm:text-lg font-semibold text-white truncate">{isDocumentMode ? "Document Assistant" : "Ilham AI"}</h2>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-2 me-2 flex-shrink-0">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${connectionStatus === 'connected' ? "bg-green-400" : "bg-red-400"}`} />
                <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:inline">{connectionStatus === 'connected' ? "Connected" : "Connecting..."}</span>
          </div>
        </div>

        {sessionId && (
          <Badge variant="outline" className="border-green-700 text-green-300 text-center flex items-center justify-center flex-shrink-0 hidden sm:flex">
            Session Active
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-2 sm:p-4 min-h-0 overflow-hidden">
        <div className="space-y-3 sm:space-y-4">
          {messages.filter((message) => message.type !== "edit_suggestion").map((message) => (
            <div key={message.id} className="space-y-2">
              <div
                className={`flex items-start ${
                  message.type === "user" ? "flex-row-reverse space-x-reverse" : "space-x-3"
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
                <div className={`flex-1 max-w-[85%] sm:max-w-[75%] ${message.type === "user" ? "text-right" : "text-left"} break-words overflow-wrap-anywhere me-1 sm:me-2`}>
                  <div
                    className={`inline-block p-2.5 sm:p-3 rounded-lg max-w-full text-left overflow-wrap-anywhere ${
                      message.type === "user"
                        ? "bg-green-700 text-white"
                        : message.type === "ai"
                          ? "bg-[#1a1a1a] text-white border border-[#2a2a2a]"
                          : message.type === "proposal"
                            ? "bg-blue-900/30 text-blue-300 border border-blue-700"
                            : message.type === "error"
                                ? "bg-red-900/30 text-red-300 border border-red-700"
                                : "bg-blue-900/30 text-blue-300 border border-blue-700"
                    }`}
                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                  >
                    {/* User messages with special formatting for pasted content */}
                    {message.type === "user" && (() => {
                      const formatted = formatMessageForDisplay(message.content)
                      const isFileUploadRequest = message.content?.toLowerCase().includes("uploaded an attachment")
                      return (
                        <>
                          {isFileUploadRequest && (
                            <div className="bg-[#18181b] border border-[#232326] rounded-lg px-4 py-3 flex items-center space-x-3 mb-2">
                              <span className="text-2xl">📄</span>
                              <span className="text-sm text-gray-200 font-medium">Uploaded 1 PDF file</span>
                            </div>
                          )}
                          {formatted.isPastedContent && formatted.userRequest && formatted.pastedText && formatted.preview ? (() => {
                            const isLongPastedText = formatted.pastedText.length > 500
                            const isExpanded = expandedMessages.has(message.id)
                            const shouldTruncate = isLongPastedText && !isExpanded
                            const displayPreview = shouldTruncate 
                              ? formatted.pastedText.substring(0, 200) + '...'
                              : formatted.pastedText
                            
                             return (
                               <div className="space-y-2 text-left">
                                 {/* User's request */}
                                 <p className="text-sm text-left font-medium">{formatted.userRequest}</p>
                                 {/* Pasted content preview - Cursor style */}
                                 <div className="bg-black/20 border border-white/20 rounded p-2 mt-2">
                                   <div className="flex items-center space-x-2 mb-1">
                                     <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                     <span className="text-xs font-medium text-blue-200">Pasted Text</span>
                                   </div>
                                   <p className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                                     {displayPreview}
                                   </p>
                                   <p className="text-xs text-gray-400 mt-1">
                                     {formatted.pastedText.length} characters
                                   </p>
                                   {shouldTruncate && (
                                     <button
                                       onClick={() => toggleMessageExpansion(message.id)}
                                       className="mt-2 text-xs text-blue-300 hover:text-blue-200 underline"
                                     >
                                       Read more
                                     </button>
                                   )}
                                   {isExpanded && isLongPastedText && (
                                     <button
                                       onClick={() => toggleMessageExpansion(message.id)}
                                       className="mt-2 text-xs text-blue-300 hover:text-blue-200 underline"
                                     >
                                       Show less
                                     </button>
                                   )}
                                 </div>
                               </div>
                             )
                          })() : (() => {
                            const isLongMessage = message.content.length > 500
                            const isExpanded = expandedMessages.has(message.id)
                            const shouldTruncate = isLongMessage && !isExpanded
                            const displayContent = shouldTruncate 
                              ? message.content.substring(0, 200) + '...'
                              : message.content
                            
                            return (
                              <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                {displayContent}
                                {shouldTruncate && (
                                  <button
                                    onClick={() => toggleMessageExpansion(message.id)}
                                    className="ml-2 text-xs text-blue-300 hover:text-blue-200 underline"
                                  >
                                    Read more
                                  </button>
                                )}
                                {isExpanded && isLongMessage && (
                                  <button
                                    onClick={() => toggleMessageExpansion(message.id)}
                                    className="ml-2 text-xs text-blue-300 hover:text-blue-200 underline"
                                  >
                                    Show less
                                  </button>
                                )}
                              </div>
                            )
                          })()}
                        </>
                      )
                    })()}
                    
                    {/* AI and other message types - no truncation for agent messages */}
                    {message.type !== "user" && message.type !== "edit_suggestion" && (
                      <div className="text-sm leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
                        <ReactMarkdown
                          components={{
                            a: ({ node, ...props }) => (
                              <a
                                {...props}
                                className="text-blue-400 hover:text-blue-300 underline break-all overflow-wrap-anywhere"
                                style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            ),
                            p: ({ node, ...props }) => (
                              <p {...props} className="break-words overflow-wrap-anywhere" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }} />
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                        {/* Show typing cursor for streaming messages */}
                        {message.id.startsWith('streaming-') && !message.suggestions && (
                          <span className="inline-block w-2 h-4 bg-green-400 ml-1 animate-pulse"></span>
                        )}
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

          {/* Agent typing indicator */}
          {(() => {
            const shouldShow = (isTyping || isUserTyping) && !isGeneratingProposal
            return shouldShow
          })() && (
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="inline-block p-3 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] min-w-[200px]">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-300">
                      LLHAM is typing
                    </span>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

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
      <div className="p-2 sm:p-4 border-t border-[#2a2a2a] flex-shrink-0">
        {/* Suggested Messages Pills - Only show when not in document mode
        {!isDocumentMode && randomSuggestedMessages.length > 0 && (
        <div className="mb-2 sm:mb-3 w-full overflow-hidden">
        <div 
          className="w-full max-w-6xl mx-auto overflow-x-auto overflow-y-hidden scrollbar-hide relative"
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="flex gap-1.5 sm:gap-2 pb-2">
            {randomSuggestedMessages.map((message, index) => (
              <button
                key={index}
                onClick={() => handleSuggestedMessageClick(message)}
                className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm bg-[#0a0a0a] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-green-700 rounded-full text-gray-500 hover:text-gray-300 transition-all duration-200 capitalize whitespace-nowrap flex-shrink-0 opacity-60 hover:opacity-100"
              >
                {message}
              </button>
            ))}
          </div>
        </div>
      </div>
      
        )} */}

        {/* Uploaded Files Display */}
        {uploadedFiles.length > 0 && (
          <div className="mb-2 sm:mb-4 space-y-2">
            <div className="text-xs text-gray-400 mb-2">Attached Files:</div>
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center space-x-2 sm:space-x-3 p-2 sm:p-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
                <div className="flex-shrink-0">
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm text-white font-medium truncate">{file.name}</div>
                  <div className="text-xs text-gray-400">
                    {formatFileSize(file.size)} • {file.type}
                    {file.status === 'uploading' && (
                      <span className="ml-2 text-blue-400">Uploading... {file.progress}%</span>
                    )}
                    {file.status === 'processing' && (
                      <span className="ml-2 text-yellow-400">Processing...</span>
                    )}
                    {file.status === 'error' && (
                      <span className="ml-2 text-red-400">Error: {file.error}</span>
                    )}
                    {file.status === 'completed' && (
                      <span className="ml-2 text-green-400">Ready</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeUploadedFile(file.id)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 sm:gap-2 min-h-[44px] sm:min-h-[48px]">
          <div className="flex items-center h-full flex-shrink-0 rounded-md">
            <FileUploadButton onFileUploaded={handleFileUploaded} />
          </div>
          <div className="flex-1 flex items-center h-full min-w-0">
            <AutoGrowTextarea
              value={inputValue}
              setValue={setInputValue}
              placeholder={isDocumentMode
                ? 'Select Text & add Your Query here...'
                : 'Tell me about your project idea...'}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
          </div>
          <div className="flex items-center h-full flex-shrink-0">
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || connectionStatus !== 'connected' || isGeneratingProposal}
              className="bg-green-700 hover:bg-green-600 text-white disabled:opacity-50 flex items-center justify-center h-10 sm:h-[45px] min-w-[38px] sm:min-w-[45px] rounded-md p-2 sm:p-0"
            >
              {(connectionStatus !== 'connected' || isGeneratingProposal) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-center mt-1.5 sm:mt-2">
          <p className="text-[10px] sm:text-xs text-gray-500 text-center mx-auto px-2">
            {isDocumentMode
              ? "Select text in document and write your query here"
              : "Press Enter to send, Shift+Enter for new line"}
          </p>
        </div>
      </div>
    </div>
  )
})

