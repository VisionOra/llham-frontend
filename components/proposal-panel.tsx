"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { FileText, Edit, History, X, Save, Loader2 } from "lucide-react"
import { getProposalEdits, type ProposalEdit } from "@/lib/api"
import { DocumentNavigation } from "./document-navigation"
import { useProposalEditor } from "./use-proposal-editor"
import { ProposalEditHistory } from "./proposal-edit-history"
import { ProposalExporter } from "./proposal-exporter"

interface ProposalPanelProps {
  proposalHtml: string | null
  proposalTitle: string | null
  showProposalPanel: boolean
  onClose: () => void
  sessionId: string | null
  projectId: string | null
  sidebarWidth: number
  chatWidth: number
  proposalPanelWidth: number
  onProposalPanelWidthChange: (width: number) => void
  isResizingProposal: boolean
  onResizeStart: () => void
  onProposalHtmlUpdate?: (html: string) => void
  isLoading?: boolean
  forceFullWidth?: boolean
}

export function ProposalPanel({
  proposalHtml,
  proposalTitle,
  showProposalPanel,
  onClose,
  sessionId,
  projectId,
  sidebarWidth,
  chatWidth,
  proposalPanelWidth,
  onProposalPanelWidthChange,
  isResizingProposal,
  onResizeStart,
  onProposalHtmlUpdate,
  isLoading = false,
  forceFullWidth = false
}: ProposalPanelProps) {
  const [proposalEdits, setProposalEdits] = useState<ProposalEdit[]>([])
  const [loadingEdits, setLoadingEdits] = useState(false)
  const [showEditHistory, setShowEditHistory] = useState(false)
  const proposalContentRef = useRef<HTMLDivElement>(null)
  const [isNavigationOpen, setIsNavigationOpen] = useState(false) // Document navigation sidebar state

  // Load proposal edits
  const loadingEditsRef = useRef(false) // Track if edits are currently loading
  
  const loadProposalEdits = useCallback(async (sessionId: string) => {
    if (!sessionId) return
    
    // Prevent duplicate calls
    if (loadingEditsRef.current) {
      return
    }
    
    loadingEditsRef.current = true
    setLoadingEdits(true)
    try {
      const response = await getProposalEdits(sessionId, 1)
      setProposalEdits(response.results || [])
    } catch (error) {
      console.error("Error loading proposal edits:", error)
      setProposalEdits([])
    } finally {
      setLoadingEdits(false)
      loadingEditsRef.current = false
    }
  }, [])

  // Track if edits have been loaded for current session to prevent duplicate calls
  const editsLoadedRef = useRef<string | null>(null)

  // Use the proposal editor hook
  const editor = useProposalEditor({
    proposalHtml,
    sessionId,
    projectId,
    onProposalHtmlUpdate,
    onEditHistoryReload: () => {
      if (sessionId) {
        editsLoadedRef.current = null
        loadProposalEdits(sessionId)
      }
    },
    contentRef: proposalContentRef
  })

  // Load edits when proposal is shown
  useEffect(() => {
    if (showProposalPanel && sessionId && proposalHtml) {
      // Only load if we haven't loaded for this session yet
      if (editsLoadedRef.current !== sessionId) {
        editsLoadedRef.current = sessionId
        loadProposalEdits(sessionId)
      }
    } else if (!showProposalPanel) {
      // Reset when panel is closed
      editsLoadedRef.current = null
    }
  }, [showProposalPanel, sessionId, proposalHtml, loadProposalEdits])

  // Edit functionality is now handled by useProposalEditor hook (see use-proposal-editor.ts)
  // Export functionality is now handled by ProposalExporter component (see proposal-exporter.tsx)
  
  const handleClose = () => {
    setShowEditHistory(false)
    if (editor.isEditMode) {
      editor.handleToggleEditMode()
    }
    onClose()
  }

  if (!showProposalPanel) {
    return null
  }
  
  // Panel should show even if proposalHtml is null (will show loader)
  const panelWidth = forceFullWidth
    ? '100%'
    : `${proposalPanelWidth}px`

  return (
    <>
      {/* Mobile/Tablet: Full Screen Overlay */}
      <div
        className={`lg:hidden fixed inset-0 z-50 flex flex-col ${showProposalPanel ? 'block' : 'hidden'}`}
        style={{ backgroundColor: '#0A0A0A' }}
      >
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-800 shadow-sm flex-shrink-0" style={{ backgroundColor: '#0A0A0A' }}>
          <div className="flex-1 mr-2 sm:mr-3 min-w-0"></div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Export Button - Mobile */}
            <ProposalExporter proposalHtml={proposalHtml} proposalTitle={proposalTitle} />
            
            {/* Edit Mode Toggle Button - Mobile */}
            {!showEditHistory && (
              <>
                {editor.isEditMode ? (
                  <Button
                    onClick={editor.handleSaveChanges}
                    disabled={editor.isSaving}
                    size="sm"
                    className="text-white flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                    style={{ backgroundColor: '#008236' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009944'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#008236'}
                  >
                    {editor.isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={editor.handleToggleEditMode}
                    variant="outline"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-gray-900 border-gray-800 flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                  style={{ backgroundColor: '#0A0A0A' }}
                  >
                    <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                )}
                {editor.isEditMode && (
                  <Button
                    onClick={editor.handleToggleEditMode}
                    variant="outline"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-gray-900 border-gray-800 flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                  style={{ backgroundColor: '#0A0A0A' }}
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                )}
              </>
            )}
            
            {/* Edit History Button - Mobile */}
            <button
              onClick={() => {
                setShowEditHistory(!showEditHistory)
                if (showEditHistory && editor.isEditMode) {
                  editor.handleToggleEditMode()
                }
              }}
              className="text-gray-400 hover:text-white hover:bg-gray-900 rounded-full p-1.5 transition-colors flex-shrink-0"
              aria-label="Show edit history"
              title="Show edit history"
            >
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            
          </div>
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6" style={{ backgroundColor: '#0A0A0A' }}>
          <style dangerouslySetInnerHTML={{
            __html: `
              .proposal-panel-content {
                max-width: 100%;
                line-height: 1.6;
                word-wrap: break-word;
                overflow-wrap: break-word;
                word-break: break-word;
                font-size: 14px;
              }
              @media (min-width: 640px) {
                .proposal-panel-content {
                  font-size: 16px;
                  line-height: 1.7;
                }
              }
              .proposal-panel-content * {
                max-width: 100%;
                word-wrap: break-word;
                overflow-wrap: break-word;
              }
              .proposal-panel-content {
                color: #e5e7eb;
              }
              .proposal-panel-content h1 {
                color: #ffffff;
                font-size: 1.5rem;
                margin-top: 0;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 2px solid #008236;
              }
              @media (min-width: 640px) {
                .proposal-panel-content h1 {
                  font-size: 2rem;
                  margin-bottom: 1.5rem;
                  padding-bottom: 0.75rem;
                }
              }
              .proposal-panel-content h2 {
                font-size: 1.25rem;
                margin-top: 0;
                margin-bottom: 0;
              }
              @media (min-width: 640px) {
                .proposal-panel-content h2 {
                  font-size: 1.5rem;
                  margin-top: 0;
                  margin-bottom: 0;
                }
              }
              .proposal-panel-content h3 {
                font-size: 1.1rem;
                margin-top: 0;
                margin-bottom: 0;
              }
              @media (min-width: 640px) {
                .proposal-panel-content h3 {
                  font-size: 1.25rem;
                  margin-top: 0;
                  margin-bottom: 0;
                }
              }
              .proposal-panel-content p {
                margin-bottom: 1rem;
              }
              @media (min-width: 640px) {
                .proposal-panel-content p {
                  margin-bottom: 1.25rem;
                }
              }
              .proposal-panel-content table {
                max-width: 100%;
                table-layout: fixed;
                font-size: 0.875rem;
              }
              @media (min-width: 640px) {
                .proposal-panel-content table {
                  font-size: 1rem;
                }
              }
              .proposal-panel-content img {
                max-width: 100%;
                height: auto;
              }
              .proposal-panel-content ul {
                padding-left: 1.25rem;
                margin-bottom: 1rem;
                list-style-type: disc;
                list-style-position: outside;
              }
              .proposal-panel-content ol {
                padding-left: 1.25rem;
                margin-bottom: 1rem;
                list-style-type: decimal;
                list-style-position: outside;
              }
              .proposal-panel-content li {
                display: list-item;
              }
              @media (min-width: 640px) {
                .proposal-panel-content ul, .proposal-panel-content ol {
                  padding-left: 1.5rem;
                  margin-bottom: 1.5rem;
                }
              }
            `
          }} />
          {showEditHistory ? (
            <ProposalEditHistory
              proposalEdits={proposalEdits}
              loadingEdits={loadingEdits}
              onClose={() => setShowEditHistory(false)}
            />
          ) : (
            <>
              {editor.isEditMode && (
                <div className="mb-3 text-sm bg-blue-900/30 border border-blue-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-400">✏️ Edit mode active - You can now edit the content directly</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-blue-800">
                    <div className="flex items-center gap-2">
                      <label htmlFor="replace-all-toggle" className="text-blue-300 text-xs cursor-pointer">
                        Replace All Occurrences
                      </label>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${editor.replaceAll ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {editor.replaceAll ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <Switch
                      id="replace-all-toggle"
                      checked={editor.replaceAll}
                      onCheckedChange={editor.setReplaceAll}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-500"
                    />
                  </div>
                </div>
              )}
              {isLoading || (!proposalHtml && !editor.previewHtml) ? (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                    <p className="text-gray-400">Loading proposal...</p>
                  </div>
                </div>
              ) : (
                <div
                  ref={proposalContentRef}
                  className="proposal-panel-content w-full"
                  contentEditable={editor.isEditMode && !editor.isPreviewMode}
                  suppressContentEditableWarning={true}
                  style={{ 
                    userSelect: editor.isEditMode && !editor.isPreviewMode ? 'text' : 'text',
                    cursor: editor.isEditMode && !editor.isPreviewMode ? 'text' : 'text',
                    outline: editor.isEditMode && !editor.isPreviewMode ? '1px solid #3b82f6' : 'none',
                    outlineOffset: editor.isEditMode && !editor.isPreviewMode ? '4px' : '0',
                    minHeight: editor.isEditMode && !editor.isPreviewMode ? '200px' : 'auto',
                    padding: editor.isEditMode && !editor.isPreviewMode ? '8px' : '0'
                  }}
                  dangerouslySetInnerHTML={{ __html: (editor.isPreviewMode && editor.previewHtml) ? editor.previewHtml : (proposalHtml || '') }}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Desktop: Side Panel */}
      <div
        className={`hidden lg:flex flex-col h-full border-l border-gray-800 shadow-xl relative ${!isResizingProposal ? 'transition-all duration-200' : ''} min-w-0`}
        style={{ 
          backgroundColor: '#1A1A1A',
          width: panelWidth, 
          maxWidth: '100%',
          minWidth: '300px'
        }}
      >
        {/* Panel Header - Fixed at top */}
        <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5.5 border-b border-gray-800 shadow-sm min-w-0 flex-shrink-0" style={{ backgroundColor: '#0A0A0A' }}>
          {/* Left side - Navigation Toggle Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <Button
              onClick={() => setIsNavigationOpen(!isNavigationOpen)}
              variant="outline"
              size="sm"
              className="text-gray-300 hover:text-white hover:bg-gray-900 border-gray-800 flex-shrink-0 h-7 sm:h-7 px-3 sm:px-3 rounded-full"
              style={{ backgroundColor: '#0A0A0A' }}
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
              <span className="hidden sm:inline">Table of contents</span>
            </Button>
          </div>
          
          {/* Right side - Action buttons */}
          <div className="flex-1 min-w-0 mr-2 sm:mr-3"></div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Edit Mode Toggle Button */}
            {!showEditHistory && (
              <>
                {editor.isEditMode ? (
                  <Button
                    onClick={editor.handleSaveChanges}
                    disabled={editor.isSaving}
                    size="sm"
                    className="text-white flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                    style={{ backgroundColor: '#008236' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009944'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#008236'}
                  >
                    {editor.isSaving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 animate-spin" />
                        <span className="hidden sm:inline">Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                        <span className="hidden sm:inline">Save</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={editor.handleToggleEditMode}
                    variant="outline"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-gray-900 border-gray-800 flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                  style={{ backgroundColor: '#0A0A0A' }}
                  >
                    <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                )}
                {editor.isEditMode && (
                  <Button
                    onClick={editor.handleToggleEditMode}
                    variant="outline"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-gray-900 border-gray-800 flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                  style={{ backgroundColor: '#0A0A0A' }}
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                )}
              </>
            )}
            
            {/* Edit History Button */}
            <button
              onClick={() => {
                setShowEditHistory(!showEditHistory)
                if (showEditHistory && editor.isEditMode) {
                  editor.handleToggleEditMode()
                }
              }}
              className="text-gray-400 hover:text-white hover:bg-gray-900 rounded-full p-1.5 transition-colors flex-shrink-0"
              aria-label="Show edit history"
              title="Show edit history"
            >
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            
            {/* Export Button */}
            <ProposalExporter proposalHtml={proposalHtml} proposalTitle={proposalTitle} />
            
          </div>
        </div>

        {/* Content Area Below Header - Contains Navigation and Main Content */}
        <div className="flex-1 flex min-w-0 overflow-hidden">
          {/* Document Navigation Sidebar - Below Header */}
          {isNavigationOpen && (
            <DocumentNavigation
              htmlContent={(editor.isPreviewMode && editor.previewHtml) ? editor.previewHtml : proposalHtml}
              title={proposalTitle}
              isOpen={isNavigationOpen}
              onToggle={() => setIsNavigationOpen(!isNavigationOpen)}
            />
          )}
          
          {/* Desktop Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8" style={{ backgroundColor: '#0A0A0A' }}>
          <style dangerouslySetInnerHTML={{
            __html: `
              .proposal-panel-content {
                max-width: 100%;
                line-height: 1.7;
                word-wrap: break-word;
                overflow-wrap: break-word;
                word-break: break-word;
              }
              .proposal-panel-content * {
                max-width: 100%;
                word-wrap: break-word;
                overflow-wrap: break-word;
              }
              .proposal-panel-content table {
                max-width: 100%;
                table-layout: fixed;
              }
              .proposal-panel-content img {
                max-width: 100%;
                height: auto;
              }
              .proposal-panel-content {
                color: #e5e7eb;
              }
              .proposal-panel-content h1 {
                color: #ffffff;
                font-size: 2rem;
                font-weight: 700;
                margin-top: 0;
                margin-bottom: 1.5rem;
                padding-bottom: 0.75rem;
                border-bottom: 2px solid #008236;
              }
              .proposal-panel-content h2 {
                color: #f3f4f6;
                font-size: 1.5rem;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 0;
                padding-top: 0;
              }
              .proposal-panel-content h3 {
                color: #e5e7eb;
                font-size: 1.25rem;
                font-weight: 600;
                margin-top: 0;
                margin-bottom: 0;
              }
              .proposal-panel-content h4 {
                color: #d1d5db;
                font-size: 1.1rem;
                font-weight: 600;
                margin-top: 1.25rem;
                margin-bottom: 0.5rem;
              }
              .proposal-panel-content p {
                color: #d1d5db;
                margin-bottom: 1.25rem;
                line-height: 1.8;
              }
              .proposal-panel-content ul {
                color: #d1d5db;
                margin-bottom: 1.5rem;
                padding-left: 1.5rem;
                list-style-type: disc;
                list-style-position: outside;
              }
              .proposal-panel-content ol {
                color: #d1d5db;
                margin-bottom: 1.5rem;
                padding-left: 1.5rem;
                list-style-type: decimal;
                list-style-position: outside;
              }
              .proposal-panel-content li {
                color: #d1d5db;
                margin-bottom: 0.75rem;
                line-height: 1.7;
                display: list-item;
              }
              .proposal-panel-content strong {
                color: #ffffff;
                font-weight: 600;
              }
              .proposal-panel-content a {
                color: #60a5fa;
                text-decoration: underline;
                transition: color 0.2s;
              }
              .proposal-panel-content a:hover {
                color: #93c5fd;
              }
              .proposal-panel-content table {
                color: #d1d5db;
                border-collapse: collapse;
                width: 100%;
                margin-bottom: 1.5rem;
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                border-radius: 0.5rem;
                overflow: hidden;
              }
              .proposal-panel-content th, .proposal-panel-content td {
                border: 1px solid #1a1a1a;
                padding: 0.75rem;
                text-align: left;
              }
              .proposal-panel-content th {
                background-color: #0a0a0a;
                color: #ffffff;
                font-weight: 600;
              }
              .proposal-panel-content tr:nth-child(even) {
                background-color: #0a0a0a;
              }
              .proposal-panel-content tr:hover {
                background-color: #1a1a1a;
              }
              .proposal-panel-content section {
                margin-bottom: 2rem;
              }
              .proposal-panel-content .agent-section {
                background-color: #0a0a0a;
                padding: 1.5rem;
                border-radius: 0.75rem;
                margin-bottom: 1.5rem;
                border-left: 4px solid #008236;
              }
            `
          }} />
          {showEditHistory ? (
            <ProposalEditHistory
              proposalEdits={proposalEdits}
              loadingEdits={loadingEdits}
              onClose={() => setShowEditHistory(false)}
            />
          ) : (
            <>
              {editor.isEditMode && (
                <div className="mb-3 text-sm bg-blue-900/30 border border-blue-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-400">✏️ Edit mode active - You can now edit the content directly</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-blue-800">
                    <div className="flex items-center gap-2">
                      <label htmlFor="replace-all-toggle-desktop" className="text-blue-300 text-xs cursor-pointer">
                        Replace All Occurrences
                      </label>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${editor.replaceAll ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {editor.replaceAll ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <Switch
                      id="replace-all-toggle-desktop"
                      checked={editor.replaceAll}
                      onCheckedChange={editor.setReplaceAll}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-500"
                    />
                  </div>
                </div>
              )}
              {isLoading || (!proposalHtml && !editor.previewHtml) ? (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                    <p className="text-gray-400">Loading proposal...</p>
                  </div>
                </div>
              ) : (
                <div
                  ref={proposalContentRef}
                  className="proposal-panel-content w-full"
                  contentEditable={editor.isEditMode && !editor.isPreviewMode}
                  suppressContentEditableWarning={true}
                  style={{ 
                    userSelect: editor.isEditMode && !editor.isPreviewMode ? 'text' : 'text',
                    cursor: editor.isEditMode && !editor.isPreviewMode ? 'text' : 'text',
                    outline: editor.isEditMode && !editor.isPreviewMode ? '2px solid #3b82f6' : 'none',
                    outlineOffset: editor.isEditMode && !editor.isPreviewMode ? '4px' : '0',
                    minHeight: editor.isEditMode && !editor.isPreviewMode ? '200px' : 'auto',
                    padding: editor.isEditMode && !editor.isPreviewMode ? '8px' : '0'
                  }}
                  dangerouslySetInnerHTML={{ __html: (editor.isPreviewMode && editor.previewHtml) ? editor.previewHtml : (proposalHtml || '') }}
                />
              )}
            </>
          )}
          </div>
        </div>
      </div>
    </>
  )
}
