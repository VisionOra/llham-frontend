"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MainLayout } from "@/components/main-layout"
import { useProjects } from "@/contexts/project-context"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, MessageSquare, FileText, Loader2, Trash2 } from "lucide-react"
import { getProjectSessions, deleteSession, createSession, type CreateSessionRequest, communicateWithMasterAgent } from "@/lib/api"

// Local Session interface that matches what ProjectSidebar expects
interface LocalSession {
  id: string
  project_id: string
  title: string
  initial_idea: string
  agent_mode: string
  has_document: boolean
  document?: any
  created_at: string
  updated_at: string
  proposal_title?: string
  current_stage: string
  is_proposal_generated: boolean
  conversation_history: Array<{
    role: string;
    message: string;
    timestamp: string;
  }>
  user: string
}

function ProjectSessionsContent() {
  const params = useParams()
  const router = useRouter()
  const { projects, selectProject } = useProjects()
  const projectId = params.projectId as string

  const [projectSessions, setProjectSessions] = useState<LocalSession[]>([])
  const [pagination, setPagination] = useState<any>(null)
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [isDeletingSession, setIsDeletingSession] = useState(false)
  const [checkingDeleteSessionId, setCheckingDeleteSessionId] = useState<string | null>(null)
  const [showPopup, setShowPopup] = useState(false)
  const [popupInitialIdea, setPopupInitialIdea] = useState("")
  const [popupMessage, setPopupMessage] = useState("")

  // Find the current project
  const currentProject = projects.find(p => p.id === projectId)

  useEffect(() => {
    if (currentProject) {
      selectProject(currentProject)
      loadProjectSessions()
    }
  }, [currentProject, projectId])

  const loadProjectSessions = async () => {
    if (!projectId) return
    setLoadingSessions(true)
    try {
      const response = await getProjectSessions(projectId, pagination?.current_page || 1)
      setPagination(response.pagination)
      // Clean up sessions with 0 messages
      const sessionsToDelete: string[] = []
      const validSessions = response.results.filter((session) => {
        if (session.conversation_history.length === 0) {
          sessionsToDelete.push(session.id)
          return false
        }
        return true
      })
      for (const sessionId of sessionsToDelete) {
        try {
          await deleteSession(sessionId)
        } catch (error) {
          // Optionally handle error
        }
      }
      const mappedSessions: LocalSession[] = validSessions.map((session) => ({
        id: session.id,
        project_id: session.project.id,
        title: session.proposal_title || session.initial_idea || 'Untitled Session',
        initial_idea: session.initial_idea,
        agent_mode: session.agent_mode,
        has_document: !!session.document || session.is_proposal_generated,
        document: session.document,
        created_at: session.created_at,
        updated_at: session.updated_at,
        proposal_title: session.proposal_title,
        current_stage: session.current_stage,
        is_proposal_generated: session.is_proposal_generated,
        conversation_history: session.conversation_history,
        user: session.user
      }))
      setProjectSessions(mappedSessions)
    } catch (error) {
      setProjectSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }
  const [loadingMore, setLoadingMore] = useState(false)

  const handleSessionSelect = (sessionId: string) => {
    // Navigate to chat session with project ID
    router.push(`/chat/${sessionId}?project=${projectId}`)
  }

  const handleNewSession = () => {
    // Show popup first
    setShowPopup(true)
    setPopupInitialIdea("")
    setPopupMessage("")
  }

  const handlePopupSubmit = async () => {
    if (!projectId || !popupInitialIdea.trim() || !popupMessage.trim()) return

    setCreatingSession(true)
    setShowPopup(false)
    try {
      const sessionData: CreateSessionRequest = {
        project_id: projectId,
        initial_idea: popupInitialIdea.trim(),
        agent_mode: "conversation"
      }
      
      const newSession = await createSession(sessionData)
      
      // Call communicate API after session is created with popup values
      try {
        const communicateResponse = await communicateWithMasterAgent({
          session_id: newSession.id,
          project_id: projectId,
          message: popupMessage.trim()
        })
        
        // Store communicate response in sessionStorage to handle it on chat page
        if (communicateResponse) {
          sessionStorage.setItem('pendingCommunicateResponse', JSON.stringify({
            message: communicateResponse.message,
            proposal_html: communicateResponse.proposal_html,
            proposal_title: communicateResponse.proposal_title,
            session_id: communicateResponse.session_id
          }))
        }
      } catch (communicateError) {
        console.error("Error calling communicate API:", communicateError)
        // Continue even if communicate API fails
      }
      
      // Store message in sessionStorage to display it in chat
      sessionStorage.setItem('pendingMessage', popupMessage.trim())
      sessionStorage.setItem('pendingSessionId', newSession.id)
      
      router.push(`/chat/${newSession.id}?project=${projectId}`)
    } catch (error) {
      setShowPopup(true) // Show popup again on error
    } finally {
      setCreatingSession(false)
    }
  }

  const handlePopupCancel = () => {
    setShowPopup(false)
    setPopupInitialIdea("")
    setPopupMessage("")
  }

  const handleProjectSelect = (projectId: string) => {
    router.push(`/project/${projectId}`)
  }

  const handleDeleteSession = async (sessionId: string, sessionTitle: string) => {
    setCheckingDeleteSessionId(sessionId);

    setTimeout(() => {
      setSessionToDelete(sessionId);
      setShowDeleteDialog(true);
      setCheckingDeleteSessionId(null);
    }, 300);
  }

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return

    setIsDeletingSession(true)
    try {
      await deleteSession(sessionToDelete)

      setProjectSessions(prev => prev.filter(s => s.id !== sessionToDelete))
      
      setShowDeleteDialog(false)
      setSessionToDelete(null)
    } catch (error) {
      alert("Failed to delete session. Please try again.")
    } finally {
      setIsDeletingSession(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getSessionStatusBadge = (session: LocalSession) => {
    if (session.document && (session.document.content || session.document.id)) {
      return (
        <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700">
          <FileText className="w-3 h-3 mr-1" />
          Document
        </Badge>
      )
    }

    if (session.is_proposal_generated) {
      return (
        <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700">
          <FileText className="w-3 h-3 mr-1" />
          Document
        </Badge>
      )
    }

    switch (session.current_stage) {
      case "conversation":
        return (
          <Badge variant="outline" className="border-blue-700 text-blue-300">
            <MessageSquare className="w-3 h-3 mr-1" />
            Chat
          </Badge>
        )
      case "proposal_generation":
        return (
          <Badge variant="outline" className="border-yellow-700 text-yellow-300">
            Generating
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="border-green-700 text-green-300">
            Completed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-gray-700 text-gray-300">
            {session.current_stage}
          </Badge>
        )
    }
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto ">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 mt-12 sm:mt-10">
            <div>
              <h1 className="text-2xl font-semibold text-white mb-2">
                {currentProject?.title || 'Project Sessions'}
              </h1>
              <p className="text-gray-400">Choose a session to continue or start a new conversation</p>
            </div>
            <Button 
              onClick={handleNewSession}
              disabled={creatingSession}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {creatingSession ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  New Session
                </>
              )}
            </Button>
          </div>
        </div>
        {loadingSessions ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-400">Loading sessions...</div>
          </div>
        ) : projectSessions.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <h3 className="text-lg font-medium text-white mb-2">No sessions yet</h3>
            <p className="text-gray-400 mb-6">Start your first conversation in this project</p>
            <Button 
              onClick={handleNewSession}
              disabled={creatingSession}
              className="bg-white text-black hover:bg-gray-200"
            >
              {creatingSession ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating Session...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  New Session
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4" style={{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
              {projectSessions.map((session) => (
                <Card 
                  key={session.id} 
                  className="bg-[#1a1a1a] border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors group"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle 
                        className="text-white text-base truncate cursor-pointer flex-1"
                        onClick={() => handleSessionSelect(session.id)}
                      >
                        {session.proposal_title || session.initial_idea || 'Untitled Session'}
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        {getSessionStatusBadge(session)}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteSession(session.id, session.proposal_title || session.initial_idea || 'Untitled Session')
                          }}
                          className="p-1 hover:bg-red-600/20 rounded text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete session"
                          disabled={checkingDeleteSessionId === session.id || (isDeletingSession && sessionToDelete === session.id)}
                        >
                          {checkingDeleteSessionId === session.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isDeletingSession && sessionToDelete === session.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <CardDescription 
                      className="text-gray-400 text-sm cursor-pointer"
                      onClick={() => handleSessionSelect(session.id)}
                    >
                      {formatDate(session.updated_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent 
                    className="pt-0 cursor-pointer"
                    onClick={() => handleSessionSelect(session.id)}
                  >
                    <p className="text-gray-300 text-sm line-clamp-2">
                      {session.initial_idea}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                      <span>{session.conversation_history.length} messages</span>
                      <span>{session.current_stage}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {pagination?.has_next && (
                <div className="col-span-1 md:col-span-2 flex justify-center py-4">
                  <Button
                    className="bg-[#1a1a1a] border border-[#2a2a2a] text-white"
                    disabled={loadingMore}
                    onClick={async () => {
                      setLoadingMore(true)
                      try {
                        const nextPage = (pagination.current_page || 1) + 1
                        const response = await getProjectSessions(projectId, nextPage)
                        setPagination(response.pagination)
                        // Clean up sessions with 0 messages
                        const validSessions = response.results.filter((session) => session.conversation_history.length > 0)
                        const mappedSessions: LocalSession[] = validSessions.map((session) => ({
                          id: session.id,
                          project_id: session.project.id,
                          title: session.proposal_title || session.initial_idea || 'Untitled Session',
                          initial_idea: session.initial_idea,
                          agent_mode: session.agent_mode,
                          has_document: !!session.document || session.is_proposal_generated,
                          document: session.document,
                          created_at: session.created_at,
                          updated_at: session.updated_at,
                          proposal_title: session.proposal_title,
                          current_stage: session.current_stage,
                          is_proposal_generated: session.is_proposal_generated,
                          conversation_history: session.conversation_history,
                          user: session.user
                        }))
                        setProjectSessions((prev) => [...prev, ...mappedSessions])
                      } catch (e) {
                      } finally {
                        setLoadingMore(false)
                      }
                    }}
                  >
                    {loadingMore ? 'Loading...' : 'Load More'}
                  </Button>
                </div>
              )}
            </div>
        )}
      </div>

      {/* New Session Popup */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white">New Session Details</DialogTitle>
            <DialogDescription className="text-gray-400">
              Please provide your initial idea and message to start a new session
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="initial_idea" className="text-sm font-medium text-gray-300">
                Initial Idea *
              </Label>
              <Textarea
                id="initial_idea"
                value={popupInitialIdea}
                onChange={(e) => setPopupInitialIdea(e.target.value)}
                placeholder="Describe your project idea..."
                rows={4}
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && popupInitialIdea.trim() && popupMessage.trim()) {
                    e.preventDefault()
                    handlePopupSubmit()
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message" className="text-sm font-medium text-gray-300">
                Message *
              </Label>
              <Textarea
                id="message"
                value={popupMessage}
                onChange={(e) => setPopupMessage(e.target.value)}
                placeholder="Enter your message..."
                rows={3}
                className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && popupInitialIdea.trim() && popupMessage.trim()) {
                    e.preventDefault()
                    handlePopupSubmit()
                  }
                }}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handlePopupCancel}
                className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
                disabled={creatingSession}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePopupSubmit}
                disabled={!popupInitialIdea.trim() || !popupMessage.trim() || creatingSession}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingSession ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Session"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Session Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-300">
              Are you sure you want to delete this session? This action cannot be undone and all conversation history will be lost.
            </p>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false)
                  setSessionToDelete(null)
                }}
                className="border-[#2a2a2a] text-black hover:bg-[#2a2a2a] hover:text-white"
                disabled={isDeletingSession}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmDeleteSession}
                disabled={isDeletingSession}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeletingSession ? "Deleting..." : "Delete Session"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ProjectSessions() {
  return (
    <MainLayout>
      <ProjectSessionsContent />
    </MainLayout>
  )
}
