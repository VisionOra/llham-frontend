import { useCallback } from 'react'
import { Document } from './types'
import { formatDate, htmlToMarkdown } from './utils'

export const useExportActions = (document: Document | null, processedContent: string) => {
  const handleExportMarkdown = useCallback(() => {
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
  }, [document, processedContent])

  const handleExportPDF = useCallback(() => {
    if (!document) return
    
    try {
      const htmlContent = `<!DOCTYPE html><html><head><meta charset='UTF-8'><title>${document.title}</title></head><body style='font-family: Arial, sans-serif; background: #fff; color: #000; padding: 32px; width: 100%; max-width: 900px; margin: 0 auto;'>
        <h1 style="color:#333;margin-top:20px;font-size:2.2em;font-weight:bold;border-bottom:2px solid #4a5568;padding-bottom:8px;">${document.title}</h1>
        <div style="color:#666;font-size:12px;margin-bottom:16px;">
          ${document.author ? `<div><strong>Author:</strong> ${document.author}</div>` : ''}
          ${document.created_at ? `<div><strong>Created:</strong> ${formatDate(document.created_at)}</div>` : ''}
          ${document.updated_at ? `<div><strong>Last Updated:</strong> ${formatDate(document.updated_at)}</div>` : ''}
        </div>
        <div style="font-size:14px;line-height:1.8;color:#000;">${processedContent}</div>
      </body></html>`
      
      const blob = new Blob([htmlContent], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement('a')
      a.href = url
      a.download = `${document.title ? document.title.replace(/[^a-zA-Z0-9]/g, "_") : "document"}.html`
      window.document.body.appendChild(a)
      a.click()
      window.document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('HTML export failed. Please try again.')
    }
  }, [document, processedContent])

  const handleShareWithNotion = useCallback(() => {
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
  }, [document, processedContent])

  return {
    handleExportMarkdown,
    handleExportPDF,
    handleShareWithNotion,
  }
}

