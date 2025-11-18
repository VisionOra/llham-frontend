import axios, { AxiosInstance, AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://192.168.1.105:8000";

// Helper function to determine if we should use proxy or direct URL
const shouldUseProxy = () => {
  // Use proxy in browser environment to avoid CORS
  // Direct URL can be used in server-side or when CORS is configured
  return typeof window !== 'undefined';
};

// Create axios instances
// Use empty baseURL to leverage Next.js proxy and avoid CORS issues
const authApi = axios.create({
  baseURL: API_BASE_URL, // Use proxy
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

const projectApi = axios.create({
  baseURL: API_BASE_URL, // Use proxy
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    date_joined: string;
    linkedin_id: string | null;
    is_email_verified: boolean;
    profile_picture: string | null;
  };
  status: string;
  message: string;
  access_token: string;
  refresh_token: string;
  access: string;
  refresh: string;
}

export interface Project {
  id: string;
  title: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  title: string;
  created_by: string;
}

export interface Session {
  id: string;
  user: string;
  project: {
    id: string;
    title: string;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
  document: any | null;
  current_stage: string;
  agent_mode: string;
  is_proposal_generated: boolean;
  initial_idea: string;
  conversation_history: Array<{
    role: string;
    message: string;
    timestamp: string;
  }>;
  proposal_title: string;
  error_message: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithSessions {
  project: Project;
  sessions: Session[];
}

// Token management utilities
export const TokenManager = {
  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem("access_token", accessToken);
   localStorage.setItem("refresh_token", refreshToken);
  },

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem("access_token");
  },

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem("refresh_token");
  },

  clearTokens() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_data");
  },

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },

  setUserData(user: any) {
    if (typeof window === 'undefined') return;
    localStorage.setItem("user_data", JSON.stringify(user));
  },

  getUserData(): any | null {
    if (typeof window === 'undefined') return null;
    const userData = localStorage.getItem("user_data");
    return userData ? JSON.parse(userData) : null;
  },
};

// Request interceptor for project API to add auth token
projectApi.interceptors.request.use(
  (config) => {
    const token = TokenManager.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling common errors
const createResponseInterceptor = (apiInstance: AxiosInstance, isAuthApi = false) => {
  apiInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response) {
        const { status, data } = error.response;
        
        // Handle authentication errors
        if (status === 401) {
          if (!isAuthApi) {
            TokenManager.clearTokens();
            throw new Error("Your session has expired. Please log in again.");
          } else {
            throw new Error("Invalid email or password. Please check your credentials and try again.");
          }
        }
        
        // Handle other HTTP errors
        if (status === 403) {
          if (isAuthApi) {
            throw new Error("Your account has been disabled. Please contact support.");
          } else {
            throw new Error("You don't have permission to perform this action.");
          }
        }
        
        if (status === 404) {
          if (isAuthApi) {
            throw new Error("Invalid email or password. Please check your credentials and try again.");
          } else {
            throw new Error("The requested resource was not found.");
          }
        }
        
        if (status === 429) {
          throw new Error("Too many requests. Please wait a few minutes and try again.");
        }
        
        if (status >= 500) {
          throw new Error("Server error. Please try again later.");
        }
        
        if (status === 400) {
          // Handle validation errors
          if (data && typeof data === 'object') {
            const errorData = data as any;
            if (errorData.email) {
              throw new Error("Please enter a valid email address.");
            }
            if (errorData.password) {
              throw new Error("Password is required.");
            }
            if (errorData.message) {
              throw new Error(errorData.message);
            }
            if (errorData.detail) {
              throw new Error(errorData.detail);
            }
          }
          throw new Error("Invalid request. Please check your input and try again.");
        }
        
        // Generic error message for other status codes
        throw new Error(`Request failed with status ${status}`);
      } else if (error.request) {
        // Network error
        throw new Error("Unable to connect to server. Please check your internet connection and try again.");
      } else {
        // Other error
        throw new Error("An unexpected error occurred. Please try again.");
      }
    }
  );
};

