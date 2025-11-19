"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { FileText, X, Save, Check, XCircle } from "lucide-react"
import { DocumentViewerProps, EditableBlock } from './types'
import { countCharacters, parseHTMLToBlocks, blocksToHTML } from './utils'
import { useExportActions } from './use-export-actions'
import { DocumentToolbar } from './document-toolbar'
import { EditableBlockRenderer } from './editable-block'

const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  let text = temp.textContent || temp.innerText || '';
  
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  return text.trim();
};

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
  const [isSelecting, setIsSelecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState<string>("")
  const [editableBlocks, setEditableBlocks] = useState<EditableBlock[]>([])
  const [editMode, setEditMode] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const contentRef = useRef<HTMLDivElement>(null)
  const editableRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (document) {
      setIsLoading(true)
    }
  }, [document?.id])

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

  useEffect(() => {
    if (processedContent) {
      setIsLoading(true)
      requestAnimationFrame(() => {
        const blocks = parseHTMLToBlocks(processedContent)
        setEditableBlocks(blocks)
        setTimeout(() => setIsLoading(false), 300)
      })
    } else if (document) {
      setIsLoading(true)
      setEditableBlocks([])
    } else {
      setIsLoading(false)
      setEditableBlocks([])
    }
  }, [processedContent, document])

  const { handleExportMarkdown, handleExportPDF, handleShareWithNotion } = useExportActions(document, processedContent)

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
   
    <div className="flex justify-end items-end">
    <p className="text-xs  text-gray-400 uppercase tracking-wider mb-2">
                    Artilence
                  </p>
                  </div>
      <h1>${document.title}</h1>

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

  const handleCopyText = () => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

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
      <DocumentToolbar
        document={document}
        editMode={editMode}
        isSelecting={isSelecting}
        copied={copied}
        selectedText={selectedText}
        onToggleEdit={toggleEditMode}
        onPrint={handlePrint}
        onExportMarkdown={handleExportMarkdown}
        onExportPDF={handleExportPDF}
        onShareWithNotion={handleShareWithNotion}
        onCopy={handleCopyText}
      />

      <ScrollArea className="flex-1 overflow-x-hidden">
        <div className="flex justify-center p-4 md:p-8">
          <div 
            ref={contentRef}
            className={`document-content bg-white text-black p-8 md:p-12 shadow-2xl w-full max-w-full rounded-lg`}
          >
            {isLoading ? (
              <div className="flex flex-col items-center justify-center min-h-[600px]">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-t-4 border-green-500 mb-6"></div>
                <p className="text-gray-700 text-base font-medium">Loading document...</p>
                <p className="text-gray-500 text-sm mt-2">Please wait</p>
              </div>
            ) : (
              <>
                {/* Document Header */}
               
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">
                    Artilence
                  </p>
                  <h1 className="text-2xl md:text-2xl font-bold text-gray-900 break-words">
                    {document.title}
                  </h1>
                

                {/* Document Content */}
                {editableBlocks.map(block => (
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
                ))}
              </>
            )}
          </div>
        </div>
      </ScrollArea>

      {editSuggestion?.showAcceptReject && editSuggestion.editData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-[#3a3a3a] rounded-lg max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-start justify-between p-6 pb-4 border-b border-[#3a3a3a] flex-shrink-0">
              <h3 className="text-lg font-semibold text-white">Edit Suggestion</h3>
              <button 
                onClick={() => {
                  const editId = editSuggestion.editData?.edit_id || editSuggestion.id;
                  onRejectEdit?.(editId);
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 p-6">
              <p className="text-sm text-gray-300 mb-4">{editSuggestion.editData.reason}</p>
              <div className="space-y-3">
                {/* Original Hash - Red */}
                {editSuggestion.editData.verification?.original_hash && (
                  <div className="bg-[#0a0a0a] border-2 border-red-500/50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-red-400 font-semibold flex items-center gap-2">
                        <XCircle className="w-4 h-4" />
                        Original Hash:
                      </div>
                    </div>
                    <div className="text-sm text-red-300 font-mono break-all">
                      {editSuggestion.editData.verification.original_hash}
                    </div>
                    {editSuggestion.editData.original && (
                      <div className="text-sm text-gray-300 whitespace-pre-wrap break-words mt-2 pt-2 border-t border-red-500/20">
                        {stripHtmlTags(editSuggestion.editData.original)}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Updated Hash - Green with Tick */}
                {editSuggestion.editData.verification?.updated_hash && (
                  <div className="bg-[#0a0a0a] border-2 border-green-500/50 rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs text-green-400 font-semibold flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        Updated Hash:
                      </div>
                    </div>
                    <div className="text-sm text-green-300 font-mono break-all">
                      {editSuggestion.editData.verification.updated_hash}
                    </div>
                    {editSuggestion.editData.proposed && (
                      <div className="text-sm text-gray-300 whitespace-pre-wrap break-words mt-2 pt-2 border-t border-green-500/20">
                        {stripHtmlTags(editSuggestion.editData.proposed)}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Fallback to original/proposed if no verification hashes */}
                {!editSuggestion.editData.verification && (
                  <>
                    <div className="bg-[#0a0a0a] border border-red-900/30 rounded p-3">
                      <div className="text-xs text-red-400 font-semibold mb-2">Original:</div>
                      <div className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                        {stripHtmlTags(editSuggestion.editData.original)}
                      </div>
                    </div>
                    <div className="bg-[#0a0a0a] border border-green-900/30 rounded p-3">
                      <div className="text-xs text-green-400 font-semibold mb-2">Proposed:</div>
                      <div className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                        {stripHtmlTags(editSuggestion.editData.proposed)}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 justify-end p-6 pt-4 border-t border-[#3a3a3a] flex-shrink-0">
              <button
                onClick={() => {
                  const editId = editSuggestion.editData?.edit_id || editSuggestion.id;
                  onRejectEdit?.(editId);
                }}
                className="flex items-center gap-2 bg-transparent border border-[#3a3a3a] hover:bg-[#2a2a2a] text-gray-300 px-4 py-2 rounded text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={() => {
                  const editId = editSuggestion.editData?.edit_id || editSuggestion.id;
                  onAcceptEdit?.(editId);
                }}
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

export * from './types'

