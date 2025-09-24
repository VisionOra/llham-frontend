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
  className = "hover:text-white cursor-pointer", 
  variant = "outline",
  size = "sm"
}: PdfExporterProps) {
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

  const handleExportHTML = async () => {
    if (!document || isExporting) return;
    setIsExporting(true);
    try {
      const htmlContent = `<!DOCTYPE html><html><head><meta charset='UTF-8'><title>${document.title}</title></head><body style='font-family: Arial, sans-serif; background: #fff; color: #000; padding: 32px; width: 100%; max-width: 900px; margin: 0 auto;'>
        <h1 style="color:#333;margin-top:20px;font-size:2.2em;font-weight:bold;border-bottom:2px solid #4a5568;padding-bottom:8px;">${document.title}</h1>
        <div style="color:#666;font-size:12px;margin-bottom:16px;">
          ${document.author ? `<div><strong>Author:</strong> ${document.author}</div>` : ''}
          ${document.created_at ? `<div><strong>Created:</strong> ${formatDate(document.created_at)}</div>` : ''}
          ${document.updated_at ? `<div><strong>Last Updated:</strong> ${formatDate(document.updated_at)}</div>` : ''}
        </div>
        <div style="font-size:14px;line-height:1.8;color:#000;">${processedContent}</div>
      </body></html>`;
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `${document.title ? document.title.replace(/[^a-zA-Z0-9]/g, "_") : "download"}.html`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('HTML export failed.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExportHTML}
      disabled={!document || isExporting}
      className={`hover:text-white cursor-pointer ${className}`}
    >
      <Download className="w-4 h-4 mr-1" />
      {isExporting ? "Exporting..." : "Export HTML"}
    </Button>
  )
}