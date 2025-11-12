import { useState, useEffect, useRef, useCallback } from 'react';
import { TokenManager } from '@/lib/api';

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai' | 'proposal' | 'error' | 'edit_suggestion';
  content: string;
  timestamp: Date;
  sessionId?: string;
  projectId?: string;
  suggestedQuestions?: string[];
  suggestions?: string[]; // Add this for compatibility with existing code
  documentId?: string;
  proposalTitle?: string;
  isStreaming?: boolean;
  editData?: {
    edit_id: string;
    original: string;
    proposed: string;
    reason: string;
    section_info: string;
    selected_context: boolean;
    confidence: number;
    edit_type: string;
  };
  showAcceptReject?: boolean;
  // Edit history properties (for edit_history messages)
  status?: 'accepted' | 'rejected' | 'pending';
  section_identifier?: string;
  original_content?: string;
  proposed_content?: string;
  edit_reason?: string;
}

export interface GenerationProgress {
  stage: string;
  progress: number;
  message: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export const useProposalSocket = (sessionId?: string | null, projectId?: string | null) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isGeneratingProposal, setIsGeneratingProposal] = useState(false);
  const [currentDocument, setCurrentDocument] = useState<any>(null);
  const [agentMode, setAgentMode] = useState<string>('conversation');
  
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    const token = TokenManager.getAccessToken();
    if (!token) {
      return;
    }

    if (socket?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
   
    const wsUrl = `ws://192.168.1.105:8000/ws/chat/?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch(data.type) {
            case 'connection_established':
              break;

            case 'ai_message':
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'ai',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id,
                projectId: data.project_id,
                suggestedQuestions: data.suggested_questions,
                suggestions: data.suggested_questions 
              }]);
              setAgentMode(data.agent_mode || 'conversation');
              break;

            case 'title_generated':
              break;

            case 'proposal_generation_started':
              setIsGeneratingProposal(true);
              setProgress(0);
              setAgentMode('proposal_generation');
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'ai',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id,
                projectId: data.project_id
              }]);
              break;

            case 'generation_progress':
              setCurrentStage(data.stage);
              setProgress(data.progress);
              break;

            case 'proposal_completed':
              setIsGeneratingProposal(false);
              setCurrentStage(null);
              setProgress(100);
              setAgentMode('editor_mode');
              
              if (data.document) {
                setCurrentDocument({
                  id: data.document_id,
                  title: data.proposal_title,
                  content: data.document,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  author: 'AI Assistant'
                });
              }

              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'proposal',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id,
                projectId: data.project_id,
                documentId: data.document_id,
                proposalTitle: data.proposal_title
              }]);
              break;

            case 'edit_suggestion':
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'edit_suggestion',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id,
                projectId: data.project_id,
                editData: data.edit_data,
                showAcceptReject: data.show_accept_reject
              }]);
              break;

            case 'proposal_error':
              setIsGeneratingProposal(false);
              setCurrentStage(null);
              setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'error',
                content: data.message,
                timestamp: new Date(),
                sessionId: data.session_id
              }]);
              break;

            default:
          }
        } catch (error) {
        }
      };

      ws.onclose = (event) => {
        setConnectionStatus('disconnected');
        
        const reasons: { [key: number]: string } = {
          1000: 'Normal closure',
          1001: 'Going away',
          4001: 'Unauthorized - check your token'
        };
        
        const reason = reasons[event.code] || `Unknown error (${event.code})`;
        
        if (event.code === 4001) {
          TokenManager.clearTokens();
          setConnectionStatus('error');
        } else if (event.code !== 1000) {
          handleReconnection();
        }
      };

      ws.onerror = (error) => {
        setConnectionStatus('error');
      };

      setSocket(ws);
    } catch (error) {
      setConnectionStatus('error');
    }
  }, []);

  const handleReconnection = useCallback(() => {
    if (reconnectAttempts.current < maxReconnectAttempts) {
      reconnectAttempts.current++;
      const delay = 1000 * reconnectAttempts.current;
          
      setTimeout(() => {
        connect();
      }, delay);
    } else {
      setConnectionStatus('error');
    }
  }, [connect]);

  const sendMessage = useCallback((message: string, documentContext: string | null = null) => {
    if (socket?.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'chat_message',
        message,
        session_id: sessionId,
        project_id: projectId,
        document_context: documentContext
      };
      
      socket.send(JSON.stringify(payload));
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'user',
        content: message,
        timestamp: new Date(),
        sessionId: sessionId || undefined,
        projectId: projectId || undefined
      }]);
    } else {
    }
  }, [socket, sessionId, projectId]);

  const acceptEdit = useCallback((editId: string) => {
    if (socket?.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'edit_request',
        session_id: sessionId,
        edit_id: editId,
        action: 'accept'
      };
            socket.send(JSON.stringify(payload));
    }
  }, [socket, sessionId]);

  const rejectEdit = useCallback((editId: string) => {
    if (socket?.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'edit_request',
        session_id: sessionId,
        edit_id: editId,
        action: 'reject'
      };
            socket.send(JSON.stringify(payload));
    }
  }, [socket, sessionId]);

  const requestEdit = useCallback((selectedText: string, documentContext: string) => {
    if (socket?.readyState === WebSocket.OPEN) {
      const message = `Please edit this section: "${selectedText}"`;
      sendMessage(message, documentContext);
    }
  }, [socket, sendMessage]);

  useEffect(() => {
    if (sessionId) {
      connect();
      setMessages([]);
      setCurrentDocument(null);
      setIsGeneratingProposal(false);
      setCurrentStage(null);
      setProgress(0);
      setAgentMode('conversation');
    } else {
      if (socket) {
        socket.close(1000);
        setSocket(null);
        setConnectionStatus('disconnected');
        setMessages([]);
      }
    }
    
    return () => {
      if (socket) {
        socket.close(1000);
      }
    };
  }, [sessionId, connect]);

  useEffect(() => {
    return () => {
      if (socket) {
        socket.close(1000);
      }
    };
  }, [socket]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.close(1000);
      setSocket(null);
      setConnectionStatus('disconnected');
    }
  }, [socket]);

  const manualConnect = useCallback(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      connect();
    }
  }, [socket, connect]);

  return {
    connectionStatus,
    messages,
    currentStage,
    progress,
    isGeneratingProposal,
    currentDocument,
    agentMode,
    sendMessage,
    acceptEdit,
    rejectEdit,
    requestEdit,
    connect: manualConnect,
    disconnect,
    reconnect: connect
  };
};