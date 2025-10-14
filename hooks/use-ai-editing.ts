"use client"

import { useState, useCallback } from "react"

interface EditSuggestion {
  id: string
  originalText: string
  suggestedText: string
  reason: string
  type: "improvement" | "correction" | "expansion" | "simplification"
  confidence: number
}

interface EditRequest {
  selectedText: string
  context: string
  element: HTMLElement
}

export function useAIEditing() {
  const [suggestions, setSuggestions] = useState<EditSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [pendingEdits, setPendingEdits] = useState<Map<string, EditRequest>>(new Map())

  const generateSuggestion = useCallback(
    async (selectedText: string, context: string, element: HTMLElement): Promise<EditSuggestion> => {
      // Mock AI suggestion generation - replace with actual API call
      const suggestionTypes = ["improvement", "correction", "expansion", "simplification"] as const
      const randomType = suggestionTypes[Math.floor(Math.random() * suggestionTypes.length)]

      const mockSuggestions = {
        improvement: {
          text: selectedText.replace(/\b\w+/g, (word) => (word.length > 5 ? word + " (enhanced)" : word)),
          reason: "Enhanced clarity and professional tone while maintaining the original meaning.",
        },
        correction: {
          text: selectedText.replace(/\s+/g, " ").trim(),
          reason: "Fixed grammar, spelling, and formatting issues for better readability.",
        },
        expansion: {
          text:
            selectedText +
            " Additionally, this provides comprehensive coverage of the topic with detailed explanations and examples.",
          reason: "Added more detail and context to make the content more informative and complete.",
        },
        simplification: {
          text:
            selectedText
              .split(" ")
              .slice(0, Math.max(3, selectedText.split(" ").length / 2))
              .join(" ") + "...",
          reason: "Simplified the language and structure for better understanding and conciseness.",
        },
      }

      const suggestion = mockSuggestions[randomType]

      return {
        id: Date.now().toString(),
        originalText: selectedText,
        suggestedText: suggestion.text,
        reason: suggestion.reason,
        type: randomType,
        confidence: Math.floor(Math.random() * 40) + 60, // 60-100%
      }
    },
    [],
  )

  const requestEdit = useCallback(
    async (selectedText: string, context: string, element: HTMLElement) => {
      setIsLoading(true)

      try {
        const suggestion = await generateSuggestion(selectedText, context, element)
        setSuggestions((prev) => [...prev, suggestion])
        setPendingEdits((prev) => new Map(prev).set(suggestion.id, { selectedText, context, element }))
      } catch (error) {
      } finally {
        setIsLoading(false)
      }
    },
    [generateSuggestion],
  )

  const acceptSuggestion = useCallback(
    (suggestionId: string) => {
      const suggestion = suggestions.find((s) => s.id === suggestionId)
      const editRequest = pendingEdits.get(suggestionId)

      if (suggestion && editRequest) {
        // Apply the edit to the document
        const { element } = editRequest
        if (element && element.textContent) {
          element.textContent = element.textContent.replace(suggestion.originalText, suggestion.suggestedText)
        }

        // Remove from pending
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
        setPendingEdits((prev) => {
          const newMap = new Map(prev)
          newMap.delete(suggestionId)
          return newMap
        })
      }
    },
    [suggestions, pendingEdits],
  )

  const rejectSuggestion = useCallback((suggestionId: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId))
    setPendingEdits((prev) => {
      const newMap = new Map(prev)
      newMap.delete(suggestionId)
      return newMap
    })
  }, [])

  const regenerateSuggestion = useCallback(
    async (suggestionId: string) => {
      const editRequest = pendingEdits.get(suggestionId)
      if (!editRequest) return

      setIsLoading(true)

      try {
        const newSuggestion = await generateSuggestion(
          editRequest.selectedText,
          editRequest.context,
          editRequest.element,
        )

        setSuggestions((prev) => prev.map((s) => (s.id === suggestionId ? { ...newSuggestion, id: suggestionId } : s)))
      } catch (error) {
      } finally {
        setIsLoading(false)
      }
    },
    [pendingEdits, generateSuggestion],
  )

  const clearAllSuggestions = useCallback(() => {
    setSuggestions([])
    setPendingEdits(new Map())
  }, [])

  return {
    suggestions,
    isLoading,
    requestEdit,
    acceptSuggestion,
    rejectSuggestion,
    regenerateSuggestion,
    clearAllSuggestions,
  }
}
