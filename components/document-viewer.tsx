"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { FileText, Download, Printer, Edit3, ZoomIn, ZoomOut, Type, Copy, Check, X } from "lucide-react"

interface Document {
  id?: string
  title: string
  content: string
  created_at?: string
  updated_at?: string
  author?: string
}

interface EditSuggestion {
  id: string
  type: string
  editData?: {
    edit_id: string
    original: string
    proposed: string
    reason: string
    section_info: string
    selected_context: boolean
    confidence: number
    edit_type: string
  }
  showAcceptReject?: boolean
}

interface DocumentViewerProps {
  document: Document | null
  onTextSelect?: (selectedText: string, element: HTMLElement) => void
  editSuggestion?: EditSuggestion
  onAcceptEdit?: (editId: string) => void
  onRejectEdit?: (editId: string) => void
}

export function DocumentViewer({ document, onTextSelect, editSuggestion, onAcceptEdit, onRejectEdit }: DocumentViewerProps) {
  const [selectedText, setSelectedText] = useState("")
  const [zoomLevel, setZoomLevel] = useState(100)
  const [isSelecting, setIsSelecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Debug: Log document content type and value
  useEffect(() => {
    console.log('[DocumentViewer] Document content debug:', {
      hasDocument: !!document,
      contentType: typeof document?.content,
      contentValue: document?.content,
      isString: typeof document?.content === 'string',
      isObject: typeof document?.content === 'object',
      contentKeys: typeof document?.content === 'object' && document?.content !== null 
        ? Object.keys(document.content) 
        : null
    })
  }, [document])

  // Process document content to make text selection more precise
  const processedContent = (() => {
    if (!document?.content) return ''
    
    // If content is already a string, use it directly
    if (typeof document.content === 'string') {
      return document.content
        // Add word boundaries to make selection more precise
        .replace(/(<h[1-6][^>]*>)(.*?)(<\/h[1-6]>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<p[^>]*>)(.*?)(<\/p>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<li[^>]*>)(.*?)(<\/li>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<td[^>]*>)(.*?)(<\/td>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<th[^>]*>)(.*?)(<\/th>)/g, '$1<span class="selectable-text">$2</span>$3')
    }
    
    // If content is an object, try to extract HTML content from common fields
    if (typeof document.content === 'object' && document.content !== null) {
      const contentObj = document.content as any
      
      // Try common content field names
      const possibleContent = contentObj.document || 
                             contentObj.content || 
                             contentObj.html_content || 
                             contentObj.body || 
                             contentObj.text || 
                             contentObj.proposal_content
      
      if (typeof possibleContent === 'string') {
        return possibleContent
          .replace(/(<h[1-6][^>]*>)(.*?)(<\/h[1-6]>)/g, '$1<span class="selectable-text">$2</span>$3')
          .replace(/(<p[^>]*>)(.*?)(<\/p>)/g, '$1<span class="selectable-text">$2</span>$3')
          .replace(/(<li[^>]*>)(.*?)(<\/li>)/g, '$1<span class="selectable-text">$2</span>$3')
          .replace(/(<td[^>]*>)(.*?)(<\/td>)/g, '$1<span class="selectable-text">$2</span>$3')
          .replace(/(<th[^>]*>)(.*?)(<\/th>)/g, '$1<span class="selectable-text">$2</span>$3')
      }
      
      // If it's still an object, try JSON.stringify as fallback
      try {
        return `<pre>${JSON.stringify(contentObj, null, 2)}</pre>`
      } catch (e) {
        return '<p>Unable to display document content</p>'
      }
    }
    
    // Fallback: convert whatever it is to string
    return String(document.content)
  })()

  useEffect(() => {
    console.log("[v0] DocumentViewer received document:", document)
  }, [document])

  useEffect(() => {
    let startNode: Node | null = null
    let startOffset = 0
    let isSelecting = false

    const handleMouseDown = (e: MouseEvent) => {
      if (contentRef.current?.contains(e.target as Node)) {
        isSelecting = true
        // Clear any existing selection
        window.getSelection()?.removeAllRanges()
        setSelectedText("")
        setIsSelecting(false)
        setCopied(false)
        
        // Record where selection started
        const target = e.target as Node
        if (target.nodeType === Node.TEXT_NODE) {
          startNode = target
        } else if (target.firstChild?.nodeType === Node.TEXT_NODE) {
          startNode = target.firstChild
        }
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelecting || !contentRef.current?.contains(e.target as Node)) {
        isSelecting = false
        return
      }

      isSelecting = false
      
      // Get the current selection after mouse up
      setTimeout(() => {
        const selection = window.getSelection()
        if (selection && !selection.isCollapsed) {
          const text = selection.toString().trim()
          
          // Simple validation - just check if we have text and it's reasonable
          if (text && text.length > 0 && text.length < 1000) {
            console.log('[DocumentViewer] Selected text:', text)
            setSelectedText(text)
            setIsSelecting(true)
            setCopied(false)
          }
        }
      }, 10)
    }

    const contentElement = contentRef.current
    if (contentElement) {
      contentElement.addEventListener("mousedown", handleMouseDown)
      contentElement.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      if (contentElement) {
        contentElement.removeEventListener("mousedown", handleMouseDown)
        contentElement.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [document])

  const handleExport = () => {
    if (!document) return

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>${document.title}</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 800px; 
              margin: 0 auto; 
              padding: 40px 20px; 
              line-height: 1.6; 
              color: #333;
            }
            h1, h2, h3 { color: #2d3748; margin-top: 2em; margin-bottom: 0.5em; }
            h1 { border-bottom: 2px solid #4a5568; padding-bottom: 10px; }
            h2 { border-left: 4px solid #4a5568; padding-left: 15px; }
            p { margin-bottom: 1em; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            th { background: #f7fafc; font-weight: bold; }
            ul, ol { padding-left: 30px; margin-bottom: 1em; }
            li { margin-bottom: 0.5em; }
            blockquote { 
              border-left: 4px solid #e2e8f0; 
              padding-left: 20px; 
              margin: 20px 0; 
              font-style: italic; 
            }
          </style>
        </head>
        <body>
          ${document.content}
        </body>
      </html>
    `

    const blob = new Blob([htmlContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement("a")
    a.href = url
    a.download = `${document.title.replace(/[^a-zA-Z0-9]/g, "_")}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(prev + 10, 200))
  }

  const handleZoomOut = () => {
    setZoomLevel((prev) => Math.max(prev - 10, 50))
  }

  const handleCopyText = async () => {
    if (selectedText) {
      try {
        await navigator.clipboard.writeText(selectedText)
        setCopied(true)
        console.log('[DocumentViewer] Text copied to clipboard')
        
        // Reset copy state after 2 seconds
        setTimeout(() => setCopied(false), 2000)
      } catch (error) {
        console.error('Failed to copy text:', error)
      }
    }
  }

  // Convert HTML to readable plain text
  const htmlToPlainText = (html: string) => {
    // Create a temporary div to parse HTML
    const tempDiv = window.document.createElement('div')
    tempDiv.innerHTML = html
    
    // Remove script and style elements
    const scripts = tempDiv.querySelectorAll('script, style')
    scripts.forEach(el => el.remove())
    
    // Get text content and clean it up
    let text = tempDiv.textContent || tempDiv.innerText || ''
    
    // Clean up extra whitespace and line breaks
    text = text
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple line breaks with single
      .trim()
    
    return text
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Unknown"
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (!document) {
    return (
      <div className="flex flex-col h-full bg-[#0a0a0a]">
        <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
          <h2 className="text-lg font-semibold text-white">Document Viewer</h2>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-400">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-medium mb-2">No Document Selected</h3>
            <p className="text-sm max-w-md">
              Select a session with a generated document from the sidebar, or start a new chat to create a proposal.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center space-x-3">
          <FileText className="w-5 h-5 text-green-400" />
          <div>
            <h2 className="text-lg font-semibold text-white break-words max-w-xs sm:max-w-md whitespace-normal">{document.title}</h2>
            <p className="text-xs text-gray-400">Last updated: {formatDate(document.updated_at)}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 bg-[#1a1a1a] rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
              className="text-gray-400 hover:text-white h-8 w-8 p-0"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-gray-400 px-2 min-w-[3rem] text-center">{zoomLevel}%</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 200}
              className="text-gray-400 hover:text-white h-8 w-8 p-0"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          {/* Action Buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="border-[#2a2a2a] text-gray-300 hover:bg-[#1a1a1a] bg-transparent"
          >
            <Printer className="w-4 h-4 mr-1" />
            Print
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="border-[#2a2a2a] text-gray-300 hover:bg-[#1a1a1a] bg-transparent"
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Document Metadata */}
      <div className="px-4 py-2 bg-[#1a1a1a]/50 border-b border-[#2a2a2a]/50">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Created: {formatDate(document.created_at)}</span>
            {document.author && <span>Author: {document.author}</span>}
          </div>
          <div className="flex items-center space-x-2">
            {isSelecting && (
              <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700">
                <Edit3 className="w-3 h-3 mr-1" />
                Text Selected
              </Badge>
            )}
            <Badge variant="outline" className="border-[#2a2a2a] text-gray-400">
              <Type className="w-3 h-3 mr-1" />
              HTML Document
            </Badge>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <ScrollArea className="flex-1">
        <div className="p-8">
          <div
            ref={contentRef}
            className="max-w-5xl mx-auto bg-white text-black rounded-lg shadow-2xl p-12 min-h-[800px] document-content"
            style={{
              fontSize: `${zoomLevel}%`,
              userSelect: "text",
              cursor: "text",
              lineHeight: "1.8",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
            }}
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        </div>
      </ScrollArea>

      {/* Cursor AI Style Edit Overlay */}
      {editSuggestion && editSuggestion.editData && editSuggestion.showAcceptReject && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-blue-500 rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="bg-blue-900/30 px-6 py-4 border-b border-blue-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                  <h3 className="text-lg font-semibold text-white">✨ AI Edit Suggestion</h3>
                </div>
                <div className="text-sm text-gray-400">
                  Confidence: {Math.round((editSuggestion.editData.confidence || 0.9) * 100)}%
                </div>
              </div>
              {editSuggestion.editData.reason && (
                <p className="text-sm text-blue-200 mt-2">{editSuggestion.editData.reason}</p>
              )}
            </div>

            {/* Content Comparison */}
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Original Content */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <span className="text-sm font-semibold text-red-300">CURRENT</span>
                </div>
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {htmlToPlainText(editSuggestion.editData.original)}
                  </pre>
                </div>
              </div>

              {/* Proposed Content */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span className="text-sm font-semibold text-green-300">PROPOSED</span>
                </div>
                <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {htmlToPlainText(editSuggestion.editData.proposed)}
                  </pre>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-[#0a0a0a] px-6 py-4 border-t border-gray-700 flex justify-between items-center">
              <div className="text-xs text-gray-400">
                Section: {editSuggestion.editData.section_info || 'Document'}
              </div>
              <div className="flex space-x-3">
                <Button
                  onClick={() => {
                    onRejectEdit?.(editSuggestion.editData!.edit_id)
                  }}
                  variant="outline"
                  className="border-red-500/50 text-red-400 hover:bg-red-900/20 px-6"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    onAcceptEdit?.(editSuggestion.editData!.edit_id)
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-6"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Accept
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selection Toolbar */}
      {isSelecting && selectedText && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-[#1a1a1a] border border-blue-500 rounded-lg p-3 shadow-lg max-w-md">
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-300 flex-1 min-w-0">
              <span className="text-blue-400 font-medium">Selected:</span>
              <div className="mt-1 text-xs text-gray-400 truncate">
                {selectedText.length > 80 ? `${selectedText.substring(0, 80)}...` : selectedText}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {selectedText.length} characters
              </div>
            </div>
            <Button
              size="sm"
              className={`${copied ? 'bg-green-600' : 'bg-blue-600'} hover:bg-blue-700 text-white transition-colors`}
              onClick={handleCopyText}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <div className="mt-2 text-xs text-gray-400 text-center">
            Copy text and paste in chat to request edits
          </div>
        </div>
      )}
    </div>
  )
}
