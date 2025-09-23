"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { MainLayout } from "@/components/main-layout"
import { useProjects } from "@/contexts/project-context"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, MessageSquare, FileText, Loader2 } from "lucide-react"
import { getProjectSessions, deleteSession, createSession, type CreateSessionRequest } from "@/lib/api"

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
  const [loadingSessions, setLoadingSessions] = useState(false)
  const [creatingSession, setCreatingSession] = useState(false)

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
      const projectWithSessions = await getProjectSessions(projectId)
      
      // Clean up sessions with 0 messages
      const sessionsToDelete: string[] = []
      const validSessions = projectWithSessions.sessions.filter((session) => {
        if (session.conversation_history.length === 0) {
          sessionsToDelete.push(session.id)
          return false
        }
        return true
      })
      
      // Delete sessions with 0 messages
      for (const sessionId of sessionsToDelete) {
        try {
          console.log(`Deleting empty session: ${sessionId}`)
          await deleteSession(sessionId)
        } catch (error) {
          console.error(`Failed to delete session ${sessionId}:`, error)
        }
      }
      
      // Map sessions to local format
      const mappedSessions: LocalSession[] = validSessions.map((session) => {
        return {
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
        }
      })
      setProjectSessions(mappedSessions)
    } catch (error) {
      console.error('Failed to load project sessions:', error)
      setProjectSessions([])
    } finally {
      setLoadingSessions(false)
    }
  }

  const handleSessionSelect = (sessionId: string) => {
    // Navigate to chat session
    router.push(`/chat/${sessionId}`)
  }

  const handleNewSession = async () => {
    if (!projectId) return

    setCreatingSession(true)
    try {
      console.log('Creating new session in project:', projectId)
      
      const sessionData: CreateSessionRequest = {
        project_id: projectId,
        initial_idea: "New conversation",
        agent_mode: "conversation"
      }
      
      const newSession = await createSession(sessionData)
      console.log('New session created:', newSession)
      
      // Navigate to the new session
      router.push(`/chat/${newSession.id}`)
    } catch (error) {
      console.error('Failed to create new session:', error)
    } finally {
      setCreatingSession(false)
    }
  }

  const handleProjectSelect = (projectId: string) => {
    router.push(`/project/${projectId}`)
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
    // Check if session has a document (either with content or just an ID)
    if (session.document && (session.document.content || session.document.id)) {
      return (
        <Badge variant="secondary" className="bg-green-900/50 text-green-300 border-green-700">
          <FileText className="w-3 h-3 mr-1" />
          Document
        </Badge>
      )
    }

    // Check if proposal has been generated (even without document content)
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
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4  overflow-y-auto pb-4">
              {projectSessions.map((session) => (
                <Card 
                  key={session.id} 
                  className="bg-[#1a1a1a] border-[#2a2a2a] hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                  onClick={() => handleSessionSelect(session.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-base truncate">
                        {session.proposal_title || session.initial_idea || 'Untitled Session'}
                      </CardTitle>
                      {getSessionStatusBadge(session)}
                    </div>
                    <CardDescription className="text-gray-400 text-sm">
                      {formatDate(session.updated_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
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
            </div>
          )}
        </div>
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
