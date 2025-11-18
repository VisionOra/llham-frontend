"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Download, FileText, FileCode, FileType, Edit, History, X, Save, Loader2, FileEdit, Check } from "lucide-react"
import { getProposalEdits, editProposedHtml, type ProposalEdit, type EditProposedHtmlRequest } from "@/lib/api"
import { toast } from "sonner"

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
  const [isEditMode, setIsEditMode] = useState(false)
  const [originalProposalHtml, setOriginalProposalHtml] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [replaceAll, setReplaceAll] = useState(false) // Default to false (off)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [pendingEditData, setPendingEditData] = useState<EditProposedHtmlRequest | null>(null)
  const [previewResponse, setPreviewResponse] = useState<any>(null) // Store full preview response for inline controls
  const proposalContentRef = useRef<HTMLDivElement>(null)

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

  // Toggle edit mode
  const handleToggleEditMode = useCallback(() => {
    if (!isEditMode) {
      // Entering edit mode - save original HTML
      setOriginalProposalHtml(proposalHtml)
    } else {
      // Exiting edit mode - restore original if not saved
      if (originalProposalHtml) {
        // Restore original HTML
        if (proposalContentRef.current) {
          proposalContentRef.current.innerHTML = originalProposalHtml
        }
      }
      setOriginalProposalHtml(null)
    }
    setIsEditMode(!isEditMode)
  }, [isEditMode, proposalHtml, originalProposalHtml])

  // Extract plain text from HTML
  const extractText = (html: string): string => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    return tempDiv.textContent || tempDiv.innerText || ''
  }

  // Extract sections from HTML with section IDs
  const extractSections = (html: string): Map<string, { html: string; text: string; identifier: string; sectionId?: string }> => {
    const sections = new Map<string, { html: string; text: string; identifier: string; sectionId?: string }>()
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    
    // Find all sections with agent-section class or data-section attribute
    const sectionElements = tempDiv.querySelectorAll('.agent-section, [data-section], section, [data-section-id]')
    
    sectionElements.forEach((element, index) => {
      const sectionHtml = element.outerHTML
      const sectionText = extractText(sectionHtml)
      
      // Get section ID from data-section-id attribute (for API)
      const sectionId = (element as HTMLElement).getAttribute('data-section-id')
      
      // Get section identifier from data-section attribute or class or h3/h2 text
      let identifier = (element as HTMLElement).getAttribute('data-section') || 
                      (element.classList.contains('agent-section') ? 
                        (element.querySelector('h3, h2')?.textContent?.trim() || `Section ${index + 1}`) : 
                        (element.querySelector('h3, h2, h1')?.textContent?.trim() || `Section ${index + 1}`))
      
      if (!identifier || identifier === '') {
        identifier = `Section ${index + 1}`
      }
      
      sections.set(identifier, { html: sectionHtml, text: sectionText, identifier, sectionId: sectionId || undefined })
    })
    
    // If no sections found, treat entire document as one section
    if (sections.size === 0) {
      sections.set('Full Proposal', { html, text: extractText(html), identifier: 'Full Proposal' })
    }
    
    return sections
  }

  // Find exact text differences between two strings
  const findTextDifferences = (originalText: string, newText: string): Array<{ original: string; new: string }> => {
    const differences: Array<{ original: string; new: string }> = []
    
    // If texts are identical, no differences
    if (originalText === newText) {
      return differences
    }
    
    // Handle case where newText is empty or whitespace (text deletion)
    if (!newText.trim()) {
      // If new text is empty, the entire original text was deleted
      if (originalText.trim()) {
        differences.push({
          original: originalText.trim(),
          new: ""
        })
      }
      return differences
    }
    
    // Handle case where originalText is empty (text addition)
    if (!originalText.trim()) {
      differences.push({
        original: "",
        new: newText.trim()
      })
      return differences
    }
    
    // Find the longest common prefix
    let prefixEnd = 0
    while (prefixEnd < originalText.length && prefixEnd < newText.length && 
           originalText[prefixEnd] === newText[prefixEnd]) {
      prefixEnd++
    }
    
    // Find the longest common suffix
    let suffixStart = 0
    while (suffixStart < (originalText.length - prefixEnd) && 
           suffixStart < (newText.length - prefixEnd) &&
           originalText[originalText.length - 1 - suffixStart] === newText[newText.length - 1 - suffixStart]) {
      suffixStart++
    }
    
    // Extract the changed portion
    const originalDiffStart = prefixEnd
    const originalDiffEnd = originalText.length - suffixStart
    const newDiffStart = prefixEnd
    const newDiffEnd = newText.length - suffixStart
    
    // Find word boundaries around the changed portion
    // For original text: find word start before diff and word end after diff
    let originalWordStart = originalDiffStart
    let originalWordEnd = originalDiffEnd
    
    // Move back to find word start (non-word character or start of string)
    while (originalWordStart > 0 && /\w/.test(originalText[originalWordStart - 1])) {
      originalWordStart--
    }
    
    // Move forward to find word end (non-word character or end of string)
    while (originalWordEnd < originalText.length && /\w/.test(originalText[originalWordEnd])) {
      originalWordEnd++
    }
    
    // For new text: find word start before diff and word end after diff
    let newWordStart = newDiffStart
    let newWordEnd = newDiffEnd
    
    // Move back to find word start
    while (newWordStart > 0 && /\w/.test(newText[newWordStart - 1])) {
      newWordStart--
    }
    
    // Move forward to find word end
    while (newWordEnd < newText.length && /\w/.test(newText[newWordEnd])) {
      newWordEnd++
    }
    
    // Extract full words
    const originalFullWord = originalText.substring(originalWordStart, originalWordEnd).trim()
    const newFullWord = newText.substring(newWordStart, newWordEnd).trim()
    
    // Calculate what was actually deleted/added
    // The original diff portion is what was in original but not in new
    const originalDiff = originalText.substring(originalDiffStart, originalDiffEnd).trim()
    // The new diff portion is what is in new but not in original
    const newDiff = newText.substring(newDiffStart, newDiffEnd).trim()
    
    // Check if this is a pure deletion (text removed, nothing added)
    // This happens when originalDiff has content but newDiff is empty
    if (originalDiff && !newDiff) {
      // Pure deletion: the text between prefix and suffix was deleted
      // Use the original diff (the deleted portion) with empty new text
      differences.push({ 
        original: originalFullWord || originalDiff,
        new: ""
      })
    } else if (!originalDiff && newDiff) {
      // Pure addition: new text was added where there was nothing
      differences.push({
        original: "",
        new: newFullWord || newDiff
      })
    } else if (originalDiff && newDiff) {
      // Replacement: text was changed (both original and new have content)
      // Use the full words to capture the complete change
      differences.push({ 
        original: originalFullWord || originalDiff, 
        new: newFullWord || newDiff
      })
    } else if (originalFullWord && originalFullWord !== newFullWord) {
      // Fallback: use word boundaries if diff calculation didn't work
      differences.push({ 
        original: originalFullWord, 
        new: newFullWord || "" 
      })
    }
    
    return differences
  }

  // Save changes using the new edit endpoint - section-wise
  const handleSaveChanges = useCallback(async () => {
    if (!sessionId || !projectId || !proposalContentRef.current || !proposalHtml) {
      toast.error("Cannot save changes", {
        description: "Missing required information.",
        duration: 3000,
      })
      return
    }

    setIsSaving(true)
    try {
      // Get the current HTML content from the editable div
      const updatedHtml = proposalContentRef.current.innerHTML
      
      // Find what changed by comparing with original
      const originalHtml = originalProposalHtml || proposalHtml
      
      // Extract sections from both versions
      const originalSections = extractSections(originalHtml)
      const updatedSections = extractSections(updatedHtml)
      
      // Find changed sections and their specific text differences
      const textChanges: Array<{ identifier: string; sectionId?: string; originalText: string; newText: string }> = []
      
      // Check all sections in updated version
      updatedSections.forEach((updatedSection, identifier) => {
        const originalSection = originalSections.get(identifier)
        
        if (!originalSection) {
          // New section added - skip for now as we need original text to replace
          // We can't replace something that doesn't exist
          return
        } else if (originalSection.text.trim() !== updatedSection.text.trim()) {
          // Section changed - find specific text differences
          const differences = findTextDifferences(originalSection.text, updatedSection.text)
          
          // For each difference, create a separate edit request
          differences.forEach(diff => {
            // Always include the change, even if newText is empty (for deletions)
            if (diff.original.trim()) {
              textChanges.push({
                identifier,
                sectionId: updatedSection.sectionId,
                originalText: diff.original.trim(),
                newText: diff.new ? diff.new.trim() : "" // Ensure empty string for deletions
              })
            }
          })
        }
      })
      
      // Check for deleted sections
      originalSections.forEach((originalSection, identifier) => {
        if (!updatedSections.has(identifier) && originalSection.text.trim()) {
          // Section deleted - we can't handle this with replace, so skip
          return
        }
      })
      
      // If no changes detected
      if (textChanges.length === 0) {
        setIsEditMode(false)
        setOriginalProposalHtml(null)
        toast.info("No changes detected", {
          description: "The content hasn't been modified.",
          duration: 3000,
        })
        return
      }
      
      // Process each text change
      let totalReplacements = 0
      let lastResponse: any = null
      let hasSuccessfulSave = false
      
      for (const change of textChanges) {
        if (!change.originalText.trim() && !change.newText.trim()) {
          continue // Skip empty changes
        }
        
        // Determine if this is a remove operation (new_text is empty)
        const isRemove = !change.newText.trim()
        
        // Determine which case this is based on replaceAll and isRemove
        // Case 1: Replace Text - All Sections (Preview)
        //   - apply_to_all_sections: true, confirm: false, new_text: "..."
        // Case 2: Remove Text - All Sections
        //   - apply_to_all_sections: true, confirm: true, new_text: ""
        // Case 3: Remove Text - Specific Sections
        //   - apply_to_all_sections: false, confirm: false, new_text: "", section_ids: [...]
        // Case 4: Replace Text - Specific Sections
        //   - apply_to_all_sections: false, confirm: true, new_text: "...", section_ids: [...]
        
        let editData: EditProposedHtmlRequest
        
        if (replaceAll && !isRemove) {
          // Case 1: Replace Text - All Sections (Preview)
          editData = {
            original_text: change.originalText,
            new_text: change.newText,
            apply_to_all_sections: true,
            confirm: false
          }
        } else if (replaceAll && isRemove) {
          // Case 2: Remove Text - All Sections
          editData = {
            original_text: change.originalText,
            new_text: "",
            apply_to_all_sections: true,
            confirm: true
          }
        } else if (!replaceAll && isRemove) {
          // Case 3: Remove Text - Specific Sections
          editData = {
            original_text: change.originalText,
            new_text: "",
            section_ids: change.sectionId ? [change.sectionId] : [],
            apply_to_all_sections: false,
            confirm: false
          }
        } else {
          // Case 4: Replace Text - Specific Sections
          editData = {
            original_text: change.originalText,
            new_text: change.newText,
            section_ids: change.sectionId ? [change.sectionId] : [],
            apply_to_all_sections: false,
            confirm: true
          }
        }
        

        
        try {
          const response = await editProposedHtml(projectId, sessionId, editData)
          
          // Handle response based on confirm flag
          // Cases 1 & 3: confirm: false -> Show preview
          // Cases 2 & 4: confirm: true -> Apply changes directly
          if (editData.confirm === false && response.preview_mode && response.preview_html) {
            // Case 1 or 3: Show preview instead of applying changes
            setPreviewHtml(response.preview_html)
            setIsPreviewMode(true)
            setPendingEditData(editData)
            setPreviewResponse(response) // Store full response for inline controls
            toast.info("Preview generated", {
              description: response.message || "Review the changes and confirm to apply them.",
              duration: 5000,
            })
            return // Don't continue with other changes if preview mode
          }
          
          // Cases 2 & 4: confirm: true -> Apply changes directly
          if (editData.confirm === true && response.html_content) {
            hasSuccessfulSave = true
            totalReplacements += response.replacements_count || 0
            lastResponse = response
            
            // Update the proposal HTML immediately
            if (onProposalHtmlUpdate) {
              onProposalHtmlUpdate(response.html_content)
            } else if (proposalContentRef.current) {
              proposalContentRef.current.innerHTML = response.html_content
            }
            
            // Exit edit mode immediately to hide save button
            setOriginalProposalHtml(null)
            setIsEditMode(false)
          } else if (response.html_content) {
            // Fallback: if html_content is present, apply it
            hasSuccessfulSave = true
            totalReplacements += response.replacements_count || 0
            lastResponse = response
            
            if (onProposalHtmlUpdate) {
              onProposalHtmlUpdate(response.html_content)
            } else if (proposalContentRef.current) {
              proposalContentRef.current.innerHTML = response.html_content
            }
            
            setOriginalProposalHtml(null)
            setIsEditMode(false)
          } else {
            // No html_content, just track the response
            totalReplacements += response.replacements_count || 0
            lastResponse = response
          }
        } catch (error) {
          console.error(`Error saving change in section ${change.identifier}:`, error)
          const errorMessage = error instanceof Error ? error.message : "Failed to save changes. Please try again."
          toast.error("Failed to save change", {
            description: errorMessage,
            duration: 5000,
          })
          // Continue with other changes even if one fails
        }
      }
      
      // If we didn't exit edit mode during the loop, exit it now if we got a successful response
      // (This is a fallback in case state update didn't work during the loop)
      if (hasSuccessfulSave) {
        // Already exited during loop, but ensure it's set
        setOriginalProposalHtml(null)
        setIsEditMode(false)
      } else if (lastResponse?.html_content) {
        // Fallback: Update HTML and exit edit mode if we have html_content
        if (onProposalHtmlUpdate) {
        onProposalHtmlUpdate(lastResponse.html_content)
        } else if (proposalContentRef.current) {
        proposalContentRef.current.innerHTML = lastResponse.html_content
      }
      setOriginalProposalHtml(null)
      setIsEditMode(false)
      }
      
      // Reload edits (reset ref so it can reload)
      editsLoadedRef.current = null
      await loadProposalEdits(sessionId)
      editsLoadedRef.current = sessionId
      
      // Show success toast with original and new text
      const firstChange = textChanges.length > 0 ? textChanges[0] : null
      let message = ""
      
      if (firstChange) {
        const originalText = firstChange.originalText.length > 50 
          ? firstChange.originalText.substring(0, 50) + '...' 
          : firstChange.originalText
        const newText = firstChange.newText.length > 50 
          ? firstChange.newText.substring(0, 50) + '...' 
          : firstChange.newText
        
        message = `Successfully changed from '${originalText}' to '${newText}'`
        if (totalReplacements > 0) {
          message += ` (${totalReplacements} occurrence(s) replaced)`
        }
        if (textChanges.length > 1) {
          message += ` and ${textChanges.length - 1} more change(s)`
        }
      } else {
        message = totalReplacements > 0
        ? `${textChanges.length} text change(s) made with ${totalReplacements} total replacement(s)`
        : `${textChanges.length} text change(s) made`
      }
      
      toast.success("Changes saved successfully!", {
        description: message,
        duration: 4000,
      })
    } catch (error) {
      console.error("Error saving changes:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save changes. Please try again."
      toast.error("Failed to save changes", {
        description: errorMessage,
        duration: 5000,
      })
    } finally {
      setIsSaving(false)
    }
  }, [sessionId, projectId, proposalHtml, originalProposalHtml, loadProposalEdits, onProposalHtmlUpdate, replaceAll])

  // Confirm preview changes
  const handleConfirmPreview = useCallback(async () => {
    if (!sessionId || !projectId || !pendingEditData) {
      return
    }

    setIsSaving(true)
    try {
      // Call edit endpoint again with confirm: true
      const confirmData = { ...pendingEditData, confirm: true }
      const response = await editProposedHtml(projectId, sessionId, confirmData)
      
      // Apply the changes
      if (response.html_content && onProposalHtmlUpdate) {
        onProposalHtmlUpdate(response.html_content)
      } else if (response.html_content && proposalContentRef.current) {
        proposalContentRef.current.innerHTML = response.html_content
      }
      
      // Clear preview mode
      setPreviewHtml(null)
      setIsPreviewMode(false)
      setPendingEditData(null)
      setOriginalProposalHtml(null)
      setIsEditMode(false)
      
      // Reload edits
      editsLoadedRef.current = null
      await loadProposalEdits(sessionId)
      editsLoadedRef.current = sessionId
      
      // Format original and new text for toast message
      const originalText = pendingEditData.original_text.length > 50 
        ? pendingEditData.original_text.substring(0, 50) + '...' 
        : pendingEditData.original_text
      const newText = pendingEditData.new_text.length > 50 
        ? pendingEditData.new_text.substring(0, 50) + '...' 
        : pendingEditData.new_text
      const replacementsCount = response.replacements_count || 0
      
      let description = `Successfully changed from '${originalText}' to '${newText}'`
      if (replacementsCount > 0) {
        description += ` (${replacementsCount} occurrence(s) replaced)`
      }
      
      toast.success("Changes applied successfully!", {
        description: description,
        duration: 4000,
      })
    } catch (error) {
      console.error("Error confirming preview:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to apply changes. Please try again."
      toast.error("Failed to apply changes", {
        description: errorMessage,
        duration: 5000,
      })
    } finally {
      setIsSaving(false)
    }
  }, [sessionId, projectId, pendingEditData, onProposalHtmlUpdate, loadProposalEdits])

  // Cancel preview and return to original
  const handleCancelPreview = useCallback(() => {
    setPreviewHtml(null)
    setIsPreviewMode(false)
    setPendingEditData(null)
    setPreviewResponse(null)
    toast.info("Preview cancelled", {
      description: "Returned to original proposal.",
      duration: 3000,
    })
  }, [])

  // Process preview HTML and add inline controls for changes
  useEffect(() => {
    if (!isPreviewMode || !previewHtml || !previewResponse?.diff_preview || !proposalContentRef.current) {
      return
    }

    // Wait for DOM to update after HTML is rendered
    const timeoutId = setTimeout(() => {
      const container = proposalContentRef.current
      if (!container) return

      const diffPreview = previewResponse.diff_preview
    
    if (!diffPreview || diffPreview.length === 0) {
      return
    }

    // Extract original_text and new_text from pendingEditData
    const originalText = pendingEditData?.original_text || ''
    const newText = pendingEditData?.new_text || ''

    // Process each diff and add inline controls
    diffPreview.forEach((diff: {occurrence: number, before: string, after: string}, index: number) => {
      const { before, after } = diff
      
      // Extract the changed text from brackets [text]
      const extractChangedText = (pattern: string): string => {
        const match = pattern.match(/\[([^\]]+)\]/)
        return match ? match[1] : ''
      }
      
      // Get actual text to search for
      const beforeText = extractChangedText(before) || originalText
      const afterText = extractChangedText(after) || newText
      
      if (!beforeText || !afterText) return
      
      // Find all instances of the new text in the container
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      )
      
      const textNodes: Text[] = []
      let node
      while (node = walker.nextNode()) {
        if (node.textContent?.includes(afterText)) {
          textNodes.push(node as Text)
        }
      }
      
      // Process only the first text node that contains this change (to avoid highlighting all occurrences)
      let processed = false
      textNodes.forEach((textNode) => {
        if (processed) return // Only process first occurrence
        
        const parent = textNode.parentElement
        if (!parent || parent.classList.contains('diff-container')) return
        
        const text = textNode.textContent || ''
        if (!text.includes(afterText)) return
        
        // Find first occurrence only
        const firstIndex = text.indexOf(afterText)
        if (firstIndex === -1) return
        
        // Create unique ID for this diff
        const diffId = `diff-${index}-${Date.now()}-${Math.random()}`
        
        // Create fragment with only first occurrence highlighted
        const fragment = document.createDocumentFragment()
        
        // Add text before the match
        if (firstIndex > 0) {
          fragment.appendChild(document.createTextNode(text.substring(0, firstIndex)))
        }
        
        // Create inline control container for the matched text
        const diffContainer = document.createElement('span')
        diffContainer.className = 'diff-container'
        diffContainer.setAttribute('data-diff-id', diffId)
        diffContainer.setAttribute('data-before', beforeText)
        diffContainer.setAttribute('data-after', afterText)
        diffContainer.style.cssText = 'position: relative; display: inline-block; margin: 0 2px;'
        
        // Highlighted new text
        const newTextSpan = document.createElement('span')
        newTextSpan.className = 'diff-new'
        newTextSpan.textContent = afterText
        newTextSpan.style.cssText = 'background-color: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 500;'
        
        // Inline controls
        const controlsSpan = document.createElement('span')
        controlsSpan.className = 'diff-actions'
        controlsSpan.style.cssText = 'position: absolute; top: -28px; right: 0; display: flex; gap: 4px; z-index: 1000; background: rgba(0,0,0,0.9); padding: 4px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);'
        
        // Accept button
        const acceptBtn = document.createElement('button')
        acceptBtn.className = 'diff-accept'
        acceptBtn.setAttribute('data-diff-id', diffId)
        acceptBtn.setAttribute('data-before', beforeText)
        acceptBtn.setAttribute('data-after', afterText)
        acceptBtn.innerHTML = '✓'
        acceptBtn.title = 'Accept change'
        acceptBtn.style.cssText = 'background-color: #10b981; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; font-weight: bold; transition: opacity 0.2s; min-width: 28px;'
        acceptBtn.onmouseenter = () => { acceptBtn.style.opacity = '0.8' }
        acceptBtn.onmouseleave = () => { acceptBtn.style.opacity = '1' }
        
        // Reject button
        const rejectBtn = document.createElement('button')
        rejectBtn.className = 'diff-reject'
        rejectBtn.setAttribute('data-diff-id', diffId)
        rejectBtn.setAttribute('data-before', beforeText)
        rejectBtn.setAttribute('data-after', afterText)
        rejectBtn.innerHTML = '✕'
        rejectBtn.title = 'Reject change'
        rejectBtn.style.cssText = 'background-color: #ef4444; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px; font-weight: bold; transition: opacity 0.2s; min-width: 28px;'
        rejectBtn.onmouseenter = () => { rejectBtn.style.opacity = '0.8' }
        rejectBtn.onmouseleave = () => { rejectBtn.style.opacity = '1' }
        
        controlsSpan.appendChild(acceptBtn)
        controlsSpan.appendChild(rejectBtn)
        diffContainer.appendChild(newTextSpan)
        diffContainer.appendChild(controlsSpan)
        fragment.appendChild(diffContainer)
        
        // Add text after the match
        const remainingText = text.substring(firstIndex + afterText.length)
        if (remainingText) {
          fragment.appendChild(document.createTextNode(remainingText))
        }
        
        // Replace the text node with the fragment
        if (parent) {
          parent.replaceChild(fragment, textNode)
          processed = true // Mark as processed to avoid processing more nodes
        }
      })
    })

    // Add event listeners for accept/reject buttons
    const handleAccept = async (e: Event) => {
      const button = e.target as HTMLElement
      const diffId = button.getAttribute('data-diff-id')
      const before = button.getAttribute('data-before')
      const after = button.getAttribute('data-after')
      
      if (!diffId || !before || !after || !sessionId || !projectId) return

      e.stopPropagation()
      e.preventDefault()
      
      try {
        setIsSaving(true)
        // Call edit endpoint with confirm: true for this specific change
        // Case 2 or 4: Apply changes (confirm: true)
        const confirmData: EditProposedHtmlRequest = {
          original_text: before,
          new_text: after || "", // Ensure empty string if after is empty
          apply_to_all_sections: true, // Apply to all sections for inline confirm
          confirm: true
        }
        
        const response = await editProposedHtml(projectId, sessionId, confirmData)
        
        if (response.html_content && onProposalHtmlUpdate) {
          onProposalHtmlUpdate(response.html_content)
        } else if (response.html_content && container) {
          container.innerHTML = response.html_content
        }
        
        // Clear preview mode
        setPreviewHtml(null)
        setIsPreviewMode(false)
        setPendingEditData(null)
        setPreviewResponse(null)
        
        // Exit edit mode to hide save/cancel buttons
        setOriginalProposalHtml(null)
        setIsEditMode(false)
        
        // Reload edits to get the latest edit history
        editsLoadedRef.current = null
        await loadProposalEdits(sessionId)
        editsLoadedRef.current = sessionId
        
        // Format original and new text for toast message
        const originalText = before.length > 50 ? before.substring(0, 50) + '...' : before
        const newText = after.length > 50 ? after.substring(0, 50) + '...' : after
        const replacementsCount = response.replacements_count || 0
        
        let description = `Successfully changed from '${originalText}' to '${newText}'`
        if (replacementsCount > 0) {
          description += ` (${replacementsCount} occurrence(s) replaced)`
        }
        
        toast.success("Change applied successfully!", {
          description: description,
          duration: 4000,
        })
      } catch (error) {
        console.error("Error accepting change:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to apply change. Please try again."
        toast.error("Failed to apply change", {
          description: errorMessage,
          duration: 5000,
        })
      } finally {
        setIsSaving(false)
      }
    }

    const handleReject = (e: Event) => {
      const button = e.target as HTMLElement
      const diffId = button.getAttribute('data-diff-id')
      const before = button.getAttribute('data-before')
      const after = button.getAttribute('data-after')
      
      if (!diffId || !before || !after || !container) return

      e.stopPropagation()
      e.preventDefault()
      
      // Find the diff container and replace new text with original
      const diffContainer = container.querySelector(`[data-diff-id="${diffId}"]`)
      if (diffContainer && diffContainer.parentElement) {
        diffContainer.parentElement.replaceChild(document.createTextNode(before), diffContainer)
      }
      
      toast.info("Change rejected", {
        description: "The change has been reverted to the original text.",
        duration: 3000,
      })
    }

      // Attach event listeners
      const acceptButtons = container.querySelectorAll('.diff-accept')
      const rejectButtons = container.querySelectorAll('.diff-reject')
      
      acceptButtons.forEach(btn => {
        btn.addEventListener('click', handleAccept)
      })
      
      rejectButtons.forEach(btn => {
        btn.addEventListener('click', handleReject)
      })
    }, 100) // Small delay to ensure DOM is updated

    // Cleanup
    return () => {
      clearTimeout(timeoutId)
      const container = proposalContentRef.current
      if (container) {
        const acceptButtons = container.querySelectorAll('.diff-accept')
        const rejectButtons = container.querySelectorAll('.diff-reject')
        // Note: We can't remove listeners here as handleAccept/Reject are scoped inside timeout
        // But this is okay as the component will unmount or re-render when preview mode changes
      }
    }
  }, [isPreviewMode, previewHtml, previewResponse, pendingEditData, sessionId, projectId, onProposalHtmlUpdate, loadProposalEdits])

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

  // Export functions
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
      // Don't add title prefix since proposalHtml already contains h1 with title
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

  // HTML to formatted text converter for Google Docs (preserves structure)
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
    
    // Clean up extra whitespace
    formattedText = formattedText.replace(/\n{3,}/g, '\n\n')
    
    return formattedText.trim()
  }

  const handleExportGoogleDocs = async () => {
    if (!proposalHtml || !proposalTitle) return
    
    try {
      // Convert HTML to formatted text (proposalHtml already contains title in h1)
      const formattedText = htmlToFormattedText(proposalHtml)
      // Don't add title prefix since proposalHtml already contains it
      const fullText = formattedText
      
      // Create a data URI with HTML content for better formatting
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
      
      // Copy formatted text to clipboard
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([fullText], { type: 'text/plain' }),
        'text/html': new Blob([htmlContent], { type: 'text/html' })
      })
      
      await navigator.clipboard.write([clipboardItem])
      
      // Open Google Docs in new tab
      const googleDocsUrl = 'https://docs.google.com/document/create'
      const newWindow = window.open(googleDocsUrl, '_blank')
      
      if (newWindow) {
        // Wait a bit for Google Docs to load, then try to paste
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
      
      // Fallback: try plain text clipboard
      try {
        const formattedText = htmlToFormattedText(proposalHtml)
        // Don't add title prefix since proposalHtml already contains it
        const fullText = formattedText
        
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(fullText)
        } else {
          // Fallback to older method
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

  const handleClose = () => {
    setShowEditHistory(false)
    setIsEditMode(false)
    setOriginalProposalHtml(null)
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-gray-300 hover:text-white flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                  style={{ 
                    backgroundColor: 'transparent',
                    borderColor: '#178236'
                  }}
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" style={{ backgroundColor: '#0A0A0A' }} className="border-gray-800">
                <DropdownMenuItem
                  onClick={handleExportPDF}
                  className="cursor-pointer text-gray-300"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#008236'
                    e.currentTarget.style.color = 'white'
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = ''
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = ''
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportHTML}
                  className="cursor-pointer text-gray-300"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#008236'
                    e.currentTarget.style.color = 'white'
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = ''
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = ''
                  }}
                >
                  <FileCode className="w-4 h-4 mr-2" />
                  Export as HTML
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportMD}
                  className="cursor-pointer text-gray-300"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#008236'
                    e.currentTarget.style.color = 'white'
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = ''
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = ''
                  }}
                >
                  <FileType className="w-4 h-4 mr-2" />
                  Export as Markdown
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportGoogleDocs}
                  className="cursor-pointer text-gray-300"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#008236'
                    e.currentTarget.style.color = 'white'
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = ''
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = ''
                  }}
                >
                  <FileEdit className="w-4 h-4 mr-2" />
                  Export to Google Docs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Edit Mode Toggle Button - Mobile */}
            {!showEditHistory && (
              <>
                {isEditMode ? (
                  <Button
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    size="sm"
                    className="text-white flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                    style={{ backgroundColor: '#008236' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009944'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#008236'}
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleToggleEditMode}
                    variant="outline"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-gray-900 border-gray-800 flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                  style={{ backgroundColor: '#0A0A0A' }}
                  >
                    <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                )}
                {isEditMode && (
                  <Button
                    onClick={handleToggleEditMode}
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
                if (showEditHistory && isEditMode) {
                  setIsEditMode(false)
                  if (originalProposalHtml && proposalContentRef.current) {
                    proposalContentRef.current.innerHTML = originalProposalHtml
                    setOriginalProposalHtml(null)
                  }
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
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Edit History</h3>
                <button
                  onClick={() => setShowEditHistory(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {loadingEdits ? (
                <div className="text-center py-8 text-gray-400">Loading edits...</div>
              ) : proposalEdits.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No edits yet. Use Edit button to make changes.</div>
              ) : (
                <div className="space-y-4">
                  {proposalEdits.map((edit) => (
                    <div key={edit.id} className="border border-gray-800 rounded-lg p-4" style={{ backgroundColor: '#0A0A0A' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">{edit.section_identifier}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          edit.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          edit.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {edit.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-300 mb-2">
                        <strong>Original:</strong> {edit.original_content.substring(0, 100)}...
                      </div>
                      <div className="text-sm text-gray-300 mb-2">
                        <strong>Proposed:</strong> {edit.proposed_content.substring(0, 100)}...
                      </div>
                      {edit.edit_reason && (
                        <div className="text-xs text-gray-400 mt-2">
                          <strong>Reason:</strong> {edit.edit_reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {isEditMode && (
                <div className="mb-3 text-sm bg-blue-900/30 border border-blue-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-400">✏️ Edit mode active - You can now edit the content directly</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-blue-800">
                    <div className="flex items-center gap-2">
                      <label htmlFor="replace-all-toggle" className="text-blue-300 text-xs cursor-pointer">
                        Replace All Occurrences
                      </label>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${replaceAll ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {replaceAll ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <Switch
                      id="replace-all-toggle"
                      checked={replaceAll}
                      onCheckedChange={setReplaceAll}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-500"
                    />
                  </div>
                </div>
              )}
              {isLoading || (!proposalHtml && !previewHtml) ? (
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
                  contentEditable={isEditMode && !isPreviewMode}
                  suppressContentEditableWarning={true}
                  style={{ 
                    userSelect: isEditMode && !isPreviewMode ? 'text' : 'text',
                    cursor: isEditMode && !isPreviewMode ? 'text' : 'text',
                    outline: isEditMode && !isPreviewMode ? '1px solid #3b82f6' : 'none',
                    outlineOffset: isEditMode && !isPreviewMode ? '4px' : '0',
                    minHeight: isEditMode && !isPreviewMode ? '200px' : 'auto',
                    padding: isEditMode && !isPreviewMode ? '8px' : '0'
                  }}
                  dangerouslySetInnerHTML={{ __html: (isPreviewMode && previewHtml) ? previewHtml : (proposalHtml || '') }}
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
        {/* Panel Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5.5 border-b border-gray-800 shadow-sm min-w-0 flex-shrink-0" style={{ backgroundColor: '#0A0A0A' }}>
          <div className="flex-1 min-w-0 mr-2 sm:mr-3"></div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Edit Mode Toggle Button */}
            {!showEditHistory && (
              <>
                {isEditMode ? (
                  <Button
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    size="sm"
                    className="text-white flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                    style={{ backgroundColor: '#008236' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#009944'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#008236'}
                  >
                    {isSaving ? (
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
                    onClick={handleToggleEditMode}
                    variant="outline"
                    size="sm"
                    className="text-gray-300 hover:text-white hover:bg-gray-900 border-gray-800 flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3"
                  style={{ backgroundColor: '#0A0A0A' }}
                  >
                    <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                )}
                {isEditMode && (
                  <Button
                    onClick={handleToggleEditMode}
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
                if (showEditHistory && isEditMode) {
                  setIsEditMode(false)
                  if (originalProposalHtml && proposalContentRef.current) {
                    proposalContentRef.current.innerHTML = originalProposalHtml
                    setOriginalProposalHtml(null)
                  }
                }
              }}
              className="text-gray-400 hover:text-white hover:bg-gray-900 rounded-full p-1.5 transition-colors flex-shrink-0"
              aria-label="Show edit history"
              title="Show edit history"
            >
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            
            {/* Export Button */}
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
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" style={{ backgroundColor: '#0A0A0A' }} className="border-gray-800">
                <DropdownMenuItem
                  onClick={handleExportPDF}
                  className="cursor-pointer text-gray-300"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#008236'
                    e.currentTarget.style.color = 'white'
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = ''
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = ''
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportHTML}
                  className="cursor-pointer text-gray-300"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#008236'
                    e.currentTarget.style.color = 'white'
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = ''
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = ''
                  }}
                >
                  <FileCode className="w-4 h-4 mr-2" />
                  Export as HTML
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportMD}
                  className="cursor-pointer text-gray-300"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#008236'
                    e.currentTarget.style.color = 'white'
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = ''
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = ''
                  }}
                >
                  <FileType className="w-4 h-4 mr-2" />
                  Export as Markdown
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportGoogleDocs}
                  className="cursor-pointer text-gray-300"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#008236'
                    e.currentTarget.style.color = 'white'
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.color = ''
                    const icon = e.currentTarget.querySelector('svg')
                    if (icon) icon.style.color = ''
                  }}
                >
                  <FileEdit className="w-4 h-4 mr-2" />
                  Export to Google Docs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
          </div>
        </div>

        {/* Panel Content */}
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
            <div className="spacey-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Edit History</h3>
                <button
                  onClick={() => setShowEditHistory(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {loadingEdits ? (
                <div className="text-center py-8 text-gray-400">Loading edits...</div>
              ) : proposalEdits.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No edits yet. Use Edit button to make changes.</div>
              ) : (
                <div className="space-y-4">
                  {proposalEdits.map((edit) => (
                    <div key={edit.id} className="border border-gray-800 rounded-lg p-4" style={{ backgroundColor: '#0A0A0A' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-300">{edit.section_identifier}</span>
                        <span className={`text-xs px-2 py-1 rounded ${
                          edit.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          edit.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {edit.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-300 mb-2">
                        <strong>Original:</strong> {edit.original_content.substring(0, 100)}...
                      </div>
                      <div className="text-sm text-gray-300 mb-2">
                        <strong>Proposed:</strong> {edit.proposed_content.substring(0, 100)}...
                      </div>
                      {edit.edit_reason && (
                        <div className="text-xs text-gray-400 mt-2">
                          <strong>Reason:</strong> {edit.edit_reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {isEditMode && (
                <div className="mb-3 text-sm bg-blue-900/30 border border-blue-700 rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-400">✏️ Edit mode active - You can now edit the content directly</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-blue-800">
                    <div className="flex items-center gap-2">
                      <label htmlFor="replace-all-toggle" className="text-blue-300 text-xs cursor-pointer">
                        Replace All Occurrences
                      </label>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${replaceAll ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {replaceAll ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <Switch
                      id="replace-all-toggle"
                      checked={replaceAll}
                      onCheckedChange={setReplaceAll}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-500"
                    />
                  </div>
                </div>
              )}
              {isLoading || (!proposalHtml && !previewHtml) ? (
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
                  contentEditable={isEditMode && !isPreviewMode}
                  suppressContentEditableWarning={true}
                  style={{ 
                    userSelect: isEditMode && !isPreviewMode ? 'text' : 'text',
                    cursor: isEditMode && !isPreviewMode ? 'text' : 'text',
                    outline: isEditMode && !isPreviewMode ? '2px solid #3b82f6' : 'none',
                    outlineOffset: isEditMode && !isPreviewMode ? '4px' : '0',
                    minHeight: isEditMode && !isPreviewMode ? '200px' : 'auto',
                    padding: isEditMode && !isPreviewMode ? '8px' : '0'
                  }}
                  dangerouslySetInnerHTML={{ __html: (isPreviewMode && previewHtml) ? previewHtml : (proposalHtml || '') }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

