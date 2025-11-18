"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { editProposedHtml, type EditProposedHtmlRequest } from "@/lib/api"
import { toast } from "sonner"

interface UseProposalEditorProps {
  proposalHtml: string | null
  sessionId: string | null
  projectId: string | null
  onProposalHtmlUpdate?: (html: string) => void
  onEditHistoryReload?: () => void
  contentRef: React.RefObject<HTMLDivElement>
}

export function useProposalEditor({
  proposalHtml,
  sessionId,
  projectId,
  onProposalHtmlUpdate,
  onEditHistoryReload,
  contentRef
}: UseProposalEditorProps) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [originalProposalHtml, setOriginalProposalHtml] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [replaceAll, setReplaceAll] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [pendingEditData, setPendingEditData] = useState<EditProposedHtmlRequest | null>(null)
  const [previewResponse, setPreviewResponse] = useState<any>(null)

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
    
    const sectionElements = tempDiv.querySelectorAll('.agent-section, [data-section], section, [data-section-id]')
    
    sectionElements.forEach((element, index) => {
      const sectionHtml = element.outerHTML
      const sectionText = extractText(sectionHtml)
      const sectionId = (element as HTMLElement).getAttribute('data-section-id')
      
      let identifier = (element as HTMLElement).getAttribute('data-section') || 
                      (element.classList.contains('agent-section') ? 
                        (element.querySelector('h3, h2')?.textContent?.trim() || `Section ${index + 1}`) : 
                        (element.querySelector('h3, h2, h1')?.textContent?.trim() || `Section ${index + 1}`))
      
      if (!identifier || identifier === '') {
        identifier = `Section ${index + 1}`
      }
      
      sections.set(identifier, { html: sectionHtml, text: sectionText, identifier, sectionId: sectionId || undefined })
    })
    
    if (sections.size === 0) {
      sections.set('Full Proposal', { html, text: extractText(html), identifier: 'Full Proposal' })
    }
    
    return sections
  }

  // Find exact text differences between two strings
  const findTextDifferences = (originalText: string, newText: string): Array<{ original: string; new: string }> => {
    const differences: Array<{ original: string; new: string }> = []
    
    if (originalText === newText) {
      return differences
    }
    
    if (!newText.trim()) {
      if (originalText.trim()) {
        differences.push({
          original: originalText.trim(),
          new: ""
        })
      }
      return differences
    }
    
    if (!originalText.trim()) {
      differences.push({
        original: "",
        new: newText.trim()
      })
      return differences
    }
    
    let prefixEnd = 0
    while (prefixEnd < originalText.length && prefixEnd < newText.length && 
           originalText[prefixEnd] === newText[prefixEnd]) {
      prefixEnd++
    }
    
    let suffixStart = 0
    while (suffixStart < (originalText.length - prefixEnd) && 
           suffixStart < (newText.length - prefixEnd) &&
           originalText[originalText.length - 1 - suffixStart] === newText[newText.length - 1 - suffixStart]) {
      suffixStart++
    }
    
    const originalDiffStart = prefixEnd
    const originalDiffEnd = originalText.length - suffixStart
    const newDiffStart = prefixEnd
    const newDiffEnd = newText.length - suffixStart
    
    let originalWordStart = originalDiffStart
    let originalWordEnd = originalDiffEnd
    
    while (originalWordStart > 0 && /\w/.test(originalText[originalWordStart - 1])) {
      originalWordStart--
    }
    
    while (originalWordEnd < originalText.length && /\w/.test(originalText[originalWordEnd])) {
      originalWordEnd++
    }
    
    let newWordStart = newDiffStart
    let newWordEnd = newDiffEnd
    
    while (newWordStart > 0 && /\w/.test(newText[newWordStart - 1])) {
      newWordStart--
    }
    
    while (newWordEnd < newText.length && /\w/.test(newText[newWordEnd])) {
      newWordEnd++
    }
    
    const originalFullWord = originalText.substring(originalWordStart, originalWordEnd).trim()
    const newFullWord = newText.substring(newWordStart, newWordEnd).trim()
    
    const originalDiff = originalText.substring(originalDiffStart, originalDiffEnd).trim()
    const newDiff = newText.substring(newDiffStart, newDiffEnd).trim()
    
    if (originalDiff && !newDiff) {
      differences.push({ 
        original: originalFullWord || originalDiff,
        new: ""
      })
    } else if (!originalDiff && newDiff) {
      differences.push({
        original: "",
        new: newFullWord || newDiff
      })
    } else if (originalDiff && newDiff) {
      differences.push({ 
        original: originalFullWord || originalDiff, 
        new: newFullWord || newDiff
      })
    } else if (originalFullWord && originalFullWord !== newFullWord) {
      differences.push({ 
        original: originalFullWord, 
        new: newFullWord || "" 
      })
    }
    
    return differences
  }

  // Toggle edit mode
  const handleToggleEditMode = useCallback(() => {
    if (!isEditMode) {
      setOriginalProposalHtml(proposalHtml)
    } else {
      if (originalProposalHtml && contentRef.current) {
        contentRef.current.innerHTML = originalProposalHtml
      }
      setOriginalProposalHtml(null)
    }
    setIsEditMode(!isEditMode)
  }, [isEditMode, proposalHtml, originalProposalHtml, contentRef])

  // Save changes
  const handleSaveChanges = useCallback(async () => {
    if (!sessionId || !projectId || !contentRef.current || !proposalHtml) {
      toast.error("Cannot save changes", {
        description: "Missing required information.",
        duration: 3000,
      })
      return
    }

    setIsSaving(true)
    try {
      const updatedHtml = contentRef.current.innerHTML
      const originalHtml = originalProposalHtml || proposalHtml
      
      const originalSections = extractSections(originalHtml)
      const updatedSections = extractSections(updatedHtml)
      
      const textChanges: Array<{ identifier: string; sectionId?: string; originalText: string; newText: string }> = []
      
      updatedSections.forEach((updatedSection, identifier) => {
        const originalSection = originalSections.get(identifier)
        
        if (!originalSection) {
          return
        } else if (originalSection.text.trim() !== updatedSection.text.trim()) {
          const differences = findTextDifferences(originalSection.text, updatedSection.text)
          
          differences.forEach(diff => {
            if (diff.original.trim()) {
              textChanges.push({
                identifier,
                sectionId: updatedSection.sectionId,
                originalText: diff.original.trim(),
                newText: diff.new ? diff.new.trim() : ""
              })
            }
          })
        }
      })
      
      if (textChanges.length === 0) {
        setIsEditMode(false)
        setOriginalProposalHtml(null)
        toast.info("No changes detected", {
          description: "The content hasn't been modified.",
          duration: 3000,
        })
        return
      }
      
      let totalReplacements = 0
      let lastResponse: any = null
      let hasSuccessfulSave = false
      
      for (const change of textChanges) {
        if (!change.originalText.trim() && !change.newText.trim()) {
          continue
        }
        
        const isRemove = !change.newText.trim()
        
        let editData: EditProposedHtmlRequest
        
        if (replaceAll && !isRemove) {
          editData = {
            original_text: change.originalText,
            new_text: change.newText,
            apply_to_all_sections: true,
            confirm: false
          }
        } else if (replaceAll && isRemove) {
          editData = {
            original_text: change.originalText,
            new_text: "",
            apply_to_all_sections: true,
            confirm: true
          }
        } else if (!replaceAll && isRemove) {
          editData = {
            original_text: change.originalText,
            new_text: "",
            section_ids: change.sectionId ? [change.sectionId] : [],
            apply_to_all_sections: false,
            confirm: false
          }
        } else {
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
          
          if (editData.confirm === false && response.preview_mode && response.preview_html) {
            setPreviewHtml(response.preview_html)
            setIsPreviewMode(true)
            setPendingEditData(editData)
            setPreviewResponse(response)
            toast.info("Preview generated", {
              description: response.message || "Review the changes and confirm to apply them.",
              duration: 5000,
            })
            return
          }
          
          if (editData.confirm === true && response.html_content) {
            hasSuccessfulSave = true
            totalReplacements += response.replacements_count || 0
            lastResponse = response
            
            if (onProposalHtmlUpdate) {
              onProposalHtmlUpdate(response.html_content)
            } else if (contentRef.current) {
              contentRef.current.innerHTML = response.html_content
            }
            
            setOriginalProposalHtml(null)
            setIsEditMode(false)
          } else if (response.html_content) {
            hasSuccessfulSave = true
            totalReplacements += response.replacements_count || 0
            lastResponse = response
            
            if (onProposalHtmlUpdate) {
              onProposalHtmlUpdate(response.html_content)
            } else if (contentRef.current) {
              contentRef.current.innerHTML = response.html_content
            }
            
            setOriginalProposalHtml(null)
            setIsEditMode(false)
          } else {
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
        }
      }
      
      if (hasSuccessfulSave) {
        setOriginalProposalHtml(null)
        setIsEditMode(false)
      } else if (lastResponse?.html_content) {
        if (onProposalHtmlUpdate) {
          onProposalHtmlUpdate(lastResponse.html_content)
        } else if (contentRef.current) {
          contentRef.current.innerHTML = lastResponse.html_content
        }
        setOriginalProposalHtml(null)
        setIsEditMode(false)
      }
      
      if (onEditHistoryReload) {
        onEditHistoryReload()
      }
      
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
  }, [sessionId, projectId, proposalHtml, originalProposalHtml, onProposalHtmlUpdate, onEditHistoryReload, replaceAll, contentRef])

  // Confirm preview changes
  const handleConfirmPreview = useCallback(async () => {
    if (!sessionId || !projectId || !pendingEditData) {
      return
    }

    setIsSaving(true)
    try {
      const confirmData = { ...pendingEditData, confirm: true }
      const response = await editProposedHtml(projectId, sessionId, confirmData)
      
      if (response.html_content && onProposalHtmlUpdate) {
        onProposalHtmlUpdate(response.html_content)
      } else if (response.html_content && contentRef.current) {
        contentRef.current.innerHTML = response.html_content
      }
      
      setPreviewHtml(null)
      setIsPreviewMode(false)
      setPendingEditData(null)
      setOriginalProposalHtml(null)
      setIsEditMode(false)
      
      if (onEditHistoryReload) {
        onEditHistoryReload()
      }
      
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
  }, [sessionId, projectId, pendingEditData, onProposalHtmlUpdate, onEditHistoryReload, contentRef])

  // Cancel preview
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

  // Process preview HTML and add inline controls
  useEffect(() => {
    if (!isPreviewMode || !previewHtml || !previewResponse?.diff_preview || !contentRef.current) {
      return
    }

    const timeoutId = setTimeout(() => {
      const container = contentRef.current
      if (!container) return

      const diffPreview = previewResponse.diff_preview
    
      if (!diffPreview || diffPreview.length === 0) {
        return
      }

      const originalText = pendingEditData?.original_text || ''
      const newText = pendingEditData?.new_text || ''

      diffPreview.forEach((diff: {occurrence: number, before: string, after: string}, index: number) => {
        const { before, after } = diff
        
        const extractChangedText = (pattern: string): string => {
          const match = pattern.match(/\[([^\]]+)\]/)
          return match ? match[1] : ''
        }
        
        const beforeText = extractChangedText(before) || originalText
        const afterText = extractChangedText(after) || newText
        
        if (!beforeText || !afterText) return
        
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
        
        let processed = false
        textNodes.forEach((textNode) => {
          if (processed) return
          
          const parent = textNode.parentElement
          if (!parent || parent.classList.contains('diff-container')) return
          
          const text = textNode.textContent || ''
          if (!text.includes(afterText)) return
          
          const firstIndex = text.indexOf(afterText)
          if (firstIndex === -1) return
          
          const diffId = `diff-${index}-${Date.now()}-${Math.random()}`
          
          const fragment = document.createDocumentFragment()
          
          if (firstIndex > 0) {
            fragment.appendChild(document.createTextNode(text.substring(0, firstIndex)))
          }
          
          const diffContainer = document.createElement('span')
          diffContainer.className = 'diff-container'
          diffContainer.setAttribute('data-diff-id', diffId)
          diffContainer.setAttribute('data-before', beforeText)
          diffContainer.setAttribute('data-after', afterText)
          diffContainer.style.cssText = 'position: relative; display: inline-block; margin: 0 2px;'
          
          const newTextSpan = document.createElement('span')
          newTextSpan.className = 'diff-new'
          newTextSpan.textContent = afterText
          newTextSpan.style.cssText = 'background-color: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 500;'
          
          const controlsSpan = document.createElement('span')
          controlsSpan.className = 'diff-actions'
          controlsSpan.style.cssText = 'position: absolute; top: -28px; right: 0; display: flex; gap: 4px; z-index: 1000; background: rgba(0,0,0,0.9); padding: 4px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);'
          
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
          
          const remainingText = text.substring(firstIndex + afterText.length)
          if (remainingText) {
            fragment.appendChild(document.createTextNode(remainingText))
          }
          
          if (parent) {
            parent.replaceChild(fragment, textNode)
            processed = true
          }
        })
      })

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
          const confirmData: EditProposedHtmlRequest = {
            original_text: before,
            new_text: after || "",
            apply_to_all_sections: true,
            confirm: true
          }
          
          const response = await editProposedHtml(projectId, sessionId, confirmData)
          
          if (response.html_content && onProposalHtmlUpdate) {
            onProposalHtmlUpdate(response.html_content)
          } else if (response.html_content && container) {
            container.innerHTML = response.html_content
          }
          
          setPreviewHtml(null)
          setIsPreviewMode(false)
          setPendingEditData(null)
          setPreviewResponse(null)
          setOriginalProposalHtml(null)
          setIsEditMode(false)
          
          if (onEditHistoryReload) {
            onEditHistoryReload()
          }
          
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
        
        const diffContainer = container.querySelector(`[data-diff-id="${diffId}"]`)
        if (diffContainer && diffContainer.parentElement) {
          diffContainer.parentElement.replaceChild(document.createTextNode(before), diffContainer)
        }
        
        toast.info("Change rejected", {
          description: "The change has been reverted to the original text.",
          duration: 3000,
        })
      }

      const acceptButtons = container.querySelectorAll('.diff-accept')
      const rejectButtons = container.querySelectorAll('.diff-reject')
      
      acceptButtons.forEach(btn => {
        btn.addEventListener('click', handleAccept)
      })
      
      rejectButtons.forEach(btn => {
        btn.addEventListener('click', handleReject)
      })
    }, 100)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [isPreviewMode, previewHtml, previewResponse, pendingEditData, sessionId, projectId, onProposalHtmlUpdate, onEditHistoryReload, contentRef])

  return {
    isEditMode,
    isSaving,
    replaceAll,
    setReplaceAll,
    previewHtml,
    isPreviewMode,
    handleToggleEditMode,
    handleSaveChanges,
    handleConfirmPreview,
    handleCancelPreview
  }
}

