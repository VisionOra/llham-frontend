"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { FileText, Printer, Edit3, ZoomIn, ZoomOut, Type, Copy, Check, X } from "lucide-react"
import { MarkdownExporter } from "@/components/markdown-exporter"

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

  const processedContent = (() => {
    let rawContent = null
    const doc = document as any
    
    if (doc?.content && typeof doc.content === 'string') {
      rawContent = doc.content
    } else if (doc?.document && typeof doc.document === 'string') {
      rawContent = doc.document
    } else if (doc?.content && typeof doc.content === 'object') {
      const content = doc.content as any
      rawContent = content.html || 
                  content.content || 
                  content.document ||
                  content.body || 
                  content.text || 
                  content.data
    } else if (typeof doc === 'string') {
      rawContent = doc
    }
    
    if (!rawContent) return ''
    
    let contentString = ''
    if (typeof rawContent === 'string') {
      contentString = rawContent
    } else {
      contentString = String(rawContent)
    }
    
    if (contentString && typeof contentString === 'string') {
      return contentString
        .replace(/(<h[1-6][^>]*>)(.*?)(<\/h[1-6]>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<p[^>]*>)(.*?)(<\/p>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<li[^>]*>)(.*?)(<\/li>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<td[^>]*>)(.*?)(<\/td>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<th[^>]*>)(.*?)(<\/th>)/g, '$1<span class="selectable-text">$2</span>$3')
    }
    
    return contentString || ''

  })()

  useEffect(() => {
    let isSelecting = false
    let selectionTimeout: NodeJS.Timeout | null = null

    const handleMouseDown = (e: MouseEvent) => {
      if (contentRef.current?.contains(e.target as Node)) {
        isSelecting = true
        window.getSelection()?.removeAllRanges()
        setSelectedText("")
        setIsSelecting(false)
        setCopied(false)
        
        if (selectionTimeout) {
          clearTimeout(selectionTimeout)
          selectionTimeout = null
        }
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isSelecting) return
      
      isSelecting = false
      
      if (selectionTimeout) {
        clearTimeout(selectionTimeout)
      }
      
      selectionTimeout = setTimeout(() => {
        const selection = window.getSelection()
        if (selection && !selection.isCollapsed) {
          const text = selection.toString().trim()
          
          if (text && text.length > 0) {
            setSelectedText(text)
            setIsSelecting(true)
            setCopied(false)
            
            if (onTextSelect && contentRef.current) {
              onTextSelect(text, contentRef.current)
            }
          }
        }
        selectionTimeout = null
      }, 50)
    }

    const handleSelectionChange = () => {
      if (isSelecting) return
      
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed && contentRef.current?.contains(selection.anchorNode)) {
        const text = selection.toString().trim()
        if (text && text.length > 0) {
          setSelectedText(text)
          setIsSelecting(true)
          setCopied(false)
          
          if (onTextSelect && contentRef.current) {
            onTextSelect(text, contentRef.current)
          }
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (contentRef.current?.contains(e.target as Node)) {
        setTimeout(() => {
          const selection = window.getSelection()
          if (selection && !selection.isCollapsed) {
            const text = selection.toString().trim()
            if (text && text.length > 0) {
              setSelectedText(text)
              setIsSelecting(true)
              setCopied(false)
              
              if (onTextSelect && contentRef.current) {
                onTextSelect(text, contentRef.current)
              }
            }
          }
        }, 10)
      }
    }

    const contentElement = contentRef.current
    if (contentElement) {
      contentElement.addEventListener("mousedown", handleMouseDown)
      contentElement.addEventListener("mouseup", handleMouseUp)
      contentElement.addEventListener("keyup", handleKeyUp)
      window.document.addEventListener("selectionchange", handleSelectionChange)
    }

    return () => {
      if (contentElement) {
        contentElement.removeEventListener("mousedown", handleMouseDown)
        contentElement.removeEventListener("mouseup", handleMouseUp)
        contentElement.removeEventListener("keyup", handleKeyUp)
        window.document.removeEventListener("selectionchange", handleSelectionChange)
      }
      if (selectionTimeout) {
        clearTimeout(selectionTimeout)
      }
    }
  }, [document, onTextSelect])

  const handlePrint = () => {
    if (!document) return;
    const printWindow = window.open('', '_blank', 'width=900,height=1200')
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${document.title}</title><style>
      body { font-family: Arial, sans-serif; background: #fff; color: #000; padding: 32px; width: 100%; max-width: 900px; margin: 0 auto; }
      h1 { color:#333;margin-top:20px;font-size:2.2em;font-weight:bold;border-bottom:2px solid #4a5568;padding-bottom:8px; }
      .meta { color:#666;font-size:12px;margin-bottom:16px; }
      .content { font-size:14px;line-height:1.8;color:#000; }
    </style></head><body>
      <h1>${document.title}</h1>
      <div class="meta">
        ${document.author ? `<div><strong>Author:</strong> ${document.author}</div>` : ''}
        ${document.created_at ? `<div><strong>Created:</strong> ${formatDate(document.created_at)}</div>` : ''}
        ${document.updated_at ? `<div><strong>Last Updated:</strong> ${formatDate(document.updated_at)}</div>` : ''}
      </div>
      <div class="content">${processedContent}</div>
    </body></html>`)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 200)
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
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(selectedText)
        } else {
          const textArea = window.document.createElement('textarea')
          textArea.value = selectedText
          textArea.style.position = 'fixed'
          textArea.style.left = '-999999px'
          textArea.style.top = '-999999px'
          window.document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          window.document.execCommand('copy')
          window.document.body.removeChild(textArea)
        }
        
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      } catch (error) {
        alert('Failed to copy text. Please try selecting a smaller portion or use Ctrl+C (Cmd+C on Mac) instead.')
      }
    }
  }

  const htmlToPlainText = (html: string) => {
    const tempDiv = window.document.createElement('div')
    tempDiv.innerHTML = html
    
    const scripts = tempDiv.querySelectorAll('script, style')
    scripts.forEach(el => el.remove())
    
    let text = tempDiv.textContent || tempDiv.innerText || ''
    
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
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
    <div className="flex flex-col h-full bg-[#0a0a0a] w-full ">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border-b border-[#2a2a2a] gap-4 md:gap-0">
        <div className="flex items-center space-x-3 md:space-x-3">
          <FileText className="w-5 h-5 text-green-400" />
          <div>
            <h2 className="text-lg font-semibold text-white break-words max-w-xs sm:max-w-md whitespace-normal">{document.title}</h2>
            <p className="text-xs text-gray-400">Last updated: {formatDate(document.updated_at)}</p>
          </div>
        </div>

        <div className="flex flex-col-reverse md:flex-row md:items-center md:space-x-2 gap-2 md:gap-0 w-full md:w-auto">
          <div className="flex items-center space-x-2 justify-end md:justify-start w-full md:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-[#2a2a2a] hover:text-white cursor-pointer text-gray-300 hover:bg-[#1a1a1a] bg-transparent"
            >
              <Printer className="w-4 h-4 mr-1" />
              Print
            </Button>
            <MarkdownExporter
              document={document}
              processedContent={processedContent}
              variant="outline"
              size="sm"
              className="border-[#2a2a2a] text-gray-300 hover:bg-[#1a1a1a] bg-transparent"
            />
          </div>
          <div className="flex items-center space-x-1 bg-[#1a1a1a] rounded-lg p-1 justify-center md:justify-start w-full md:w-auto mt-2 md:mt-0 mb-0 md:mb-0">
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
        </div>
      </div>

      <div className="px-4 py-2 bg-[#1a1a1a]/50 border-b border-[#2a2a2a]/50 min-w-[430px]">
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

      <ScrollArea className="flex-1">
        <div className="p-0 sm:p-0 md:p-8">
          <div
            ref={contentRef}
            className="bg-white  text-black rounded-lg shadow-2xl min-h-[800px] document-content w-full p-2 sm:p-4 md:p-12 md:max-w-3xl md:mx-auto"
            style={{
              fontSize: `${zoomLevel}%`,
              userSelect: "text",
              cursor: "text",
              lineHeight: "1.8",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
              boxSizing: "border-box",
              overflowX: "auto",
              minWidth: 0,
              maxWidth: "100%"
            }}
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />
        </div>
      </ScrollArea>

      {editSuggestion && editSuggestion.editData && editSuggestion.showAcceptReject && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-blue-500 rounded-lg shadow-2xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
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

            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                  <span className="text-sm font-semibold text-red-300">CURRENT</span>
                </div>
                <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                    {htmlToPlainText(editSuggestion.editData.original)}
                  </pre>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span className="text-sm font-semibold text-green-300">PROPOSED</span>
                </div>
                <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed break-words">
                    {htmlToPlainText(editSuggestion.editData.proposed)}
                  </pre>
                </div>
              </div>
            </div>

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

      {isSelecting && selectedText && (
        <div className="absolute bottom-4 left-2/5 transform -translate-x-1/2 bg-[#1a1a1a] border border-blue-500 rounded-lg p-3 shadow-lg max-w-lg">
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-300 flex-1 min-w-0">
              <span className="text-blue-400 font-medium">Selected:</span>
              <div className="mt-1 text-xs text-gray-400 truncate">
                {selectedText.length > 100 ? `${selectedText.substring(0, 100)}...` : selectedText}
              </div>
              <div className="mt-1 text-xs text-gray-500 flex items-center space-x-2">
                <span>{selectedText.length} characters</span>
                {selectedText.length > 5000 && (
                  <span className="text-yellow-400">Large selection</span>
                )}
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
            {selectedText.length > 10000 ? 
              "Large text selected - copying may take a moment" : 
              "Copy text and paste in chat to request edits"
            }
          </div>
        </div>
      )}
    </div>
  )
}