// Apply interceptors
createResponseInterceptor(authApi, true);
createResponseInterceptor(projectApi, false);

// Auth API functions
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  try {
    const response = await authApi.post<AuthResponse>('/api/auth/login/', credentials);
    // Use access and refresh keys for tokens
    const { access, refresh, ...rest } = response.data;
    if (access && refresh) {
      TokenManager.setTokens(access, refresh);
    }
    return { ...rest, access, refresh } as AuthResponse;
  } catch (error) {
    throw error;
  }
}


export interface RegisterApiResponse {
  data: AuthResponse;
  status: number;
}

export async function register(userData: RegisterRequest): Promise<RegisterApiResponse> {
  try {
    const response = await authApi.post<AuthResponse>('/api/auth/register/', userData);
    // Save tokens to localStorage as access_token and refresh_token, using response.access and response.refresh
    const { access, refresh, ...rest } = response.data;
    if (access && refresh) {
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
    }
    return { data: { ...rest, access, refresh } as AuthResponse, status: response.status };
  } catch (error: any) {
    if (error.response) {
      return { data: error.response.data, status: error.response.status };
    }
    throw error;
  }
}

// Project API functions
export interface PaginatedProjectsResponse {
  pagination: {
    count: number;
    page_size: number;
    current_page: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
    next_page: number | null;
    previous_page: number | null;
  };
  results: Project[];
}

export async function getUserProjects(): Promise<PaginatedProjectsResponse> {
  try {
    const response = await projectApi.get<PaginatedProjectsResponse>('/api/proposals/projects/', {
      maxRedirects: 0,
    });
    return response.data;
  } catch (error) {
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.get<PaginatedProjectsResponse>(`${API_BASE_URL}/api/proposals/projects/`, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to load projects. Please try again.");
      }
    }
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to load projects. Please try again.");
  }
}

export async function getUserProjectsPaginated(page: number = 1): Promise<PaginatedProjectsResponse> {
  try {
    const response = await projectApi.get<PaginatedProjectsResponse>(`/api/proposals/projects/?page=${page}`, {
      maxRedirects: 0,
    });
    return response.data;
  } catch (error) {
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.get<PaginatedProjectsResponse>(`${API_BASE_URL}/api/proposals/projects/?page=${page}`, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
        });
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to load projects. Please try again.");
      }
    }
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to load projects. Please try again.");
  }
}

export async function createProject(projectData: CreateProjectRequest): Promise<Project> {
  try {
    const response = await projectApi.post<Project>('/api/proposals/projects/', projectData);
    return response.data;
  } catch (error) {
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.post<Project>(`${API_BASE_URL}/api/proposals/projects/`, projectData, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
          timeout: 10000,
        });
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to create project. Please try again.");
      }
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to create project. Please try again.");
  }
}

export async function getProject(id: string): Promise<Project> {
  try {
    const response = await projectApi.get<Project>(`/api/proposals/projects/${id}/`);
    return response.data;
  } catch (error) {
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.get<Project>(`${API_BASE_URL}/api/proposals/projects/${id}/`, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
          timeout: 10000,
        });
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to load project. Please try again.");
      }
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to load project. Please try again.");
  }
}

export interface PaginatedSessionsResponse {
  pagination: {
    count: number;
    page_size: number;
    current_page: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
    next_page: number | null;
    previous_page: number | null;
  };
  results: Session[];
  project?: Project;
}

export async function getProjectSessions(projectId: string, page: number = 1): Promise<PaginatedSessionsResponse> {
  try {
    const response = await projectApi.get<PaginatedSessionsResponse>(`/api/proposals/projects/${projectId}/sessions/?page=${page}`);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.get<PaginatedSessionsResponse>(`${API_BASE_URL}/api/proposals/projects/${projectId}/sessions/?page=${page}`, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
          timeout: 10000,
        });
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to load project sessions. Please try again.");
      }
    }
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to load project sessions. Please try again.");
  }
}

