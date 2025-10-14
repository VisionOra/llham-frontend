"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Loader2 } from "lucide-react"
import { useProjects } from "@/contexts/project-context"

interface ProjectCreationModalProps {
  trigger?: React.ReactNode
  onProjectCreated?: (projectId: string) => void
}

export function ProjectCreationModal({ trigger, onProjectCreated }: ProjectCreationModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState("")
  const { createProject, isLoading, error } = useProjects()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    try {
      await createProject(title.trim())
      setTitle("")
      setIsOpen(false)
    } catch (error) {
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setTitle("")
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            size="sm"
            className="border-[#2a2a2a] bg-transparent hover:bg-[#1a1a1a] text-gray-400 hover:text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-title" className="text-gray-300">
              Project Title
            </Label>
            <Input
              id="project-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter project title..."
              className="bg-[#0a0a0a] border-[#2a2a2a] text-white focus:border-[#3a3a3a]"
              autoFocus
            />
          </div>

          {error && <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-3">{error}</div>}

          <div className="flex justify-end space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-[#2a2a2a] bg-transparent hover:bg-[#1a1a1a]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || isLoading}
              className="bg-white text-black hover:bg-gray-200 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
