"use client"

import React, { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { FileText, Printer, Edit3, ZoomIn, ZoomOut, Type, Copy, Check, X, Save, FileDown, Share2, FileCode } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

interface EditableBlock {
  id: string
  type: string
  content: string
  attributes: Record<string, string>
  children?: EditableBlock[]
}

interface DocumentViewerProps {
  document: Document | null
  onTextSelect?: (selectedText: string, element: HTMLElement) => void
  editSuggestion?: EditSuggestion
  onAcceptEdit?: (editId: string) => void
  onRejectEdit?: (editId: string) => void
  onDocumentChange?: (updatedDocument: Document) => void
  sessionId?: string
  sendMessage?: (message: any) => boolean
}

export function DocumentViewer({ document, onTextSelect, editSuggestion, onAcceptEdit, onRejectEdit, onDocumentChange, sessionId, sendMessage }: DocumentViewerProps) {
  const [selectedText, setSelectedText] = useState("")
  const [zoomLevel, setZoomLevel] = useState(100)
  const [isSelecting, setIsSelecting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editedContent, setEditedContent] = useState<string>("")
  const [editableBlocks, setEditableBlocks] = useState<EditableBlock[]>([])
  const [editMode, setEditMode] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const editableRef = useRef<HTMLElement>(null)

  const countCharacters = (text: string): number => {
    const plainText = text.replace(/<[^>]*>/g, '').trim()
    return plainText.length
  }

  // Parse HTML into editable blocks
  const parseHTMLToBlocks = (html: string): EditableBlock[] => {
    if (!html) return []
    
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const blocks: EditableBlock[] = []
    let blockId = 0

    const processNode = (node: Node): EditableBlock | null => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent?.trim() || ''
        if (text) {
          return {
            id: `block-${blockId++}`,
            type: 'text',
            content: text,
            attributes: {}
          }
        }
        return null
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement
        const tagName = element.tagName.toLowerCase()
        
        // Skip empty elements
        const textContent = element.textContent?.trim() || ''
        if (!textContent && !['br', 'hr', 'img'].includes(tagName)) {
          return null
        }

        const attributes: Record<string, string> = {}
        Array.from(element.attributes).forEach(attr => {
          attributes[attr.name] = attr.value
        })

        // For editable elements (headings, paragraphs, list items, table cells)
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'blockquote'].includes(tagName)) {
          return {
            id: `block-${blockId++}`,
            type: tagName,
            content: element.innerHTML,
            attributes
          }
        }

        // For container elements (lists, tables, divs)
        if (['ul', 'ol', 'table', 'tbody', 'thead', 'tr', 'div', 'section', 'article'].includes(tagName)) {
          const children: EditableBlock[] = []
          Array.from(element.childNodes).forEach(child => {
            const childBlock = processNode(child)
            if (childBlock) children.push(childBlock)
          })
          
          if (children.length > 0) {
            return {
              id: `block-${blockId++}`,
              type: tagName,
              content: '',
              attributes,
              children
            }
          }
        }

        // For inline elements, preserve as HTML
        if (['strong', 'em', 'b', 'i', 'u', 'a', 'span', 'code'].includes(tagName)) {
          return {
            id: `block-${blockId++}`,
            type: 'inline',
            content: element.outerHTML,
            attributes: {}
          }
        }
      }

      return null
    }

    Array.from(doc.body.childNodes).forEach(child => {
      const block = processNode(child)
      if (block) blocks.push(block)
    })

    return blocks
  }

  // Reconstruct HTML from editable blocks
  const blocksToHTML = (blocks: EditableBlock[]): string => {
    const renderBlock = (block: EditableBlock): string => {
      const attrs = Object.entries(block.attributes)
        .map(([key, value]) => `${key}="${value}"`)
        .join(' ')
      const attrStr = attrs ? ` ${attrs}` : ''

      if (block.type === 'text') {
        return block.content
      }

      if (block.type === 'inline') {
        return block.content
      }

      if (block.children && block.children.length > 0) {
        const childrenHTML = block.children.map(renderBlock).join('')
        return `<${block.type}${attrStr}>${childrenHTML}</${block.type}>`
      }

      return `<${block.type}${attrStr}>${block.content}</${block.type}>`
    }

    return blocks.map(renderBlock).join('')
  }

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

  })()

  useEffect(() => {
    if (processedContent) {
      const blocks = parseHTMLToBlocks(processedContent)
      setEditableBlocks(blocks)
    }
  }, [processedContent])

  useEffect(() => {
    if (editingBlockId && editableRef.current && editedContent) {
      editableRef.current.innerHTML = editedContent
      
      editableRef.current.focus()
      
      setTimeout(() => {
        if (editableRef.current) {
          try {
            const range = window.document.createRange()
            const selection = window.getSelection()
            if (selection && editableRef.current.childNodes.length > 0) {
              range.selectNodeContents(editableRef.current)
              range.collapse(false)
              selection.removeAllRanges()
              selection.addRange(range)
            }
          } catch (error) {
          }
        }
      }, 0)
    }
  }, [editingBlockId])

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
    
    const updatedHTML = blocksToHTML(updatedBlocks)
    const updatedDocument = {
      ...document!,
      content: updatedHTML
    }
    
 
    if (sendMessage && sessionId && document?.id) {
      const message = {
        type: 'document_update',
        document_id: document.id,
        content: updatedHTML,
        session_id: sessionId,
      }
      const sent = sendMessage(message)
    } else {
   
    }
    
    if (onDocumentChange) {
      onDocumentChange(updatedDocument)
    }

    setEditingBlockId(null)
    setEditedContent("")
  }

  const toggleEditMode = () => {
    const newEditMode = !editMode
    setEditMode(newEditMode)
    setEditingBlockId(null)
    setEditedContent("")
    setIsSelecting(false)
    setSelectedText("")
    setCopied(false)
  }

  useEffect(() => {
    if (editMode || editingBlockId) return
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
  }, [document, onTextSelect, editMode, editingBlockId])

  const handlePrint = () => {
    if (!document) return;
    const iframe = window.document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    window.document.body.appendChild(iframe);
    
    const iframeDoc = iframe.contentWindow?.document;
    if (!iframeDoc) return;
    
    // Use current editable blocks for printing
    const printContent = editableBlocks.length > 0 ? blocksToHTML(editableBlocks) : processedContent;
    
    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html><html><head><title>${document.title} - Ilham</title><style>
  
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
      <div class="content">${printContent}</div>
    </body></html>`);
    iframeDoc.close();
    
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        
        setTimeout(() => {
          window.document.body.removeChild(iframe);
        }, 1000);
      }, 200);
    };
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

  // Convert HTML to Markdown
  const htmlToMarkdown = (html: string): string => {
    const tempDiv = window.document.createElement('div')
    tempDiv.innerHTML = html
    
    const scripts = tempDiv.querySelectorAll('script, style')
    scripts.forEach(el => el.remove())
    
    let markdown = ''
    
    const processElement = (element: Element): string => {
      let result = ''
      
      switch (element.tagName.toLowerCase()) {
        case 'h1': result += `# ${element.textContent?.trim() || ''}\n\n`; break
        case 'h2': result += `## ${element.textContent?.trim() || ''}\n\n`; break
        case 'h3': result += `### ${element.textContent?.trim() || ''}\n\n`; break
        case 'h4': result += `#### ${element.textContent?.trim() || ''}\n\n`; break
        case 'h5': result += `##### ${element.textContent?.trim() || ''}\n\n`; break
        case 'h6': result += `###### ${element.textContent?.trim() || ''}\n\n`; break
        case 'p':
          const pText = element.textContent?.trim() || ''
          if (pText) result += `${pText}\n\n`
          break
        case 'ul':
          const ulItems = Array.from(element.querySelectorAll('li'))
          ulItems.forEach(item => { result += `- ${item.textContent?.trim() || ''}\n` })
          result += '\n'
          break
        case 'ol':
          const olItems = Array.from(element.querySelectorAll('li'))
          olItems.forEach((item, index) => { result += `${index + 1}. ${item.textContent?.trim() || ''}\n` })
          result += '\n'
          break
        case 'blockquote':
          const quoteText = element.textContent?.trim() || ''
          if (quoteText) result += `> ${quoteText}\n\n`
          break
        case 'strong':
        case 'b': result += `**${element.textContent?.trim() || ''}**`; break
        case 'em':
        case 'i': result += `*${element.textContent?.trim() || ''}*`; break
        case 'code': result += `\`${element.textContent?.trim() || ''}\``; break
        case 'pre':
          const codeText = element.textContent?.trim() || ''
          if (codeText) result += `\n\`\`\`\n${codeText}\n\`\`\`\n\n`
          break
        case 'table': result += processTable(element); break
        case 'hr': result += '---\n\n'; break
        case 'br': result += '\n'; break
        default:
          if (element.children.length === 0) {
            result += element.textContent || ''
          } else {
            Array.from(element.children).forEach(child => {
              result += processElement(child as Element)
            })
          }
      }
      
      return result
    }
    
    const processTable = (table: Element): string => {
      let result = ''
      const rows = Array.from(table.querySelectorAll('tr'))
      
      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll('td, th'))
        const cellTexts = cells.map(cell => cell.textContent?.trim() || '')
        
        if (cellTexts.length > 0) {
          result += `| ${cellTexts.join(' | ')} |\n`
          
          if (rowIndex === 0) {
            const separator = cellTexts.map(() => '---').join(' | ')
            result += `| ${separator} |\n`
          }
        }
      })
      
      return result + '\n'
    }
    
    Array.from(tempDiv.children).forEach(child => {
      markdown += processElement(child as Element)
    })
    
    markdown = markdown
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim()
    
    return markdown
  }

  const handleExportMarkdown = () => {
    if (!document) return
    
    try {
      const markdownContent = htmlToMarkdown(processedContent)
      
      const fullMarkdown = `# ${document.title}

**Author:** ${document.author || 'Unknown'}  
**Created:** ${formatDate(document.created_at)}  
**Last Updated:** ${formatDate(document.updated_at)}

---

${markdownContent}
`
      
      const blob = new Blob([fullMarkdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = `${document.title ? document.title.replace(/[^a-zA-Z0-9]/g, "_") : "document"}.md`
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('Markdown export failed. Please try again.')
    }
  }

  const handleShareWithNotion = () => {
    if (!document) return
    
    try {
      const markdownContent = htmlToMarkdown(processedContent)
      
      const fullMarkdown = `# ${document.title}

**Author:** ${document.author || 'Unknown'}  
**Created:** ${formatDate(document.created_at)}  
**Last Updated:** ${formatDate(document.updated_at)}

---

${markdownContent}
`
      
      navigator.clipboard.writeText(fullMarkdown).then(() => {
        window.open('https://www.notion.so', '_blank')
        alert('Markdown content copied to clipboard! Paste it into your new Notion page.')
      }).catch(() => {
        alert('Failed to copy to clipboard. Please try again.')
      })
    } catch (error) {
      alert('Failed to prepare content for Notion. Please try again.')
    }
  }

  const renderEditableBlock = (block: EditableBlock): JSX.Element => {
    const isEditing = editingBlockId === block.id
    const isEditableType = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'blockquote'].includes(block.type)

    const { style, ...otherAttributes } = block.attributes

    if (block.children && block.children.length > 0) {
      const Tag = block.type as keyof JSX.IntrinsicElements
      return (
        <Tag key={block.id} {...otherAttributes}>
          {block.children.map(renderEditableBlock)}
        </Tag>
      )
    }

    if (!isEditableType) {
      if (block.type === 'text') {
        return <span key={block.id}>{block.content}</span>
      }
      if (block.type === 'inline') {
        return <span key={block.id} dangerouslySetInnerHTML={{ __html: block.content }} />
      }
      const Tag = block.type as keyof JSX.IntrinsicElements
      return <Tag key={block.id} {...otherAttributes} dangerouslySetInnerHTML={{ __html: block.content }} />
    }

    // Editable elements
    const TagName = block.type

    if (isEditing) {
      const EditElement = React.createElement(
        TagName,
        {
          ref: editableRef,
          contentEditable: true,
          suppressContentEditableWarning: true,
          className: `${block.attributes.class || ''} outline-none ring-2 ring-blue-500 rounded px-2 py-1 bg-blue-50/10`,
          onInput: (e: React.FormEvent<HTMLElement>) => {
            const target = e.currentTarget as HTMLElement
            setEditedContent(target.innerHTML)
          },
          onBlur: (e: React.FocusEvent<HTMLElement>) => {
            const target = e.currentTarget as HTMLElement
            setEditedContent(target.innerHTML)
          },
          onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              handleCancelEdit()
            }
            if (e.key === 'Enter' && e.ctrlKey) {
              e.preventDefault()
              handleSaveEdit(block.id)
            }
          }
        }
      )
      
      return (
        <div key={block.id} className="relative group">
          {EditElement}
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              onClick={() => handleSaveEdit(block.id)}
              className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 h-7"
            >
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
            <Button
              size="sm"
              variant={"outline" as const}
              onClick={handleCancelEdit}
              className="border-gray-600 text-gray-300 hover:bg-gray-700 text-xs px-3 py-1 h-7"
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
            <span className="text-xs text-gray-400">Ctrl+Enter to save, Esc to cancel</span>
          </div>
        </div>
      )
    }

    const NonEditElement = React.createElement(
      TagName,
      {
        key: block.id,
        ...otherAttributes,
        className: `${block.attributes.class || ''} ${editMode ? 'cursor-pointer hover:bg-blue-50/5 rounded px-2 py-1 transition-colors' : ''}`,
        onClick: (e: React.MouseEvent<HTMLElement>) => {
          if (editMode) {
            e.stopPropagation()
            handleStartEdit(block.id, block.content)
          }
        },
        dangerouslySetInnerHTML: { __html: block.content }
      }
    )

    return NonEditElement
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
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#2a2a2a] hover:text-white cursor-pointer text-gray-300 hover:bg-[#1a1a1a] bg-transparent"
                >
                  <FileDown className="w-4 h-4 mr-1" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="bg-[#1a1a1a] border border-[#2a2a2a] shadow-lg z-[100] min-w-[200px]"
              >
                <DropdownMenuItem 
                  onClick={handleExportMarkdown}
                  className="text-gray-300 hover:text-white hover:bg-[#2a2a2a] cursor-pointer focus:bg-[#2a2a2a] focus:text-white"
                >
                  <FileCode className="w-4 h-4 mr-2" />
                  Export Markdown
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleShareWithNotion}
                  className="text-gray-300 hover:text-white hover:bg-[#2a2a2a] cursor-pointer focus:bg-[#2a2a2a] focus:text-white"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share with Notion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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

      <div className="px-4 py-2 bg-[#1a1a1a]/50 border-b border-[#2a2a2a]/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-gray-400">
          {/* Created/Author Info - Hidden on mobile, shown on desktop */}
          <div className="hidden md:flex items-center space-x-4">
            <span>Created: {formatDate(document.created_at)}</span>
            {document.author && <span>Author: {document.author}</span>}
          </div>
          
          {/* Status Badges - Top row on mobile */}
          <div className="flex items-center justify-between md:justify-end space-x-2">
            {isSelecting && !editMode && (
              <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700 text-xs">
                <Edit3 className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Text Selected</span>
                <span className="sm:hidden">Selected</span>
              </Badge>
            )}
            {editMode && (
              <Badge variant="secondary" className="bg-blue-900/50 text-blue-300 border-blue-700 text-xs">
                <Edit3 className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Edit Mode Active</span>
                <span className="sm:hidden">Editing</span>
              </Badge>
            )}
          </div>
          
          {/* HTML Document Badge & Edit Button - Bottom row on mobile */}
          <div className="flex items-center justify-center md:justify-end space-x-2 w-full md:w-auto">
            <Badge variant="outline" className="border-[#2a2a2a] text-gray-400 text-xs">
              <Type className="w-3 h-3 mr-1" />
              HTML Document
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleEditMode}
              className={`border-[#2a2a2a] hover:text-white cursor-pointer text-xs h-6 px-2 flex-shrink-0 ${
                editMode 
                  ? 'bg-blue-600/20 text-blue-400 border-blue-600 hover:bg-blue-600/30' 
                  : 'text-gray-300 hover:bg-[#1a1a1a] bg-transparent'
              }`}
            >
              <Edit3 className="w-3 h-3 mr-1" />
              {editMode ? 'Exit Edit' : 'Edit'}
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-x-hidden">
        <div className="w-full h-full px-2 py-2 sm:px-4 sm:py-4 md:px-8 md:py-8 flex justify-center">
          <div
            ref={contentRef}
            className="bg-white text-black rounded-lg shadow-2xl min-h-[800px] document-content w-full max-w-full p-4 sm:p-6 md:p-10 lg:p-12"
            style={{
              fontSize: `${zoomLevel}%`,
              userSelect: "text",
              cursor: "text",
              lineHeight: "1.8",
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif",
              boxSizing: "border-box",
              overflowWrap: "break-word",
              wordWrap: "break-word",
              maxWidth: "100%",
              minWidth: "0"
            }}
          >
            <h1 style={{
              color: '#333',
              marginTop: '0',
              marginBottom: '24px',
              fontSize: '2.2em',
              fontWeight: 'bold',
              borderBottom: '2px solid #4a5568',
              paddingBottom: '12px',
              wordBreak: 'break-word',
              overflowWrap: 'break-word'
            }}>
              {document.title}
            </h1>
            <div style={{
              width: '100%',
              maxWidth: '100%',
              overflowWrap: 'break-word',
              wordBreak: 'break-word'
            }}>
              {editableBlocks.map(renderEditableBlock)}
            </div>
          </div>
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

      {isSelecting && selectedText && !editMode && (
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