export interface CreateSessionRequest {
  initial_idea: string;
  agent_mode?: string;
}

export interface CreateProjectWithSessionRequest {
  title?: string;
  agent_mode?: string;
}

export interface CreateProjectWithSessionResponse {
  project: Project;
  session: Session;
}

export async function createProjectWithSession(data: CreateProjectWithSessionRequest): Promise<CreateProjectWithSessionResponse> {
  try {
    const response = await projectApi.post<CreateProjectWithSessionResponse>(`/api/proposals/projects/create-with-session/`, data);
    return response.data;
  } catch (error) {
    
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.post<CreateProjectWithSessionResponse>(`${API_BASE_URL}/api/proposals/projects/create-with-session/`, data, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
          timeout: 10000,
        });
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to create project with session. Please try again.");
      }
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to create project with session. Please try again.");
  }
}


export async function getDocumentContent(sessionId: string): Promise<any> {
  try {
    const response = await projectApi.get(`/api/proposals/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.get(`${API_BASE_URL}/api/proposals/sessions/${sessionId}`, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
          timeout: 10000,
        });
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to load document content. Please try again.");
      }
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to load document content. Please try again.");
  }
}

export async function getSessionHistory(sessionId: string): Promise<any> {
  try {
    const response = await projectApi.post(`/api/proposals/sessions/${sessionId}/resume/`);
    return response.data;
  } catch (error) {
    
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.post(`${API_BASE_URL}/api/proposals/sessions/${sessionId}/resume/`, {}, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
          timeout: 10000,
        });
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to load session history. Please try again.");
      }
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to load session history. Please try again.");
  }
}

/**
 * Request interface for communicating with the Master Agent.
 * 
 * The Master Agent will:
 * - Route your request (conversation, edit, or generate proposal)
 * - Handle conversation and gather information
 * - Generate proposals when you say "create proposal" or similar
 * - Edit existing proposals based on your requests
 * 
 * Note: The initial idea is automatically extracted from the conversation history.
 * You don't need to provide it separately - just describe your project idea in the conversation.
 */
export interface CommunicateWithMasterAgentRequest {
  session_id: string;
  project_id?: string;
  message: string;
}

/**
 * Response from the Master Agent communication endpoint.
 * 
 * When you say "create proposal", the Master Agent will execute the full proposal
 * generation pipeline and return the complete proposal in `proposal_html`.
 */
export interface CommunicateWithMasterAgentResponse {
  action: string;
  message: string;
  session_id: string;
  proposal_html?: string;
  proposal_title?: string;
  agents_rerun?: string[];
  ready_for_proposal: boolean;
  suggestion?: string;
  status: string;
  requires_initial_idea: boolean;
  initial_idea_set: boolean;
}

/**
 * Send a message to the Master Agent for a specific session.
 * 
 * The Master Agent will route your request, handle conversation, gather information,
 * and generate proposals when you say "create proposal" or similar.
 * 
 * @param data - Request data containing session_id, project_id (optional), and message
 * @returns Promise resolving to the Master Agent's response
 */
export async function communicateWithMasterAgent(data: CommunicateWithMasterAgentRequest): Promise<CommunicateWithMasterAgentResponse> {
  try {
    const response = await projectApi.post<CommunicateWithMasterAgentResponse>(`/api/proposals/master-agent/communicate/`, data);
    return response.data;
  } catch (error) {
    
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.post<CommunicateWithMasterAgentResponse>(`${API_BASE_URL}/api/proposals/master-agent/communicate/`, data, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
          timeout: 10000,
        });
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to communicate with master agent. Please try again.");
      }
    }
    
    if (error instanceof AxiosError) {
      // Handle specific error status codes
      if (error.response?.status === 400) {
        throw new Error(error.response?.data?.message || 'Invalid request. Please check your input.');
      }
      if (error.response?.status === 404) {
        throw new Error(error.response?.data?.message || 'Session or project not found.');
      }
      if (error.response?.status === 500) {
        throw new Error(error.response?.data?.message || 'Server error. Please try again later.');
      }
      throw new Error(error.response?.data?.message || 'Failed to communicate with master agent.');
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to communicate with master agent. Please try again.");
  }
}

export interface CreateSessionRequest {
  project_id: string;
}

export async function createSession(sessionData: CreateSessionRequest): Promise<any> {
  try {
    const response = await projectApi.post('/api/proposals/sessions/', sessionData);
    return response.data;
  } catch (error) {
    
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.post(`${API_BASE_URL}/api/proposals/sessions/`, sessionData, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
            'ngrok-skip-browser-warning': 'true',
          },
          timeout: 10000,
        });
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to create session. Please try again.");
      }
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to create session. Please try again.");
  }
}

// Delete Project
export interface UpdateProjectRequest {
  title: string;
}

export async function updateProject(projectId: string, projectData: UpdateProjectRequest): Promise<Project> {
  try {
    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    const response = await projectApi.put<Project>(`/api/proposals/projects/${projectId}/`, projectData, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.message || error.response?.data?.detail || 'Failed to update project');
    }
    throw error;
  }
}

export async function deleteProject(projectId: string): Promise<void> {
  try {
    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    await projectApi.delete(`/api/proposals/projects/${projectId}/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.message || 'Failed to delete project');
    }
    throw new Error("Failed to delete project. Please try again.");
  }
}

