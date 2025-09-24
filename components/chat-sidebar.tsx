"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, User, LogOut, Search, Clock, Plus, Trash2, Link } from "lucide-react"
import { SidebarToggleIcon } from "@/components/ui/sidebar-toggle-icon"
import { useProjects } from "@/contexts/project-context"
import { getUserProjectsPaginated, deleteProject, getProjectSessions } from "@/lib/api"

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
  collapsed?: boolean
  setCollapsed?: (collapsed: boolean) => void
}

export const ChatSidebar = React.memo(function ChatSidebar({ 
  user, 
  onBackToDashboard, 
  onLogout, 
  onProjectSelect,
  showProjects = false,
  collapsed: collapsedProp,
  setCollapsed: setCollapsedProp
}: ChatSidebarProps) {
  const { projects: contextProjects, pagination: contextPagination, refreshProjects, createProject } = useProjects()
  const [projects, setProjects] = useState(contextProjects)
  const [pagination, setPagination] = useState(contextPagination)
  const [loadingMore, setLoadingMore] = useState(false)
  const [internalCollapsed, internalSetCollapsed] = useState(true)
  const collapsed = collapsedProp !== undefined ? collapsedProp : internalCollapsed
  const setCollapsed = setCollapsedProp !== undefined ? setCollapsedProp : internalSetCollapsed
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const router = useRouter()

  // Sync local state with context when context changes
  React.useEffect(() => {
    setProjects(contextProjects)
    setPagination(contextPagination)
  }, [contextProjects, contextPagination])
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  const [checkingDeleteProjectId, setCheckingDeleteProjectId] = useState<string | null>(null)
  const [deleteWarningInfo, setDeleteWarningInfo] = useState<{
    sessionsCount: number
    documentsCount: number
  }>({ sessionsCount: 0, documentsCount: 0 })
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleNewProjectClick = () => {
    setNewProjectName("")
    setShowNewProjectDialog(true)
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return

    setIsCreatingProject(true)
    try {
      await createProject(newProjectName.trim())
      // After context updates, sync local list so new project appears immediately
      setProjects([...contextProjects])
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

  const handleDeleteProject = async (projectId: string, projectTitle: string) => {
    setCheckingDeleteProjectId(projectId);
    try {
      // Check if project has sessions and documents
      const sessionsResponse = await getProjectSessions(projectId, 1)
      const sessions = sessionsResponse.results || []
      const sessionsCount = sessions.length
      // Count sessions with documents
      const documentsCount = sessions.filter(session => 
        session.document && (session.document.content || session.document.id) || 
        session.is_proposal_generated
      ).length
      setDeleteWarningInfo({ sessionsCount, documentsCount })
      setProjectToDelete(projectId)
      setShowDeleteDialog(true)
    } catch (error) {
      console.error("Failed to check project sessions:", error)
      // If we can't check sessions, still allow deletion but with generic warning
      setDeleteWarningInfo({ sessionsCount: 0, documentsCount: 0 })
      setProjectToDelete(projectId)
      setShowDeleteDialog(true)
    } finally {
      setCheckingDeleteProjectId(null);
    }
  }

  const confirmDeleteProject = async () => {
    if (!projectToDelete) return

    setIsDeletingProject(true)
    try {
      await deleteProject(projectToDelete)

      // Remove project from local state
      setProjects(prev => prev.filter(p => p.id !== projectToDelete))
      
      // Refresh projects from context
      await refreshProjects()
      
      setShowDeleteDialog(false)
      setProjectToDelete(null)
      setDeleteWarningInfo({ sessionsCount: 0, documentsCount: 0 })
    } catch (error) {
      console.error("Failed to delete project:", error)
      // You might want to show an error message here
      alert("Failed to delete project. Please try again.")
    } finally {
      setIsDeletingProject(false)
    }
  }

  return (
    <div
      className={`bg-[#0a0a0a] border-r border-[#2a2a2a] flex flex-col h-full transition-all duration-200 ${collapsed ? 'w-[64px] min-w-[64px]' : 'w-[256px] min-w-[256px]'} relative`}
      style={{ zIndex: 20 }}
      onMouseEnter={() => setSidebarHovered(true)}
      onMouseLeave={() => setSidebarHovered(false)}
    >

      {/* Header */}
  <div className={`p-4 border-b border-[#2a2a2a]${collapsed ? ' flex flex-col items-center justify-center px-2 py-4' : ' flex flex-col items-start justify-between'}`}
  >
        <span
          className={`flex items-center${collapsed ? ' justify-center mb-2 relative' : ' space-x-2 mb-4'} hover:cursor-pointer`}
          onClick={() => {
            if (collapsed && sidebarHovered) {
              setCollapsed(false)
            } else {
              router.push(`/`)
            }
          }}
          style={{ minHeight: 40, width: collapsed ? '100%' : undefined, justifyContent: 'center', alignItems: 'center' }}
        >
          {collapsed && sidebarHovered ? (
            <div className="relative group">
              <button
                className="w-10 h-10  flex items-center justify-center rounded hover:bg-[#232326] transition-colors"
                style={{ background: 'none', border: 'none', padding: 0 }}
                aria-label="Expand sidebar"
                tabIndex={-1}
              >
                <SidebarToggleIcon className="w-7 h-7 text-gray-400 hover:cursor-pointer hover:text-white" />
              </button>
              <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-[#232326]">
                Expand
              </div>
            </div>
          ) : (
            <>
              <span className="w-10 h-10 rounded flex items-center justify-center ms-">
                <span className="text-black text-xs font-bold"><img src="/logo.svg" alt="Icon" /></span>
              </span>
              {!collapsed && (
                <span className="flex items-center space-x-1">
                  <span className=" font-medium tracking-widest">Ilham</span>
                </span>
              )}
            </>
          )}
        </span>
        {!collapsed && (
          showProjects ? (
            <Button
              onClick={handleNewProjectClick}
              className="w-full bg-transparent border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white justify-start"
            >
              <Plus className="w-5 h-5" />
              <span className="ml-2">New Project</span>
            </Button>
          ) : (
            <Button
              onClick={onBackToDashboard}
              className="w-full bg-transparent border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white justify-start"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="ml-2">Back to Dashboard</span>
            </Button>
          )
        )}
        {/* Collapse button in expanded mode, next to logo */}
        {!collapsed && (
          <div className="absolute top-2 right-2 group">
            <button
              className="p-1 rounded hover:bg-[#232326] transition-colors"
              style={{ background: 'none', border: 'none' }}
              onClick={() => setCollapsed(true)}
              aria-label="Collapse sidebar"
            >
              <SidebarToggleIcon className="w-6 h-6 text-gray-400 mt-3 hover:cursor-pointer hover:text-white" />
            </button>
            <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-[#232326]">
              Collapse
            </div>
          </div>
        )}
      </div>

      {collapsed ? (
        <div className="flex-1 flex flex-col items-center py-4 gap-4">
          {showProjects ? (
            <>
              <div className="relative group">
                <button
                  className="p-2 rounded hover:bg-[#232326] transition-colors"
                  onClick={handleNewProjectClick}
                  aria-label="New Project"
                >
                  <Plus className="w-6 h-6 text-gray-300" />
                </button>
                <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-[#232326]">
                  New Project
                </div>
              </div>
              <div className="relative group">
                <button
                  className="p-2 rounded hover:bg-[#232326] transition-colors"
                  onClick={onBackToDashboard}
                  aria-label="New Chat"
                >
                  <Plus className="w-6 h-6 text-gray-300" />
                </button>
                <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-[#232326]">
                  New Chat
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="relative group">
                <button className="p-2 rounded hover:bg-[#232326] transition-colors" aria-label="Search">
                  <Search className="w-6 h-6 text-gray-300" />
                </button>
                <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-[#232326]">
                  Search
                </div>
              </div>
              <div className="relative group">
                <button className="p-2 rounded hover:bg-[#232326] transition-colors" aria-label="Projects">
                  <div className="w-6 h-6 border border-gray-400 rounded flex items-center justify-center text-gray-300"></div>
                </button>
                <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-[#232326]">
                  Projects
                </div>
              </div>
              <div className="relative group">
                <button className="p-2 rounded hover:bg-[#232326] transition-colors" aria-label="Recent Chats">
                  <Clock className="w-6 h-6 text-gray-300" />
                </button>
                <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-[#232326]">
                  Recent Chats
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        // ...existing code for expanded sidebar...
        showProjects ? (
          /* Projects List with additional options */
          <div className="flex-1 overflow-y-auto">
            {/* Navigation Options */}
            <div className="p-4 space-y-2 border-b border-[#2a2a2a]">
              <div 
                className="flex items-center space-x-2 p-2 text-gray-400 hover:text-white cursor-pointer hover:bg-[#1a1a1a] rounded"
                onClick={onBackToDashboard}
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm">New Chat</span>
              </div>
              <div
                className="flex items-center space-x-2 p-2 text-gray-400 hover:text-white cursor-pointer hover:bg-[#1a1a1a] rounded"
                onClick={() => setShowSearchInput((v) => !v)}
              >
                <Search className="w-4 h-4" />
                <span className="text-sm">Search</span>
              </div>
              {showSearchInput && (
                <div className="w-full mt-2 flex items-center gap-2">
                  <Input
                    autoFocus
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full bg-[#18181b] border-[#2a2a2a] text-white text-xs px-2 py-1 h-8"
                  />
                  <button
                    className="p-1 text-gray-400 hover:text-red-400 rounded transition-colors"
                    onClick={() => { setShowSearchInput(false); setSearchTerm(""); }}
                    title="Close search"
                    tabIndex={-1}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            {/* Projects List */}
            {projects && projects.length > 0 ? (
              <div className="p-2">
                {(searchTerm.trim() ? projects.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase())) : projects).map((project) => {
                  const isChecking = checkingDeleteProjectId === project.id;
                  return (
                    <div
                      key={project.id + (isChecking ? '-checking' : '')}
                      className="flex items-center space-x-3 p-3 hover:bg-[#1a1a1a] cursor-pointer rounded-lg mb-1 group"
                    >
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                      <div 
                        className="flex-1 min-w-0"
                        onClick={() => onProjectSelect?.(project.id)}
                      >
                        <p className="text-sm text-white truncate group-hover:text-blue-400 transition-colors">
                          {project.title}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProject(project.id, project.title)
                          }}
                          className="p-1 hover:bg-red-600/20 rounded text-gray-500 hover:text-red-400 transition-colors"
                          title="Delete project"
                          disabled={isChecking}
                        >
                          {isChecking ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                            </svg>
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                        <div className="text-gray-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {pagination?.has_next && (
                  <Button
                    className="w-full mt-2 bg-[#1a1a1a] border border-[#2a2a2a] text-white"
                    disabled={loadingMore}
                    onClick={async () => {
                      setLoadingMore(true)
                      try {
                        const nextPage = (pagination.current_page || 1) + 1
                        const response = await getUserProjectsPaginated(nextPage)
                        setProjects((prev: any) => [...prev, ...response.results])
                        setPagination(response.pagination)
                      } catch (e) {
                        // Optionally handle error
                      } finally {
                        setLoadingMore(false)
                      }
                    }}
                  >
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </Button>
                )}
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
        )
      )}

  {/* Spacer */}
  {!showProjects && !collapsed && <div className="flex-1"></div>}

      {/* Footer */}
      <div className={`border-t border-[#2a2a2a] flex items-center ${collapsed ? 'justify-center p-2' : 'justify-between p-4'}`}>
        {collapsed ? (
          <>
            <User className="w-5 h-5 text-gray-400" />
            <Button size="icon" variant="ghost" className="text-gray-400 hover:text-black ml-2" onClick={onLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">{user?.first_name || user?.username || 'User'}</span>
            </div>
            <Button size="sm" variant="ghost" className="text-gray-400 hover:text-black" onClick={onLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {/* New Project Dialog */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Enter project name"
              className="bg-[#232326] border-[#2a2a2a] text-white"
              autoFocus
              disabled={isCreatingProject}
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowNewProjectDialog(false)}
                className="border-[#2a2a2a] text-black hover:bg-[#2a2a2a] hover:text-white"
                disabled={isCreatingProject}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={isCreatingProject || !newProjectName.trim()}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isCreatingProject ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-gray-300">
              <p className="mb-3">Are you sure you want to delete this project? This action cannot be undone.</p>
              {deleteWarningInfo.sessionsCount > 0 && (
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 mb-3">
                  <div className="flex items-start space-x-2">
                    <div className="w-5 h-5 text-yellow-500 mt-0.5">⚠️</div>
                    <div className="text-sm">
                      <p className="font-medium text-yellow-300 mb-1">Warning: This project contains data</p>
                      <ul className="space-y-1 text-yellow-100">
                        <li>• <strong>{deleteWarningInfo.sessionsCount}</strong> session{deleteWarningInfo.sessionsCount !== 1 ? 's' : ''} will be deleted</li>
                        {deleteWarningInfo.documentsCount > 0 && (
                          <li>• <strong>{deleteWarningInfo.documentsCount}</strong> document{deleteWarningInfo.documentsCount !== 1 ? 's' : ''} will be permanently lost</li>
                        )}
                        <li>• All conversation history will be lost</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-red-300 font-medium">Are you still sure you want to proceed?</p>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setProjectToDelete(null)
                  setDeleteWarningInfo({ sessionsCount: 0, documentsCount: 0 })
                }}
                className="border-[#2a2a2a] text-black hover:bg-[#2a2a2a] hover:text-white"
                disabled={isDeletingProject}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteProject}
                disabled={isDeletingProject}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeletingProject ? "Deleting..." : "Yes, Delete Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})
