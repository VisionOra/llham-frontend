"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

interface Document {
  id?: string
  title: string
  content: string
  created_at?: string
  updated_at?: string
  author?: string
}

interface MarkdownExporterProps {
  document: Document | null
  processedContent: string
  className?: string
  variant?: "outline" | "default" | "destructive" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

export function MarkdownExporter({ 
  document, 
  processedContent, 
  className = "hover:text-white cursor-pointer", 
  variant = "outline",
  size = "sm"
}: MarkdownExporterProps) {
  const [isExporting, setIsExporting] = useState(false)

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
    // Create a temporary div to parse HTML
    const tempDiv = window.document.createElement('div')
    tempDiv.innerHTML = html
    
    // Remove script and style elements
    const scripts = tempDiv.querySelectorAll('script, style')
    scripts.forEach(el => el.remove())
    
    let markdown = ''
    
    // Process each element
    const processElement = (element: Element): string => {
      let result = ''
      
      // Handle different element types
      switch (element.tagName.toLowerCase()) {
        case 'h1':
          result += `# ${element.textContent?.trim() || ''}\n\n`
          break
        case 'h2':
          result += `## ${element.textContent?.trim() || ''}\n\n`
          break
        case 'h3':
          result += `### ${element.textContent?.trim() || ''}\n\n`
          break
        case 'h4':
          result += `#### ${element.textContent?.trim() || ''}\n\n`
          break
        case 'h5':
          result += `##### ${element.textContent?.trim() || ''}\n\n`
          break
        case 'h6':
          result += `###### ${element.textContent?.trim() || ''}\n\n`
          break
        case 'p':
          const pText = element.textContent?.trim() || ''
          if (pText) {
            result += `${pText}\n\n`
          }
          break
        case 'ul':
          const ulItems = Array.from(element.querySelectorAll('li'))
          ulItems.forEach(item => {
            result += `- ${item.textContent?.trim() || ''}\n`
          })
          result += '\n'
          break
        case 'ol':
          const olItems = Array.from(element.querySelectorAll('li'))
          olItems.forEach((item, index) => {
            result += `${index + 1}. ${item.textContent?.trim() || ''}\n`
          })
          result += '\n'
          break
        case 'li':
          // Handle nested lists
          const text = element.textContent?.trim() || ''
          if (text) {
            result += `- ${text}\n`
          }
          break
        case 'blockquote':
          const quoteText = element.textContent?.trim() || ''
          if (quoteText) {
            result += `> ${quoteText}\n\n`
          }
          break
        case 'strong':
        case 'b':
          result += `**${element.textContent?.trim() || ''}**`
          break
        case 'em':
        case 'i':
          result += `*${element.textContent?.trim() || ''}*`
          break
        case 'code':
          result += `\`${element.textContent?.trim() || ''}\``
          break
        case 'pre':
          const codeText = element.textContent?.trim() || ''
          if (codeText) {
            result += `\n\`\`\`\n${codeText}\n\`\`\`\n\n`
          }
          break
        case 'table':
          result += processTable(element)
          break
        case 'hr':
          result += '---\n\n'
          break
        case 'br':
          result += '\n'
          break
        default:
          // For other elements, just get the text content
          if (element.children.length === 0) {
            result += element.textContent || ''
          } else {
            // Process children
            Array.from(element.children).forEach(child => {
              result += processElement(child as Element)
            })
          }
      }
      
      return result
    }
    
    // Process table specifically
    const processTable = (table: Element): string => {
      let result = ''
      const rows = Array.from(table.querySelectorAll('tr'))
      
      rows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll('td, th'))
        const cellTexts = cells.map(cell => cell.textContent?.trim() || '')
        
        if (cellTexts.length > 0) {
          result += `| ${cellTexts.join(' | ')} |\n`
          
          // Add separator row after header
          if (rowIndex === 0) {
            const separator = cellTexts.map(() => '---').join(' | ')
            result += `| ${separator} |\n`
          }
        }
      })
      
      return result + '\n'
    }
    
    // Process all child elements
    Array.from(tempDiv.children).forEach(child => {
      markdown += processElement(child as Element)
    })
    
    // Clean up extra whitespace and line breaks
    markdown = markdown
      .replace(/\n{3,}/g, '\n\n') // Replace multiple line breaks with double
      .replace(/[ \t]+$/gm, '') // Remove trailing spaces
      .trim()
    
    return markdown
  }

  const handleExportMarkdown = async () => {
    if (!document || isExporting) return;
    setIsExporting(true);
    try {
      // Convert HTML content to Markdown
      const markdownContent = htmlToMarkdown(processedContent)
      
      // Create the full Markdown document with metadata
      const fullMarkdown = `# ${document.title}

**Author:** ${document.author || 'Unknown'}  
**Created:** ${formatDate(document.created_at)}  
**Last Updated:** ${formatDate(document.updated_at)}

---

${markdownContent}
`
      
      const blob = new Blob([fullMarkdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.title ? document.title.replace(/[^a-zA-Z0-9]/g, "_") : "document"}.md`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Markdown export failed:', error);
      alert('Markdown export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExportMarkdown}
      disabled={!document || isExporting}
      className={`hover:text-white cursor-pointer ${className}`}
    >
      <Download className="w-4 h-4 mr-1" />
      {isExporting ? "Exporting..." : "Export md"}
    </Button>
  )
}
