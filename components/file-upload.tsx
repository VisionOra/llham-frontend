"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Upload, File, FileText, X, Check, AlertCircle, Loader2, Paperclip } from "lucide-react"

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  status: "uploading" | "processing" | "completed" | "error"
  progress: number
  content?: string
  error?: string
}

interface FileUploadProps {
  onFileUploaded: (file: UploadedFile) => void
  onFileRemoved: (fileId: string) => void
  acceptedTypes?: string[]
  maxSize?: number // in MB
  multiple?: boolean
}

export function FileUpload({
  onFileUploaded,
  onFileRemoved,
  acceptedTypes = [".pdf", ".doc", ".docx", ".txt"],
  maxSize = 10,
  multiple = false,
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return <FileText className="w-4 h-4 text-red-400" />
    if (type.includes("doc")) return <FileText className="w-4 h-4 text-blue-400" />
    if (type.includes("text")) return <File className="w-4 h-4 text-gray-400" />
    return <File className="w-4 h-4 text-gray-400" />
  }

  const processFile = async (file: File): Promise<string> => {
    // Mock file processing - replace with actual file parsing
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          `Processed content from ${file.name}:\n\nThis is mock content extracted from the uploaded file. In a real implementation, this would contain the actual text content extracted from PDF, Word documents, or other file types.`,
        )
      }, 2000)
    })
  }

  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = Date.now().toString()
      const uploadedFile: UploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        status: "uploading",
        progress: 0,
      }

      setFiles((prev) => [...prev, uploadedFile])

      try {
        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, progress } : f)))
        }

        // Update to processing status
        setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, status: "processing", progress: 0 } : f)))

        // Process file content
        const content = await processFile(file)

        // Complete the upload
        const completedFile: UploadedFile = {
          ...uploadedFile,
          status: "completed",
          progress: 100,
          content,
        }

        setFiles((prev) => prev.map((f) => (f.id === fileId ? completedFile : f)))

        onFileUploaded(completedFile)
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  status: "error",
                  error: "Failed to process file",
                }
              : f,
          ),
        )
      }
    },
    [onFileUploaded],
  )

  const handleFileSelect = (selectedFiles: FileList) => {
    Array.from(selectedFiles).forEach((file) => {
      // Validate file type
      const isValidType = acceptedTypes.some((type) => file.name.toLowerCase().endsWith(type.toLowerCase()))

      if (!isValidType) {
        alert(`File type not supported. Accepted types: ${acceptedTypes.join(", ")}`)
        return
      }

      // Validate file size
      if (file.size > maxSize * 1024 * 1024) {
        alert(`File size too large. Maximum size: ${maxSize}MB`)
        return
      }

      uploadFile(file)
    })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    onFileRemoved(fileId)
  }

  const getStatusIcon = (file: UploadedFile) => {
    switch (file.status) {
      case "uploading":
      case "processing":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
      case "completed":
        return <Check className="w-4 h-4 text-green-400" />
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-400" />
      default:
        return null
    }
  }

  const getStatusText = (file: UploadedFile) => {
    switch (file.status) {
      case "uploading":
        return "Uploading..."
      case "processing":
        return "Processing..."
      case "completed":
        return "Ready"
      case "error":
        return file.error || "Error"
      default:
        return ""
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver ? "border-green-500 bg-green-900/20" : "border-[#2a2a2a] hover:border-[#3a3a3a]"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-300 mb-2">
          Drop files here or{" "}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-green-400 hover:text-green-300 underline"
          >
            browse
          </button>
        </p>
        <p className="text-xs text-gray-500">
          Supported: {acceptedTypes.join(", ")} • Max {maxSize}MB
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(",")}
          multiple={multiple}
          onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
          className="hidden"
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">Uploaded Files</h4>
          {files.map((file) => (
            <Card key={file.id} className="bg-[#1a1a1a] border-[#2a2a2a] p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getFileIcon(file.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span className="flex items-center space-x-1">
                        {getStatusIcon(file)}
                        <span>{getStatusText(file)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(file.id)}
                  className="text-gray-400 hover:text-red-400 h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {(file.status === "uploading" || file.status === "processing") && (
                <div className="mt-2">
                  <Progress value={file.progress} className="h-1" />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// Compact file upload button for chat interface
export function FileUploadButton({ onFileUploaded }: { onFileUploaded: (file: UploadedFile) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]

      // Validate file
      const acceptedTypes = [".pdf", ".doc", ".docx", ".txt"]
      const isValidType = acceptedTypes.some((type) => file.name.toLowerCase().endsWith(type.toLowerCase()))

      if (!isValidType) {
        alert(`File type not supported. Accepted types: ${acceptedTypes.join(", ")}`)
        return
      }

      if (file.size > 10 * 1024 * 1024) {
        alert("File size too large. Maximum size: 10MB")
        return
      }

      // Create uploaded file object
      const uploadedFile: UploadedFile = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        status: "completed",
        progress: 100,
        content: `Content from ${file.name} would be processed here.`,
      }

      onFileUploaded(uploadedFile)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        className="border-[#2a2a2a] text-gray-300 hover:bg-[#1a1a1a] hover:text-white"
      >
        <Paperclip className="w-4 h-4" />
      </Button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  )
}
