# 🚀 Complete WebSocket Integration Guide for Next.js Frontend

## Overview
This guide provides complete implementation details for integrating the LLHam WebSocket API with a Next.js frontend, including chat functionality, document editing, PDF upload, and auto-save features.

## 📋 Table of Contents
1. [Setup & Authentication](#setup--authentication)
2. [WebSocket Connection](#websocket-connection)
3. [Chat Implementation](#chat-implementation)
4. [Edit Management](#edit-management)
5. [PDF Upload](#pdf-upload)
6. [Document Auto-save](#document-auto-save)
7. [Session Management](#session-management)
8. [Error Handling](#error-handling)
9. [TypeScript Definitions](#typescript-definitions)
10. [Complete Example](#complete-example)

---

## Setup & Authentication

### 1. Install Dependencies
```bash
npm install ws @types/ws
```

### 2. Environment Configuration
```typescript
// config/websocket.ts
export const WEBSOCKET_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000',
  ENDPOINTS: {
    CHAT: '/ws/proposal-chat/',
  },
  RECONNECT: {
    MAX_ATTEMPTS: 5,
    DELAY: 1000,
    BACKOFF_FACTOR: 1.5,
  }
};
```

### 3. Authentication Setup
```typescript
// hooks/useAuth.ts
export const useAuth = () => {
  const getToken = () => localStorage.getItem('access_token');
  
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = getToken();
    return fetch(`${process.env.NEXT_PUBLIC_API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  };

  return { getToken, apiCall };
};
```

---

## WebSocket Connection

### 1. WebSocket Hook
```typescript
// hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { WEBSOCKET_CONFIG } from '../config/websocket';

interface WebSocketHookProps {
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export const useWebSocket = ({
  onMessage,
  onError,
  onConnect,
  onDisconnect
}: WebSocketHookProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback((sessionId?: string, projectId?: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    
    // Build WebSocket URL with query parameters
    const params = new URLSearchParams();
    if (sessionId) params.append('session_id', sessionId);
    if (projectId) params.append('project_id', projectId);
    
    const token = localStorage.getItem('access_token');
    if (token) params.append('token', token);

    const wsUrl = `${WEBSOCKET_CONFIG.BASE_URL}${WEBSOCKET_CONFIG.ENDPOINTS.CHAT}?${params.toString()}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        onConnect?.();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message:', data);
          onMessage?.(data);
        } catch (error) {
          console.error('❌ Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        onDisconnect?.();
        
        // Auto-reconnect logic
        if (event.code !== 1000 && reconnectAttempts.current < WEBSOCKET_CONFIG.RECONNECT.MAX_ATTEMPTS) {
          const delay = WEBSOCKET_CONFIG.RECONNECT.DELAY * Math.pow(WEBSOCKET_CONFIG.RECONNECT.BACKOFF_FACTOR, reconnectAttempts.current);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            console.log(`🔄 Reconnecting... Attempt ${reconnectAttempts.current}`);
            connect(sessionId, projectId);
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
        onError?.(error);
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [onMessage, onError, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    reconnectAttempts.current = 0;
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('⚠️ WebSocket not connected, message not sent:', message);
      return false;
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected,
    connectionStatus
  };
};
```

---

## Chat Implementation

### 1. Message Types
```typescript
// types/chat.ts
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  timestamp: string;
}

export interface WebSocketMessage {
  type: string;
  message?: string;
  session_id?: string;
  project_id?: string;
  agent_mode?: string;
  [key: string]: any;
}
```

### 2. Chat Component
```typescript
// components/Chat.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { ChatMessage, WebSocketMessage } from '../types/chat';

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSession, setCurrentSession] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleWebSocketMessage = (data: WebSocketMessage) => {
    switch (data.type) {
      case 'chat_response':
        addMessage('assistant', data.message || '');
        setIsLoading(false);
        break;

      case 'session_created':
        setCurrentSession(data);
        break;

      case 'edit_suggestion':
        handleEditSuggestion(data);
        break;

      case 'edit_applied':
        handleEditApplied(data);
        break;

      case 'edit_rejected':
        handleEditRejected(data);
        break;

      case 'edit_reverted':
        handleEditReverted(data);
        break;

      case 'pdf_processed':
        handlePDFProcessed(data);
        break;

      case 'error':
        console.error('WebSocket error:', data.message);
        setIsLoading(false);
        break;
    }
  };

  const { connect, disconnect, sendMessage, isConnected } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onConnect: () => console.log('Chat connected'),
    onDisconnect: () => console.log('Chat disconnected'),
  });

  const addMessage = (role: ChatMessage['role'], content: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      role,
      message: content,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const sendChatMessage = () => {
    if (!inputValue.trim() || !isConnected) return;

    const userMessage = inputValue.trim();
    addMessage('user', userMessage);
    setInputValue('');
    setIsLoading(true);

    sendMessage({
      type: 'chat_message',
      message: userMessage,
      session_id: currentSession?.session_id,
      project_id: currentSession?.project_id,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  // Edit handling functions
  const handleEditSuggestion = (data: any) => {
    // Add edit suggestion UI
    const editMessage = `✏️ Edit Suggestion: ${data.edit_data?.section_identifier || 'Content'}\nChanges: ${data.edit_data?.edit_reason || 'Content modification'}`;
    addMessage('system', editMessage);
    
    // You can add custom edit suggestion UI here
  };

  const handleEditApplied = (data: any) => {
    addMessage('system', `✅ Edit applied successfully!`);
  };

  const handleEditRejected = (data: any) => {
    addMessage('system', `❌ Edit rejected`);
  };

  const handleEditReverted = (data: any) => {
    addMessage('system', `🔄 Edit reverted successfully!`);
  };

  const handlePDFProcessed = (data: any) => {
    addMessage('system', `📄 PDF processed: ${data.filename}`);
  };

  // Initialize connection
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-content">
              {message.message}
            </div>
            <div className="message-timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message assistant loading">
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          rows={1}
          disabled={!isConnected || isLoading}
        />
        <button
          onClick={sendChatMessage}
          disabled={!isConnected || isLoading || !inputValue.trim()}
        >
          Send
        </button>
      </div>

      <div className="connection-status">
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
    </div>
  );
};
```

---

## Edit Management

### 1. Edit Types
```typescript
// types/edit.ts
export interface EditData {
  edit_id: string;
  original: string;
  proposed: string;
  reason: string;
  section_info: string;
  confidence: number;
  edit_type: string;
}

export interface EditSuggestion {
  type: 'edit_suggestion';
  message: string;
  edit_data: EditData;
  session_id: string;
  show_accept_reject: boolean;
}
```

### 2. Edit Management Hook
```typescript
// hooks/useEditManagement.ts
import { useCallback } from 'react';

export const useEditManagement = (sendMessage: (msg: any) => boolean) => {
  
  const acceptEdit = useCallback((editId: string, sessionId: string) => {
    return sendMessage({
      type: 'edit_request',
      action: 'accept',
      edit_id: editId,
      session_id: sessionId,
    });
  }, [sendMessage]);

  const rejectEdit = useCallback((editId: string, sessionId: string) => {
    return sendMessage({
      type: 'edit_request',
      action: 'reject',
      edit_id: editId,
      session_id: sessionId,
    });
  }, [sendMessage]);

  const revertEdit = useCallback((editId: string, sessionId: string) => {
    return sendMessage({
      type: 'revert_edit',
      edit_id: editId,
      session_id: sessionId,
    });
  }, [sendMessage]);

  const requestEdit = useCallback((
    message: string,
    sessionId: string,
    documentContext?: string
  ) => {
    return sendMessage({
      type: 'chat_message',
      message,
      session_id: sessionId,
      document_context: documentContext,
    });
  }, [sendMessage]);

  return {
    acceptEdit,
    rejectEdit,
    revertEdit,
    requestEdit,
  };
};
```

### 3. Edit Suggestion Component
```typescript
// components/EditSuggestion.tsx
import React from 'react';
import { EditSuggestion as EditSuggestionType } from '../types/edit';

interface Props {
  editSuggestion: EditSuggestionType;
  onAccept: (editId: string) => void;
  onReject: (editId: string) => void;
}

export const EditSuggestion: React.FC<Props> = ({
  editSuggestion,
  onAccept,
  onReject,
}) => {
  const { edit_data } = editSuggestion;
  const confidencePercent = Math.round(edit_data.confidence * 100);

  return (
    <div className="edit-suggestion">
      <div className="edit-header">
        <div className="edit-title">
          ✏️ Edit Suggestion ({confidencePercent}% confidence)
        </div>
        <div className="edit-actions">
          <button
            className="btn-accept"
            onClick={() => onAccept(edit_data.edit_id)}
          >
            ✅ Accept
          </button>
          <button
            className="btn-reject"
            onClick={() => onReject(edit_data.edit_id)}
          >
            ❌ Reject
          </button>
        </div>
      </div>

      <div className="edit-context">
        📄 Section: {edit_data.section_info}
      </div>

      <div className="diff-container">
        <div className="diff-section diff-removed">
          <div className="diff-label">- Original</div>
          <div className="diff-content">
            {edit_data.original}
          </div>
        </div>
        <div className="diff-section diff-added">
          <div className="diff-label">+ Proposed</div>
          <div className="diff-content">
            {edit_data.proposed}
          </div>
        </div>
      </div>

      <div className="edit-reason">
        💡 Reason: {edit_data.reason}
      </div>
    </div>
  );
};
```

---

## PDF Upload

### 1. PDF Upload Hook
```typescript
// hooks/usePDFUpload.ts
import { useState, useCallback } from 'react';

export const usePDFUpload = (sendMessage: (msg: any) => boolean) => {
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({});
  const [processingFiles, setProcessingFiles] = useState<string[]>([]);

  const uploadPDFs = useCallback(async (
    files: FileList,
    sessionId: string,
    message?: string
  ) => {
    const pdfFiles = Array.from(files).filter(
      file => file.type === 'application/pdf'
    );

    if (pdfFiles.length === 0) {
      throw new Error('No PDF files selected');
    }

    // Convert files to base64
    const filePromises = pdfFiles.map(async (file) => {
      return new Promise<{filename: string, content: string, size: number}>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve({
            filename: file.name,
            content: base64,
            size: file.size,
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    const processedFiles = await Promise.all(filePromises);
    
    // Track processing
    setProcessingFiles(processedFiles.map(f => f.filename));

    // Send via WebSocket
    return sendMessage({
      type: 'pdf_upload',
      pdf_files: processedFiles,
      message: message || '',
      session_id: sessionId,
    });
  }, [sendMessage]);

  const handlePDFProcessed = useCallback((data: any) => {
    setProcessingFiles(prev => 
      prev.filter(filename => filename !== data.filename)
    );
  }, []);

  return {
    uploadPDFs,
    uploadProgress,
    processingFiles,
    handlePDFProcessed,
  };
};
```

### 2. PDF Upload Component
```typescript
// components/PDFUpload.tsx
import React, { useRef } from 'react';
import { usePDFUpload } from '../hooks/usePDFUpload';

interface Props {
  sessionId: string;
  sendMessage: (msg: any) => boolean;
  onUploadComplete?: (files: string[]) => void;
}

export const PDFUpload: React.FC<Props> = ({
  sessionId,
  sendMessage,
  onUploadComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadPDFs, processingFiles } = usePDFUpload(sendMessage);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      await uploadPDFs(files, sessionId);
      onUploadComplete?.(Array.from(files).map(f => f.name));
    } catch (error) {
      console.error('PDF upload failed:', error);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="pdf-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      
      <button
        onClick={() => fileInputRef.current?.click()}
        className="upload-btn"
        disabled={processingFiles.length > 0}
      >
        📄 Upload PDF{processingFiles.length > 0 ? 's' : ''}
      </button>

      {processingFiles.length > 0 && (
        <div className="processing-files">
          <h4>Processing PDFs:</h4>
          {processingFiles.map((filename) => (
            <div key={filename} className="processing-file">
              <span>📄 {filename}</span>
              <div className="spinner">⏳</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## Document Auto-save

### 1. Auto-save Hook
```typescript
// hooks/useAutoSave.ts
import { useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash';

interface AutoSaveOptions {
  delay?: number;
  enabled?: boolean;
}

export const useAutoSave = (
  content: string,
  documentId: string,
  sessionId: string,
  sendMessage: (msg: any) => boolean,
  options: AutoSaveOptions = {}
) => {
  const { delay = 2000, enabled = true } = options;
  const lastSavedContent = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveDocument = useCallback((contentToSave: string) => {
    if (!enabled || !documentId || contentToSave === lastSavedContent.current) {
      return;
    }

    const success = sendMessage({
      type: 'document_update',
      document_id: documentId,
      content: contentToSave,
      session_id: sessionId,
    });

    if (success) {
      lastSavedContent.current = contentToSave;
      console.log('📄 Document auto-saved');
    }
  }, [documentId, sessionId, sendMessage, enabled]);

  const debouncedSave = useCallback(
    debounce(saveDocument, delay),
    [saveDocument, delay]
  );

  useEffect(() => {
    if (content !== lastSavedContent.current) {
      debouncedSave(content);
    }

    return () => {
      debouncedSave.cancel();
    };
  }, [content, debouncedSave]);

  const forceSave = useCallback(() => {
    debouncedSave.cancel();
    saveDocument(content);
  }, [content, saveDocument, debouncedSave]);

  return {
    forceSave,
    lastSavedContent: lastSavedContent.current,
  };
};
```

### 2. Document Editor Component
```typescript
// components/DocumentEditor.tsx
import React, { useState, useEffect } from 'react';
import { useAutoSave } from '../hooks/useAutoSave';

interface Props {
  documentId: string;
  sessionId: string;
  sendMessage: (msg: any) => boolean;
  initialContent?: string;
}

export const DocumentEditor: React.FC<Props> = ({
  documentId,
  sessionId,
  sendMessage,
  initialContent = '',
}) => {
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);

  const { forceSave, lastSavedContent } = useAutoSave(
    content,
    documentId,
    sessionId,
    sendMessage,
    { delay: 2000, enabled: true }
  );

  const hasUnsavedChanges = content !== lastSavedContent;

  // Handle WebSocket document update responses
  useEffect(() => {
    const handleDocumentUpdated = (data: any) => {
      if (data.type === 'document_updated' && data.document_id === documentId) {
        setIsSaving(false);
        console.log('✅ Document saved successfully');
      }
    };

    // You would register this with your WebSocket message handler
    // This is just an example of how to handle the response
  }, [documentId]);

  const handleSave = () => {
    setIsSaving(true);
    forceSave();
  };

  return (
    <div className="document-editor">
      <div className="editor-toolbar">
        <button
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isSaving}
          className="save-btn"
        >
          {isSaving ? '💾 Saving...' : '💾 Save'}
        </button>
        
        <div className="save-status">
          {hasUnsavedChanges ? (
            <span className="unsaved">● Unsaved changes</span>
          ) : (
            <span className="saved">✓ All changes saved</span>
          )}
        </div>
      </div>

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="document-content"
        placeholder="Start writing your document..."
      />
    </div>
  );
};
```

---

## Session Management

### 1. Session Hook
```typescript
// hooks/useSession.ts
import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface Session {
  session_id: string;
  project_id?: string;
  conversation_history: any[];
  edit_history: any[];
  agent_mode: string;
  proposal_generated: boolean;
  document_id?: string;
  proposal_title: string;
}

export const useSession = () => {
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { apiCall } = useAuth();

  const resumeSession = useCallback(async (sessionId: string) => {
    setIsLoading(true);
    try {
      const response = await apiCall(`/api/sessions/${sessionId}/resume/`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const sessionData = await response.json();
        setCurrentSession(sessionData);
        return sessionData;
      } else {
        throw new Error('Failed to resume session');
      }
    } catch (error) {
      console.error('Error resuming session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  const createSession = useCallback(async (projectId?: string) => {
    setIsLoading(true);
    try {
      const response = await apiCall('/api/sessions/', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId }),
      });
      
      if (response.ok) {
        const sessionData = await response.json();
        setCurrentSession({
          session_id: sessionData.id,
          project_id: projectId,
          conversation_history: [],
          edit_history: [],
          agent_mode: 'conversation',
          proposal_generated: false,
          proposal_title: 'New Session',
        });
        return sessionData;
      } else {
        throw new Error('Failed to create session');
      }
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [apiCall]);

  return {
    currentSession,
    setCurrentSession,
    resumeSession,
    createSession,
    isLoading,
  };
};
```

---

## Error Handling

### 1. Error Handling Hook
```typescript
// hooks/useErrorHandler.ts
import { useState, useCallback } from 'react';

export interface AppError {
  id: string;
  type: 'websocket' | 'api' | 'upload' | 'general';
  message: string;
  timestamp: Date;
  details?: any;
}

export const useErrorHandler = () => {
  const [errors, setErrors] = useState<AppError[]>([]);

  const addError = useCallback((
    type: AppError['type'],
    message: string,
    details?: any
  ) => {
    const error: AppError = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date(),
      details,
    };
    
    setErrors(prev => [...prev, error]);
    console.error(`[${type.toUpperCase()}]`, message, details);
    
    // Auto-remove error after 5 seconds
    setTimeout(() => {
      setErrors(prev => prev.filter(e => e.id !== error.id));
    }, 5000);
  }, []);

  const removeError = useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return {
    errors,
    addError,
    removeError,
    clearErrors,
  };
};
```

### 2. Error Display Component
```typescript
// components/ErrorDisplay.tsx
import React from 'react';
import { AppError } from '../hooks/useErrorHandler';

interface Props {
  errors: AppError[];
  onDismiss: (id: string) => void;
}

export const ErrorDisplay: React.FC<Props> = ({ errors, onDismiss }) => {
  if (errors.length === 0) return null;

  return (
    <div className="error-container">
      {errors.map((error) => (
        <div key={error.id} className={`error-toast error-${error.type}`}>
          <div className="error-content">
            <div className="error-message">{error.message}</div>
            <div className="error-timestamp">
              {error.timestamp.toLocaleTimeString()}
            </div>
          </div>
          <button
            onClick={() => onDismiss(error.id)}
            className="error-dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};
```

---

## TypeScript Definitions

### 1. Complete Type Definitions
```typescript
// types/index.ts
export interface WebSocketMessage {
  type: 'chat_message' | 'pdf_upload' | 'edit_request' | 'revert_edit' | 'document_update';
  message?: string;
  session_id?: string;
  project_id?: string;
  [key: string]: any;
}

export interface WebSocketResponse {
  type: 'chat_response' | 'edit_suggestion' | 'edit_applied' | 'edit_rejected' | 
        'edit_reverted' | 'pdf_processed' | 'document_updated' | 'error';
  message?: string;
  session_id?: string;
  [key: string]: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  timestamp: string;
}

export interface EditData {
  edit_id: string;
  original: string;
  proposed: string;
  reason: string;
  section_info: string;
  confidence: number;
  edit_type: string;
  status?: 'pending' | 'accepted' | 'rejected' | 'reverted';
}

export interface PDFFile {
  filename: string;
  content: string; // base64
  size: number;
}

export interface Session {
  session_id: string;
  project_id?: string;
  conversation_history: ChatMessage[];
  edit_history: EditData[];
  agent_mode: 'conversation' | 'proposal_generation' | 'editor_mode';
  proposal_generated: boolean;
  document_id?: string;
  proposal_title: string;
}
```

---

## Complete Example

### 1. Main Chat Page Component
```typescript
// pages/chat/[sessionId].tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Chat } from '../../components/Chat';
import { DocumentEditor } from '../../components/DocumentEditor';
import { PDFUpload } from '../../components/PDFUpload';
import { ErrorDisplay } from '../../components/ErrorDisplay';
import { useSession } from '../../hooks/useSession';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useErrorHandler } from '../../hooks/useErrorHandler';
import { useEditManagement } from '../../hooks/useEditManagement';

const ChatPage: React.FC = () => {
  const router = useRouter();
  const { sessionId } = router.query;
  const [documentContent, setDocumentContent] = useState('');

  const { currentSession, resumeSession } = useSession();
  const { errors, addError, removeError } = useErrorHandler();

  const handleWebSocketMessage = (data: any) => {
    // Handle all WebSocket messages here
    console.log('WebSocket message:', data);
  };

  const { connect, sendMessage, isConnected } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onError: (error) => addError('websocket', 'Connection error'),
    onConnect: () => console.log('Connected to chat'),
  });

  const { acceptEdit, rejectEdit, revertEdit } = useEditManagement(sendMessage);

  // Initialize session and connection
  useEffect(() => {
    if (sessionId && typeof sessionId === 'string') {
      resumeSession(sessionId).then((session) => {
        connect(sessionId, session.project_id);
      });
    }
  }, [sessionId, resumeSession, connect]);

  return (
    <div className="chat-page">
      <ErrorDisplay errors={errors} onDismiss={removeError} />
      
      <div className="chat-layout">
        <div className="chat-sidebar">
          <Chat />
          
          <PDFUpload
            sessionId={currentSession?.session_id || ''}
            sendMessage={sendMessage}
          />
        </div>

        <div className="document-area">
          {currentSession?.document_id && (
            <DocumentEditor
              documentId={currentSession.document_id}
              sessionId={currentSession.session_id}
              sendMessage={sendMessage}
              initialContent={documentContent}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
```

### 2. CSS Styles
```css
/* styles/chat.css */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 800px;
  margin: 0 auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f8fafc;
}

.message {
  margin-bottom: 16px;
  padding: 12px 16px;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  background: #3b82f6;
  color: white;
  margin-left: auto;
  text-align: right;
}

.message.assistant {
  background: white;
  border: 1px solid #e2e8f0;
}

.message.system {
  background: #f0f9ff;
  border: 1px solid #7dd3fc;
  color: #0c4a6e;
  font-size: 0.9rem;
}

.input-container {
  display: flex;
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  background: white;
}

.input-container textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  resize: none;
  font-family: inherit;
}

.input-container button {
  margin-left: 8px;
  padding: 12px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.input-container button:disabled {
  background: #9ca3af;
  cursor: not-allowed;
}

/* Edit Suggestion Styles */
.edit-suggestion {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  margin: 15px 0;
}

.edit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e2e8f0;
}

.edit-title {
  font-weight: 600;
  color: #2d3748;
}

.edit-actions {
  display: flex;
  gap: 8px;
}

.btn-accept {
  background: #48bb78;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

.btn-reject {
  background: #f56565;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
}

/* Diff Styles */
.diff-container {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  margin: 15px 0;
}

.diff-section {
  padding: 15px;
}

.diff-section:not(:last-child) {
  border-bottom: 1px solid #e2e8f0;
}

.diff-removed {
  background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
  border-left: 4px solid #dc2626;
}

.diff-added {
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
  border-left: 4px solid #16a34a;
}

.diff-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 8px;
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
}

.diff-removed .diff-label {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

.diff-added .diff-label {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.1);
}

.diff-content {
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(255, 255, 255, 0.7);
  padding: 12px;
  border-radius: 6px;
}

/* Error Styles */
.error-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.error-toast {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 8px;
  background: #fee2e2;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  color: #991b1b;
  min-width: 300px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.error-content {
  flex: 1;
}

.error-message {
  font-weight: 600;
  margin-bottom: 4px;
}

.error-timestamp {
  font-size: 0.8rem;
  opacity: 0.8;
}

.error-dismiss {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #991b1b;
  margin-left: 12px;
}
```

---

## 🎯 Implementation Checklist

### Backend Requirements ✅
- [x] WebSocket consumer with JWT authentication
- [x] Chat message handling
- [x] Edit suggestion system with accept/reject/revert
- [x] PDF upload and processing
- [x] Document auto-save functionality
- [x] Session management
- [x] Error handling and validation

### Frontend Implementation 📋
- [ ] Install required dependencies
- [ ] Set up WebSocket connection with authentication
- [ ] Implement chat interface
- [ ] Add edit suggestion UI with diff display
- [ ] Implement PDF upload with progress tracking
- [ ] Add document editor with auto-save
- [ ] Set up session management
- [ ] Add comprehensive error handling
- [ ] Style components with provided CSS

### Testing & Deployment 🧪
- [ ] Test WebSocket connection and reconnection
- [ ] Test chat functionality
- [ ] Test edit suggestions (accept/reject/revert)
- [ ] Test PDF upload and processing
- [ ] Test document auto-save
- [ ] Test session resumption
- [ ] Test error scenarios
- [ ] Performance testing with large documents
- [ ] Mobile responsiveness testing

---

## 📚 Additional Resources

### WebSocket Message Types Reference
```typescript
// Outgoing Messages (Frontend → Backend)
'chat_message'     // Send chat message
'pdf_upload'       // Upload PDF files
'edit_request'     // Accept/reject edit suggestions
'revert_edit'      // Revert applied edit
'document_update'  // Save document content

// Incoming Messages (Backend → Frontend)
'chat_response'    // AI chat response
'edit_suggestion'  // Edit suggestion from AI
'edit_applied'     // Edit was applied successfully
'edit_rejected'    // Edit was rejected
'edit_reverted'    // Edit was reverted successfully
'pdf_processed'    // PDF processing completed
'document_updated' // Document save confirmation
'error'           // Error occurred
```

### Environment Variables
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### Package.json Dependencies
```json
{
  "dependencies": {
    "next": "^13.0.0",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "ws": "^8.0.0",
    "lodash": "^4.17.21"
  },
  "devDependencies": {
    "@types/ws": "^8.0.0",
    "@types/lodash": "^4.14.0",
    "typescript": "^5.0.0"
  }
}
```

---

This guide provides a complete, production-ready implementation for integrating the LLHam WebSocket API with Next.js. Follow the implementation checklist and customize the components according to your specific UI requirements.
