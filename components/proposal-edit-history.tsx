"use client"

import { X } from "lucide-react"
import { type ProposalEdit } from "@/lib/api"

interface ProposalEditHistoryProps {
  proposalEdits: ProposalEdit[]
  loadingEdits: boolean
  onClose: () => void
}

export function ProposalEditHistory({
  proposalEdits,
  loadingEdits,
  onClose
}: ProposalEditHistoryProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Edit History</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {loadingEdits ? (
        <div className="text-center py-8 text-gray-400">Loading edits...</div>
      ) : proposalEdits.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No edits yet. Use Edit button to make changes.</div>
      ) : (
        <div className="space-y-4">
          {proposalEdits.map((edit) => (
            <div key={edit.id} className="border border-gray-800 rounded-lg p-4" style={{ backgroundColor: '#0A0A0A' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-300">{edit.section_identifier}</span>
                <span className={`text-xs px-2 py-1 rounded ${
                  edit.status === 'accepted' ? 'bg-green-100 text-green-800' :
                  edit.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {edit.status}
                </span>
              </div>
              <div className="text-sm text-gray-300 mb-2">
                <strong>Original:</strong> {edit.original_content.substring(0, 100)}...
              </div>
              <div className="text-sm text-gray-300 mb-2">
                <strong>Proposed:</strong> {edit.proposed_content.substring(0, 100)}...
              </div>
              {edit.edit_reason && (
                <div className="text-xs text-gray-400 mt-2">
                  <strong>Reason:</strong> {edit.edit_reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

