"use client"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Download, FileText, FileCode, FileType, FileEdit } from "lucide-react"
import { toast } from "sonner"

interface ProposalExporterProps {
  proposalHtml: string | null
  proposalTitle: string | null
}

export function ProposalExporter({
  proposalHtml,
  proposalTitle
}: ProposalExporterProps) {
  // HTML to Markdown converter
  const htmlToMarkdown = (html: string): string => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
    const processElement = (element: Element | Node): string => {
      if (element.nodeType === Node.TEXT_NODE) {
        return element.textContent || ''
      }
      
      if (element.nodeType !== Node.ELEMENT_NODE) return ''
      
      const el = element as Element
      const tagName = el.tagName.toLowerCase()
      const textContent = el.textContent || ''
      
      switch (tagName) {
        case 'h1': return `# ${textContent}\n\n`
        case 'h2': return `## ${textContent}\n\n`
        case 'h3': return `### ${textContent}\n\n`
        case 'h4': return `#### ${textContent}\n\n`
        case 'p': return `${textContent}\n\n`
        case 'strong':
        case 'b': return `**${textContent}**`
        case 'em':
        case 'i': return `*${textContent}*`
        case 'ul':
        case 'ol': {
          const items = Array.from(el.children)
          return items.map((item, idx) => 
            tagName === 'ol' ? `${idx + 1}. ${item.textContent || ''}\n` : `- ${item.textContent || ''}\n`
          ).join('') + '\n'
        }
        case 'li': return el.textContent || ''
        case 'a': {
          const href = el.getAttribute('href') || ''
          return `[${textContent}](${href})`
        }
        case 'code': return `\`${textContent}\``
        case 'pre': return `\`\`\`\n${textContent}\n\`\`\`\n\n`
        case 'br': return '\n'
        case 'hr': return '---\n\n'
        case 'table': {
          const rows = Array.from(el.querySelectorAll('tr'))
          if (rows.length === 0) return ''
          
          let markdown = '\n'
          rows.forEach((row, rowIdx) => {
            const cells = Array.from(row.querySelectorAll('td, th'))
            const cellTexts = cells.map(cell => cell.textContent?.trim() || '')
            markdown += `| ${cellTexts.join(' | ')} |\n`
            
            if (rowIdx === 0) {
              markdown += `| ${cellTexts.map(() => '---').join(' | ')} |\n`
            }
          })
          return markdown + '\n'
        }
        default: {
          const children = Array.from(el.childNodes)
          return children.map(processElement).join('')
        }
      }
    }
    
    const children = Array.from(tempDiv.childNodes)
    return children.map(processElement).join('').trim()
  }

  // HTML to formatted text converter for Google Docs
  const htmlToFormattedText = (html: string): string => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
    let formattedText = ''
    
    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || ''
      }
      
      if (node.nodeType !== Node.ELEMENT_NODE) return ''
      
      const el = node as Element
      const tagName = el.tagName.toLowerCase()
      const textContent = el.textContent || ''
      
      switch (tagName) {
        case 'h1':
          return `\n${textContent.trim()}\n${'='.repeat(textContent.trim().length)}\n\n`
        case 'h2':
          return `\n${textContent.trim()}\n${'-'.repeat(textContent.trim().length)}\n\n`
        case 'h3':
          return `\n${textContent.trim().toUpperCase()}\n\n`
        case 'h4':
          return `\n${textContent.trim()}\n\n`
        case 'p':
          return `${textContent.trim()}\n\n`
        case 'strong':
        case 'b':
          return `**${textContent.trim()}**`
        case 'em':
        case 'i':
          return `*${textContent.trim()}*`
        case 'ul':
        case 'ol': {
          const items = Array.from(el.children)
          return items.map((item, idx) => 
            tagName === 'ol' ? `${idx + 1}. ${item.textContent?.trim() || ''}\n` : `• ${item.textContent?.trim() || ''}\n`
          ).join('') + '\n'
        }
        case 'li':
          return el.textContent?.trim() || ''
        case 'br':
          return '\n'
        case 'hr':
          return '\n' + '-'.repeat(50) + '\n\n'
        case 'table': {
          const rows = Array.from(el.querySelectorAll('tr'))
          if (rows.length === 0) return ''
          
          let tableText = '\n'
          rows.forEach((row) => {
            const cells = Array.from(row.querySelectorAll('td, th'))
            const cellTexts = cells.map(cell => (cell.textContent?.trim() || '').replace(/\|/g, '│'))
            tableText += `| ${cellTexts.join(' | ')} |\n`
          })
          return tableText + '\n'
        }
        case 'div':
        case 'section':
        case 'article': {
          const children = Array.from(el.childNodes)
          return children.map(processNode).join('')
        }
        default: {
          const children = Array.from(el.childNodes)
          return children.map(processNode).join('')
        }
      }
    }
    
    const children = Array.from(tempDiv.childNodes)
    formattedText = children.map(processNode).join('')
    
    formattedText = formattedText.replace(/\n{3,}/g, '\n\n')
    
    return formattedText.trim()
  }

  const handleExportPDF = () => {
    if (!proposalHtml || !proposalTitle) return
    
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) return
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${proposalTitle}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
              h1 { color: #111827; font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.75rem; }
              h2 { color: #1f2937; font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 1rem; }
              h3 { color: #374151; font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
              p { color: #4b5563; margin-bottom: 1.25rem; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }
              th, td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; }
              th { background-color: #f9fafb; font-weight: 600; }
              @media print {
                body { margin: 0; padding: 20px; }
              }
            </style>
          </head>
          <body>
            ${proposalHtml}
          </body>
        </html>
      `)
      
      printWindow.document.close()
      
      setTimeout(() => {
        printWindow.print()
      }, 250)
    } catch (error) {
      console.error('PDF export failed:', error)
      toast.error("Export failed", {
        description: "PDF export failed. Please try again.",
        duration: 4000,
      })
    }
  }

  const handleExportHTML = () => {
    if (!proposalHtml || !proposalTitle) return
    
    try {
      const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>${proposalTitle}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; max-width: 900px; margin: 0 auto; }
      h1 { color: #111827; font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.75rem; }
      h2 { color: #1f2937; font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 1rem; }
      h3 { color: #374151; font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
      p { color: #4b5563; margin-bottom: 1.25rem; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }
      th, td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; }
      th { background-color: #f9fafb; font-weight: 600; }
    </style>
  </head>
  <body>
    ${proposalHtml}
  </body>
</html>`
      
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${proposalTitle.replace(/[^a-zA-Z0-9]/g, "_")}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('HTML export failed:', error)
      toast.error("Export failed", {
        description: "HTML export failed. Please try again.",
        duration: 4000,
      })
    }
  }

  const handleExportMD = () => {
    if (!proposalHtml || !proposalTitle) return
    
    try {
      const markdownContent = htmlToMarkdown(proposalHtml)
      const fullMarkdown = markdownContent
      
      const blob = new Blob([fullMarkdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${proposalTitle.replace(/[^a-zA-Z0-9]/g, "_")}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Markdown export failed:', error)
      toast.error("Export failed", {
        description: "Markdown export failed. Please try again.",
        duration: 4000,
      })
    }
  }

  const handleExportGoogleDocs = async () => {
    if (!proposalHtml || !proposalTitle) return
    
    try {
      const formattedText = htmlToFormattedText(proposalHtml)
      const fullText = formattedText
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${proposalTitle}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; max-width: 900px; margin: 0 auto; }
    h1 { color: #111827; font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.75rem; }
    h2 { color: #1f2937; font-size: 1.5rem; font-weight: 600; margin-top: 2rem; margin-bottom: 1rem; }
    h3 { color: #374151; font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.75rem; }
    p { color: #4b5563; margin-bottom: 1.25rem; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }
    th, td { border: 1px solid #e5e7eb; padding: 0.75rem; text-align: left; }
    th { background-color: #f9fafb; font-weight: 600; }
  </style>
</head>
<body>
  ${proposalHtml}
</body>
</html>`
      
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([fullText], { type: 'text/plain' }),
        'text/html': new Blob([htmlContent], { type: 'text/html' })
      })
      
      await navigator.clipboard.write([clipboardItem])
      
      const googleDocsUrl = 'https://docs.google.com/document/create'
      const newWindow = window.open(googleDocsUrl, '_blank')
      
      if (newWindow) {
        setTimeout(() => {
          toast.success("Content copied to clipboard!", {
            description: "Content is ready! Press Ctrl+V (Cmd+V on Mac) in Google Docs to paste.",
            duration: 6000,
          })
        }, 1000)
      } else {
        toast.info("Please allow popups", {
          description: "Content copied! Open Google Docs manually and paste (Ctrl+V / Cmd+V).",
          duration: 5000,
        })
      }
    } catch (error) {
      console.error('Google Docs export failed:', error)
      
      try {
        const formattedText = htmlToFormattedText(proposalHtml)
        const fullText = formattedText
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(fullText)
        } else {
          const textArea = document.createElement('textarea')
          textArea.value = fullText
          textArea.style.position = 'fixed'
          textArea.style.opacity = '0'
          textArea.style.left = '-9999px'
          document.body.appendChild(textArea)
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
        }
        
        const googleDocsUrl = 'https://docs.google.com/document/create'
        window.open(googleDocsUrl, '_blank')
        
        toast.success("Content copied to clipboard!", {
          description: "Press Ctrl+V (Cmd+V on Mac) in Google Docs to paste your content.",
          duration: 6000,
        })
      } catch (fallbackError) {
        console.error('Fallback export failed:', fallbackError)
        toast.error("Export failed", {
          description: "Failed to copy content. Please try again or check browser permissions.",
          duration: 5000,
        })
      }
    }
  }

  const menuItemStyle = {
    onMouseEnter: (e: React.MouseEvent<HTMLDivElement>) => {
      e.currentTarget.style.backgroundColor = '#008236'
      e.currentTarget.style.color = 'white'
      const icon = e.currentTarget.querySelector('svg')
      if (icon) icon.style.color = 'white'
    },
    onMouseLeave: (e: React.MouseEvent<HTMLDivElement>) => {
      e.currentTarget.style.backgroundColor = 'transparent'
      e.currentTarget.style.color = ''
      const icon = e.currentTarget.querySelector('svg')
      if (icon) icon.style.color = ''
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-gray-300 hover:text-white flex-shrink-0"
          style={{ 
            backgroundColor: 'transparent',
            borderColor: '#178236'
          }}
        >
          <Download className="w-4 h-4 mr-1.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" style={{ backgroundColor: '#0A0A0A' }} className="border-gray-800">
        <DropdownMenuItem
          onClick={handleExportPDF}
          className="cursor-pointer text-gray-300"
          {...menuItemStyle}
        >
          <FileText className="w-4 h-4 mr-2" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleExportHTML}
          className="cursor-pointer text-gray-300"
          {...menuItemStyle}
        >
          <FileCode className="w-4 h-4 mr-2" />
          Export as HTML
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleExportMD}
          className="cursor-pointer text-gray-300"
          {...menuItemStyle}
        >
          <FileType className="w-4 h-4 mr-2" />
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleExportGoogleDocs}
          className="cursor-pointer text-gray-300"
          {...menuItemStyle}
        >
          <FileEdit className="w-4 h-4 mr-2" />
          Export to Google Docs
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

