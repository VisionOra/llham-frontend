"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { ChevronLeft, ChevronRight, FileText, Menu } from "lucide-react"
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
  const scrollContainerRef = useRef<HTMLDivElement>(null)

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
    const marginLeft = (heading.level - 1) * 20 // 20px per level for better hierarchy

    // Different styling based on heading level
    const getHeadingStyle = () => {
      switch (heading.level) {
        case 1:
          return {
            iconSize: 'w-4 h-4',
            textSize: 'text-sm font-semibold',
            iconColor: 'text-green-400',
            textColor: 'text-white',
            padding: 'py-2'
          }
        case 2:
          return {
            iconSize: 'w-3.5 h-3.5',
            textSize: 'text-sm font-medium',
            iconColor: 'text-green-500',
            textColor: 'text-gray-200',
            padding: 'py-1.5'
          }
        case 3:
          return {
            iconSize: 'w-3 h-3',
            textSize: 'text-xs font-normal',
            iconColor: 'text-gray-500',
            textColor: 'text-gray-300',
            padding: 'py-1'
          }
        default:
          return {
            iconSize: 'w-3 h-3',
            textSize: 'text-xs',
            iconColor: 'text-gray-600',
            textColor: 'text-gray-400',
            padding: 'py-1'
          }
      }
    }

    const style = getHeadingStyle()

    return (
      <div
        key={heading.id}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleHeadingClick(heading)
        }}
        onMouseDown={(e) => e.preventDefault()}
        className={`cursor-pointer group ${style.padding} px-3 rounded-md transition-all duration-200 select-none border-l-2 border-transparent hover:border-green-500/50 hover:bg-[#232326]/80 active:bg-[#2a2a2a]`}
        style={{ marginLeft: `${marginLeft}px`, userSelect: 'none' }}
      >
        <div className="flex items-center space-x-2.5">
          <FileText className={`${style.iconSize} ${style.iconColor} flex-shrink-0 transition-colors group-hover:text-green-400`} />
          <span className={`${style.textSize} ${style.textColor} truncate transition-colors group-hover:text-white`}>
            {heading.text}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="w-64 h-full border-r border-[#2a2a2a] bg-gradient-to-b from-[#1a1a1a] to-[#151515] flex flex-col shadow-lg" style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[#2a2a2a] bg-[#1a1a1a]/50 backdrop-blur-sm">
        <div className="flex items-center space-x-2">
          <Menu className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-semibold text-white">Table of contents</h3>
        </div>
        {headings.length > 0 && (
          <span className="text-xs text-gray-500 bg-[#232326] px-2 py-0.5 rounded-full">
            {headings.length}
          </span>
        )}
      </div>

      {/* Navigation Tree */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 toc-scrollbar"
        onScroll={() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.classList.add('scrolling')
            clearTimeout((scrollContainerRef.current as any).scrollTimeout)
            ;(scrollContainerRef.current as any).scrollTimeout = setTimeout(() => {
              if (scrollContainerRef.current) {
                scrollContainerRef.current.classList.remove('scrolling')
              }
            }, 1000)
          }
        }}
      >
        <style dangerouslySetInnerHTML={{
          __html: `
            .toc-scrollbar {
              scrollbar-width: none; /* Firefox */
              -ms-overflow-style: none; /* IE and Edge */
            }
            .toc-scrollbar::-webkit-scrollbar {
              display: none; /* Chrome, Safari, Opera */
            }
            .toc-scrollbar:hover {
              scrollbar-width: thin; /* Firefox */
              scrollbar-color: #2a2a2a transparent; /* Firefox */
            }
            .toc-scrollbar:hover::-webkit-scrollbar {
              display: block; /* Chrome, Safari, Opera */
              width: 6px;
            }
            .toc-scrollbar:hover::-webkit-scrollbar-track {
              background: transparent;
            }
            .toc-scrollbar:hover::-webkit-scrollbar-thumb {
              background-color: #2a2a2a;
              border-radius: 3px;
            }
            .toc-scrollbar:hover::-webkit-scrollbar-thumb:hover {
              background-color: #3a3a3a;
            }
            .toc-scrollbar:active {
              scrollbar-width: thin;
              scrollbar-color: #2a2a2a transparent;
            }
            .toc-scrollbar:active::-webkit-scrollbar {
              display: block;
              width: 6px;
            }
            .toc-scrollbar:active::-webkit-scrollbar-track {
              background: transparent;
            }
            .toc-scrollbar:active::-webkit-scrollbar-thumb {
              background-color: #2a2a2a;
              border-radius: 3px;
            }
            .toc-scrollbar.scrolling {
              scrollbar-width: thin;
              scrollbar-color: #2a2a2a transparent;
            }
            .toc-scrollbar.scrolling::-webkit-scrollbar {
              display: block;
              width: 6px;
            }
            .toc-scrollbar.scrolling::-webkit-scrollbar-track {
              background: transparent;
            }
            .toc-scrollbar.scrolling::-webkit-scrollbar-thumb {
              background-color: #2a2a2a;
              border-radius: 3px;
            }
          `
        }} />
        {headings.length > 0 ? (
          <div className="space-y-0.5">
            {headings.map((heading, index) => renderHeading(heading, index))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
            <FileText className="w-12 h-12 text-gray-600 mb-3 opacity-50" />
            <p className="text-gray-500 text-sm font-medium">No headings found</p>
            <p className="text-gray-600 text-xs mt-1">Document headings will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}

