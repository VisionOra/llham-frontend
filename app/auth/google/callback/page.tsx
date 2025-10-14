"use client"

import { useEffect, useState, useRef } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, useSearchParams } from "next/navigation"
import Loading from "@/app/loading"
import ReactMarkdown from "react-markdown"

export default function GoogleCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const { login } = useAuth()
  // Ref to prevent duplicate API calls in StrictMode
  const hasCalled = useRef(false)

  useEffect(() => {
    if (hasCalled.current) return
    hasCalled.current = true

    const codeParam = searchParams.get("code")
    if (!codeParam) {
      setError("No code found in URL.")
      setLoading(false)
      return
    }

    // Decode code if needed
    const code = codeParam.replace(/%2F/g, "/")

    const verifyGoogleCode = async () => {
      setLoading(true)
      setError("")

      try {
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || ""
        const res = await fetch(`${apiBaseUrl}/api/auth/google/callback/?code=${code}`, {
          method: "GET",
          credentials: "include", // if cookies/sessions are used
        })

        if (!res.ok) throw new Error("Failed to verify Google code.")

        const data = await res.json()

        if (data.status==="success") {
            if (data.user && data.access_token && data.refresh_token) {
              login(data.user, data.access_token, data.refresh_token)
            }
            const pendingMessage = sessionStorage.getItem('pendingMessage')
            if (pendingMessage) {
              sessionStorage.removeItem('pendingMessage')
            }
            
            router.push("/dashboard")
        } else {
          setError(data.message || "Google verification failed.")
        }
      } catch (err: any) {
        setError(err.message || "Google verification failed.")
      } finally {
        setLoading(false)
      }
    }

    verifyGoogleCode()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
      {loading ? (
        <Loading />
      ) : error ? (
        <div className="text-red-400 text-lg">
          <ReactMarkdown>{error}</ReactMarkdown>
        </div>
      ) : null}
    </div>
  )
}
