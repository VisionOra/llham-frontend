"use client"

import type React from "react"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MessageSquare, FileText, ChevronRight, ChevronDown, Plus } from "lucide-react"
import { useProjects } from "@/contexts/project-context"
import { useAuth } from "@/contexts/auth-context"

interface Session {
  id: string
  project_id: string
  title: string
  initial_idea: string
  agent_mode: string
  has_document: boolean
  document?: any
  created_at: string
  updated_at: string
}

interface ProjectSidebarProps {
  sessions: Session[]
  selectedProject: string | null
  selectedSession: string | null
  onProjectSelect: (projectId: string) => void
  onSessionSelect: (sessionId: string, document?: any) => void
  onNewSession?: () => void
}

export function ProjectSidebar({
  sessions,
  selectedProject,
  selectedSession,
  onProjectSelect,
  onSessionSelect,
  onNewSession,
}: ProjectSidebarProps) {
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState("")

  const { projects, createProject, isLoading, error } = useProjects()
  const { user } = useAuth()

  const getProjectSessions = (projectId: string) => {
    return sessions.filter((session) => session.project_id === projectId)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  }

  const getStatusBadge = (agentMode: string, hasDocument: boolean) => {
    if (hasDocument) {
      return (
        <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700">
          Document
        </Badge>
      )
    }

    switch (agentMode) {
      case "conversation":
        return (
          <Badge variant="outline" className="border-blue-700 text-blue-300">
            Chat
          </Badge>
        )
      case "proposal_generation":
        return (
          <Badge variant="outline" className="border-yellow-700 text-yellow-300">
            Generating
          </Badge>
        )
      case "editor_mode":
        return (
          <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700">
            Editor
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-gray-700 text-gray-300">
            Unknown
          </Badge>
        )
    }
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectTitle.trim()) return

    try {
      await createProject(newProjectTitle.trim())
      setNewProjectTitle("")
      setShowCreateForm(false)
    } catch (error) {
      console.error("Failed to create project:", error)
    }
  }

  return (
  <div className="space-y-1">
      <div className="mb-4">
        {!showCreateForm ? (
          <Button
            onClick={() => setShowCreateForm(true)}
            variant="outline"
            size="sm"
            className="w-full border-[#2a2a2a] bg-transparent hover:bg-[#1a1a1a] text-gray-400 hover:text-white"
          >
            <Plus className="w-3 h-3 mr-2" />
            New Project
          </Button>
        ) : (
          <form onSubmit={handleCreateProject} className="space-y-2">
            <input
              type="text"
              value={newProjectTitle}
              onChange={(e) => setNewProjectTitle(e.target.value)}
              placeholder="Project title..."
              className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-white text-sm focus:outline-none focus:border-[#3a3a3a]"
              autoFocus
            />
            <div className="flex space-x-2">
              <Button
                type="submit"
                size="sm"
                disabled={!newProjectTitle.trim() || isLoading}
                className="flex-1 bg-white text-black hover:bg-gray-200"
              >
                {isLoading ? "Creating..." : "Create"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowCreateForm(false)
                  setNewProjectTitle("")
                }}
                className="border-[#2a2a2a] bg-transparent hover:bg-[#1a1a1a]"
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>
<div>
  {projects.length === 0 ? (
    <div className="text-center py-8 text-gray-500">
      <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
      <p className="text-sm">No projects yet</p>
      <p className="text-xs text-gray-600 mt-1">Create your first project above</p>
    </div>
  ) : (
  <div className="flex flex-col overflow-y-auto max-h-[400px] sidebar-scrollbar">
      {projects.map((project) => {
        const projectSessions = getProjectSessions(project.id)
        const isSelected = selectedProject === project.id

        return (
          <div key={project.id} className="mb-2">
            {/* Project Item - Simple List Format */}
            <div
              className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors text-sm ${
                isSelected ? "bg-[#2a2a2a] text-white" : "text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
              }`}
              onClick={() => onProjectSelect(project.id)}
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{project.title}</div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {projectSessions.some(s => s.has_document || s.document) && (
                  <FileText className="w-4 h-4 text-green-400" />
                )}
                <ChevronRight className="w-4 h-4 text-gray-500" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )}
</div>
    </div>
  )
}
