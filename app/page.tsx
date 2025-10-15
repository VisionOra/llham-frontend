"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { ChatInterface } from "@/components/chat-interface"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])
  const handleNewChat = (message: string) => {
  sessionStorage.setItem('pendingMessage', message)
    router.push('/login')
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white">
      <div className="flex items-center justify-between p-4 border-b border-[#2a2a2a]">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 rounded flex items-center justify-center">
            <img src="/logo.svg" alt="Ilham Logo" className="w-10 h-10" />
          </div>
          <span className="text-xl font-medium tracking-widest">Ilham</span>
        </div>
        
        <Button
          onClick={() => router.push('/login')}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          Login
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center min-h-screen  bg-[#0a0a0a]">
        <div className="max-w-2xl w-full mx-auto text-center space-y-2 -mt-24 p-8">
          <h1 className="text-4xl font-extrabold text-white drop-shadow-lg">What do you want to create?</h1>
          <p className="text-lg text-gray-400 mb-4">Start building with a single prompt. No coding needed.</p>
      
          <div className="w-full max-w-xl mx-auto">
            <ChatInterface
              sessionId={null}
              projectId={null}
              onNewChat={handleNewChat}
              isDocumentMode={false}
              isWelcomeMode={true}
              onDocumentGenerated={undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
