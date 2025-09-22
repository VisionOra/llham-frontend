"use client"

import { useState, useEffect } from "react"

interface Project {
  id: string
  title: string
  created_at: string
  updated_at: string
}

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

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  // Mock data for now - replace with actual API calls
  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setProjects([
        {
          id: "1",
          title: "E-commerce Website",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "2",
          title: "Mobile App Development",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])

      setSessions([
        {
          id: "1",
          project_id: "1",
          title: "Initial Discussion",
          initial_idea: "Build an e-commerce platform",
          agent_mode: "conversation",
          has_document: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "2",
          project_id: "1",
          title: "Proposal Generated",
          initial_idea: "Build an e-commerce platform",
          agent_mode: "editor_mode",
          has_document: true,
          document: {
            id: "doc-1",
            title: "E-commerce Website Proposal",
            content: `
              <h1>E-commerce Website Development Proposal</h1>
              
              <h2>Executive Summary</h2>
              <p>This proposal outlines the development of a comprehensive e-commerce platform that will enable your business to sell products online effectively. Our solution will include modern design, secure payment processing, and robust inventory management.</p>
              
              <h2>Project Scope</h2>
              <ul>
                <li>Custom e-commerce website design</li>
                <li>Product catalog management</li>
                <li>Shopping cart and checkout system</li>
                <li>Payment gateway integration</li>
                <li>User account management</li>
                <li>Order tracking and management</li>
                <li>Mobile-responsive design</li>
                <li>SEO optimization</li>
              </ul>
              
              <h2>Technical Specifications</h2>
              <p>The platform will be built using modern web technologies including React.js for the frontend, Node.js for the backend, and PostgreSQL for the database. We'll implement secure authentication, SSL certificates, and PCI compliance for payment processing.</p>
              
              <h2>Timeline</h2>
              <table>
                <tr><th>Phase</th><th>Duration</th><th>Deliverables</th></tr>
                <tr><td>Planning & Design</td><td>2 weeks</td><td>Wireframes, UI/UX Design</td></tr>
                <tr><td>Development</td><td>6 weeks</td><td>Core functionality</td></tr>
                <tr><td>Testing & Launch</td><td>2 weeks</td><td>QA, Deployment</td></tr>
              </table>
              
              <h2>Investment</h2>
              <p>The total investment for this project is <strong>$15,000</strong>, which includes all development, testing, and initial deployment costs.</p>
              
              <blockquote>
                "This e-commerce solution will provide your business with a professional online presence and the tools needed to succeed in digital commerce."
              </blockquote>
            `,
            author: "Ilham AI",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])

      setLoading(false)
    }, 1000)
  }, [])

  const generateProjectTitle = (initialIdea: string): string => {
    // Simple AI-like title generation based on keywords
    const keywords = initialIdea.toLowerCase()

    if (keywords.includes("mobile") || keywords.includes("app")) {
      return "Mobile App Development"
    } else if (keywords.includes("website") || keywords.includes("web")) {
      return "Website Development"
    } else if (keywords.includes("ecommerce") || keywords.includes("e-commerce") || keywords.includes("shop")) {
      return "E-commerce Platform"
    } else if (keywords.includes("business") || keywords.includes("startup")) {
      return "Business Plan"
    } else if (keywords.includes("ai") || keywords.includes("artificial intelligence")) {
      return "AI Solution"
    } else if (keywords.includes("dashboard") || keywords.includes("admin")) {
      return "Dashboard System"
    } else if (keywords.includes("api") || keywords.includes("backend")) {
      return "API Development"
    } else if (keywords.includes("database") || keywords.includes("data")) {
      return "Data Management System"
    } else {
      // Extract first few meaningful words
      const words = initialIdea
        .split(" ")
        .filter(
          (word) => word.length > 2 && !["the", "and", "for", "with", "that", "this"].includes(word.toLowerCase()),
        )
      const title = words.slice(0, 3).join(" ")
      return title.charAt(0).toUpperCase() + title.slice(1) + " Project"
    }
  }

  const createProject = async (titleOrIdea: string, isAutoGenerated = false): Promise<Project> => {
    const title = isAutoGenerated ? generateProjectTitle(titleOrIdea) : titleOrIdea

    const newProject: Project = {
      id: Date.now().toString(),
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setProjects((prev) => [newProject, ...prev])
    return newProject
  }

  const generateSessionTitle = (initialIdea: string, existingSessions: Session[]): string => {
    const projectSessionCount = existingSessions.length

    // Generate contextual titles based on content
    const keywords = initialIdea.toLowerCase()

    if (keywords.includes("proposal") || keywords.includes("generate")) {
      return `Proposal Discussion ${projectSessionCount + 1}`
    } else if (keywords.includes("requirement") || keywords.includes("spec")) {
      return `Requirements Gathering ${projectSessionCount + 1}`
    } else if (keywords.includes("design") || keywords.includes("ui") || keywords.includes("ux")) {
      return `Design Discussion ${projectSessionCount + 1}`
    } else if (keywords.includes("technical") || keywords.includes("architecture")) {
      return `Technical Planning ${projectSessionCount + 1}`
    } else if (keywords.includes("budget") || keywords.includes("cost") || keywords.includes("price")) {
      return `Budget Planning ${projectSessionCount + 1}`
    } else if (keywords.includes("timeline") || keywords.includes("schedule")) {
      return `Timeline Discussion ${projectSessionCount + 1}`
    } else {
      // Default session naming
      if (projectSessionCount === 0) {
        return "Initial Discussion"
      } else {
        return `Session ${projectSessionCount + 1}`
      }
    }
  }

  const createSession = async (projectId: string, initialIdea: string): Promise<Session> => {
    const projectSessions = sessions.filter((s) => s.project_id === projectId)
    const title = generateSessionTitle(initialIdea, projectSessions)

    const newSession: Session = {
      id: Date.now().toString(),
      project_id: projectId,
      title,
      initial_idea: initialIdea,
      agent_mode: "conversation",
      has_document: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setSessions((prev) => [newSession, ...prev])
    return newSession
  }

  const createProjectAndSession = async (initialMessage: string): Promise<{ project: Project; session: Session }> => {
    // Create project with AI-generated title
    const project = await createProject(initialMessage, true)

    // Create initial session
    const session = await createSession(project.id, initialMessage)

    return { project, session }
  }

  const updateSessionWithDocument = (sessionId: string, document: any) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              has_document: true,
              document,
              agent_mode: "editor_mode",
              updated_at: new Date().toISOString(),
            }
          : session,
      ),
    )
  }

  const getSession = (sessionId: string): Session | undefined => {
    return sessions.find((session) => session.id === sessionId)
  }

  const getProject = (projectId: string): Project | undefined => {
    return projects.find((project) => project.id === projectId)
  }

  return {
    projects,
    sessions,
    loading,
    createProject,
    createSession,
    createProjectAndSession,
    updateSessionWithDocument,
    getSession,
    getProject,
  }
}
