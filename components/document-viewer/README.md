# Document Viewer - Modular Structure

This component has been refactored into a modular architecture for better maintainability and reusability.

## 📁 File Structure

```
document-viewer/
├── index.tsx                  # Main DocumentViewer component
├── types.ts                   # TypeScript interfaces and types
├── utils.ts                   # Utility functions (parsing, formatting, etc.)
├── use-export-actions.ts      # Custom hook for export functionality
├── document-toolbar.tsx       # Top toolbar with actions
├── document-header.tsx        # Header with zoom controls and metadata
├── editable-block.tsx         # Editable block renderer
└── README.md                  # This file
```

## 🧩 Components

### **Main Component** (`index.tsx`)
The main `DocumentViewer` component that orchestrates all sub-components and manages state.

**Props:**
- `document`: Document object to display
- `onTextSelect`: Callback when text is selected
- `editSuggestion`: Edit suggestions from AI
- `onAcceptEdit`: Callback to accept edit
- `onRejectEdit`: Callback to reject edit
- `onDocumentChange`: Callback when document changes
- `sessionId`: WebSocket session ID
- `sendMessage`: Function to send WebSocket messages

---

### **DocumentToolbar** (`document-toolbar.tsx`)
The top toolbar containing:
- Document title and last updated date
- Print button
- Export dropdown (Markdown, HTML/PDF, Notion)
- Edit mode toggle

**Props:**
- `document`: Document data
- `editMode`: Whether edit mode is active
- `isSelecting`: Whether text is being selected
- `onToggleEdit`: Toggle edit mode
- `onPrint`: Print handler
- `onExportMarkdown`: Export as Markdown
- `onExportPDF`: Export as HTML/PDF
- `onShareWithNotion`: Share with Notion

---

### **DocumentHeader** (`document-header.tsx`)
Header section with:
- Zoom controls (in/out)
- Document metadata (created date, author)
- Status badges (text selected, editing mode)
- Copy button

**Props:**
- `document`: Document data
- `zoomLevel`: Current zoom percentage
- `isSelecting`: Text selection status
- `editMode`: Edit mode status
- `copied`: Copy status
- `selectedText`: Currently selected text
- `onZoomIn/onZoomOut`: Zoom handlers
- `onCopy`: Copy text handler

---

### **EditableBlockRenderer** (`editable-block.tsx`)
Renders individual editable blocks with edit capabilities.

**Props:**
- `block`: Block data structure
- `isEditing`: Whether this block is being edited
- `editableRef`: Ref for the editable element
- `onStartEdit`: Start editing handler
- `onSaveEdit`: Save edit handler
- `onCancelEdit`: Cancel edit handler
- `onContentChange`: Content change handler

---

## 🛠 Utilities (`utils.ts`)

### Functions:
- **`formatDate(dateString)`**: Format date strings
- **`countCharacters(text)`**: Count text characters (without HTML)
- **`parseHTMLToBlocks(html)`**: Parse HTML into editable block structure
- **`blocksToHTML(blocks)`**: Convert blocks back to HTML
- **`htmlToMarkdown(html)`**: Convert HTML to Markdown

---

## 🪝 Custom Hooks

### **useExportActions** (`use-export-actions.ts`)
Custom hook that provides export functionality:
- `handleExportMarkdown()`: Export document as Markdown
- `handleExportPDF()`: Export document as HTML (for PDF conversion)
- `handleShareWithNotion()`: Copy to clipboard and open Notion

---

## 📝 Types (`types.ts`)

### Interfaces:
- **`Document`**: Document data structure
- **`EditSuggestion`**: AI edit suggestion structure
- **`EditableBlock`**: Block structure for editable content
- **`DocumentViewerProps`**: Main component props

---

## 🎯 Usage Example

```tsx
import { DocumentViewer } from '@/components/document-viewer'

function MyPage() {
  const handleTextSelect = (text: string, element: HTMLElement) => {
    console.log('Selected:', text)
  }

  const handleDocumentChange = (updatedDoc: Document) => {
    console.log('Document updated:', updatedDoc)
  }

  return (
    <DocumentViewer
      document={myDocument}
      onTextSelect={handleTextSelect}
      onDocumentChange={handleDocumentChange}
      sessionId="session-123"
    />
  )
}
```

---

## 🔄 Migration Notes

The old monolithic `document-viewer.tsx` has been replaced with a re-export:

```tsx
// Old: Everything in one file (1100+ lines)
export function DocumentViewer() { ... }

// New: Modular structure with re-exports
export { DocumentViewer } from './document-viewer/index'
export type { ... } from './document-viewer/types'
```

All existing imports continue to work without changes:
```tsx
import { DocumentViewer } from '@/components/document-viewer'
```

---

## ✨ Benefits

1. **Maintainability**: Smaller, focused files are easier to understand and modify
2. **Reusability**: Components and utilities can be reused independently
3. **Testability**: Individual functions and components can be tested in isolation
4. **Collaboration**: Multiple developers can work on different files simultaneously
5. **Performance**: Better tree-shaking and code splitting opportunities

---

## 🚀 Future Improvements

- Add unit tests for utility functions
- Add Storybook stories for components
- Extract more hooks (e.g., `useDocumentEdit`, `useTextSelection`)
- Add proper TypeScript strict mode compliance
- Optimize rendering with React.memo where appropriate

