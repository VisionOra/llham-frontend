"use client"

import React, { useEffect, useState, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { DollarSign, Clock, FileText, AlertCircle, CheckCircle, Loader2, Users, Shield, Search, Filter, ChevronLeft, ChevronRight, Crown, CreditCard } from "lucide-react"
import { projectApi, TokenManager, getAvailableAgents, selectSessionAgents, type AvailableAgent, getAdminUsers, updateUserSubscriptionPatch, type AdminUser, type AdminUsersListParams, resetSettingsToDefault } from "@/lib/api"
import { useWebSocket } from "@/contexts/websocket-context"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

const currencies = [
  { code: "USD", name: "US Dollar", flag: "🇺🇸", symbol: "$" },
  { code: "EUR", name: "Euro", flag: "🇪🇺", symbol: "€" },
  { code: "GBP", name: "British Pound", flag: "🇬🇧", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", flag: "🇯🇵", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", flag: "🇦🇺", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", flag: "🇨🇭", symbol: "₣" },
  { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳", symbol: "¥" },
  { code: "SEK", name: "Swedish Krona", flag: "🇸🇪", symbol: "kr" },
  { code: "NZD", name: "New Zealand Dollar", flag: "🇳🇿", symbol: "NZ$" },
  { code: "MXN", name: "Mexican Peso", flag: "🇲🇽", symbol: "$" },
  { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", flag: "🇭🇰", symbol: "HK$" },
  { code: "NOK", name: "Norwegian Krone", flag: "🇳🇴", symbol: "kr" },
  { code: "INR", name: "Indian Rupee", flag: "🇮🇳", symbol: "₹" },
  { code: "BRL", name: "Brazilian Real", flag: "🇧🇷", symbol: "R$" },
  { code: "RUB", name: "Russian Ruble", flag: "🇷🇺", symbol: "₽" },
  { code: "KRW", name: "South Korean Won", flag: "🇰🇷", symbol: "₩" },
  { code: "ZAR", name: "South African Rand", flag: "🇿🇦", symbol: "R" },
  { code: "TRY", name: "Turkish Lira", flag: "🇹🇷", symbol: "₺" },
  { code: "PLN", name: "Polish Zloty", flag: "🇵🇱", symbol: "zł" },
  { code: "DKK", name: "Danish Krone", flag: "🇩🇰", symbol: "kr" },
  { code: "CZK", name: "Czech Koruna", flag: "🇨🇿", symbol: "Kč" },
  { code: "HUF", name: "Hungarian Forint", flag: "🇭🇺", symbol: "Ft" },
  { code: "ILS", name: "Israeli Shekel", flag: "🇮🇱", symbol: "₪" },
  { code: "CLP", name: "Chilean Peso", flag: "🇨🇱", symbol: "$" },
  { code: "PHP", name: "Philippine Peso", flag: "🇵🇭", symbol: "₱" },
  { code: "AED", name: "UAE Dirham", flag: "🇦🇪", symbol: "د.إ" },
  { code: "SAR", name: "Saudi Riyal", flag: "🇸🇦", symbol: "﷼" },
  { code: "EGP", name: "Egyptian Pound", flag: "🇪🇬", symbol: "£" },
  { code: "THB", name: "Thai Baht", flag: "🇹🇭", symbol: "฿" },
  { code: "MYR", name: "Malaysian Ringgit", flag: "🇲🇾", symbol: "RM" },
  { code: "IDR", name: "Indonesian Rupiah", flag: "🇮🇩", symbol: "Rp" },
  { code: "VND", name: "Vietnamese Dong", flag: "🇻🇳", symbol: "₫" },
  { code: "BGN", name: "Bulgarian Lev", flag: "🇧🇬", symbol: "лв" },
  { code: "HRK", name: "Croatian Kuna", flag: "🇭🇷", symbol: "kn" },
  { code: "RON", name: "Romanian Leu", flag: "🇷🇴", symbol: "lei" },
  { code: "ISK", name: "Icelandic Krona", flag: "🇮🇸", symbol: "kr" },
  { code: "PKR", name: "Pakistani Rupee", flag: "🇵🇰", symbol: "₨" },
  { code: "BDT", name: "Bangladeshi Taka", flag: "🇧🇩", symbol: "৳" },
  { code: "LKR", name: "Sri Lankan Rupee", flag: "🇱🇰", symbol: "₨" },
  { code: "NPR", name: "Nepalese Rupee", flag: "🇳🇵", symbol: "₨" },
  { code: "AFN", name: "Afghan Afghani", flag: "🇦🇫", symbol: "؋" },
  { code: "MMK", name: "Myanmar Kyat", flag: "🇲🇲", symbol: "K" },
  { code: "LAK", name: "Lao Kip", flag: "🇱🇦", symbol: "₭" },
  { code: "KHR", name: "Cambodian Riel", flag: "🇰🇭", symbol: "៛" },
]

const initialState = {
  senior_engineer_rate: "",
  mid_level_engineer_rate: "",
  junior_engineer_rate: "",
  ui_ux_designer_rate: "",
  project_manager_rate: "",
  devops_engineer_rate: "",
  ai_engineer_rate: "",
  default_instructions: "",
  currency: "",
  max_task_hours: 0,
}

const SettingsPage = () => {
  const [form, setForm] = useState(initialState)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [isNew, setIsNew] = useState(false)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [success, setSuccess] = useState("")
  const [availableAgents, setAvailableAgents] = useState<AvailableAgent[]>([])
  const [selectedAgentNames, setSelectedAgentNames] = useState<string[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [savingAgents, setSavingAgents] = useState(false)

  // Admin state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [loadingAdminUsers, setLoadingAdminUsers] = useState(false)
  const [adminPagination, setAdminPagination] = useState<{
    count: number
    next: string | null
    previous: string | null
  } | null>(null)
  const [adminSearch, setAdminSearch] = useState("")
  const [adminIsActiveFilter, setAdminIsActiveFilter] = useState<boolean | undefined>(undefined)
  const [adminSubscriptionFilter, setAdminSubscriptionFilter] = useState<"free" | "paid" | undefined>(undefined)
  const [adminPage, setAdminPage] = useState(1)
  const [adminPageSize, setAdminPageSize] = useState(20)

  const { activeSessionId } = useWebSocket()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const loadedAgentsSessionIdRef = useRef<string | null>(null)
  const loadingAgentsRef = useRef(false)

  // Get project_id and session_id from URL params or context
  const projectIdFromUrl = searchParams.get('project_id') || searchParams.get('project')
  const sessionIdFromUrl = searchParams.get('session_id') || searchParams.get('session')
  
  // Use session_id from URL, or fallback to activeSessionId from WebSocket context
  const currentSessionId = sessionIdFromUrl || activeSessionId || null
  const currentProjectId = projectIdFromUrl || null

  // Use TokenManager for access token, matching the rest of the app
  const token = TokenManager.getAccessToken();

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      setError("")
      try {
        // Build query parameters for the settings endpoint
        const params = new URLSearchParams()
        // You can add project_id and session_id here if needed from URL params or context
        // For now, fetching global settings (no params = global)
        
        const res = await projectApi.get(`/api/proposals/settings/?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = res.data
        
        // Handle different response structures:
        // 1. Nested structure: { settings: {...}, inherited_from: "...", scope: "..." }
        // 2. Paginated structure: { count, next, previous, results: [...] }
        let settings = null
        
        if (data?.settings) {
          // Nested structure with settings object
          settings = data.settings
        } else if (data?.results && data.results.length > 0) {
          // Paginated structure - get first result
          settings = data.results[0]
        }
        
        if (!settings) {
          setIsNew(true)
          setSettingsId(null)
          setForm(initialState)
        } else {
          setIsNew(false)
          setSettingsId(settings.id) // Store settings ID for PUT updates
          setForm({
            senior_engineer_rate: settings.senior_engineer_rate?.toString() || "",
            mid_level_engineer_rate: settings.mid_level_engineer_rate?.toString() || "",
            junior_engineer_rate: settings.junior_engineer_rate?.toString() || "",
            ui_ux_designer_rate: settings.ui_ux_designer_rate?.toString() || "",
            project_manager_rate: settings.project_manager_rate?.toString() || "",
            devops_engineer_rate: settings.devops_engineer_rate?.toString() || "",
            ai_engineer_rate: settings.ai_engineer_rate?.toString() || "",
            default_instructions: settings.default_instructions || "",
            currency: settings.currency || "",
            max_task_hours: settings.max_task_hours || 0,
          })
        }
      } catch (e) {
        setError("Could not load settings.")
        console.error("Error fetching settings:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
    // eslint-disable-next-line
  }, [])

  // Fetch available agents from registry
  // If activeSessionId exists, fetch agents for that session (shows selected status)
  useEffect(() => {
    // Prevent duplicate calls
    if (loadingAgentsRef.current || loadedAgentsSessionIdRef.current === activeSessionId) {
      return
    }

    const fetchAvailableAgents = async () => {
      loadingAgentsRef.current = true
      setLoadingAgents(true)
      try {
        const response = await getAvailableAgents(activeSessionId || undefined)
        setAvailableAgents(response.agents || [])
        
        // Pre-select agents that are already selected for the session
        if (activeSessionId && response.agents) {
          const selected = response.agents
            .filter(agent => agent.is_selected)
            .map(agent => agent.name)
          setSelectedAgentNames(selected)
        } else {
          // If no session, clear selections
          setSelectedAgentNames([])
        }
        loadedAgentsSessionIdRef.current = activeSessionId || null
      } catch (error) {
        console.error("Error fetching available agents:", error)
        setAvailableAgents([])
        setSelectedAgentNames([])
      } finally {
        setLoadingAgents(false)
        loadingAgentsRef.current = false
      }
    }

    fetchAvailableAgents()
  }, [activeSessionId])

  // Handle agent selection
  const handleAgentToggle = (agentName: string) => {
    const isPaid = user?.subscription_status === "paid"
    const maxAgents = isPaid ? Infinity : 3
    
    setSelectedAgentNames(prev => {
      if (prev.includes(agentName)) {
        // Deselecting - always allowed
        return prev.filter(name => name !== agentName)
      } else {
        // Selecting - check limit for free users
        if (!isPaid && prev.length >= maxAgents) {
          toast.error(`Free plan allows maximum ${maxAgents} agents. Please upgrade to paid plan to select more agents.`)
          return prev
        }
        return [...prev, agentName]
      }
    })
  }

  // Save selected agents for session
  const handleSaveAgents = async () => {
    if (!activeSessionId) {
      setError("No active session. Please start a session first.")
      toast.error("No active session. Please start a session first.")
      return
    }

    // Check free plan limit
    const isPaid = user?.subscription_status === "paid"
    if (!isPaid && selectedAgentNames.length > 3) {
      setError("Free plan allows maximum 3 agents. Please upgrade to paid plan to select more agents.")
      toast.error("Free plan allows maximum 3 agents. Please upgrade to paid plan to select more agents.")
      return
    }

    setSavingAgents(true)
    setError("")
    setSuccess("")
    try {
      const response = await selectSessionAgents(activeSessionId, {
        agent_names: selectedAgentNames,
        auto_order: true
      })
      setSuccess(response.message || "Agents selected successfully!")
      toast.success(response.message || "Agents selected successfully!")
    } catch (e: any) {
      console.error("Error selecting agents:", e)
      const errorMessage = e?.message || "Could not select agents."
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSavingAgents(false)
    }
  }

  // Fetch admin users
  useEffect(() => {
    const isAdmin = user?.is_staff || user?.is_superuser
    if (!isAdmin) {
      return
    }

    const fetchAdminUsers = async () => {
      setLoadingAdminUsers(true)
      try {
        const params: AdminUsersListParams = {
          page: adminPage,
          page_size: adminPageSize,
        }
        if (adminSearch) params.search = adminSearch
        if (adminIsActiveFilter !== undefined) params.is_active = adminIsActiveFilter
        if (adminSubscriptionFilter) params.subscription_status = adminSubscriptionFilter

        const response = await getAdminUsers(params)
        setAdminUsers(response.results || [])
        setAdminPagination({
          count: response.count,
          next: response.next,
          previous: response.previous,
        })
      } catch (e: any) {
        console.error("Error fetching admin users:", e)
        toast.error(e?.message || "Could not load users.")
      } finally {
        setLoadingAdminUsers(false)
      }
    }

    fetchAdminUsers()
  }, [adminPage, adminPageSize, adminSearch, adminIsActiveFilter, adminSubscriptionFilter, user])

  const handleUpdateSubscription = async (userId: string, newStatus: "free" | "paid") => {
    try {
      const updatedUser = await updateUserSubscriptionPatch(userId, {
        subscription_status: newStatus,
      })
      
      setAdminUsers(prevUsers =>
        prevUsers.map(u => (u.id === userId ? updatedUser : u))
      )
      
      toast.success(`Subscription updated to ${newStatus}`)
    } catch (e: any) {
      console.error("Error updating subscription:", e)
      toast.error(e?.message || "Could not update subscription.")
    }
  }

  const handleAdminSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setAdminPage(1)
  }

  const handleClearAdminFilters = () => {
    setAdminSearch("")
    setAdminIsActiveFilter(undefined)
    setAdminSubscriptionFilter(undefined)
    setAdminPage(1)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      // Prepare request body with scope for global settings
      const requestBody = {
        scope: "global",
        ...form
      }

      let res
      
      // Use PUT for partial update if settings ID exists, otherwise POST for create
      if (settingsId) {
        // PUT endpoint for partial update
        res = await projectApi.put(`/api/proposals/settings/${settingsId}/`, requestBody, {
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        // POST endpoint for create
        res = await projectApi.post("/api/proposals/settings/", requestBody, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      
      // Handle response structure - can be nested { settings: {...}, message: "..." } or direct settings object
      const responseData = res.data
      const savedSettings = responseData.settings || responseData
      
      // Store the settings ID (update even if it already exists, in case it changed)
      if (savedSettings.id) {
        setSettingsId(savedSettings.id)
      }
      
      // Update form with saved settings from response - directly set all values
      const updatedForm = {
        senior_engineer_rate: String(savedSettings.senior_engineer_rate || ""),
        mid_level_engineer_rate: String(savedSettings.mid_level_engineer_rate || ""),
        junior_engineer_rate: String(savedSettings.junior_engineer_rate || ""),
        ui_ux_designer_rate: String(savedSettings.ui_ux_designer_rate || ""),
        project_manager_rate: String(savedSettings.project_manager_rate || ""),
        devops_engineer_rate: String(savedSettings.devops_engineer_rate || ""),
        ai_engineer_rate: String(savedSettings.ai_engineer_rate || ""),
        default_instructions: String(savedSettings.default_instructions || ""),
        currency: String(savedSettings.currency || ""),
        max_task_hours: Number(savedSettings.max_task_hours || 0),
      }
      
      // Directly set form state (not using functional update to ensure it works)
      setForm(updatedForm)
      
      const successMessage = responseData.message || "Settings saved!"
      setSuccess(successMessage)
      toast.success(successMessage)
      setIsNew(false)
    } catch (e: any) {
      console.error("Error saving settings:", e)
      const errorMessage = e?.response?.data?.message || e?.message || "Could not save settings."
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      // Build payload based on available context:
      // Case 1: No IDs - global reset (empty payload)
      // Case 2: Only project_id - project reset
      // Case 3: Both session_id and project_id - session reset
      let resetPayload: { project_id?: string; session_id?: string } = {}
      
      if (currentSessionId && currentProjectId) {
        // Case 3: Reset only specific session
        resetPayload = {
          session_id: currentSessionId,
          project_id: currentProjectId
        }
      } else if (currentProjectId) {
        // Case 2: Reset project + all sessions in project
        resetPayload = {
          project_id: currentProjectId
        }
      }
      // Case 1: No IDs - global reset (empty payload, already set)
      
      // Call the new reset-to-default endpoint with appropriate payload
      const response = await resetSettingsToDefault(Object.keys(resetPayload).length > 0 ? resetPayload : undefined)
      
      // Map default rates from response to form fields
      // Default rates from API:
      // - Senior Software Engineer: $35/hr
      // - DevOps Engineer: $30/hr
      // - Mid to Senior AI Engineer: $30/hr
      // - Project Manager: $25/hr
      // - Mid Level Engineer: $25/hr
      // - UI/UX Designer: $25/hr
      // - Junior Engineer: $18/hr
      const defaultRates = response.default_rates || {}
      
      // Update form with default rates
      setForm({
        senior_engineer_rate: String(defaultRates.senior_software_engineer || 35),
        mid_level_engineer_rate: String(defaultRates.mid_level_engineer || 25),
        junior_engineer_rate: String(defaultRates.junior_engineer || 18),
        ui_ux_designer_rate: String(defaultRates.ui_ux_designer || 25),
        project_manager_rate: String(defaultRates.project_manager || 25),
        devops_engineer_rate: String(defaultRates.devops_engineer || 30),
        ai_engineer_rate: String(defaultRates.mid_to_senior_ai_engineer || 30),
        default_instructions: "",
        currency: "",
        max_task_hours: 0,
      })
      
      // Reset settings ID since we're using defaults
      setIsNew(true)
      setSettingsId(null)
      
      // Show success message with reset count
      const successMessage = response.message || `Settings reset! ${response.reset_count || 0} setting(s) reset to default.`
      setSuccess(successMessage)
      toast.success(successMessage)
    } catch (e: any) {
      console.error("Error resetting settings:", e)
      const errorMessage = e?.message || "Could not reset settings to default."
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 mt-10">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-gray-400">Configure your proposal rates and default settings</p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-700/50 rounded-lg text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-4 bg-green-900/20 border border-green-700/50 rounded-lg text-green-300">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
            <CardContent className="flex items-center justify-center p-12">
              <div className="flex items-center gap-3 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Loading settings...</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <form
            onSubmit={e => {
              e.preventDefault()
              handleSave()
            }}
            className="space-y-6"
          >
            {/* Hourly Rates Section */}
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <DollarSign className="w-5 h-5" />
                  Hourly Rates
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Set the hourly rates for different roles in your proposals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="senior_engineer_rate" className="text-sm font-medium text-gray-300">
                      Senior Engineer Rate
                    </Label>
                    <Input
                      id="senior_engineer_rate"
                      name="senior_engineer_rate"
                      value={form.senior_engineer_rate}
                      onChange={handleChange}
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mid_level_engineer_rate" className="text-sm font-medium text-gray-300">
                      Mid Level Engineer Rate
                    </Label>
                    <Input
                      id="mid_level_engineer_rate"
                      name="mid_level_engineer_rate"
                      value={form.mid_level_engineer_rate}
                      onChange={handleChange}
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="junior_engineer_rate" className="text-sm font-medium text-gray-300">
                      Junior Engineer Rate
                    </Label>
                    <Input
                      id="junior_engineer_rate"
                      name="junior_engineer_rate"
                      value={form.junior_engineer_rate}
                      onChange={handleChange}
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ui_ux_designer_rate" className="text-sm font-medium text-gray-300">
                      UI/UX Designer Rate
                    </Label>
                    <Input
                      id="ui_ux_designer_rate"
                      name="ui_ux_designer_rate"
                      value={form.ui_ux_designer_rate}
                      onChange={handleChange}
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project_manager_rate" className="text-sm font-medium text-gray-300">
                      Project Manager Rate
                    </Label>
                    <Input
                      id="project_manager_rate"
                      name="project_manager_rate"
                      value={form.project_manager_rate}
                      onChange={handleChange}
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="devops_engineer_rate" className="text-sm font-medium text-gray-300">
                      DevOps Engineer Rate
                    </Label>
                    <Input
                      id="devops_engineer_rate"
                      name="devops_engineer_rate"
                      value={form.devops_engineer_rate}
                      onChange={handleChange}
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ai_engineer_rate" className="text-sm font-medium text-gray-300">
                      AI Engineer Rate
                    </Label>
                    <Input
                      id="ai_engineer_rate"
                      name="ai_engineer_rate"
                      value={form.ai_engineer_rate}
                      onChange={handleChange}
                      type="number"
                      step="any"
                      placeholder="0.00"
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Project Configuration Section */}
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Clock className="w-5 h-5" />
                  Project Configuration
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Configure currency and time settings for your proposals
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="text-sm font-medium text-gray-300">
                      Currency
                    </Label>
                    <Select
                      value={form.currency}
                      onValueChange={(value) => setForm(f => ({ ...f, currency: value }))}
                    >
                      <SelectTrigger className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-green-500 focus:ring-green-500/20 h-12">
                        <SelectValue placeholder="Select currency">
                          {form.currency && (
                            <div className="flex items-center gap-3">
                              <span className="text-lg">
                                {currencies.find(c => c.code === form.currency)?.flag}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-white">
                                  {currencies.find(c => c.code === form.currency)?.code}
                                </span>
                                <span className="text-gray-400 text-sm">
                                  {currencies.find(c => c.code === form.currency)?.name}
                                </span>
                              </div>
                              <span className="text-gray-400 ml-auto">
                                {currencies.find(c => c.code === form.currency)?.symbol}
                              </span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white max-h-[300px]">
                        {currencies.map((currency) => (
                          <SelectItem
                            key={currency.code}
                            value={currency.code}
                            className="hover:bg-[#2a2a2a] focus:bg-[#2a2a2a] text-white py-3 px-4"
                          >
                            <div className="flex items-center gap-3 w-full">
                              <span className="text-lg flex-shrink-0">{currency.flag}</span>
                              <div className="flex flex-col flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-white">{currency.code}</span>
                                  <span className="text-gray-400 ml-auto flex-shrink-0">{currency.symbol}</span>
                                </div>
                                <span className="text-xs text-gray-500 truncate">{currency.name}</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_task_hours" className="text-sm font-medium text-gray-300">
                      Maximum Task Hours
                    </Label>
                    <Input
                      id="max_task_hours"
                      name="max_task_hours"
                      value={form.max_task_hours}
                      onChange={handleChange}
                      type="number"
                      placeholder="40"
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Subscription Status Section */}
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <CreditCard className="w-5 h-5" />
                  Subscription Plan
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Your current subscription status and plan details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
                  <div className="flex items-center gap-3">
                    {user?.subscription_status === "paid" ? (
                      <Crown className="w-6 h-6 text-yellow-400" />
                    ) : (
                      <CreditCard className="w-6 h-6 text-gray-400" />
                    )}
                    <div>
                      <div className="text-white font-medium">
                        {user?.subscription_status === "paid" ? "Paid Plan" : "Free Plan"}
                      </div>
                      <div className="text-sm text-gray-400">
                        {user?.subscription_status === "paid" 
                          ? "Unlimited agents available" 
                          : "Up to 3 agents available"}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={user?.subscription_status === "paid" ? "default" : "secondary"}
                    className={
                      user?.subscription_status === "paid"
                        ? "bg-yellow-900/30 text-yellow-400 border-yellow-700"
                        : "bg-gray-800 text-gray-400 border-gray-700"
                    }
                  >
                    {user?.subscription_status === "paid" ? "Paid" : "Free"}
                  </Badge>
                </div>
                {user?.subscription_status === "free" && (
                  <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-400">
                      💡 Upgrade to paid plan to select unlimited agents for your sessions.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Default Instructions Section */}
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="w-5 h-5" />
                  Default Instructions
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Set default instructions that will be included in all proposals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="default_instructions" className="text-sm font-medium text-gray-300">
                    Instructions
                  </Label>
                  <Textarea
                    id="default_instructions"
                    name="default_instructions"
                    value={form.default_instructions}
                    onChange={(e) => setForm(f => ({ ...f, default_instructions: e.target.value }))}
                    placeholder="Enter default instructions for proposals..."
                    rows={4}
                    className="bg-[#0a0a0a] border-[#2a2a2a] text-white placeholder:text-gray-500 focus:border-green-500 focus:ring-green-500/20 resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Available Agents Section */}
            <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Users className="w-5 h-5" />
                  Available Agents
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Select agents to use for your session
                  {user?.subscription_status === "free" && (
                    <span className="block mt-1 text-yellow-400">
                      Free plan: Maximum {selectedAgentNames.length}/3 agents selected
                    </span>
                  )}
                  {user?.subscription_status === "paid" && (
                    <span className="block mt-1 text-green-400">
                      Paid plan: {selectedAgentNames.length} agent(s) selected (unlimited)
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAgents ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="flex items-center gap-3 text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Loading agents...</span>
                    </div>
                  </div>
                ) : availableAgents.length > 0 ? (
                  <div className="space-y-3">
                    {availableAgents.map((agent) => {
                      const isSelected = selectedAgentNames.includes(agent.name) || agent.is_selected
                      return (
                        <div
                          key={agent.id || agent.name}
                          className="p-4 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  id={`agent-${agent.name}`}
                                  checked={isSelected}
                                  onChange={() => handleAgentToggle(agent.name)}
                                  disabled={
                                    agent.is_always_active || 
                                    (!agent.can_be_disabled && !isSelected) ||
                                    (user?.subscription_status === "free" && 
                                     !isSelected && 
                                     selectedAgentNames.length >= 3)
                                  }
                                  className="w-4 h-4 rounded border-gray-600 bg-[#0a0a0a] text-green-600 focus:ring-green-500 focus:ring-2 accent-green-600"
                                  style={{ accentColor: '#16a34a' }}
                                />
                                <label htmlFor={`agent-${agent.name}`} className="flex-1 cursor-pointer">
                                  <h4 className="text-white font-medium">
                                    {agent.display_name || agent.name}
                                  </h4>
                                  <p className="text-sm text-gray-400 mt-1">
                                    {agent.description || "No description available"}
                                  </p>
                                  <div className="flex items-center gap-4 mt-2">
                                    {agent.is_always_active && (
                                      <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-400">
                                        Always Active
                                      </span>
                                    )}
                                    {!agent.can_be_disabled && (
                                      <span className="text-xs px-2 py-1 rounded bg-yellow-900/30 text-yellow-400">
                                        Required
                                      </span>
                                    )}
                                    {agent.is_selected && (
                                      <span className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-400">
                                        Selected
                                      </span>
                                    )}
                                    {agent.section_types && agent.section_types.length > 0 && (
                                      <span className="text-xs text-gray-500">
                                        Sections: {agent.section_types.join(", ")}
                                      </span>
                                    )}
                                  </div>
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {activeSessionId && (
                      <div className="mt-6 pt-4 border-t border-[#2a2a2a]">
                        <Button
                          onClick={handleSaveAgents}
                          disabled={savingAgents || selectedAgentNames.length === 0}
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                          {savingAgents ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Save Selected Agents ({selectedAgentNames.length})
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                    {!activeSessionId && (
                      <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-800 rounded-lg">
                        <p className="text-sm text-yellow-400">
                          Start a session to select agents for it.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>No agents available.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Admin Section - Only show if user is admin */}
            {(user?.is_staff || user?.is_superuser) && (
              <>
                <Separator className="my-8 bg-[#2a2a2a]" />
                
                <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Shield className="w-5 h-5" />
                      Admin Panel
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Manage users and their subscriptions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Admin Filters */}
                    <form onSubmit={handleAdminSearch} className="space-y-4 mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Search */}
                        <div className="space-y-2">
                          <Label htmlFor="admin-search" className="text-sm font-medium text-gray-300">
                            Search
                          </Label>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                              id="admin-search"
                              value={adminSearch}
                              onChange={(e) => setAdminSearch(e.target.value)}
                              placeholder="Email, username, name..."
                              className="bg-[#0a0a0a] border-[#2a2a2a] text-white pl-10"
                            />
                          </div>
                        </div>

                        {/* Active Status */}
                        <div className="space-y-2">
                          <Label htmlFor="admin-is_active" className="text-sm font-medium text-gray-300">
                            Active Status
                          </Label>
                          <Select
                            value={adminIsActiveFilter === undefined ? "all" : adminIsActiveFilter ? "true" : "false"}
                            onValueChange={(value) =>
                              setAdminIsActiveFilter(value === "all" ? undefined : value === "true")
                            }
                          >
                            <SelectTrigger className="bg-[#0a0a0a] border-[#2a2a2a] text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="true">Active</SelectItem>
                              <SelectItem value="false">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Subscription Status */}
                        <div className="space-y-2">
                          <Label htmlFor="admin-subscription" className="text-sm font-medium text-gray-300">
                            Subscription
                          </Label>
                          <Select
                            value={adminSubscriptionFilter || "all"}
                            onValueChange={(value) =>
                              setAdminSubscriptionFilter(value === "all" ? undefined : value as "free" | "paid")
                            }
                          >
                            <SelectTrigger className="bg-[#0a0a0a] border-[#2a2a2a] text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="paid">Paid</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Page Size */}
                        <div className="space-y-2">
                          <Label htmlFor="admin-page_size" className="text-sm font-medium text-gray-300">
                            Per Page
                          </Label>
                          <Select
                            value={adminPageSize.toString()}
                            onValueChange={(value) => {
                              setAdminPageSize(Number(value))
                              setAdminPage(1)
                            }}
                          >
                            <SelectTrigger className="bg-[#0a0a0a] border-[#2a2a2a] text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                              <SelectItem value="10">10</SelectItem>
                              <SelectItem value="20">20</SelectItem>
                              <SelectItem value="50">50</SelectItem>
                              <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Search className="w-4 h-4 mr-2" />
                          Search
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClearAdminFilters}
                          className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
                        >
                          Clear Filters
                        </Button>
                      </div>
                    </form>

                    {/* Admin Users List */}
                    {loadingAdminUsers ? (
                      <div className="flex items-center justify-center p-8">
                        <div className="flex items-center gap-3 text-gray-400">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Loading users...</span>
                        </div>
                      </div>
                    ) : adminUsers.length > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-[#2a2a2a]">
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">User</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Email</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Status</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Subscription</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Joined</th>
                                <th className="text-left py-3 px-4 text-sm font-medium text-gray-300">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminUsers.map((adminUser) => (
                                <tr key={adminUser.id} className="border-b border-[#2a2a2a] hover:bg-[#0a0a0a]">
                                  <td className="py-3 px-4">
                                    <div>
                                      <div className="text-white font-medium">
                                        {adminUser.first_name} {adminUser.last_name}
                                      </div>
                                      <div className="text-sm text-gray-400">@{adminUser.username}</div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-4 text-gray-300">{adminUser.email}</td>
                                  <td className="py-3 px-4">
                                    <Badge
                                      variant={adminUser.is_active ? "default" : "secondary"}
                                      className={
                                        adminUser.is_active
                                          ? "bg-green-900/30 text-green-400 border-green-700"
                                          : "bg-gray-800 text-gray-400 border-gray-700"
                                      }
                                    >
                                      {adminUser.is_active ? "Active" : "Inactive"}
                                    </Badge>
                                  </td>
                                  <td className="py-3 px-4">
                                    <Badge
                                      variant={adminUser.subscription_status === "paid" ? "default" : "secondary"}
                                      className={
                                        adminUser.subscription_status === "paid"
                                          ? "bg-blue-900/30 text-blue-400 border-blue-700"
                                          : "bg-gray-800 text-gray-400 border-gray-700"
                                      }
                                    >
                                      {adminUser.subscription_status}
                                    </Badge>
                                  </td>
                                  <td className="py-3 px-4 text-gray-400 text-sm">
                                    {new Date(adminUser.date_joined).toLocaleDateString()}
                                  </td>
                                  <td className="py-3 px-4">
                                    <Select
                                      value={adminUser.subscription_status}
                                      onValueChange={(value) =>
                                        handleUpdateSubscription(adminUser.id, value as "free" | "paid")
                                      }
                                    >
                                      <SelectTrigger className="w-32 bg-[#0a0a0a] border-[#2a2a2a] text-white h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                                        <SelectItem value="free">Free</SelectItem>
                                        <SelectItem value="paid">Paid</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination */}
                        {adminPagination && (
                          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#2a2a2a]">
                            <div className="text-sm text-gray-400">
                              Showing {adminUsers.length} of {adminPagination.count} users
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAdminPage(adminPage - 1)}
                                disabled={!adminPagination.previous || loadingAdminUsers}
                                className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
                              >
                                <ChevronLeft className="w-4 h-4 mr-1" />
                                Previous
                              </Button>
                              <span className="text-sm text-gray-400 px-3">
                                Page {adminPage}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAdminPage(adminPage + 1)}
                                disabled={!adminPagination.next || loadingAdminUsers}
                                className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
                              >
                                Next
                                <ChevronRight className="w-4 h-4 ml-1" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-400">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No users found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white h-11 text-base font-medium transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={saving}
                className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-500 h-11 text-base font-medium transition-colors"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Reset to Defaults
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default SettingsPage