"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { type Project, getUserProjects, createProject as apiCreateProject, type CreateProjectRequest } from "@/lib/api"
import { useAuth } from "./auth-context"

interface ProjectContextType {
  projects: Project[]
  pagination: {
    count: number;
    page_size: number;
    current_page: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
    next_page: number | null;
    previous_page: number | null;
  } | null;
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  createProject: (title: string) => Promise<void>;
  selectProject: (project: Project) => void;
  refreshProjects: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [pagination, setPagination] = useState<ProjectContextType['pagination']>(null)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const refreshProjects = async () => {
    if (!user) return

    setIsLoading(true)
    setError(null)

    try {
  const response = await getUserProjects()
  setProjects(response.results)
  setPagination(response.pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects")
    } finally {
      setIsLoading(false)
    }
  }

  const createProject = async (title: string) => {
    if (!user) {
      setError("User not authenticated")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const projectData: CreateProjectRequest = {
        title,
        created_by: user.id,
      }

      const newProject = await apiCreateProject(projectData)
      setProjects((prev) => [newProject, ...prev])
      setCurrentProject(newProject)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const selectProject = (project: Project) => {
    setCurrentProject(project)
  }

  useEffect(() => {
    if (user) {
      refreshProjects()
    } else {
      setProjects([])
      setPagination(null)
      setCurrentProject(null)
    }
  }, [user])

  const value: ProjectContextType = {
  projects,
  pagination,
  currentProject,
  isLoading,
  error,
  createProject,
  selectProject,
  refreshProjects,
  }

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProjects() {
  const context = useContext(ProjectContext)
  if (context === undefined) {
    throw new Error("useProjects must be used within a ProjectProvider")
  }
  return context
}
