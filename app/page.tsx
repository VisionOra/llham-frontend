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
        <div className="flex items-center space-x-2 mb-4" >
          <div className="w-10 h-10  rounded flex items-center justify-center">
            <span className="text-black text-xs font-bold"><img src="/logo.svg" alt="Icon" /></span>
          </div>
          <div className="flex items-center space-x-1">
            <span className=" font-medium tracking-widest">Ilham</span>
          </div>
          
        </div>
    </div>
  )
}
