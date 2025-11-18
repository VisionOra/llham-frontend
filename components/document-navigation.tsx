"use client"

import React, { useState, useEffect, useMemo } from "react"
import { ChevronLeft, ChevronRight, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Heading {
  id: string
  level: number
  text: string
  element: HTMLElement
}

interface DocumentNavigationProps {
  htmlContent: string | null
  title: string | null
  isOpen: boolean
  onToggle: () => void
}

export function DocumentNavigation({
  htmlContent,
  title,
  isOpen,
  onToggle
}: DocumentNavigationProps) {
  const [headings, setHeadings] = useState<Heading[]>([])

  // Parse HTML and extract headings
  useEffect(() => {
    if (!htmlContent) {
      setHeadings([])
      return
    }

    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, 'text/html')
      
      // Find all headings (h1, h2, h3, h4, h5, h6)
      const headingElements = doc.querySelectorAll('h1, h2, h3, h4, h5, h6')
      const extractedHeadings: Heading[] = []

      headingElements.forEach((element, index) => {
        const level = parseInt(element.tagName.charAt(1))
        const text = element.textContent?.trim() || ''
        
        if (!text) return // Skip empty headings
        
        // Create unique ID if not present
        let id = element.id
        if (!id) {
          // Generate a more robust ID based on text and position
          const sanitizedText = text.toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '')
            .substring(0, 50)
          id = `heading-${index}-${sanitizedText}`
        }

        extractedHeadings.push({
          id,
          level,
          text,
          element: element as HTMLElement
        })
      })

      setHeadings(extractedHeadings)
      
      // Function to set IDs in the actual DOM
      const setIdsInDOM = () => {
        const contentElement = document.querySelector('.proposal-panel-content')
        if (!contentElement || extractedHeadings.length === 0) return
        
        const domHeadings = Array.from(contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[]
        
        // Helper function to normalize text
        const normalizeText = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase()
        
        // Match headings by text content and set IDs
        extractedHeadings.forEach((heading, headingIndex) => {
          // First check if ID already exists
          let targetElement = contentElement.querySelector(`#${CSS.escape(heading.id)}`) as HTMLElement
          
          if (!targetElement) {
            // Find by text matching (exact or partial)
            const headingTextNormalized = normalizeText(heading.text)
            
            // Try to match by index first (most reliable)
            if (headingIndex < domHeadings.length) {
              const candidateElement = domHeadings[headingIndex]
              const candidateText = normalizeText(candidateElement.textContent?.trim() || '')
              
              // Check if texts match (allowing for truncation)
              if (candidateText === headingTextNormalized || 
                  candidateText.startsWith(headingTextNormalized) ||
                  headingTextNormalized.startsWith(candidateText)) {
                targetElement = candidateElement
              }
            }
            
            // If index matching failed, try text matching across all headings
            if (!targetElement) {
              for (const el of domHeadings) {
                if (el.id) continue // Skip if already has ID
                
                const elText = el.textContent?.trim() || ''
                const elTextNormalized = normalizeText(elText)
                
                // Exact match or one starts with the other (handles truncation)
                if (elTextNormalized === headingTextNormalized || 
                    elTextNormalized.startsWith(headingTextNormalized) ||
                    headingTextNormalized.startsWith(elTextNormalized)) {
                  targetElement = el
                  break
                }
              }
            }
          }
          
          // Set the ID if we found a matching element
          if (targetElement && !targetElement.id) {
            targetElement.id = heading.id
            // Also set data attribute for additional tracking
            targetElement.setAttribute('data-heading-id', heading.id)
          }
        })
      }
      
      // Use MutationObserver to watch for content changes
      const observer = new MutationObserver(() => {
        setIdsInDOM()
      })
      
      // Start observing after a short delay to ensure content is rendered
      const startObserving = () => {
        const contentElement = document.querySelector('.proposal-panel-content')
        if (contentElement) {
          setIdsInDOM()
          observer.observe(contentElement, {
            childList: true,
            subtree: true,
            attributes: false
          })
        }
      }
      
      // Try multiple times to catch content when it's rendered
      startObserving()
      setTimeout(startObserving, 100)
      setTimeout(startObserving, 300)
      setTimeout(startObserving, 500)
      setTimeout(startObserving, 1000) // Additional delay for slower renders
      
      return () => {
        observer.disconnect()
      }
    } catch (error) {
      console.error('Error parsing HTML for navigation:', error)
      setHeadings([])
    }
  }, [htmlContent])

  // Scroll to heading when clicked
  const handleHeadingClick = (heading: Heading) => {
    // Wait a bit to ensure DOM is ready
    setTimeout(() => {
      const contentElement = document.querySelector('.proposal-panel-content') as HTMLElement
      if (!contentElement) return

      const domHeadings = Array.from(contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[]
      const headingIndex = headings.findIndex(h => h.id === heading.id)
      
      // Find target element by index (most reliable)
      let targetElement: HTMLElement | null = null
      
      if (headingIndex >= 0 && headingIndex < domHeadings.length) {
        targetElement = domHeadings[headingIndex]
      } else {
        // Fallback: find by text
        const normalizeText = (text: string) => text.trim().toLowerCase()
        const headingText = normalizeText(heading.text)
        
        for (const el of domHeadings) {
          const elText = normalizeText(el.textContent || '')
          if (elText === headingText || elText.startsWith(headingText) || headingText.startsWith(elText)) {
            targetElement = el
            break
          }
        }
      }

      if (!targetElement) return

      // Find the scrollable parent
      let scrollContainer: HTMLElement | null = null
      let current: HTMLElement | null = contentElement.parentElement as HTMLElement
      
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current)
        if (style.overflowY === 'auto' || style.overflowY === 'scroll' || 
            current.classList.contains('overflow-y-auto') || 
            current.classList.contains('overflow-auto')) {
          if (current.scrollHeight > current.clientHeight) {
            scrollContainer = current
            break
          }
        }
        current = current.parentElement as HTMLElement
      }

      // Use scrollIntoView first (most reliable)
      targetElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      })

      // Also manually scroll the container if found (for better control)
      if (scrollContainer) {
        setTimeout(() => {
          const containerRect = scrollContainer!.getBoundingClientRect()
          const elementRect = targetElement!.getBoundingClientRect()
          const currentScrollTop = scrollContainer!.scrollTop
          const elementTopRelative = elementRect.top - containerRect.top + currentScrollTop
          
          scrollContainer!.scrollTo({
            top: Math.max(0, elementTopRelative - 20),
            behavior: 'smooth'
          })
        }, 50)
      }
    }, 10)
  }

  // Render heading with proper indentation
  const renderHeading = (heading: Heading, index: number) => {
    const prevLevel = index > 0 ? headings[index - 1].level : 0
    const marginLeft = (heading.level - 1) * 16 // 16px per level

    return (
      <div
        key={heading.id}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleHeadingClick(heading)
        }}
        onMouseDown={(e) => e.preventDefault()}
        className="cursor-pointer hover:bg-[#232326] active:bg-[#2a2a2a] px-2 py-1.5 rounded transition-colors text-sm select-none"
        style={{ marginLeft: `${marginLeft}px`, userSelect: 'none' }}
      >
        <div className="flex items-center space-x-2">
          <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span className="text-gray-300 hover:text-white truncate">
            {heading.text}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-64 h-full border-r border-[#2a2a2a] bg-[#1a1a1a] flex flex-col rounded-l-full">
      {/* Header */}
      <div className="flex items-center p-2 border-b border-[#2a2a2a]">
        <h3 className="text-sm font-semibold text-white">Table of contents</h3>
      </div>

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        
        {headings.length > 0 ? (
          <div className="space-y-1">
            {headings.map((heading, index) => renderHeading(heading, index))}
          </div>
        ) : (
          <div className="px-2 py-4 text-center text-gray-500 text-xs">
            No headings found
          </div>
        )}
      </div>
    </div>
  )
}

