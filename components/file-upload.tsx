"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Upload, File, FileText, X, Check, AlertCircle, Loader2, Paperclip, FileIcon } from "lucide-react"

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
  maxSize = 3,
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

  const formatFileType = (type: string) => {
    if (!type) return 'Unknown'
    if (type.includes('pdf')) return 'PDF Document'
    if (type.includes('word')) return 'Word Document'
    if (type.includes('doc')) return 'Word Document'
    if (type.includes('text')) return 'Text File'
    const parts = type.split('/')
    return parts[parts.length - 1].toUpperCase()
  }

  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return <FileText className="w-4 h-4 text-red-400" />
    if (type.includes("doc")) return <FileText className="w-4 h-4 text-blue-400" />
    if (type.includes("text")) return <File className="w-4 h-4 text-gray-400" />
    return <File className="w-4 h-4 text-gray-400" />
  }

  const processFile = async (file: File): Promise<string> => {
    // Convert file to base64 string
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove the data URL prefix
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white break-all line-clamp-2 max-w-[220px] sm:max-w-[320px] overflow-hidden cursor-pointer" title={file.name} style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{file.name}</p>
                  <div className="flex items-center space-x-2 text-xs text-gray-400 mt-1">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span>{file.type || 'Unknown'}</span>
                  </div>
                </div>
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
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatFileType = (type: string) => {
    if (!type) return 'Unknown'
    if (type.includes('pdf')) return 'PDF Document'
    if (type.includes('word')) return 'Word Document'
    if (type.includes('doc')) return 'Word Document'
    if (type.includes('text')) return 'Text File'
    const parts = type.split('/')
    return parts[parts.length - 1].toUpperCase()
  }

  const processAndUploadFile = async (file: File) => {
    // Process file to base64 before creating UploadedFile
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      const uploadedFile: UploadedFile = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        status: "completed",
        progress: 100,
        content: base64,
      };
      onFileUploaded(uploadedFile);
    };
    reader.onerror = () => {
      const uploadedFile: UploadedFile = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        status: "error",
        progress: 100,
        content: undefined,
        error: "Failed to convert file to base64",
      };
      onFileUploaded(uploadedFile);
    };
    reader.readAsDataURL(file);
  }

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


      if (file.size > 3 * 1024 * 1024) {
        setPendingFile(file)
        setFileError("File size too large. Maximum size: 3MB")
        setShowConfirmDialog(true)
        return
      }

      // Show confirmation dialog
  setPendingFile(file)
  setFileError(null)
  setShowConfirmDialog(true)
    }

    // Reset input value so the same file can be selected again
    e.target.value = ''
  }

  const handleConfirmUpload = () => {
    if (pendingFile && !fileError) {
      processAndUploadFile(pendingFile)
      setPendingFile(null)
      setShowConfirmDialog(false)
    }
  }

  const handleCancelUpload = () => {
    setPendingFile(null)
    setFileError(null)
    setShowConfirmDialog(false)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        className="border-[#2a2a2a] text-black/70 hover:bg-[#1a1a1a] hover:text-white"
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

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="bg-[#1a1a1a] border-[#2a2a2a] text-white sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <FileIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
              Confirm File Upload
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Review the file details before uploading
            </DialogDescription>
          </DialogHeader>
          
          {pendingFile && (
            <div className="space-y-4 py-4 overflow-hidden">
              <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-4 space-y-3 overflow-hidden">
                <div className="flex items-start gap-3 min-w-0 w-full">
                  <FileText className="w-8 h-8 text-blue-400 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0 overflow-hidden w-full">
                    <p
                      className="text-sm font-medium text-white break-all line-clamp-2 max-w-full overflow-hidden cursor-pointer"
                      title={pendingFile.name}
                      style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                    >
                      {pendingFile.name}
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-gray-400">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 flex-shrink-0">Size:</span>
                        <span className="font-medium text-green-400">{formatFileSize(pendingFile.size)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 flex-shrink-0">Type:</span>
                        <span className="font-medium text-blue-400">{formatFileType(pendingFile.type)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {fileError && (
                  <div className="mt-3 bg-red-900/20 border border-red-700/50 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <p className="text-xs text-red-300">{fileError}</p>
                    </div>
                  </div>
                )}
              </div>
              {!fileError && (
                <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300">
                      The file will be processed and added to your chat. You can then ask questions or request analysis.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleCancelUpload}
              className="border-[#2a2a2a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUpload}
              className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
              disabled={!!fileError}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
