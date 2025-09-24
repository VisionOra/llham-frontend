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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)

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
      <div
        className={`transition-all duration-200 bg-[#0a0a0a] border-r border-[#2a2a2a] flex-shrink-0`}
        style={{ width: sidebarCollapsed ? 64 : 256, minWidth: sidebarCollapsed ? 64 : 256 }}
      >
        <ChatSidebar 
          user={user || undefined}
          onBackToDashboard={handleBackToDashboard}
          onLogout={handleLogout}
          onProjectSelect={handleProjectSelect}
          onNewProject={handleNewProject}
          showProjects={showProjects}
          // Pass collapsed state and setter to sidebar
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
      </div>

      {/* Main Content with Smooth Transitions */}
      <div className="flex-1 relative overflow-hidden">
        <div 
          key={pathname}
          className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            isTransitioning ? 'opacity-100 translate-x-0 pointer-events-none' : 'opacity-100 translate-x-0 pointer-events-auto'
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
