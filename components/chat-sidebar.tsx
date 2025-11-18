"use client"
import Image from "next/image"
import "@/styles/sidebar-settings-icon.css"
import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
// import settingIcon from "@/public/settings.svg"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowLeft, User, LogOut, Search, Clock, Plus, Trash2, Link, Pencil, MoreVertical, Folder, FolderOpen } from "lucide-react"
import { SidebarToggleIcon } from "@/components/ui/sidebar-toggle-icon"
import { useProjects } from "@/contexts/project-context"
import { getUserProjectsPaginated, deleteProject, getProjectSessions, updateProject } from "@/lib/api"

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
  activeProjectId?: string | null
  activeSessionId?: string | null
}

export const ChatSidebar = React.memo(function ChatSidebar({ 
  user, 
  onBackToDashboard, 
  onLogout, 
  onProjectSelect,
  showProjects = false,
  collapsed: collapsedProp,
  setCollapsed: setCollapsedProp,
  activeProjectId,
  activeSessionId
}: ChatSidebarProps) {
  const [selectingProjectId, setSelectingProjectId] = useState<null | string>(null);
  const { projects: contextProjects, pagination: contextPagination, refreshProjects, createProject } = useProjects()
  const [projects, setProjects] = useState(contextProjects)
  const [pagination, setPagination] = useState(contextPagination)
  const [loadingMore, setLoadingMore] = useState(false)
  const [internalCollapsed, internalSetCollapsed] = useState(false)
  const collapsed = collapsedProp !== undefined ? collapsedProp : internalCollapsed
  const setCollapsed = setCollapsedProp !== undefined ? setCollapsedProp : internalSetCollapsed
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const router = useRouter()

  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null)
  const [isDeletingProject, setIsDeletingProject] = useState(false)
  const [checkingDeleteProjectId, setCheckingDeleteProjectId] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [projectToEdit, setProjectToEdit] = useState<{ id: string; title: string } | null>(null)
  const [editProjectName, setEditProjectName] = useState("")
  const [isUpdatingProject, setIsUpdatingProject] = useState(false)
  const [deleteWarningInfo, setDeleteWarningInfo] = useState<{
    sessionsCount: number
    documentsCount: number
  }>({ sessionsCount: 0, documentsCount: 0 })
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [allSessions, setAllSessions] = useState<Array<{id: string, projectId: string, projectTitle: string, title: string}>>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [projectSessions, setProjectSessions] = useState<Map<string, Array<{id: string, title: string}>>>(new Map());
  const [loadingProjectSessions, setLoadingProjectSessions] = useState<Set<string>>(new Set());
  const [openContextMenu, setOpenContextMenu] = useState<string | null>(null);

  // Sync local state with context when context changes
  React.useEffect(() => {
    setProjects(contextProjects)
    setPagination(contextPagination)
  }, [contextProjects, contextPagination])

  // Auto-expand project when active session is set
  React.useEffect(() => {
    if (!activeSessionId) return

    let projectIdToExpand: string | null = null

    // If we have activeProjectId, use it directly
    if (activeProjectId) {
      projectIdToExpand = activeProjectId
    } else {
      // If we don't have activeProjectId, find it from allSessions
      const sessionData = allSessions.find(s => s.id === activeSessionId)
      if (sessionData && sessionData.projectId) {
        projectIdToExpand = sessionData.projectId
      }
    }

    if (!projectIdToExpand) return

    // Check if project is already expanded
    setExpandedProjects(prev => {
      if (prev.has(projectIdToExpand!)) {
        return prev
      }
      return new Set(prev).add(projectIdToExpand!)
    })

    // Load sessions if not already loaded
    setProjectSessions(prev => {
      if (prev.has(projectIdToExpand!)) {
        return prev
      }
      
      // Start loading
      setLoadingProjectSessions(loading => new Set(loading).add(projectIdToExpand!))
      
      getProjectSessions(projectIdToExpand!, 1)
        .then(response => {
          const validSessions = response.results.filter(session => 
            session.conversation_history && session.conversation_history.length > 0
          )
          const sessions = validSessions.map(session => ({
            id: session.id,
            title: session.proposal_title || session.initial_idea || 'Untitled Session'
          }))
          setProjectSessions(prev => new Map(prev).set(projectIdToExpand!, sessions))
        })
        .catch(error => {
          console.error('Error loading project sessions:', error)
          setProjectSessions(prev => new Map(prev).set(projectIdToExpand!, []))
        })
        .finally(() => {
          setLoadingProjectSessions(prev => {
            const newSet = new Set(prev)
            newSet.delete(projectIdToExpand!)
            return newSet
          })
        })
      
      return prev
    })
  }, [activeSessionId, activeProjectId, allSessions])

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openContextMenu) {
        // Close menu and unselect project
        setOpenContextMenu(null)
      }
    }

    if (openContextMenu) {
      // Small delay to prevent immediate closing when opening
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleClickOutside)
      }, 100)
      
      return () => {
        clearTimeout(timeoutId)
        document.removeEventListener('click', handleClickOutside)
      }
    }
  }, [openContextMenu])

  const handleNewProjectClick = () => {
    setNewProjectName("")
    setShowNewProjectDialog(true)
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return

    setIsCreatingProject(true)
    try {
      await createProject(newProjectName.trim())
      setProjects([...contextProjects])
      setShowNewProjectDialog(false)
      setNewProjectName("")
    } catch (error) {
    } finally {
      setIsCreatingProject(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateProject()
    }
  }

  const loadAllSessions = async () => {
    setLoadingSessions(true)
    setAllSessions([]) // Clear previous sessions
    
    try {
      // Load sessions from all projects in parallel and update as they complete
      const allSessionsData: Array<{id: string, projectId: string, projectTitle: string, title: string}> = []
      
      // Create promises that update state as they resolve
      const sessionPromises = projects.map(async (project) => {
        try {
          const response = await getProjectSessions(project.id, 1)
          const validSessions = response.results.filter(session => 
            session.conversation_history && session.conversation_history.length > 0
          )
          
          const projectSessions = validSessions.map(session => ({
            id: session.id,
            projectId: project.id,
            projectTitle: project.title,
            title: session.proposal_title || session.initial_idea || 'Untitled Session'
          }))
          
          // Update state immediately as this project's sessions load
          if (projectSessions.length > 0) {
            setAllSessions(prev => [...prev, ...projectSessions])
          }
          
          return projectSessions
        } catch (error) {
          return []
        }
      })
      
      // Wait for all to complete (but state is already updating progressively)
      await Promise.all(sessionPromises)
    } catch (error) {
      setAllSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }

  const handleSearchClick = async () => {
    if (!showSearchInput) {
      setShowSearchInput(true)
      setSearchTerm("")
      await loadAllSessions()
    } else {
      setShowSearchInput(false)
      setSearchTerm("")
    }
  }

  const handleSessionClick = (sessionId: string, projectId: string) => {
    setShowSearchInput(false)
    setSearchTerm("")
    router.push(`/chat/${sessionId}?project=${projectId}`)
  }

  const filteredSessions = allSessions.filter(session => 
    session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    session.projectTitle.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredProjects = projects.filter(project => 
    project.title.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const toggleProjectExpansion = async (projectId: string) => {
    const isExpanded = expandedProjects.has(projectId)
    
    if (isExpanded) {
      // Collapse
      setExpandedProjects(prev => {
        const newSet = new Set(prev)
        newSet.delete(projectId)
        return newSet
      })
    } else {
      // Expand - load sessions if not already loaded
      setExpandedProjects(prev => new Set(prev).add(projectId))
      
      if (!projectSessions.has(projectId)) {
        setLoadingProjectSessions(prev => new Set(prev).add(projectId))
        try {
          const response = await getProjectSessions(projectId, 1)
          const validSessions = response.results.filter(session => 
            session.conversation_history && session.conversation_history.length > 0
          )
          const sessions = validSessions.map(session => ({
            id: session.id,
            title: session.proposal_title || session.initial_idea || 'Untitled Session'
          }))
          setProjectSessions(prev => new Map(prev).set(projectId, sessions))
        } catch (error) {
          console.error('Error loading project sessions:', error)
          setProjectSessions(prev => new Map(prev).set(projectId, []))
        } finally {
          setLoadingProjectSessions(prev => {
            const newSet = new Set(prev)
            newSet.delete(projectId)
            return newSet
          })
        }
      }
    }
  }

  const handleEditProject = (projectId: string, projectTitle: string) => {
    setProjectToEdit({ id: projectId, title: projectTitle })
    setEditProjectName(projectTitle)
    setShowEditDialog(true)
  }

  const confirmEditProject = async () => {
    if (!projectToEdit || !editProjectName.trim()) return

    setIsUpdatingProject(true)
    try {
      await updateProject(projectToEdit.id, { title: editProjectName.trim() })
      await refreshProjects()
      setShowEditDialog(false)
      setProjectToEdit(null)
      setEditProjectName("")
    } catch (error: any) {
      alert(error.message || "Failed to update project. Please try again.")
    } finally {
      setIsUpdatingProject(false)
    }
  }

  const handleDeleteProject = async (projectId: string, projectTitle: string) => {
    setCheckingDeleteProjectId(projectId);
    try {
      const sessionsResponse = await getProjectSessions(projectId, 1)
      const sessions = sessionsResponse.results || []
      const sessionsCount = sessions.length
      const documentsCount = sessions.filter(session => 
        session.document && (session.document.content || session.document.id) || 
        session.is_proposal_generated
      ).length
      setDeleteWarningInfo({ sessionsCount, documentsCount })
      setProjectToDelete(projectId)
      setShowDeleteDialog(true)
    } catch (error) {
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
      setProjects(prev => prev.filter(p => p.id !== projectToDelete))
      await refreshProjects()
      
      setShowDeleteDialog(false)
      setProjectToDelete(null)
      setDeleteWarningInfo({ sessionsCount: 0, documentsCount: 0 })
    } catch (error) {
      alert("Failed to delete project. Please try again.")
    } finally {
      setIsDeletingProject(false)
    }
  }

  return (
    <div
      className={`bg-[#0a0a0a] border-r border-[#2a2a2a] flex flex-col h-full transition-all duration-200 ${collapsed ? 'w-[64px] min-w-[64px]' : 'w-[256px] min-w-[256px]'} relative md:relative z-20 overflow-visible
        ${!collapsed ? 'fixed top-0 left-0 h-screen max-h-screen md:static md:h-full md:max-h-full' : ''}
        ${!collapsed ? 'shadow-2xl' : ''}
        ${!collapsed ? 'md:shadow-none' : ''}
        ${!collapsed ? 'md:relative' : ''}
      `}
      style={{ zIndex: !collapsed ? 50 : 20 }}
      onMouseEnter={() => setSidebarHovered(true)}
      onMouseLeave={() => setSidebarHovered(false)}
    >

      {/* Header */}
  <div className={`p-4 relative overflow-visible${collapsed ? ' flex flex-col items-center justify-center px-2 py-4' : ' flex flex-col items-start justify-between'}`}
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
                <span className="flex items-center space-x-2 flex-1">
                  <span className=" font-medium tracking-widest">Ilham</span>
                  <div className="group ml-auto mr-3">
                    <button
                      className="p-1.5 rounded hover:bg-[#232326] transition-colors"
                      style={{ background: 'none', border: 'none' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setCollapsed(true)
                      }}
                      aria-label="Collapse sidebar"
                    >
                      <SidebarToggleIcon className="w-6 h-6 text-white hover:cursor-pointer hover:text-gray-400" />
                    </button>
                  </div>
                </span>
              )}
            </>
          )}
        </span>
        {!collapsed && (
          !showProjects && (
            <Button
              onClick={onBackToDashboard}
              className="w-full bg-transparent border border-[#2a2a2a] hover:bg-[#1a1a1a] text-white justify-start"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="ml-2">Back to Dashboard</span>
            </Button>
          )
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
                  <Image src="/new-project.svg" alt="New Project" width={24} height={24} className="w-6 h-6" />
                </button>
                <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-[#232326]">
                  New Project
                </div>
              </div>
              <div className="relative group">
                <button
                  className="p-2 rounded hover:bg-[#232326] transition-colors"
                  onClick={onBackToDashboard}
                  aria-label="New Document"
                >
                  <Image src="/new-chat.svg" alt="New Document" width={24} height={24} className="w-6 h-6" />
                </button>
                <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-[#232326]">
                  New Document
                </div>
              </div>
              <div className="relative group">
                <button 
                  className="p-2 rounded hover:bg-[#232326] transition-colors" 
                  aria-label="Search"
                  onClick={handleSearchClick}
                >
                  <Search className="w-6 h-6 text-[#BCBCBC]" />
                </button>
                <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black text-[#BCBCBC] text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-[#232326]">
                  Search
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="relative group">
                <button 
                  className="p-2 rounded hover:bg-[#232326] transition-colors" 
                  aria-label="Search"
                  onClick={handleSearchClick}
                >
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
            <div className="p-4 space-y-2">
              <div 
                className="flex items-center space-x-2 p-2 text-white cursor-pointer hover:bg-[#1a1a1a] rounded"
                onClick={handleNewProjectClick}
              >
                <Image src="/new-project.svg" alt="New Project" width={20} height={20} className="w-5 h-5" />
                <span className="text-sm text-white">New Project</span>
              </div>
              <div 
                className="flex items-center space-x-2 p-2 text-white cursor-pointer hover:bg-[#1a1a1a] rounded"
                onClick={onBackToDashboard}
              >
                <Image src="/new-chat.svg" alt="New Document" width={20} height={20} className="w-5 h-5" />
                <span className="text-sm text-white">New Document</span>
              </div>
              <div>
                {showSearchInput ? (
                  <div className="w-full space-y-2">
                    <div className="relative flex items-center">
                      <Search className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                      <Input
                        autoFocus
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Search..."
                        className="w-full bg-[#18181b] border-[#2a2a2a] text-white text-xs pl-9 pr-8 py-2 h-9 rounded"
                        onBlur={(e) => {
                          // Keep search open if there's text or if clicking on results
                          if (!searchTerm && !e.relatedTarget) {
                            // Only close if clicking outside and no text
                          }
                        }}
                      />
                      <button
                        className="absolute right-2 p-1 text-gray-400 hover:text-white rounded transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowSearchInput(false)
                          setSearchTerm("")
                        }}
                        title="Close search"
                        tabIndex={-1}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {/* Search Results - Documents */}
                    {searchTerm && (
                      <div className="max-h-[200px] overflow-y-auto space-y-1 mb-2">
                        {loadingSessions && allSessions.length === 0 ? (
                          <div className="flex items-center justify-center py-4">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              <div className="text-gray-400 text-xs">Loading documents...</div>
                            </div>
                          </div>
                        ) : filteredSessions.length > 0 ? (
                          <>
                            <div className="px-2 py-1">
                              <span className="text-xs text-gray-500 uppercase tracking-wider">Documents</span>
                            </div>
                            {filteredSessions.map((session) => {
                              const isActiveSession = activeSessionId === session.id;
                              return (
                                <div
                                  key={session.id}
                                  onClick={() => handleSessionClick(session.id, session.projectId)}
                                  className={`flex items-center space-x-3 p-2 cursor-pointer rounded-lg transition-colors group ${
                                    isActiveSession ? 'bg-[#232326]' : 'hover:bg-[#232326]'
                                  }`}
                                >
                                  <Folder className={`w-4 h-4 flex-shrink-0 ${
                                    isActiveSession ? 'text-green-400' : 'text-gray-400'
                                  }`} />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm truncate transition-colors ${
                                      isActiveSession 
                                        ? 'text-green-400' 
                                        : 'text-white group-hover:text-blue-400'
                                    }`}>
                                      {session.title}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate">
                                      {session.projectTitle}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div className="flex items-center justify-center py-4">
                            <div className="text-gray-400 text-xs text-center">
                              No documents found matching your search
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex items-center space-x-2 p-2 text-white cursor-pointer hover:bg-[#1a1a1a] rounded"
                    onClick={handleSearchClick}
                  >
                    <Search className="w-5 h-5 text-white" />
                    <span className="text-sm text-white">Search</span>
                  </div>
                )}
              </div>
            </div>
            {/* Projects Label */}
            <div className="px-4 py-2">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Projects</span>
            </div>
            {/* Projects List */}
            {projects && projects.length > 0 ? (
              <div className="p-2">
                {(showSearchInput && searchTerm ? filteredProjects : projects).map((project) => {
                  const isChecking = checkingDeleteProjectId === project.id;
                  const isExpanded = expandedProjects.has(project.id);
                  const isLoadingSessions = loadingProjectSessions.has(project.id);
                  const sessions = projectSessions.get(project.id) || [];
                  
                  const isContextMenuOpen = openContextMenu === project.id;
                  const isActiveProject = activeProjectId === project.id;
                  
                  return (
                    <div key={project.id + (isChecking ? '-checking' : '')} className="mb-1">
                      <div
                        className={`flex items-center space-x-3 p-3 rounded-lg group relative ${isChecking ? 'opacity-50' : ''} ${
                          isContextMenuOpen || isActiveProject ? 'bg-[#232326]' : 'hover:bg-[#1a1a1a]'
                        }`}
                      >
                        {/* Folder icon - click to toggle dropdown */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleProjectExpansion(project.id)
                          }}
                          className="p-1 hover:bg-[#232326] rounded transition-colors flex-shrink-0"
                          title={isExpanded ? "Collapse documents" : "Expand documents"}
                        >
                          {isExpanded ? (
                            <FolderOpen className={`w-4 h-4 flex-shrink-0 ${
                              isContextMenuOpen || isActiveProject ? 'text-green-400' : 'text-gray-400'
                            }`} />
                          ) : (
                            <Folder className={`w-4 h-4 flex-shrink-0 ${
                              isContextMenuOpen || isActiveProject ? 'text-green-400' : 'text-gray-400'
                            }`} />
                          )}
                        </button>
                        
                        {/* Project title - click for navigation */}
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={async () => {
                            if (!selectingProjectId) {
                              setSelectingProjectId(project.id);
                              try {
                                // Load sessions for the selected project
                                setLoadingProjectSessions(prev => new Set(prev).add(project.id));
                                try {
                                  const response = await getProjectSessions(project.id, 1);
                                  const validSessions = response.results.filter(session => 
                                    session.conversation_history && session.conversation_history.length > 0
                                  );
                                  const sessions = validSessions.map(session => ({
                                    id: session.id,
                                    title: session.proposal_title || session.initial_idea || 'Untitled Session'
                                  }));
                                  setProjectSessions(prev => new Map(prev).set(project.id, sessions));
                                } catch (error) {
                                  console.error('Error loading project sessions:', error);
                                } finally {
                                  setLoadingProjectSessions(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(project.id);
                                    return newSet;
                                  });
                                }
                                await onProjectSelect?.(project.id);
                              } finally {
                                setSelectingProjectId(null);
                              }
                            }
                          }}
                          style={{ cursor: selectingProjectId ? 'not-allowed' : 'pointer' }}
                        >
                          <p className={`text-sm truncate transition-colors ${
                            isContextMenuOpen || isActiveProject
                              ? 'text-green-400' 
                              : 'text-white group-hover:text-green-400'
                          }`}>
                            {project.title}
                          </p>
                        </div>
                        
                        {/* Three dots menu button */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (openContextMenu === project.id) {
                                // Close menu and unselect
                                setOpenContextMenu(null)
                              } else {
                                // Open menu and select project
                                setOpenContextMenu(project.id)
                              }
                            }}
                            className={`p-1 rounded transition-colors ${
                              isContextMenuOpen 
                                ? 'bg-[#2a2a2a] opacity-100' 
                                : isActiveProject
                                ? 'hover:bg-[#232326] opacity-100'
                                : 'hover:bg-[#232326] opacity-0 group-hover:opacity-100'
                            }`}
                            title="More options"
                            disabled={isChecking || !!selectingProjectId}
                          >
                            <MoreVertical className={`w-4 h-4 ${isContextMenuOpen ? 'text-white' : 'text-gray-400'}`} />
                          </button>
                          
                          {/* Context Menu */}
                          {openContextMenu === project.id && (
                            <div 
                              className="absolute -right-2 top-8 z-50 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl min-w-[180px] overflow-hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenContextMenu(null)
                                  handleEditProject(project.id, project.title)
                                }}
                                className="w-full flex items-center space-x-2 px-4 py-2.5 text-white hover:bg-[#232326] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isChecking || !!selectingProjectId || isUpdatingProject}
                              >
                                <Pencil className="w-4 h-4 text-white" />
                                <span className="text-sm">Rename project</span>
                              </button>
                              <div className="h-px bg-[#2a2a2a]"></div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenContextMenu(null)
                                  handleDeleteProject(project.id, project.title)
                                }}
                                className="w-full flex items-center space-x-2 px-4 py-2.5 text-red-400 hover:bg-[#232326] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={isChecking || !!selectingProjectId}
                              >
                                {isChecking ? (
                                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                                  </svg>
                                ) : (
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                )}
                                <span className="text-sm">Delete project</span>
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Loader overlay for selecting project */}
                        {selectingProjectId === project.id && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 rounded-lg">
                            <svg className="w-6 h-6 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                            </svg>
                          </div>
                        )}
                      </div>
                      
                      {/* Documents Dropdown */}
                      {isExpanded && (
                        <div className="ml-6 mt-1 mb-2 space-y-1">
                          {isLoadingSessions ? (
                            <div className="flex items-center justify-center py-2">
                              <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                              </svg>
                            </div>
                          ) : sessions.length > 0 ? (
                            sessions.map((session) => {
                              const isActiveSession = activeSessionId === session.id;
                              return (
                                <div
                                  key={session.id}
                                  onClick={() => handleSessionClick(session.id, project.id)}
                                  className={`flex items-center space-x-2 p-2 pl-4 cursor-pointer rounded-lg group ${
                                    isActiveSession ? 'bg-[#232326]' : 'hover:bg-[#1a1a1a]'
                                  }`}
                                >
                                  <Folder className={`w-3 h-3 flex-shrink-0 ${
                                    isActiveSession ? 'text-green-400' : 'text-gray-400'
                                  }`} />
                                  <p className={`text-xs truncate transition-colors ${
                                    isActiveSession 
                                      ? 'text-green-400' 
                                      : 'text-gray-400 group-hover:text-blue-400'
                                  }`}>
                                    {session.title}
                                  </p>
                                </div>
                              );
                            })
                          ) : (
                            <div className="p-2 pl-4 text-xs text-gray-500">
                              No documents found
                            </div>
                          )}
                        </div>
                      )}
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

      <div className={`border-t border-[#2a2a2a] ${collapsed ? 'flex flex-col items-center justify-center gap-2 p-2' : 'flex items-center justify-between p-4'}`}>
        {collapsed ? (
          <>
            <div className="flex flex-col items-center gap-4 w-full">
              <Button size="icon" variant="ghost" className="button-settings text-[#BCBCBC] hover:text-black mx-auto" aria-label="Settings" onClick={() => router.push('/settings')}>
                <Image src="/settings.svg" alt="Settings" width={20} height={20} className="w-5 h-5 sidebar-settings-icon" />
              </Button>
              <Button size="icon" variant="ghost" className="text-[#BCBCBC] hover:text-black mx-auto" onClick={onLogout} aria-label="Logout">
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">{user?.first_name || user?.username || 'User'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Button size="icon" variant="ghost" className="button-settings text-gray-400 hover:text-black" aria-label="Settings" onClick={() => router.push('/settings')}>
                <Image src="/settings.svg" alt="Settings" width={16} height={16} className="w-4 h-4 sidebar-settings-icon" />
              </Button>
              <Button size="sm" variant="ghost" className="text-gray-400 hover:text-black" onClick={onLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
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

      {/* Search Modal */}
      <Dialog open={showSearchModal} onOpenChange={setShowSearchModal}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white">Search Projects</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            {/* Search Input */}
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={modalSearchTerm}
                onChange={e => setModalSearchTerm(e.target.value)}
                placeholder="Search documents by title or project..."
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-[#3a3a3a]"
              />
            </div>
            
            {/* Documents List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {loadingSessions && allSessions.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    <div className="text-gray-400 text-sm">Loading projects...</div>
                  </div>
                </div>
              ) : filteredSessions.length > 0 ? (
                <div className="space-y-1">
                  {filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => handleSessionClick(session.id, session.projectId)}
                      className="flex items-center space-x-3 p-3 hover:bg-[#232326] cursor-pointer rounded-lg transition-colors group"
                    >
                      <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate group-hover:text-blue-400 transition-colors">
                          {session.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {session.projectTitle}
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
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-400 text-center">
                    {modalSearchTerm ? 'No documents found matching your search' : 'No documents available'}
                  </div>
                </div>
              )}
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
                        <li>• <strong>{deleteWarningInfo.sessionsCount}</strong> document{deleteWarningInfo.sessionsCount !== 1 ? 's' : ''} will be deleted</li>
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

      {/* Edit Project Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-gray-300">
              <label htmlFor="edit-project-name" className="block text-sm font-medium mb-2">
                Project Name
              </label>
              <Input
                id="edit-project-name"
                type="text"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                placeholder="Enter project name"
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder-gray-500 focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isUpdatingProject && editProjectName.trim()) {
                    confirmEditProject()
                  }
                }}
                disabled={isUpdatingProject}
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false)
                  setProjectToEdit(null)
                  setEditProjectName("")
                }}
                className="border-[#2a2a2a] text-white hover:bg-[#2a2a2a] hover:text-white bg-transparent"
                disabled={isUpdatingProject}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmEditProject}
                disabled={isUpdatingProject || !editProjectName.trim()}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdatingProject ? "Updating..." : "Update Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
})
