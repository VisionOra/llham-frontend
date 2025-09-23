"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    } else {
      router.push('/login')
    }
  }, [isAuthenticated, router])

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 bg-white rounded mx-auto mb-4 flex items-center justify-center">
          <span className="text-black text-sm font-bold">v0</span>
        </div>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  )
}
