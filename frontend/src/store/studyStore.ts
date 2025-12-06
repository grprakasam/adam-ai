import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

// Use relative URL in development (via Vite proxy) or absolute URL if VITE_API_URL is set
const API_BASE_URL = import.meta.env.VITE_API_URL?.trim()
  ? import.meta.env.VITE_API_URL.trim().replace(/\/$/, '')
  : ''; // Empty string = relative URL (uses Vite proxy)

const authHeaders = () => {
  const token = localStorage.getItem('adam_access_token');
  if (!token) {
    console.warn('No authentication token found. User may need to log in.');
  }
  return {
    Authorization: token ? `Bearer ${token}` : '',
  };
};

// Helper to build API URL (relative if API_BASE_URL is empty, absolute otherwise)
const buildApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanPath}` : cleanPath;
};

// Types
export interface Study {
  id: string;
  name: string;
  protocol_number?: string;
  sponsor?: string;
  therapeutic_area?: string;
  phase?: string;
  description?: string;
  sdtm_version?: string;
  adam_ig_version?: string;
  meddra_version?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
  last_accessed_at?: string;
  setup_complete: boolean;
  code_generated: boolean;
  validation_status: string;
  submission_status: string;
  is_deleted: boolean;
}

export interface StudyListItem {
  id: string;
  name: string;
  protocol_number?: string;
  sponsor?: string;
  phase?: string;
  created_by: string;
  created_at: string;
  last_accessed_at?: string;
  setup_complete: boolean;
  code_generated: boolean;
  validation_status: string;
  submission_status: string;
  datasets_count: number;
  my_permission?: string;
}

export interface StudyDocument {
  id: string;
  study_id: string;
  document_type: string;
  file_name: string;
  original_file_name: string;
  storage_path: string;
  storage_url?: string;
  mime_type?: string;
  size_bytes?: number;
  version_label?: string;
  tags?: Record<string, any>;
  uploaded_by: string;
  uploaded_at: string;
  is_active: boolean;
  processing_status: string;
  extracted_text?: string;
  metadata?: Record<string, any>;
}

export interface StudyDatasetSelection {
  id: string;
  study_id: string;
  dataset_name: string;
  language: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  document_id: string;
  document_name: string;
  page_number?: number;
  section?: string;
  chunk_text?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  source_document_ids?: string[];
  citations?: Citation[];
  model_used?: string;
  tokens_used?: number;
}

export interface ChatSession {
  id: string;
  study_id: string;
  title?: string;
  created_by: string;
  created_at: string;
  message_count: number;
}

export interface ChatResponse {
  answer: string;
  citations: Array<{
    document_id: string;
    document_name: string;
    page_number?: number;
    section?: string;
    chunk_text?: string;
  }>;
  source_document_ids: string[];
  session_id: string;
  message_id: string;
}

export interface StudyStore {
  // Current study context
  currentStudyId: string | null;
  currentStudy: Study | null;

  // Study list cache
  studies: StudyListItem[];
  studiesLoadedAt: number | null;
  studiesLoading: boolean;

  // Study documents cache
  documents: Record<string, StudyDocument[]>; // keyed by study_id
  documentsLoading: Record<string, boolean>;

  // Dataset selections cache
  datasetSelections: Record<string, StudyDatasetSelection[]>; // keyed by study_id

  // Chatbot state
  chatSessions: Record<string, ChatSession[]>; // keyed by study_id
  activeChatSession: string | null;
  chatMessages: Record<string, ChatMessage[]>; // keyed by session_id

  // Actions
  setCurrentStudy: (studyId: string) => Promise<void>;
  loadStudies: (force?: boolean) => Promise<void>;
  loadStudy: (studyId: string) => Promise<Study>;
  loadStudyDocuments: (studyId: string, force?: boolean) => Promise<void>;
  loadDatasetSelections: (studyId: string) => Promise<void>;
  updateDatasetSelections: (
    studyId: string,
    datasets: Array<{ dataset_name: string; language: string; priority: number }>
  ) => Promise<void>;
  createStudy: (data: Partial<Study>) => Promise<Study>;
  addStudyToStore: (study: StudyListItem) => void;
  updateStudy: (studyId: string, data: Partial<Study>) => Promise<Study>;
  uploadDocument: (
    studyId: string,
    file: File,
    documentType: string,
    versionLabel?: string,
    tags?: Record<string, any>,
    description?: string
  ) => Promise<StudyDocument>;
  deleteDocument: (studyId: string, documentId: string) => Promise<void>;
  sendChatMessage: (
    studyId: string,
    message: string,
    sessionId?: string,
    temperature?: number
  ) => Promise<ChatResponse>;
  loadChatSessions: (studyId: string) => Promise<void>;
  loadChatMessages: (studyId: string, sessionId: string) => Promise<void>;

  // Computed
  getStudyDocuments: (studyId: string, type?: string) => StudyDocument[];
  getStudyConfig: (studyId: string) => {
    datasets: StudyDatasetSelection[];
    documents: StudyDocument[];
    study: Study | null;
  } | null;
}

export const useStudyStore = create<StudyStore>()(
  persist(
    (set, get) => ({
      // Initial state
      currentStudyId: null,
      currentStudy: null,
      studies: [],
      studiesLoadedAt: null,
      studiesLoading: false,
      documents: {},
      documentsLoading: {},
      datasetSelections: {},
      chatSessions: {},
      activeChatSession: null,
      chatMessages: {},

      // Set current study
      setCurrentStudy: async (studyId: string) => {
        set({ currentStudyId: studyId });
        // Load study details
        const study = await get().loadStudy(studyId);
        set({ currentStudy: study });
        // Broadcast change
        window.dispatchEvent(new CustomEvent('study-changed', { detail: { studyId } }));

        // Also load study documents and dataset selections so they're available
        // This ensures specification files and datasets are loaded when study is selected
        try {
          await Promise.all([
            get().loadStudyDocuments(studyId, true), // Force reload
            get().loadDatasetSelections(studyId)
          ]);
          console.log('Study documents and datasets loaded for study:', studyId);
          window.dispatchEvent(new CustomEvent('study-documents-ready', { detail: { studyId, study, documents: get().documents[studyId] || [], datasets: get().datasetSelections[studyId] || [] } }));
        } catch (error) {
          console.warn('Failed to load study documents/datasets:', error);
        }
      },

      // Load studies list
      loadStudies: async (force = false) => {
        const { studiesLoadedAt, studiesLoading } = get();
        const now = Date.now();
        // Reduced cache time from 30s to 5s for more responsive updates
        const CACHE_TIME_MS = 5000; // 5 seconds

        if (!force && (studiesLoading || (studiesLoadedAt && now - studiesLoadedAt < CACHE_TIME_MS))) {
          console.log('Skipping loadStudies - cache still valid or already loading');
          return;
        }

        console.log('Loading studies...', { force, API_BASE_URL, hasToken: !!localStorage.getItem('adam_access_token') });
        set({ studiesLoading: true });

        try {
          const token = localStorage.getItem('adam_access_token');
          if (!token) {
            console.warn('No authentication token found. User needs to log in.');
            set({ studies: [], studiesLoading: false });
            window.dispatchEvent(new CustomEvent('adam-ai:auth-required'));
            return;
          }

          const headers = authHeaders();
          const apiUrl = buildApiUrl('/api/v1/studies');
          console.log('Making request to:', apiUrl);
          console.log('Headers:', { ...headers, Authorization: headers.Authorization ? 'Bearer ***' : 'none' });

          const response = await axios.get<StudyListItem[]>(
            apiUrl,
            {
              headers,
              timeout: 10000 // 10 second timeout
            }
          );

          console.log('Studies loaded successfully:', response.data.length, 'studies');
          set({ studies: response.data, studiesLoadedAt: Date.now() });

          // Broadcast update event for components to react
          window.dispatchEvent(new CustomEvent('study-store-updated', {
            detail: {
              studies: response.data,
              count: response.data.length,
              timestamp: Date.now()
            }
          }));
        } catch (error) {
          console.error('Error loading studies:', error);

          if (axios.isAxiosError(error)) {
            const status = error.response?.status;
            const message = error.message;

            console.error('Axios error details:', {
              status,
              message,
              code: error.code,
              response: error.response?.data,
              url: error.config?.url
            });

            if (status === 401 || status === 403) {
              console.warn('Authentication failed. Clearing tokens and redirecting to login.');
              // Clear stale auth and ask app to redirect to login
              localStorage.removeItem('adam_access_token');
              localStorage.removeItem('adam_user');
              set({ studies: [] });
              window.dispatchEvent(new CustomEvent('adam-ai:auth-required'));
            } else if (!error.response) {
              // Network error
              console.error('Network error - backend may not be running or CORS issue');
              const errorUrl = buildApiUrl('/api/v1/studies');
              console.error('Error details:', {
                message: error.message,
                code: error.code,
                url: errorUrl
              });
            }
          }

          // Don't clear studies on error - keep existing ones if any
          // set({ studies: [] }); // Commented out to preserve existing studies
        } finally {
          set({ studiesLoading: false });
        }
      },

      // Helper: Add study to store immediately (optimistic update)
      addStudyToStore: (study: StudyListItem) => {
        const currentStudies = get().studies;
        // Check if study already exists
        if (!currentStudies.find(s => s.id === study.id)) {
          const updatedStudies = [...currentStudies, study];
          set({ studies: updatedStudies });

          // Broadcast update event
          window.dispatchEvent(new CustomEvent('study-store-updated', {
            detail: {
              studies: updatedStudies,
              count: updatedStudies.length,
              timestamp: Date.now(),
              action: 'added',
              studyId: study.id
            }
          }));

          console.log('Study added to store optimistically:', study.id, study.name);
        }
      },

      // Load single study
      loadStudy: async (studyId: string): Promise<Study> => {
        try {
          const response = await axios.get<Study>(
            buildApiUrl(`/api/v1/studies/${studyId}`),
            { headers: authHeaders() }
          );
          set({ currentStudy: response.data });
          return response.data;
        } catch (error) {
          console.error('Error loading study:', error);
          throw error;
        }
      },

      // Load study documents
      loadStudyDocuments: async (studyId: string, force: boolean = false) => {
        // Skip if already loading (unless forced)
        if (!force && get().documentsLoading[studyId]) {
          return;
        }

        set({ documentsLoading: { ...get().documentsLoading, [studyId]: true } });
        try {
          const response = await axios.get<StudyDocument[]>(
            buildApiUrl(`/api/v1/studies/${studyId}/documents`),
            {
              headers: authHeaders(),
              params: {
                active_only: true,  // Only load active documents
                limit: 100  // Load up to 100 documents
              }
            }
          );

          // Ensure storage_url is set for all documents (fallback to download endpoint)
          const documentsWithUrls = response.data.map(doc => ({
            ...doc,
            storage_url: doc.storage_url || `/api/v1/studies/${studyId}/documents/${doc.id}/download`
          }));

          set({
            documents: { ...get().documents, [studyId]: documentsWithUrls },
            documentsLoading: { ...get().documentsLoading, [studyId]: false }
          });

          console.log(`Loaded ${documentsWithUrls.length} documents for study ${studyId}`);
        } catch (error: any) {
          console.error('=== ERROR LOADING STUDY DOCUMENTS ===');
          console.error('Study ID:', studyId);
          console.error('Status:', error?.response?.status);
          console.error('Detail:', error?.response?.data?.detail);
          console.error('Auth token exists:', !!localStorage.getItem('adam_access_token'));
          console.error('Full error:', error);

          // Check for authentication errors
          if (error?.response?.status === 401 || error?.response?.status === 403) {
            console.warn('Authentication required - clearing tokens');
            localStorage.removeItem('adam_access_token');
            localStorage.removeItem('adam_user');
            window.dispatchEvent(new CustomEvent('adam-ai:auth-required'));
          }

          set({ documentsLoading: { ...get().documentsLoading, [studyId]: false } });

          // Set empty array on error to prevent retry loops
          set({
            documents: { ...get().documents, [studyId]: [] }
          });
        }
      },

      // Load dataset selections
      loadDatasetSelections: async (studyId: string) => {
        try {
          const response = await axios.get<{ datasets: StudyDatasetSelection[] }>(
            buildApiUrl(`/api/v1/studies/${studyId}/datasets`),
            { headers: authHeaders() }
          );
          set({
            datasetSelections: {
              ...get().datasetSelections,
              [studyId]: response.data.datasets
            }
          });
        } catch (error) {
          console.error('Error loading dataset selections:', error);
        }
      },

      // Update dataset selections
      updateDatasetSelections: async (
        studyId: string,
        datasets: Array<{ dataset_name: string; language: string; priority: number }>
      ) => {
        try {
          const response = await axios.put<{ datasets: StudyDatasetSelection[] }>(
            buildApiUrl(`/api/v1/studies/${studyId}/datasets`),
            { datasets },
            { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
          );
          set({
            datasetSelections: {
              ...get().datasetSelections,
              [studyId]: response.data.datasets
            }
          });
        } catch (error) {
          console.error('Error updating dataset selections:', error);
          throw error;
        }
      },

      // Create study
      createStudy: async (data: Partial<Study>): Promise<Study> => {
        try {
          const token = localStorage.getItem('adam_access_token');
          if (!token) {
            const error: any = new Error('No authentication token found. Please log in.');
            error.isAuthError = true;
            console.error('Error creating study:', error);
            throw error;
          }

          console.log('Creating study with data:', data);
          const createApiUrl = buildApiUrl('/api/v1/studies');
          console.log('API URL:', createApiUrl);

          const response = await axios.post<Study>(
            createApiUrl,
            data,
            {
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              timeout: 30000 // 30 second timeout
            }
          );

          console.log('Study created successfully:', response.data.id, response.data.name);

          // OPTIMISTIC UPDATE: Add study to store immediately
          const studyListItem: StudyListItem = {
            id: response.data.id,
            name: response.data.name,
            protocol_number: response.data.protocol_number,
            sponsor: response.data.sponsor,
            phase: response.data.phase,
            created_by: response.data.created_by,
            created_at: response.data.created_at,
            last_accessed_at: response.data.last_accessed_at,
            setup_complete: response.data.setup_complete,
            code_generated: response.data.code_generated,
            validation_status: response.data.validation_status,
            datasets_count: 0, // Will be updated when datasets are loaded
            my_permission: 'admin' // Creator gets admin access
          };

          // Add to store immediately (optimistic update)
          get().addStudyToStore(studyListItem);

          // Clear cache to force refresh on next load
          set({ studiesLoadedAt: null });

          // Background sync: Reload from API to ensure consistency
          // Don't await - let it happen in background
          get().loadStudies(true).catch(err => {
            console.warn('Background study reload failed, but study is already in store:', err);
          });

          // Set as current study
          console.log('Setting current study to:', response.data.id);
          await get().setCurrentStudy(response.data.id);

          // Broadcast study created event
          window.dispatchEvent(new CustomEvent('study-created', {
            detail: {
              study: response.data,
              studyId: response.data.id
            }
          }));

          return response.data;
        } catch (error) {
          console.error('Error creating study:', error);

          // Handle authentication errors
          if (axios.isAxiosError(error)) {
            if (error.response?.status === 401 || error.response?.status === 403) {
              // Clear stale auth
              localStorage.removeItem('adam_access_token');
              localStorage.removeItem('adam_user');
              window.dispatchEvent(new CustomEvent('adam-ai:auth-required'));
              const authError: any = new Error('Authentication required. Please log in again.');
              authError.isAuthError = true;
              throw authError;
            }

            if (!error.response) {
              // Network error - check if it's actually a CORS/auth issue
              const networkError: any = new Error(
                error.code === 'ERR_NETWORK' || error.message?.includes('Network Error')
                  ? 'Network error. Please check if you are logged in and the backend server is running.'
                  : `Network error: ${error.message || 'Unable to connect to server'}`
              );
              networkError.isNetworkError = true;
              networkError.originalError = error;
              throw networkError;
            }
          }

          throw error;
        }
      },

      // Update study
      updateStudy: async (studyId: string, data: Partial<Study>): Promise<Study> => {
        try {
          const response = await axios.put<Study>(
            buildApiUrl(`/api/v1/studies/${studyId}`),
            data,
            { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
          );
          set({ currentStudy: response.data });
          // Reload studies list
          await get().loadStudies();
          return response.data;
        } catch (error) {
          console.error('Error updating study:', error);
          throw error;
        }
      },

      // Upload document
      uploadDocument: async (
        studyId: string,
        file: File,
        documentType: string,
        versionLabel?: string,
        tags?: Record<string, any>,
        description?: string
      ): Promise<StudyDocument> => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('document_type', documentType);
          if (versionLabel) formData.append('version_label', versionLabel);
          if (tags) formData.append('tags', JSON.stringify(tags));
          if (description) formData.append('description', description);

          const response = await axios.post<StudyDocument>(
            buildApiUrl(`/api/v1/studies/${studyId}/documents`),
            formData,
            {
              headers: {
                ...authHeaders(),
                'Content-Type': 'multipart/form-data'
              }
            }
          );

          // Reload documents - force reload to ensure we get the newly uploaded document
          await get().loadStudyDocuments(studyId, true);

          // Dispatch event to notify components
          window.dispatchEvent(new CustomEvent('study-documents-updated', {
            detail: { studyId }
          }));

          return response.data;
        } catch (error) {
          console.error('Error uploading document:', error);
          throw error;
        }
      },

      // Delete document
      deleteDocument: async (studyId: string, documentId: string): Promise<void> => {
        try {
          await axios.delete(
            buildApiUrl(`/api/v1/studies/${studyId}/documents/${documentId}`),
            { headers: authHeaders() }
          );

          await get().loadStudyDocuments(studyId, true);

          window.dispatchEvent(new CustomEvent('study-documents-updated', {
            detail: { studyId }
          }));
        } catch (error) {
          console.error('Error deleting document:', error);
          throw error;
        }
      },

      // Send chat message
      sendChatMessage: async (
        studyId: string,
        message: string,
        sessionId?: string,
        temperature: number = 0.1
      ): Promise<ChatResponse> => {
        try {
          const response = await axios.post<ChatResponse>(
            buildApiUrl(`/api/v1/studies/${studyId}/chat`),
            {
              message,
              session_id: sessionId,
              temperature
            },
            { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
          );

          // Update chat messages
          const sessionIdToUse = response.data.session_id;
          const currentMessages = get().chatMessages[sessionIdToUse] || [];
          set({
            chatMessages: {
              ...get().chatMessages,
              [sessionIdToUse]: [
                ...currentMessages,
                { role: 'user', content: message, timestamp: new Date().toISOString(), id: '' },
                {
                  role: 'assistant',
                  content: response.data.answer,
                  timestamp: new Date().toISOString(),
                  id: response.data.message_id,
                  source_document_ids: response.data.source_document_ids,
                  citations: response.data.citations
                }
              ]
            },
            activeChatSession: sessionIdToUse
          });

          return response.data;
        } catch (error) {
          console.error('Error sending chat message:', error);
          throw error;
        }
      },

      // Load chat sessions
      loadChatSessions: async (studyId: string) => {
        try {
          const response = await axios.get<ChatSession[]>(
            buildApiUrl(`/api/v1/studies/${studyId}/chat/sessions`),
            { headers: authHeaders() }
          );
          set({
            chatSessions: {
              ...get().chatSessions,
              [studyId]: response.data
            }
          });
        } catch (error) {
          console.error('Error loading chat sessions:', error);
        }
      },

      // Load chat messages
      loadChatMessages: async (studyId: string, sessionId: string) => {
        try {
          const response = await axios.get<{
            id: string;
            study_id: string;
            title?: string;
            created_by: string;
            created_at: string;
            message_count: number;
            messages: ChatMessage[];
          }>(
            buildApiUrl(`/api/v1/studies/${studyId}/chat/sessions/${sessionId}`),
            { headers: authHeaders() }
          );

          set({
            chatMessages: {
              ...get().chatMessages,
              [sessionId]: response.data.messages
            },
            activeChatSession: sessionId
          });
        } catch (error) {
          console.error('Error loading chat messages:', error);
        }
      },

      // Computed: Get study documents
      getStudyDocuments: (studyId: string, type?: string): StudyDocument[] => {
        const docs = get().documents[studyId] || [];
        if (type) {
          return docs.filter(doc => doc.document_type === type);
        }
        return docs;
      },

      // Computed: Get study config
      getStudyConfig: (studyId: string) => {
        const study = get().currentStudyId === studyId ? get().currentStudy : null;
        const datasets = get().datasetSelections[studyId] || [];
        const documents = get().documents[studyId] || [];
        if (!study && !datasets.length && !documents.length) {
          return null;
        }
        return { study, datasets, documents };
      }
    }),
    {
      name: 'study-store',
      partialize: (state) => ({
        currentStudyId: state.currentStudyId
      })
    }
  )
);