// Delete Session
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const token = TokenManager.getAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }

    await projectApi.delete(`/api/proposals/sessions/${sessionId}/`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.message || 'Failed to delete session');
    }
    throw new Error("Failed to delete session. Please try again.");
  }
}

// Proposed HTML Response Interface
export interface ProposedHtmlResponse {
  session_id: string;
  project_id: string;
  proposal_title: string;
  html_content: string;
  metadata: {
    is_generated: boolean;
    current_stage: string;
    last_updated: string;
    created_at: string;
    agent_responses_count: number;
    has_edits: boolean;
    initial_idea: string;
    agents_included: Array<any>;
  };
}

// Get Proposed HTML for a session
export async function getProposedHtml(projectId: string, sessionId: string): Promise<ProposedHtmlResponse> {
  try {
    const response = await projectApi.get<ProposedHtmlResponse>(
      `/api/proposals/projects/${projectId}/sessions/${sessionId}/proposed-html/`
    );
    return response.data;
  } catch (error) {
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.get<ProposedHtmlResponse>(
          `${API_BASE_URL}/api/proposals/projects/${projectId}/sessions/${sessionId}/proposed-html/`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
              'ngrok-skip-browser-warning': 'true',
            },
            timeout: 10000,
          }
        );
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to load proposed HTML. Please try again.");
      }
    }
    
    if (error instanceof AxiosError) {
      // Handle 404 - proposal not generated yet
      if (error.response?.status === 404) {
        throw new Error("Proposal not generated yet.");
      }
      throw new Error(error.response?.data?.message || 'Failed to load proposed HTML');
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to load proposed HTML. Please try again.");
  }
}

// Reset Settings to Default Interface
export interface ResetToDefaultRequest {
  project_id?: string;
  session_id?: string;
}

export interface ResetToDefaultResponse {
  message: string;
  reset_count: number;
  details: Record<string, any>;
  default_rates: {
    senior_software_engineer?: number;
    devops_engineer?: number;
    mid_to_senior_ai_engineer?: number;
    project_manager?: number;
    mid_level_engineer?: number;
    ui_ux_designer?: number;
    junior_engineer?: number;
  };
}

