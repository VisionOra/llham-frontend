"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, Printer, Edit3, FileDown, Share2, FileCode, Copy, Check, Type } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { formatDate } from './utils'
import { Document } from './types'

interface DocumentToolbarProps {
  document: Document
  editMode: boolean
  isSelecting: boolean
  copied: boolean
  selectedText: string
  onToggleEdit: () => void
  onPrint: () => void
  onExportMarkdown: () => void
  onExportPDF: () => void
  onShareWithNotion: () => void
  onCopy: () => void
}

export const DocumentToolbar: React.FC<DocumentToolbarProps> = ({
  document,
  editMode,
  isSelecting,
  copied,
  selectedText,
  onToggleEdit,
  onPrint,
  onExportMarkdown,
  onExportPDF,
  onShareWithNotion,
  onCopy,
}) => {
  return (
    <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-[#2a2a2a] p-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Title Section */}
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          <FileText className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white break-words whitespace-normal">
              {document.title}
            </h2>
            <p className="text-xs text-gray-400">
              Last updated: {formatDate(document.updated_at)}
            </p>
          </div>
        </div>

        {/* Action Buttons Section */}
        <div className="flex flex-col gap-2 lg:flex-shrink-0">
          {/* Main Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrint}
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
                  onClick={onExportMarkdown}
                  className="text-gray-300 hover:text-white hover:bg-[#2a2a2a] cursor-pointer focus:bg-[#2a2a2a] focus:text-white"
                >
                  <FileCode className="w-4 h-4 mr-2" />
                  Export Markdown
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={onExportPDF}
                  className="text-gray-300 hover:text-white hover:bg-[#2a2a2a] cursor-pointer focus:bg-[#2a2a2a] focus:text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export HTML/PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#2a2a2a] my-1" />
                <DropdownMenuItem 
                  onClick={onShareWithNotion}
                  className="text-gray-300 hover:text-white hover:bg-[#2a2a2a] cursor-pointer focus:bg-[#2a2a2a] focus:text-white"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share with Notion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={onToggleEdit}
              disabled={isSelecting}
              className={editMode ? 'bg-green-600 hover:bg-green-700 cursor-pointer' : 'border-[#2a2a2a] text-black hover:text-white hover:bg-[#1a1a1a] cursor-pointer'}
            >
              <Edit3 className="w-4 h-4 mr-1" />
              {editMode ? 'Done' : 'Edit'}
            </Button>
          </div>

          {/* Status Badges and Copy Button Row */}
          {(editMode || (isSelecting && !editMode)) && (
            <div className="flex flex-wrap items-center gap-2">
              {editMode && (
                <Badge variant="secondary" className="bg-blue-900/50 text-blue-300 border-blue-700 text-xs">
                  <Type className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">Editing Mode</span>
                  <span className="sm:hidden">Editing</span>
                </Badge>
              )}
              
              {isSelecting && !editMode && (
                <>
                  <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700 text-xs">
                    <Edit3 className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">Text Selected</span>
                    <span className="sm:hidden">Selected</span>
                  </Badge>
                  
                  <Button
                    size="sm"
                    onClick={onCopy}
                    disabled={!selectedText}
                    className="bg-green-600 hover:bg-green-700 text-white border-0 text-xs h-7 px-3 font-medium shadow-md"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

