"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Search, X } from "lucide-react"
import { getAvailableAgents, AvailableAgent } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"

type Agent = AvailableAgent

interface AgentSearchBarProps {
  sessionId?: string
  onAgentSelect?: (agent: Agent) => void
}

export const AgentSearchBar: React.FC<AgentSearchBarProps> = ({
  sessionId,
  onAgentSelect
}) => {
  const { user } = useAuth()
  const [searchTerm, setSearchTerm] = useState("")
  const [agents, setAgents] = useState<Agent[]>([])
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  
  // Check if user has free plan (default to free if not specified)
  const isFreePlan = user?.subscription_status !== "paid"
  const maxAgentsForPlan = isFreePlan ? 3 : Infinity

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (showResults && !target.closest('.agent-search-container')) {
        setShowResults(false)
      }
    }

    if (showResults) {
      document.addEventListener('click', handleClickOutside)
      return () => {
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [showResults])

  // Load agents when component mounts or sessionId changes
  useEffect(() => {
    const loadAgents = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await getAvailableAgents(sessionId)
        const allAgents = response.agents || []
        
        // Limit agents based on subscription plan
        const limitedAgents = isFreePlan 
          ? allAgents.slice(0, maxAgentsForPlan)
          : allAgents
        
        setAgents(limitedAgents)
        setFilteredAgents(limitedAgents)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load agents")
        setAgents([])
        setFilteredAgents([])
      } finally {
        setLoading(false)
      }
    }

    loadAgents()
  }, [sessionId, isFreePlan, maxAgentsForPlan])

  // Filter agents based on search term
  useEffect(() => {
    if (!debouncedSearchTerm.trim()) {
      setFilteredAgents(agents)
      return
    }

    const filtered = agents.filter(agent => 
      agent.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      agent.display_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      agent.description.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
      agent.section_types.some(type => 
        type.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      )
    )
    setFilteredAgents(filtered)
  }, [debouncedSearchTerm, agents])

  const handleClear = () => {
    setSearchTerm("")
    setShowResults(false)
  }

  const handleAgentClick = (agent: Agent) => {
    onAgentSelect?.(agent)
    setShowResults(false)
    setSearchTerm("")
  }

  return (
    <div className="relative flex-shrink-0 agent-search-container" style={{ minWidth: '200px', maxWidth: '300px', width: '100%' }}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setShowResults(true)
          }}
          onFocus={() => setShowResults(true)}
          placeholder="Search agents..."
          className="w-full bg-[#18181b] border-[#2a2a2a] text-white text-sm pl-9 pr-8 py-2 h-9 rounded focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />
        {searchTerm && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded transition-colors"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl max-h-[300px] overflow-y-auto z-50">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-gray-400 text-xs">Loading agents...</div>
              </div>
            </div>
          ) : error ? (
            <div className="p-4 text-red-400 text-sm text-center">
              {error}
            </div>
          ) : filteredAgents.length > 0 ? (
            <div className="p-2 space-y-1">
              {filteredAgents.map((agent) => (
                <div
                  key={agent.name}
                  onClick={() => handleAgentClick(agent)}
                  className="p-3 hover:bg-[#232326] cursor-pointer rounded-lg transition-colors group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-sm font-medium text-white group-hover:text-green-400 transition-colors">
                          {agent.display_name}
                        </h4>
                        {agent.is_selected && (
                          <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-2">
                        {agent.description}
                      </p>
                      {agent.section_types.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {agent.section_types.slice(0, 3).map((type, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs bg-[#2a2a2a] text-gray-400 rounded"
                            >
                              {type}
                            </span>
                          ))}
                          {agent.section_types.length > 3 && (
                            <span className="px-2 py-0.5 text-xs text-gray-500">
                              +{agent.section_types.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : searchTerm ? (
            <div className="p-4 text-gray-400 text-sm text-center">
              No agents found matching "{searchTerm}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

