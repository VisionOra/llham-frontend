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

  const handleExportPDF = async () => {
    if (!document || isExporting) return;
    setIsExporting(true);
    try {
          const jsPDFModule = await import("jspdf");
          const pdf = new jsPDFModule.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      // Create a temporary div with your HTML and styles
      const tempDiv = window.document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-10000px';
      tempDiv.style.top = '0';
      tempDiv.style.background = '#fff';
      tempDiv.style.color = '#000';
      tempDiv.style.padding = '32px';
      tempDiv.style.width = '1122px'; // A4 at 144dpi
      tempDiv.style.fontFamily = 'Arial, sans-serif';
      tempDiv.style.zIndex = '9999';
      tempDiv.innerHTML = `
        <h1 style="color:#333;margin-top:20px;font-size:2.2em;font-weight:bold;border-bottom:2px solid #4a5568;padding-bottom:8px;">${document.title}</h1>
        <div style="color:#666;font-size:12px;margin-bottom:16px;">
          ${document.author ? `<div><strong>Author:</strong> ${document.author}</div>` : ''}
          ${document.created_at ? `<div><strong>Created:</strong> ${formatDate(document.created_at)}</div>` : ''}
          ${document.updated_at ? `<div><strong>Last Updated:</strong> ${formatDate(document.updated_at)}</div>` : ''}
        </div>
        <div style="font-size:14px;line-height:1.8;color:#000;">${processedContent}</div>
      `;
      window.document.body.appendChild(tempDiv);
      await pdf.html(tempDiv, {
        callback: function (doc) {
          doc.save(`${document.title ? document.title.replace(/[^a-zA-Z0-9]/g, "_") : "download"}.pdf`);
          window.document.body.removeChild(tempDiv);
          setIsExporting(false);
        },
        margin: [10, 10, 10, 10],
        autoPaging: 'text',
        x: 0,
        y: 0,
        width: 180, // mm (A4 width)
            html2canvas: {
              scale: 2,
              useCORS: true,
              backgroundColor: '#fff',
              windowWidth: 1122
            }
      });
    } catch (error) {
      console.error('Text-based PDF export failed:', error);
      // Fallback: Download as HTML file
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
      } catch (htmlError) {
        alert('PDF and HTML export both failed.');
      }
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExportPDF}
      disabled={!document || isExporting}
      className={className}
    >
      <Download className="w-4 h-4 mr-1" />
      {isExporting ? "Exporting..." : "Export Html"}
    </Button>
  )
}