// Reset engineer rates to default values with cascading behavior
export async function resetSettingsToDefault(
  request?: ResetToDefaultRequest
): Promise<ResetToDefaultResponse> {
  try {
    const response = await projectApi.post<ResetToDefaultResponse>(
      '/api/proposals/settings/reset-to-default/',
      request || {}
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.message || 'Failed to reset settings to default');
    }
    throw new Error("Failed to reset settings to default. Please try again.");
  }
}

// Get Available Agents from Registry
export interface AvailableAgent {
  id?: string;
  name: string;
  display_name: string;
  description: string;
  section_types: string[];
  default_order: number;
  is_always_active: boolean;
  can_be_disabled: boolean;
  is_selected?: boolean; // Only present when session_id is provided
}

export interface AvailableAgentsResponse {
  agents: AvailableAgent[];
  total_count: number;
  source: string;
  session_id?: string; // Only present when session_id is provided
}

// Get available agents from llham-agents registry
// If sessionId is provided, shows which agents are selected for that session
export async function getAvailableAgents(sessionId?: string): Promise<AvailableAgentsResponse> {
  try {
    const url = sessionId 
      ? `/api/proposals/agents/?session_id=${sessionId}`
      : `/api/proposals/agents/`;
    
    const response = await projectApi.get<AvailableAgentsResponse>(url);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.message || 'Failed to load available agents');
    }
    throw new Error("Failed to load available agents. Please try again.");
  }
}

// Select Agents for Session
export interface SelectAgentsRequest {
  agent_names: string[];
  auto_order?: boolean;
}

export interface SelectAgentsResponse {
  session_id: string;
  selected_agents: any[];
  enabled_count: number;
  disabled_count: number;
  message: string;
}

// Select agents for a specific session
export async function selectSessionAgents(
  sessionId: string,
  request: SelectAgentsRequest
): Promise<SelectAgentsResponse> {
  try {
    const response = await projectApi.post<SelectAgentsResponse>(
      `/api/proposals/sessions/${sessionId}/agents/select/`,
      request
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 403) {
        throw new Error("Free users are limited to 3 agents maximum.");
      }
      throw new Error(error.response?.data?.message || 'Failed to select agents');
    }
    throw new Error("Failed to select agents. Please try again.");
  }
}

// Get Agents for a Session (Legacy - keeping for backward compatibility)
export interface AgentType {
  id: string;
  name: string;
  display_name: string;
  description: string;
  default_order: number;
  is_always_active: boolean;
  can_be_disabled: boolean;
  section_types: string[];
  created_at: string;
  updated_at: string;
}

export interface SessionAgentConfig {
  id: string;
  session: string;
  agent_type: AgentType;
  is_enabled: boolean;
  execution_order: number;
  custom_prompt: string;
  created_at: string;
  updated_at: string;
}

export interface SessionAgentsResponse {
  session_id: string;
  configs: SessionAgentConfig[];
  total_count: number;
  enabled_count: number;
}

// Admin APIs
export interface AdminUser {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
  linkedin_id: string | null;
  is_email_verified: boolean;
  profile_picture: string | null;
  subscription_status: "free" | "paid";
}

export interface AdminUsersListParams {
  page?: number;
  page_size?: number;
  search?: string;
  is_active?: boolean;
  subscription_status?: "free" | "paid";
}

export interface AdminUsersListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AdminUser[];
}

