export interface Document {
  id?: string
  title: string
  content: string
  created_at?: string
  updated_at?: string
  author?: string
}

export interface EditSuggestion {
  id: string
  type: string
  editData?: {
    edit_id: string
    original: string
    proposed: string
    reason: string
    section_info: string
    selected_context: boolean
    confidence: number
    edit_type: string
    original_hash?: string
    updated_hash?: string
    verification?: {
      original_hash: string
      updated_hash: string
      success: boolean
      message: string
    }
  }
  showAcceptReject?: boolean
}

export interface EditableBlock {
  id: string
  type: string
  content: string
  attributes: Record<string, string>
  children?: EditableBlock[]
}

export interface DocumentViewerProps {
  document: Document | null
  onTextSelect?: (selectedText: string, element: HTMLElement) => void
  editSuggestion?: EditSuggestion
  onAcceptEdit?: (editId: string) => void
  onRejectEdit?: (editId: string) => void
  onDocumentChange?: (updatedDocument: Document) => void
  sessionId?: string
  sendMessage?: (message: any) => boolean
}

