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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

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
                      pathname.startsWith('/project/') ||
                      pathname.startsWith('/settings')

  if (!showSidebar) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Sidebar: fixed/overlap on mobile/tab, static on desktop */}
      <div
        className={`transition-all duration-200 bg-[#0a0a0a] border-r border-[#2a2a2a] flex-shrink-0 hidden md:flex flex-col relative`}
        style={{
          width: sidebarCollapsed ? 64 : 256,
          minWidth: sidebarCollapsed ? 64 : 256,
          maxWidth: sidebarCollapsed ? 64 : 256,
          height: '100vh',
        }}
      >
        {/* Collapse/Expand button for desktop */}
     
        <ChatSidebar 
          user={user || undefined}
          onBackToDashboard={handleBackToDashboard}
          onLogout={handleLogout}
          onProjectSelect={handleProjectSelect}
          onNewProject={handleNewProject}
          showProjects={showProjects}
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
        />
      </div>
      {/* Sidebar open button for mobile/tab only */}
      {sidebarCollapsed && (
        <button
          className="fixed top-4 left-4 z-40 md:hidden bg-[#18181b] border border-[#23232a] rounded-full p-3 shadow-lg hover:bg-[#23232a] transition-colors"
          aria-label="Open sidebar"
          onClick={() => setSidebarCollapsed(false)}
        >
          {/* Hamburger icon */}
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      )}
      {/* Only render sidebar on mobile/tab if not collapsed, so it appears when expanded */}
      {!sidebarCollapsed && (
        <div
          className="block md:hidden fixed top-0 left-0 h-screen w-[256px] z-50 transition-transform duration-200 translate-x-0"
          style={{ pointerEvents: 'auto' }}
        >
          <ChatSidebar 
            user={user || undefined}
            onBackToDashboard={handleBackToDashboard}
            onLogout={handleLogout}
            onProjectSelect={handleProjectSelect}
            onNewProject={handleNewProject}
            showProjects={showProjects}
            collapsed={sidebarCollapsed}
            setCollapsed={setSidebarCollapsed}
          />
        </div>
      )}
      {/* Main Content with Smooth Transitions */}
      <div
        className="relative overflow-x-auto h-full"
        style={{
          flex: 1,
          marginLeft: 0,
          width: '100%',
          minWidth: 0,
        }}
      >
        <div
          key={pathname}
          className={`absolute inset-0 transition-all duration-300 ease-in-out ${
            isTransitioning ? 'opacity-100 translate-x-0 pointer-events-none' : 'opacity-100 translate-x-0 pointer-events-auto'
          }`}
          style={{
            left: 0,
            width: '100%',
            marginLeft: 0,
          }}
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
