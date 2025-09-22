"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Check, X, RefreshCw, Sparkles, Copy, Eye } from "lucide-react"

interface EditSuggestion {
  id: string
  originalText: string
  suggestedText: string
  reason: string
  type: "improvement" | "correction" | "expansion" | "simplification"
  confidence: number
}

interface AIEditSuggestionProps {
  suggestion: EditSuggestion
  onAccept: (suggestionId: string) => void
  onReject: (suggestionId: string) => void
  onRegenerate: (suggestionId: string) => void
  isLoading?: boolean
}

export function AIEditSuggestion({
  suggestion,
  onAccept,
  onReject,
  onRegenerate,
  isLoading = false,
}: AIEditSuggestionProps) {
  const [showComparison, setShowComparison] = useState(false)

  const getTypeColor = (type: string) => {
    switch (type) {
      case "improvement":
        return "bg-blue-900/50 text-blue-300 border-blue-700"
      case "correction":
        return "bg-red-900/50 text-red-300 border-red-700"
      case "expansion":
        return "bg-green-900/50 text-green-300 border-green-700"
      case "simplification":
        return "bg-purple-900/50 text-purple-300 border-purple-700"
      default:
        return "bg-[#2a2a2a]/50 text-gray-300 border-[#2a2a2a]"
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "text-green-400"
    if (confidence >= 60) return "text-yellow-400"
    return "text-red-400"
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Card className="bg-[#1a1a1a] border-[#2a2a2a] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-white">AI Suggestion</span>
          <Badge className={getTypeColor(suggestion.type)}>{suggestion.type}</Badge>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-400">
            Confidence:
            <span className={`ml-1 font-medium ${getConfidenceColor(suggestion.confidence)}`}>
              {suggestion.confidence}%
            </span>
          </span>
        </div>
      </div>

      {/* Reason */}
      <div className="text-sm text-gray-300 bg-[#0a0a0a]/50 rounded-lg p-3">
        <span className="text-green-400 font-medium">Why this change:</span>
        <p className="mt-1">{suggestion.reason}</p>
      </div>

      {/* Suggested Text */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white">Suggested Text:</span>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowComparison(!showComparison)}
              className="text-gray-400 hover:text-white h-6 px-2"
            >
              <Eye className="w-3 h-3 mr-1" />
              {showComparison ? "Hide" : "Compare"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(suggestion.suggestedText)}
              className="text-gray-400 hover:text-white h-6 px-2"
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        </div>

        <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
          <p className="text-sm text-white leading-relaxed">{suggestion.suggestedText}</p>
        </div>
      </div>

      {/* Comparison View */}
      {showComparison && (
        <div className="space-y-2">
          <span className="text-sm font-medium text-white">Original Text:</span>
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
            <p className="text-sm text-white leading-relaxed line-through opacity-75">{suggestion.originalText}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRegenerate(suggestion.id)}
          disabled={isLoading}
          className="border-[#2a2a2a] text-gray-300 hover:bg-[#1a1a1a]"
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
          Regenerate
        </Button>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReject(suggestion.id)}
            disabled={isLoading}
            className="border-red-600 text-red-300 hover:bg-red-900/20"
          >
            <X className="w-4 h-4 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            onClick={() => onAccept(suggestion.id)}
            disabled={isLoading}
            className="bg-green-700 hover:bg-green-600 text-white"
          >
            <Check className="w-4 h-4 mr-1" />
            Accept
          </Button>
        </div>
      </div>
    </Card>
  )
}
