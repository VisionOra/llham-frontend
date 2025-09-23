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

interface PdfExporterProps {
  document: Document | null
  processedContent: string
  className?: string
  variant?: "outline" | "default" | "destructive" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

export function PdfExporter({ 
  document, 
  processedContent, 
  className = "", 
  variant = "outline",
  size = "sm"
}: PdfExporterProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportHTML = async () => {
    if (!document || isExporting) return
    setIsExporting(true)
    
    try {
      console.log('[PdfExporter] Exporting as HTML file...')
      
      // Create complete HTML document
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${document.title}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #000; 
            background: #fff;
            margin: 20px;
            max-width: 800px;
        }
        h1, h2, h3, h4, h5, h6 { color: #333; margin-top: 20px; }
        p { margin-bottom: 15px; }
        ul, ol { margin: 15px 0; padding-left: 30px; }
        li { margin-bottom: 5px; }
    </style>
</head>
<body>
    <h1>${document.title}</h1>
    ${processedContent}
</body>
</html>`

      const blob = new Blob([htmlContent], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      const a = window.document.createElement("a")
      a.href = url
      a.download = `${document.title.replace(/[^a-zA-Z0-9]/g, "_")}.html`
      a.click()
      URL.revokeObjectURL(url)
      
      console.log('[PdfExporter] HTML file downloaded successfully')
      
    } catch (error) {
      console.error('Error exporting HTML:', error)
      alert(`HTML export failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExportHTML}
      disabled={!document || isExporting}
      className={className}
    >
      <Download className="w-4 h-4 mr-1 text-white hover:text-white" />
      {isExporting ? "Exporting..." : "Export HTML"}
    </Button>
  )
}
