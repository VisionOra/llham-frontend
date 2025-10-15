"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { FileText, X, Save } from "lucide-react"
import { DocumentViewerProps, EditableBlock } from './types'
import { countCharacters, parseHTMLToBlocks, blocksToHTML } from './utils'
import { useExportActions } from './use-export-actions'
import { DocumentToolbar } from './document-toolbar'
import { DocumentHeader } from './document-header'
import { EditableBlockRenderer } from './editable-block'

export function DocumentViewer({ 
  document, 
  onTextSelect, 
  editSuggestion, 
  onAcceptEdit, 
  onRejectEdit, 
  onDocumentChange, 
  sessionId, 
  sendMessage 
}: DocumentViewerProps) {
  const [selectedText, setSelectedText] = useState("")
  const [zoomLevel, setZoomLevel] = useState(100)
  const [isSelecting, setIsSelecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState<string>("")
  const [editableBlocks, setEditableBlocks] = useState<EditableBlock[]>([])
  const [editMode, setEditMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)
  const editableRef = useRef<HTMLElement>(null)

  // Process document content
  const processedContent = useMemo(() => {
    if (!document) return ''

    let rawContent: any = ''
    const doc = document as any
    
    if (doc?.html) {
      rawContent = doc.html
    } else if (doc?.document) {
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
      let processed = contentString
        .replace(/(<h[1-6][^>]*>)(.*?)(<\/h[1-6]>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<p[^>]*>)(.*?)(<\/p>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<li[^>]*>)(.*?)(<\/li>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<td[^>]*>)(.*?)(<\/td>)/g, '$1<span class="selectable-text">$2</span>$3')
        .replace(/(<th[^>]*>)(.*?)(<\/th>)/g, '$1<span class="selectable-text">$2</span>$3')
      
      const tagPattern = /<(h[1-6]|p|div|span|li|td|th|blockquote|pre|code|strong|em|b|i|u|a|section|article|aside|header|footer|nav|main)([^>]*)>([\s\S]*?)<\/\1>/gi

      processed = processed.replace(tagPattern, (match, tagName, attributes, content) => {
        const charCount = countCharacters(content)
        if (charCount <= 0) {
          return ''
        }
        return match
      })
      
      return processed
    }
    
    return contentString || ''
  }, [document])

  // Initialize editable blocks
  useEffect(() => {
    if (processedContent) {
      setIsLoading(true)
      const blocks = parseHTMLToBlocks(processedContent)
      setEditableBlocks(blocks)
      // Small delay to show loading state
      setTimeout(() => setIsLoading(false), 100)
    }
  }, [processedContent])

  // Export actions hook
  const { handleExportMarkdown, handleExportPDF, handleShareWithNotion } = useExportActions(document, processedContent)

  // Edit handlers
  const handleStartEdit = (blockId: string, currentContent: string) => {
    if (!editMode) return
    setEditingBlockId(blockId)
    setEditedContent(currentContent)
    setIsSelecting(false)
    setSelectedText("")
  }

  const handleCancelEdit = () => {
    setEditingBlockId(null)
    setEditedContent("")
  }

  const handleSaveEdit = (blockId: string) => {
    const currentContent = editableRef.current?.innerHTML || editedContent
  
    const updateBlock = (blocks: EditableBlock[]): EditableBlock[] => {
      return blocks.map(block => {
        if (block.id === blockId) {
          return { ...block, content: currentContent }
        }
        if (block.children) {
          return { ...block, children: updateBlock(block.children) }
        }
        return block
      })
    }

    const updatedBlocks = updateBlock(editableBlocks)
    setEditableBlocks(updatedBlocks)
    
    const newHTML = blocksToHTML(updatedBlocks)
    const updatedDocument = {
      ...document!,
      content: newHTML
    }
    
    // Send WebSocket message with document_id
    if (sendMessage && sessionId && document?.id) {
      const message = {
        type: 'document_update',
        document_id: document.id,
        content: newHTML,
        session_id: sessionId,
      }
      sendMessage(message)
    }
    
    if (onDocumentChange) {
      onDocumentChange(updatedDocument)
    }
    
    setEditingBlockId(null)
    setEditedContent("")
  }

  const toggleEditMode = () => {
    setEditMode(!editMode)
    if (editingBlockId) {
      handleCancelEdit()
    }
  }

  // Text selection handlers
  useEffect(() => {
    if (editMode) return

    const contentElement = contentRef.current
    if (!contentElement || !document) return

    let selectionTimeout: NodeJS.Timeout

    const handleMouseUp = (e: MouseEvent) => {
      clearTimeout(selectionTimeout)
      selectionTimeout = setTimeout(() => {
        const selection = window.getSelection()
        const selected = selection?.toString().trim() || ""

        if (selected && selected.length > 0) {
          setSelectedText(selected)
          setIsSelecting(true)
          
          const range = selection?.getRangeAt(0)
          if (range && onTextSelect) {
            const container = range.commonAncestorContainer
            const element = container.nodeType === Node.TEXT_NODE 
              ? container.parentElement 
              : container as HTMLElement
            
            if (element && contentElement.contains(element)) {
              onTextSelect(selected, element)
            }
          }
        } else {
          setIsSelecting(false)
          setSelectedText("")
        }
      }, 100)
    }

    const handleMouseDown = () => {
      if (!editMode) {
        clearTimeout(selectionTimeout)
      }
    }

    contentElement.addEventListener("mouseup", handleMouseUp)
    contentElement.addEventListener("mousedown", handleMouseDown)

    return () => {
      contentElement.removeEventListener("mouseup", handleMouseUp)
      contentElement.removeEventListener("mousedown", handleMouseDown)
      clearTimeout(selectionTimeout)
    }
  }, [document, onTextSelect, editMode])

  // Print handler
  const handlePrint = () => {
    if (!document) return

    const printContent = blocksToHTML(editableBlocks)
    
    const iframe = window.document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    window.document.body.appendChild(iframe)
    
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
    if (!iframeDoc) return
    
    iframeDoc.open()
    iframeDoc.write(`<!DOCTYPE html><html><head><title>${document.title}</title><style>
      body { font-family: Arial, sans-serif; background: #fff; color: #000; padding: 32px; width: 100%; max-width: 900px; margin: 0 auto; }
      h1 { color:#333;margin-top:20px;font-size:2.2em;font-weight:bold;border-bottom:2px solid #4a5568;padding-bottom:8px; }
      .meta { color:#666;font-size:12px;margin-bottom:16px; }
      .content { font-size:14px;line-height:1.8;color:#000; }
    </style></head><body>
      <h1>${document.title}</h1>
      <div class="meta">
        ${document.author ? `<div><strong>Author:</strong> ${document.author}</div>` : ''}
        ${document.created_at ? `<div><strong>Created:</strong> ${new Date(document.created_at).toLocaleDateString()}</div>` : ''}
        ${document.updated_at ? `<div><strong>Last Updated:</strong> ${new Date(document.updated_at).toLocaleDateString()}</div>` : ''}
      </div>
      <div class="content">${printContent}</div>
    </body></html>`)
    iframeDoc.close()
    
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus()
        iframe.contentWindow?.print()
        
        setTimeout(() => {
          window.document.body.removeChild(iframe)
        }, 100)
      }, 250)
    }
  }

  // Copy handler
  const handleCopyText = () => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel(prev => Math.min(150, prev + 10))
  const handleZoomOut = () => setZoomLevel(prev => Math.max(50, prev - 10))

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a] text-gray-400">
        <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-center">No document to display</p>
        <p className="text-sm text-gray-500 text-center mt-2">Start a conversation to generate a document</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-gray-200 overflow-hidden">
      {/* Toolbar */}
      <DocumentToolbar
        document={document}
        editMode={editMode}
        isSelecting={isSelecting}
        onToggleEdit={toggleEditMode}
        onPrint={handlePrint}
        onExportMarkdown={handleExportMarkdown}
        onExportPDF={handleExportPDF}
        onShareWithNotion={handleShareWithNotion}
      />

      {/* Header with Zoom Controls */}
      <DocumentHeader
        document={document}
        zoomLevel={zoomLevel}
        isSelecting={isSelecting}
        editMode={editMode}
        copied={copied}
        selectedText={selectedText}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onCopy={handleCopyText}
      />

      {/* Document Content */}
      <ScrollArea className="flex-1 overflow-x-hidden">
        <div className="flex justify-center p-4 md:p-8">
          <div 
            ref={contentRef}
            className={`document-content bg-white text-black p-8 md:p-12 shadow-2xl w-full max-w-full rounded-lg`}
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.2s ease',
              minWidth: '0',
            }}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
                <p className="text-gray-600 text-sm">Loading document...</p>
              </div>
            ) : (
              editableBlocks.map(block => (
                <EditableBlockRenderer
                  key={block.id}
                  block={block}
                  editingBlockId={editingBlockId}
                  editMode={editMode}
                  editableRef={editableRef}
                  onStartEdit={handleStartEdit}
                  onSaveEdit={handleSaveEdit}
                  onCancelEdit={handleCancelEdit}
                  onContentChange={setEditedContent}
                />
              ))
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Edit Suggestion Badge */}
      {editSuggestion?.showAcceptReject && editSuggestion.editData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg p-6 max-w-2xl w-full shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Edit Suggestion</h3>
              <button 
                onClick={() => onRejectEdit?.(editSuggestion.id)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-300 mb-4">{editSuggestion.editData.reason}</p>
            <div className="space-y-3 mb-6">
              <div className="bg-[#0a0a0a] border border-red-900/30 rounded p-3">
                <div className="text-xs text-red-400 font-semibold mb-1">Original:</div>
                <div className="text-sm text-gray-300">{editSuggestion.editData.original}</div>
              </div>
              <div className="bg-[#0a0a0a] border border-green-900/30 rounded p-3">
                <div className="text-xs text-green-400 font-semibold mb-1">Proposed:</div>
                <div className="text-sm text-gray-300">{editSuggestion.editData.proposed}</div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => onRejectEdit?.(editSuggestion.id)}
                className="flex items-center gap-2 bg-transparent border border-[#3a3a3a] hover:bg-[#2a2a2a] text-gray-300 px-4 py-2 rounded text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={() => onAcceptEdit?.(editSuggestion.id)}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors"
              >
                <Save className="w-4 h-4" />
                Accept
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Re-export types
export * from './types'

