"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, User, LogOut, Search, Clock, Plus } from "lucide-react"
import { useProjects } from "@/contexts/project-context"

interface ChatSidebarProps {
  user?: {
    first_name?: string
    username?: string
  }
  onBackToDashboard: () => void
  onLogout: () => void
  onProjectSelect?: (projectId: string) => void
  onNewProject?: () => void
  showProjects?: boolean
}

export const ChatSidebar = React.memo(function ChatSidebar({ 
  user, 
  onBackToDashboard, 
  onLogout, 
  onProjectSelect,
  onNewProject,
  showProjects = false 
}: ChatSidebarProps) {
  const { projects, createProject } = useProjects()
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [isCreatingProject, setIsCreatingProject] = useState(false)

  const handleNewProjectClick = () => {
    setNewProjectName("")
    setShowNewProjectDialog(true)
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return

    setIsCreatingProject(true)
    try {
      await createProject(newProjectName.trim())
      setShowNewProjectDialog(false)
      setNewProjectName("")
      // Optionally call onNewProject if you want to navigate somewhere after creation
    } catch (error) {
      console.error("Failed to create project:", error)
      // You might want to show an error message here
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateProject()
    }
  }

  return (
    <div className="w-64 bg-[#0a0a0a] border-r border-[#2a2a2a] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
            <span className="text-black text-xs font-bold">v0</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium">Ilham</span>
          </div>
        </div>

        {showProjects ? (
          <Button
            onClick={handleNewProjectClick}
            className="w-full bg-transparent border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white justify-start"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        ) : (
          <Button
            onClick={onBackToDashboard}
            className="w-full bg-transparent border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white justify-start"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        )}
      </div>

      {showProjects ? (
        /* Projects List with additional options */
        <div className="flex-1 overflow-y-auto">
          {/* Navigation Options */}
          <div className="p-4 space-y-2 border-b border-[#2a2a2a]">
            <div 
              className="flex items-center space-x-2 p-2 text-gray-400 hover:text-white cursor-pointer hover:bg-[#1a1a1a] rounded"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">New Chat</span>
            </div>
            <div className="flex items-center space-x-2 p-2 text-gray-400 hover:text-white cursor-pointer hover:bg-[#1a1a1a] rounded">
              <Search className="w-4 h-4" />
              <span className="text-sm">Search</span>
            </div>
            <div className="flex items-center space-x-2 p-2 text-gray-400 hover:text-white cursor-pointer hover:bg-[#1a1a1a] rounded">
              <div className="w-4 h-4 border border-gray-400 rounded"></div>
              <span className="text-sm">Projects</span>
            </div>
          </div>
          
          {/* Projects List */}
          {projects && projects.length > 0 ? (
            <div className="p-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => onProjectSelect?.(project.id)}
                  className="flex items-center space-x-3 p-3 hover:bg-[#1a1a1a] cursor-pointer rounded-lg mb-1 group"
                >
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate group-hover:text-blue-400 transition-colors">
                      {project.title}
                    </p>
                  </div>
                  <div className="text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">No projects yet</p>
              <p className="text-xs mt-1">Create your first project to get started</p>
            </div>
          )}
        </div>
      ) : (
        /* Navigation */
        <div className="p-4 space-y-2">
          <div className="flex items-center space-x-2 p-2 text-gray-400 hover:text-white cursor-pointer">
            <Search className="w-4 h-4" />
            <span className="text-sm">Search</span>
          </div>
          <div className="flex items-center space-x-2 p-2 text-gray-400 hover:text-white cursor-pointer">
            <div className="w-4 h-4 border border-gray-400 rounded"></div>
            <span className="text-sm">Projects</span>
          </div>
          <div className="flex items-center space-x-2 p-2 text-gray-400 hover:text-white cursor-pointer">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Recent Chats</span>
          </div>
        </div>
      )}

      {/* Spacer */}
      {!showProjects && <div className="flex-1"></div>}

      {/* Footer */}
      <div className="p-4 border-t border-[#2a2a2a] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">{user?.first_name || user?.username || 'User'}</span>
        </div>
        <Button size="sm" variant="ghost" className="text-gray-400 hover:text-black" onClick={onLogout}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Project Name</label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter project name..."
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowNewProjectDialog(false)}
                className="border-[#2a2a2a] text-black hover:bg-[#2a2a2a] hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || isCreatingProject}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isCreatingProject ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})
