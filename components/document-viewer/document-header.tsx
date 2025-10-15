"use client"

import React from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ZoomIn, ZoomOut, Type, Copy, Check, Edit3 } from "lucide-react"
import { Document } from './types'

interface DocumentHeaderProps {
  document: Document
  zoomLevel: number
  isSelecting: boolean
  editMode: boolean
  copied: boolean
  selectedText: string
  onZoomIn: () => void
  onZoomOut: () => void
  onCopy: () => void
}

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({
  document,
  zoomLevel,
  isSelecting,
  editMode,
  copied,
  selectedText,
  onZoomIn,
  onZoomOut,
  onCopy,
}) => {
  return (
    <div className="bg-[#0a0a0a] border-b border-[#2a2a2a] p-3 flex flex-wrap items-center justify-between gap-2">
      {/* Zoom Controls */}
      <div className="flex items-center space-x-1 bg-[#1a1a1a] rounded-lg p-1 justify-center md:justify-start w-full md:w-auto mt-2 md:mt-0 mb-0 md:mb-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomOut}
          disabled={zoomLevel <= 50}
          className="text-gray-400 hover:text-white h-8 w-8 p-0"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-xs text-gray-400 px-2 min-w-[3rem] text-center">
          {zoomLevel}%
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onZoomIn}
          disabled={zoomLevel >= 150}
          className="text-gray-400 hover:text-white h-8 w-8 p-0"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
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
            <Type className="w-3 h-3 mr-1" />
            <span className="hidden sm:inline">Editing Mode</span>
            <span className="sm:hidden">Editing</span>
          </Badge>
        )}
        
        {isSelecting && !editMode && (
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
        )}
      </div>
    </div>
  )
}

