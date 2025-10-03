"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { DollarSign, Clock, FileText, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { projectApi, TokenManager } from "@/lib/api"

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
  const [success, setSuccess] = useState("")



  // Use TokenManager for access token, matching the rest of the app
  const token = TokenManager.getAccessToken();

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      setError("")
      try {
        const res = await projectApi.get("/api/proposals/settings/get_settings/", {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = res.data
        if (!data || Object.keys(data).length === 0) {
          setIsNew(true)
          setForm(initialState)
        } else {
          setIsNew(false)
          setForm({ ...initialState, ...data })
        }
      } catch (e) {
        setError("Could not load settings.")
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
    // eslint-disable-next-line
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const url = isNew
        ? "/api/proposals/settings/create/"
        : "/api/proposals/settings/update/"
      const method = isNew ? "POST" : "PATCH"
      let res
      if (isNew) {
        res = await projectApi.post(url, form, {
          headers: { Authorization: `Bearer ${token}` },
        })
      } else {
        res = await projectApi.patch(url, form, {
          headers: { Authorization: `Bearer ${token}` },
        })
      }
      setSuccess("Settings saved!")
      setIsNew(false)
    } catch (e) {
      setError("Could not save settings.")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const res = await projectApi.post("/api/proposals/settings/reset/", {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setSuccess("Settings reset!")
      setIsNew(true)
      setForm(initialState)
    } catch (e) {
      setError("Could not reset settings.")
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