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
          id = `heading-${index}-${text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 50)}`
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
        
        const domHeadings = contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6')
        
        // Helper function to normalize text
        const normalizeText = (text: string) => text.trim().replace(/\s+/g, ' ')
        
        // Match headings by text content and set IDs
        extractedHeadings.forEach((heading) => {
          // First check if ID already exists
          let targetElement = contentElement.querySelector(`#${heading.id}`) as HTMLElement
          
          if (!targetElement) {
            // Find by text matching (exact or partial)
            const headingTextNormalized = normalizeText(heading.text)
            domHeadings.forEach((el) => {
              const elText = el.textContent?.trim() || ''
              const elTextNormalized = normalizeText(elText)
              
              // Exact match or one starts with the other
              if ((elTextNormalized === headingTextNormalized || 
                   elTextNormalized.startsWith(headingTextNormalized) ||
                   headingTextNormalized.startsWith(elTextNormalized)) && !el.id) {
                targetElement = el as HTMLElement
              }
            })
          }
          
          // Set the ID if we found a matching element
          if (targetElement && !targetElement.id) {
            targetElement.id = heading.id
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
            subtree: true
          })
        }
      }
      
      // Try multiple times to catch content when it's rendered
      startObserving()
      setTimeout(startObserving, 100)
      setTimeout(startObserving, 300)
      setTimeout(startObserving, 500)
      
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
    // First, ensure IDs are set in the DOM
    const contentElement = document.querySelector('.proposal-panel-content') as HTMLElement
    if (!contentElement) {
      console.warn('Proposal content element not found')
      return
    }

    // Helper function to normalize text for comparison (remove extra spaces, trim)
    const normalizeText = (text: string) => text.trim().replace(/\s+/g, ' ')
    
    // Get all headings in the DOM
    const domHeadings = Array.from(contentElement.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[]
    const headingTextNormalized = normalizeText(heading.text)
    
    // Set IDs on all matching headings if they don't have one
    domHeadings.forEach((el) => {
      const elText = el.textContent?.trim() || ''
      const elTextNormalized = normalizeText(elText)
      if ((elTextNormalized === headingTextNormalized || 
           elTextNormalized.startsWith(headingTextNormalized) ||
           headingTextNormalized.startsWith(elTextNormalized)) && !el.id) {
        el.id = heading.id
      }
    })
    
    // Helper function to check if texts match (handles truncated text)
    const textsMatch = (text1: string, text2: string) => {
      const normalized1 = normalizeText(text1)
      const normalized2 = normalizeText(text2)
      // Exact match
      if (normalized1 === normalized2) return true
      // Check if one starts with the other (for truncated text)
      // Remove common truncation patterns
      const clean1 = normalized1.replace(/\.\.\.$/, '').replace(/…$/, '').trim()
      const clean2 = normalized2.replace(/\.\.\.$/, '').replace(/…$/, '').trim()
      if (clean1 === clean2) return true
      // Check if one is a prefix of the other (handles truncated display text)
      if (clean1.length > 0 && clean2.length > 0) {
        const minLength = Math.min(clean1.length, clean2.length)
        const prefix1 = clean1.substring(0, minLength)
        const prefix2 = clean2.substring(0, minLength)
        if (prefix1 === prefix2 && minLength > 10) return true // At least 10 chars match
      }
      return false
    }

    // First, try to find by ID
    let targetElement = contentElement.querySelector(`#${heading.id}`) as HTMLElement
    
    // If not found by ID, try to find by text content (exact or partial match)
    if (!targetElement) {
      for (const el of domHeadings) {
        const elText = el.textContent?.trim() || ''
        const elTextNormalized = normalizeText(elText)
        
        // Check for exact match or if heading text matches element text
        if (textsMatch(headingTextNormalized, elTextNormalized)) {
          targetElement = el
          // Set the ID if not present
          if (!targetElement.id) {
            targetElement.id = heading.id
          }
          break
        }
      }
    }

    if (!targetElement) {
      console.warn(`Heading not found: "${heading.text}"`, {
        headingId: heading.id,
        headingText: heading.text,
        totalHeadings: domHeadings.length,
        firstFewHeadings: domHeadings.slice(0, 5).map(el => ({
          text: el.textContent?.trim(),
          id: el.id,
          tag: el.tagName
        }))
      })
      return
    }

    // Find the scrollable parent container - look for the main content scroll container
    // This should be the parent div with overflow-y-auto that contains the proposal content
    let scrollContainer: HTMLElement | null = contentElement.parentElement as HTMLElement
    
    // First, try to find the specific scroll container used in proposal panel
    // Look for div with overflow-y-auto that's a direct ancestor
    let current: HTMLElement | null = contentElement.parentElement as HTMLElement
    while (current && current !== document.body) {
      const style = window.getComputedStyle(current)
      const hasOverflow = style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay'
      const hasOverflowClass = current.classList.contains('overflow-y-auto') || 
                               current.classList.contains('overflow-auto')
      
      if ((hasOverflow || hasOverflowClass) && current.scrollHeight > current.clientHeight) {
        scrollContainer = current
        break
      }
      current = current.parentElement as HTMLElement
    }
    
    // If we found a scroll container, use it
    if (scrollContainer && scrollContainer !== document.body) {
      // Use requestAnimationFrame for smooth scrolling
      requestAnimationFrame(() => {
        if (!targetElement || !scrollContainer) return
        
        try {
          const containerRect = scrollContainer!.getBoundingClientRect()
          const elementRect = targetElement.getBoundingClientRect()
          const currentScrollTop = scrollContainer!.scrollTop
          
          // Calculate the position relative to the scroll container
          const elementTopRelativeToContainer = elementRect.top - containerRect.top + currentScrollTop
          const offset = 20 // Small offset from top for better visibility
          
          scrollContainer!.scrollTo({ 
            top: Math.max(0, elementTopRelativeToContainer - offset), 
            behavior: 'smooth' 
          })
        } catch (error) {
          console.error('Error scrolling:', error)
          // Fallback to scrollIntoView
          if (targetElement) {
            targetElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start',
              inline: 'nearest'
            })
          }
        }
      })
      return
    }
    
    // Fallback: use scrollIntoView with block: 'start'
    // This will scroll the nearest scrollable ancestor
    requestAnimationFrame(() => {
      if (targetElement) {
        try {
          targetElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
          })
          
          // Highlight the heading briefly for better UX
          const originalBg = targetElement.style.backgroundColor
          const originalTransition = targetElement.style.transition
          targetElement.style.transition = 'background-color 0.3s ease'
          targetElement.style.backgroundColor = 'rgba(22, 163, 74, 0.2)' // Green highlight
          
          setTimeout(() => {
            if (targetElement) {
              targetElement.style.backgroundColor = originalBg
              setTimeout(() => {
                if (targetElement) {
                  targetElement.style.transition = originalTransition
                }
              }, 300)
            }
          }, 1000)
        } catch (error) {
          console.error('Error with scrollIntoView:', error)
          // Last resort: direct scroll
          const parent = targetElement.parentElement
          if (parent && parent.scrollHeight > parent.clientHeight) {
            const offset = targetElement.offsetTop - 80
            parent.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
            
            // Highlight the heading briefly
            const originalBg = targetElement.style.backgroundColor
            targetElement.style.transition = 'background-color 0.3s ease'
            targetElement.style.backgroundColor = 'rgba(22, 163, 74, 0.2)'
            setTimeout(() => {
              if (targetElement) {
                targetElement.style.backgroundColor = originalBg
              }
            }, 1000)
          }
        }
      }
    })
  }

  // Render heading with proper indentation
  const renderHeading = (heading: Heading, index: number) => {
    const prevLevel = index > 0 ? headings[index - 1].level : 0
    const marginLeft = (heading.level - 1) * 16 // 16px per level

    return (
      <div
        key={heading.id}
        onClick={() => handleHeadingClick(heading)}
        className="cursor-pointer hover:bg-[#232326] px-2 py-1.5 rounded transition-colors text-sm"
        style={{ marginLeft: `${marginLeft}px` }}
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

