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
    const response = await projectApi.get<PaginatedProjectsResponse>('/projects/', {
      maxRedirects: 0,
    });
    return response.data;
  } catch (error) {
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.get<PaginatedProjectsResponse>(`${API_BASE_URL}/projects/`, {
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
    const response = await projectApi.get<PaginatedProjectsResponse>(`/projects/?page=${page}`, {
      maxRedirects: 0,
    });
    return response.data;
  } catch (error) {
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      try {
        const directResponse = await axios.get<PaginatedProjectsResponse>(`${API_BASE_URL}/projects/?page=${page}`, {
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
    const response = await projectApi.post<Project>('/projects/', projectData);
    return response.data;
  } catch (error) {
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to create project. Please try again.");
  }
}

export async function getProject(id: string): Promise<Project> {
  try {
    const response = await projectApi.get<Project>(`/projects/${id}/`);
    return response.data;
  } catch (error) {
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
  title: string;
  initial_idea: string;
  agent_mode?: string;
}

export interface CreateProjectWithSessionResponse {
  project: Project;
  session: Session;
}

export async function createProjectWithSession(data: CreateProjectWithSessionRequest): Promise<CreateProjectWithSessionResponse> {
  try {
    console.log('[API] Creating project with session:', data);
    const response = await projectApi.post<CreateProjectWithSessionResponse>(`/api/proposals/projects/create-with-session/`, data);
    console.log('[API] Create project with session response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] Create project with session error:', error);
    
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      console.log('[API] Redirect detected, trying direct backend call for create project with session...');
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
        console.log('[API] Direct create project with session call successful:', directResponse.data);
        return directResponse.data;
      } catch (directError) {
        console.error('[API] Direct create project with session call also failed:', directError);
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
    console.log('[API] Fetching document content for session:', sessionId);
    const response = await projectApi.get(`/api/proposals/sessions/${sessionId}`);
    console.log('[API] Document content response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] Document content error:', error);
    
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      console.log('[API] Redirect detected, trying direct backend call for document...');
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
        console.log('[API] Direct document call successful:', directResponse.data);
        return directResponse.data;
      } catch (directError) {
        console.error('[API] Direct document call also failed:', directError);
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
    console.log('[API] Fetching session history for:', sessionId);
    const response = await projectApi.post(`/api/proposals/sessions/${sessionId}/resume/`);
    console.log('[API] Session history response:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] Session history error:', error);
    
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      console.log('[API] Redirect detected, trying direct backend call for session history...');
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
        console.log('[API] Direct session history call successful:', directResponse.data);
        return directResponse.data;
      } catch (directError) {
        console.error('[API] Direct session history call also failed:', directError);
        throw new Error("Failed to load session history. Please try again.");
      }
    }
    
    if (error instanceof Error && error.message.includes("session has expired")) {
      throw error;
    }
    throw new Error("Failed to load session history. Please try again.");
  }
}

export interface CreateSessionRequest {
  project_id: string;
}

export async function createSession(sessionData: CreateSessionRequest): Promise<any> {
  try {
    console.log('[API] Creating new session for project:', sessionData.project_id);
    const response = await projectApi.post('/api/proposals/sessions/', sessionData);
    console.log('[API] Session created successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('[API] Session creation error:', error);
    
    // If it's a redirect error, try the direct approach
    if (error instanceof AxiosError && (error.code === 'ERR_TOO_MANY_REDIRECTS' || error.response?.status === 301 || error.response?.status === 308)) {
      console.log('[API] Redirect detected, trying direct backend call for session creation...');
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
        console.log('[API] Direct session creation call successful:', directResponse.data);
        return directResponse.data;
      } catch (directError) {
        console.error('[API] Direct session creation call also failed:', directError);
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
    console.error('Delete project error:', error);
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
    console.error('Delete session error:', error);
    if (error instanceof AxiosError) {
      throw new Error(error.response?.data?.message || 'Failed to delete session');
    }
    throw new Error("Failed to delete session. Please try again.");
  }
}

// Export axios instances for advanced usage if needed
export { authApi, projectApi };