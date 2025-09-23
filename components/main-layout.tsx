"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { ChatSidebar } from "@/components/chat-sidebar"
import { useAuth } from "@/contexts/auth-context"
import { AuthGuard } from "@/components/auth-guard"

interface MainLayoutProps {
  children: React.ReactNode
}

function MainLayoutContent({ children }: MainLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleBackToDashboard = () => {
    setIsTransitioning(true)
    router.push('/dashboard')
  }

  const handleProjectSelect = (projectId: string) => {
    setIsTransitioning(true)
    router.push(`/project/${projectId}`)
  }

  const handleNewProject = () => {
    // Scroll to the input on dashboard or stay on dashboard
    if (pathname !== '/dashboard') {
      setIsTransitioning(true)
      router.push('/dashboard')
    }
  }

  const handleLogout = () => {
    logout()
  }

  // Handle route transition states
  useEffect(() => {
    setIsTransitioning(true)
    const timer = setTimeout(() => {
      setIsTransitioning(false)
    }, 200) // Slightly longer for smoother transition

    return () => clearTimeout(timer)
  }, [pathname])

  // Don't show sidebar on login/signup pages or chat pages (they have their own layout)
  const showSidebar = !pathname.includes('/login') && 
                     !pathname.includes('/signup') && 
                     !pathname.includes('/chat/')
  
  // Show projects in sidebar when on dashboard or project pages
  const showProjects = pathname === '/dashboard' || 
                      pathname.startsWith('/project/')

  if (!showSidebar) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white">
      {/* Persistent Sidebar */}
      <div className="w-64 bg-[#0a0a0a] border-r border-[#2a2a2a] flex-shrink-0">
        <ChatSidebar 
          user={user || undefined}
          onBackToDashboard={handleBackToDashboard}
          onLogout={handleLogout}
          onProjectSelect={handleProjectSelect}
          onNewProject={handleNewProject}
          showProjects={showProjects}
        />
      </div>

      {/* Main Content with Smooth Transitions */}
      <div className="flex-1 relative overflow-hidden ">
        <div 
          className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            isTransitioning ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <AuthGuard>
      <MainLayoutContent>{children}</MainLayoutContent>
    </AuthGuard>
  )
}