// Get paginated list of all users (Admin only)
export async function getAdminUsers(params?: AdminUsersListParams): Promise<AdminUsersListResponse> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.page_size) queryParams.append("page_size", params.page_size.toString());
    if (params?.search) queryParams.append("search", params.search);
    if (params?.is_active !== undefined) queryParams.append("is_active", params.is_active.toString());
    if (params?.subscription_status) queryParams.append("subscription_status", params.subscription_status);

    const url = `/api/admin/users${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
    const response = await projectApi.get<AdminUsersListResponse>(url);
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 403) {
        throw new Error("Admin access required");
      }
      throw new Error(error.response?.data?.message || 'Failed to load users');
    }
    throw new Error("Failed to load users. Please try again.");
  }
}

export interface UpdateSubscriptionRequest {
  subscription_status: "free" | "paid";
}

// Update user subscription status (Admin only) - PUT
export async function updateUserSubscriptionPut(
  userId: string,
  request: UpdateSubscriptionRequest
): Promise<AdminUser> {
  try {
    const response = await projectApi.put<AdminUser>(
      `/api/admin/users/${userId}/subscription/`,
      request
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 403) {
        throw new Error("Admin access required");
      }
      if (error.response?.status === 404) {
        throw new Error("User not found");
      }
      throw new Error(error.response?.data?.message || 'Failed to update subscription');
    }
    throw new Error("Failed to update subscription. Please try again.");
  }
}

// Update user subscription status (Admin only) - PATCH
export async function updateUserSubscriptionPatch(
  userId: string,
  request: UpdateSubscriptionRequest
): Promise<AdminUser> {
  try {
    const response = await projectApi.patch<AdminUser>(
      `/api/admin/users/${userId}/subscription/`,
      request
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.response?.status === 403) {
        throw new Error("Admin access required");
      }
      if (error.response?.status === 404) {
        throw new Error("User not found");
      }
      throw new Error(error.response?.data?.message || 'Failed to update subscription');
    }
    throw new Error("Failed to update subscription. Please try again.");
  }
}

// Get agents for a specific session
export async function getSessionAgents(sessionId: string): Promise<SessionAgentsResponse> {
  try {
    const response = await projectApi.get<SessionAgentsResponse>(
      `/api/proposals/sessions/${sessionId}/agents/`
    );
    return response.data;
  } catch (error) {
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.get<SessionAgentsResponse>(
          `${API_BASE_URL}/api/proposals/sessions/${sessionId}/agents/`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
              'ngrok-skip-browser-warning': 'true',
            },
            timeout: 10000,
          }
        );
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to load session agents. Please try again.");
      }
    }
    
    if (error instanceof AxiosError) {
      // Handle 404 - no agents found
      if (error.response?.status === 404) {
        throw new Error("No agents found for this session.");
      }
      throw new Error(error.response?.data?.message || 'Failed to load session agents');
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to load session agents. Please try again.");
  }
}

// Proposal Edits Interfaces
export interface ProposalEdit {
  id: string;
  session: string;
  edit_type: string;
  original_content: string;
  proposed_content: string;
  section_identifier: string;
  edit_reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface ProposalEditsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ProposalEdit[];
}

export interface CreateProposalEditRequest {
  edit_type: string;
  original_content: string;
  proposed_content: string;
  section_identifier: string;
  edit_reason: string;
  status?: 'pending' | 'accepted' | 'rejected';
}

// Get proposal edits for a session
export async function getProposalEdits(sessionId: string, page: number = 1): Promise<ProposalEditsResponse> {
  try {
    const response = await projectApi.get<ProposalEditsResponse>(
      `/api/proposals/sessions/${sessionId}/edits/`,
      {
        params: { page }
      }
    );
    return response.data;
  } catch (error) {
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.get<ProposalEditsResponse>(
          `${API_BASE_URL}/api/proposals/sessions/${sessionId}/edits/`,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
              'ngrok-skip-browser-warning': 'true',
            },
            params: { page },
            timeout: 10000,
          }
        );
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to load proposal edits. Please try again.");
      }
    }
    
    if (error instanceof AxiosError) {
      // Handle 404 - no edits found
      if (error.response?.status === 404) {
        return { count: 0, next: null, previous: null, results: [] };
      }
      throw new Error(error.response?.data?.message || 'Failed to load proposal edits');
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to load proposal edits. Please try again.");
  }
}

// Create a new proposal edit (deprecated - use editProposedHtml instead)
export async function createProposalEdit(sessionId: string, editData: CreateProposalEditRequest): Promise<ProposalEdit> {
  try {
    const response = await projectApi.post<ProposalEdit>(
      `/api/proposals/sessions/${sessionId}/edits/`,
      editData
    );
    return response.data;
  } catch (error) {
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.post<ProposalEdit>(
          `${API_BASE_URL}/api/proposals/sessions/${sessionId}/edits/`,
          editData,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
              'ngrok-skip-browser-warning': 'true',
            },
            timeout: 10000,
          }
        );
        return directResponse.data;
      } catch (directError) {
        throw new Error("Failed to create proposal edit. Please try again.");
      }
    }
    
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.message || 'Failed to create proposal edit');
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to create proposal edit. Please try again.");
  }
}

// Edit Proposed HTML - Replace text throughout the document
export interface EditProposedHtmlRequest {
  original_text: string
  new_text: string
  apply_to_all_sections: boolean // true for all sections, false for specific sections
  section_ids?: string[] // Array of section IDs (data-section-id attributes) - required when apply_to_all_sections is false
  confirm?: boolean // Set to true to apply changes, false for preview
  edit_reason?: string // Optional reason for the edit
}

export interface EditProposedHtmlResponse {
  session_id: string
  project_id: string
  html_content?: string // Only present when confirm is true and changes are applied
  preview_html?: string // Present when preview_mode is true or confirm is false
  preview_mode?: boolean
  summary?: {
    occurrences_found?: number
    replacements_planned?: number
    sections_affected?: number
    replace_all_mode?: boolean
  }
  edit_id?: string
  replacements_count?: number
  message: string
  diff_preview?: Array<{
    occurrence: number
    before: string
    after: string
  }>
  affected_sections?: Array<{
    agent_name: string
    section: string
  }>
  instructions?: {
    next_step: string
    example?: {
      original_text: string
      new_text: string
      confirm: boolean
    }
  }
}

export async function editProposedHtml(
  projectId: string,
  sessionId: string,
  editData: EditProposedHtmlRequest
): Promise<EditProposedHtmlResponse> {
  if (!projectId || !sessionId) {
    throw new Error("Project ID and Session ID are required");
  }

  const url = `/api/proposals/projects/${projectId}/sessions/${sessionId}/proposed-html/edit/`;
  console.log('Calling editProposedHtml:', { url, projectId, sessionId, editData });

  try {
    const response = await projectApi.post<EditProposedHtmlResponse>(
      url,
      editData
    );
    console.log('editProposedHtml response:', response.data);
    return response.data;
  } catch (error) {
    console.error('editProposedHtml error:', error);
    
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directUrl = `${API_BASE_URL}/api/proposals/projects/${projectId}/sessions/${sessionId}/proposed-html/edit/`;
        console.log('Trying direct URL:', directUrl);
        const directResponse = await axios.post<EditProposedHtmlResponse>(
          directUrl,
          editData,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${TokenManager.getAccessToken()}`,
              'ngrok-skip-browser-warning': 'true',
            },
            timeout: 10000,
          }
        );
        console.log('Direct response:', directResponse.data);
        return directResponse.data;
      } catch (directError) {
        console.error('Direct URL error:', directError);
        if (directError instanceof AxiosError) {
          const errorMessage = directError.response?.data?.message || directError.response?.data || directError.message || "Failed to edit proposed HTML. Please try again.";
          throw new Error(errorMessage);
        }
        throw new Error("Failed to edit proposed HTML. Please try again.");
      }
    }
    
    if (error instanceof AxiosError) {
      const errorMessage = error.response?.data?.message || error.response?.data || error.message || 'Failed to edit proposed HTML';
      console.error('Axios error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: errorMessage
      });
      throw new Error(errorMessage);
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to edit proposed HTML. Please try again.");
  }
}

// Export axios instances for advanced usage if needed
export { authApi, projectApi };