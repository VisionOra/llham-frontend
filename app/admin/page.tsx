"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Users, Search, Filter, ChevronLeft, ChevronRight, Shield, AlertCircle } from "lucide-react"
import { getAdminUsers, updateUserSubscriptionPatch, type AdminUser, type AdminUsersListParams } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { MainLayout } from "@/components/main-layout"

function AdminPageContent() {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [pagination, setPagination] = useState<{
    count: number
    next: string | null
    previous: string | null
  } | null>(null)
  
  // Filters
  const [search, setSearch] = useState("")
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>(undefined)
  const [subscriptionFilter, setSubscriptionFilter] = useState<"free" | "paid" | undefined>(undefined)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  // Check if user is admin
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
      return
    }
    
    // Check if user is admin (is_staff or is_superuser)
    if (!user?.is_staff && !user?.is_superuser) {
      setError("Access denied. Admin privileges required.")
      toast.error("Access denied. Admin privileges required.")
    }
  }, [user, isAuthenticated, router])

  // Fetch users
  useEffect(() => {
    if (!user?.is_staff && !user?.is_superuser) {
      return
    }

    const fetchUsers = async () => {
      setLoading(true)
      setError("")
      try {
        const params: AdminUsersListParams = {
          page,
          page_size: pageSize,
        }
        if (search) params.search = search
        if (isActiveFilter !== undefined) params.is_active = isActiveFilter
        if (subscriptionFilter) params.subscription_status = subscriptionFilter

        const response = await getAdminUsers(params)
        setUsers(response.results || [])
        setPagination({
          count: response.count,
          next: response.next,
          previous: response.previous,
        })
      } catch (e: any) {
        console.error("Error fetching users:", e)
        const errorMessage = e?.message || "Could not load users."
        setError(errorMessage)
        toast.error(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [page, pageSize, search, isActiveFilter, subscriptionFilter, user])

  const handleUpdateSubscription = async (userId: string, newStatus: "free" | "paid") => {
    try {
      const updatedUser = await updateUserSubscriptionPatch(userId, {
        subscription_status: newStatus,
      })
      
      // Update user in the list
      setUsers(prevUsers =>
        prevUsers.map(u => (u.id === userId ? updatedUser : u))
      )
      
      toast.success(`Subscription updated to ${newStatus}`)
    } catch (e: any) {
      console.error("Error updating subscription:", e)
      const errorMessage = e?.message || "Could not update subscription."
      toast.error(errorMessage)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1) // Reset to first page on new search
  }

  const handleClearFilters = () => {
    setSearch("")
    setIsActiveFilter(undefined)
    setSubscriptionFilter(undefined)
    setPage(1)
  }

  if (!isAuthenticated) {
    return null
  }

  if (!user?.is_staff && !user?.is_superuser) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <Card className="bg-[#1a1a1a] border-[#2a2a2a] max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertCircle className="w-12 h-12 text-red-400" />
              <h2 className="text-xl font-semibold text-white">Access Denied</h2>
              <p className="text-gray-400">Admin privileges required to access this page.</p>
              <Button
                onClick={() => router.push("/dashboard")}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-green-400" />
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
          </div>
          <p className="text-gray-400">Manage users and their subscriptions</p>
        </div>

        {/* Filters */}
        <Card className="bg-[#1a1a1a] border-[#2a2a2a] mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label htmlFor="search" className="text-sm font-medium text-gray-300">
                    Search
                  </Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Email, username, name..."
                      className="bg-[#0a0a0a] border-[#2a2a2a] text-white pl-10"
                    />
                  </div>
                </div>

                {/* Active Status */}
                <div className="space-y-2">
                  <Label htmlFor="is_active" className="text-sm font-medium text-gray-300">
                    Active Status
                  </Label>
                  <Select
                    value={isActiveFilter === undefined ? "all" : isActiveFilter ? "true" : "false"}
                    onValueChange={(value) =>
                      setIsActiveFilter(value === "all" ? undefined : value === "true")
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
                  <Label htmlFor="subscription" className="text-sm font-medium text-gray-300">
                    Subscription
                  </Label>
                  <Select
                    value={subscriptionFilter || "all"}
                    onValueChange={(value) =>
                      setSubscriptionFilter(value === "all" ? undefined : value as "free" | "paid")
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
                  <Label htmlFor="page_size" className="text-sm font-medium text-gray-300">
                    Per Page
                  </Label>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value))
                      setPage(1)
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
                  onClick={handleClearFilters}
                  className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
                >
                  Clear Filters
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="bg-[#1a1a1a] border-[#2a2a2a]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Users className="w-5 h-5" />
              Users
              {pagination && (
                <Badge variant="outline" className="ml-2 border-gray-700 text-gray-300">
                  {pagination.count} total
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="flex items-center gap-3 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Loading users...</span>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p>{error}</p>
              </div>
            ) : users.length > 0 ? (
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
                      {users.map((user) => (
                        <tr key={user.id} className="border-b border-[#2a2a2a] hover:bg-[#0a0a0a]">
                          <td className="py-3 px-4">
                            <div>
                              <div className="text-white font-medium">
                                {user.first_name} {user.last_name}
                              </div>
                              <div className="text-sm text-gray-400">@{user.username}</div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-300">{user.email}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={user.is_active ? "default" : "secondary"}
                              className={
                                user.is_active
                                  ? "bg-green-900/30 text-green-400 border-green-700"
                                  : "bg-gray-800 text-gray-400 border-gray-700"
                              }
                            >
                              {user.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={user.subscription_status === "paid" ? "default" : "secondary"}
                              className={
                                user.subscription_status === "paid"
                                  ? "bg-blue-900/30 text-blue-400 border-blue-700"
                                  : "bg-gray-800 text-gray-400 border-gray-700"
                              }
                            >
                              {user.subscription_status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-sm">
                            {new Date(user.date_joined).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <Select
                              value={user.subscription_status}
                              onValueChange={(value) =>
                                handleUpdateSubscription(user.id, value as "free" | "paid")
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
                {pagination && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#2a2a2a]">
                    <div className="text-sm text-gray-400">
                      Showing {users.length} of {pagination.count} users
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={!pagination.previous || loading}
                        className="border-[#2a2a2a] text-gray-300 hover:bg-[#2a2a2a]"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        Previous
                      </Button>
                      <span className="text-sm text-gray-400 px-3">
                        Page {page}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={!pagination.next || loading}
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
      </div>
    </div>
  )
}

export default function AdminPage() {
  return (
    <MainLayout>
      <AdminPageContent />
    </MainLayout>
  )
}

