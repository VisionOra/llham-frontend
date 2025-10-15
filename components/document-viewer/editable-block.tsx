"use client"

import React, { useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { EditableBlock as EditableBlockType } from './types'

interface EditableBlockProps {
  block: EditableBlockType
  editingBlockId: string | null
  editMode: boolean
  editableRef: React.RefObject<HTMLElement>
  onStartEdit: (blockId: string, content: string) => void
  onSaveEdit: (blockId: string) => void
  onCancelEdit: () => void
  onContentChange: (content: string) => void
}

export const EditableBlockRenderer: React.FC<EditableBlockProps> = ({
  block,
  editingBlockId,
  editMode,
  editableRef,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onContentChange,
}) => {
  const isEditing = editingBlockId === block.id
  const isEditableType = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'td', 'th', 'blockquote'].includes(block.type)

  // Filter out style and class attributes (class conflicts with className in React.createElement)
  const { style, class: className, ...otherAttributes } = block.attributes

  // Set innerHTML when editing starts
  useEffect(() => {
    if (isEditing && editableRef.current) {
      editableRef.current.innerHTML = block.content
      setTimeout(() => {
        if (editableRef.current) {
          editableRef.current.focus()
          const range = document.createRange()
          const sel = window.getSelection()
          range.selectNodeContents(editableRef.current)
          range.collapse(false)
          sel?.removeAllRanges()
          sel?.addRange(range)
        }
      }, 0)
    }
  }, [isEditing, block.content])

  // Container elements with children
  if (block.children && block.children.length > 0) {
    const Tag = block.type as keyof JSX.IntrinsicElements
    return (
      <Tag key={block.id} {...otherAttributes}>
        {block.children.map(child => (
          <EditableBlockRenderer
            key={child.id}
            block={child}
            editingBlockId={editingBlockId}
            editMode={editMode}
            editableRef={editableRef}
            onStartEdit={onStartEdit}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onContentChange={onContentChange}
          />
        ))}
      </Tag>
    )
  }

  // Non-editable elements
  if (!isEditableType) {
    if (block.type === 'text') {
      return <span key={block.id}>{block.content}</span>
    }
    if (block.type === 'inline') {
      return <span key={block.id} dangerouslySetInnerHTML={{ __html: block.content }} />
    }
    
    const Tag = block.type as keyof JSX.IntrinsicElements
    
    // Void elements cannot have children or dangerouslySetInnerHTML
    const voidElements = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr']
    if (voidElements.includes(block.type)) {
      return <Tag key={block.id} {...otherAttributes} />
    }
    
    return <Tag key={block.id} {...otherAttributes} dangerouslySetInnerHTML={{ __html: block.content }} />
  }

  // Editable elements
  const TagName = block.type

  if (isEditing) {
    const EditElement = React.createElement(
      TagName,
      {
        ref: editableRef,
        contentEditable: true,
        suppressContentEditableWarning: true,
        className: `${className || ''} outline-none ring-2 ring-blue-500 rounded px-2 py-1 bg-blue-50/10`,
        onInput: (e: React.FormEvent<HTMLElement>) => {
          const target = e.currentTarget as HTMLElement
          onContentChange(target.innerHTML)
        },
        onBlur: (e: React.FocusEvent<HTMLElement>) => {
          const target = e.currentTarget as HTMLElement
          onContentChange(target.innerHTML)
        },
        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancelEdit()
          }
          if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault()
            onSaveEdit(block.id)
          }
        }
      }
    )
    
    return (
      <div key={block.id} className="relative group">
        {EditElement}
        <div className="flex gap-1 mt-1">
          <Button
            size="sm"
            onClick={() => onSaveEdit(block.id)}
            className="bg-green-600 hover:bg-green-700 text-white text-xs h-6 px-2"
          >
            <Check className="w-3 h-3 mr-1" />
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onCancelEdit}
            className="border-red-600 text-red-400 hover:bg-red-900/30 text-xs h-6 px-2"
          >
            <X className="w-3 h-3 mr-1" />
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // Regular non-editing editable block
  const NonEditElement = React.createElement(
    TagName,
    {
      key: block.id,
      ...otherAttributes,
      className: `${className || ''} ${editMode ? 'cursor-pointer hover:bg-blue-50/5 rounded px-2 py-1 transition-colors' : ''}`,
      onClick: (e: React.MouseEvent<HTMLElement>) => {
        if (editMode) {
          e.stopPropagation()
          onStartEdit(block.id, block.content)
        }
      },
      dangerouslySetInnerHTML: { __html: block.content }
    }
  )

  return NonEditElement
}

