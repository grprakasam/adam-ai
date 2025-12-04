import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_BASE_URL = (
  import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8002'
).replace(/\/$/, '');

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('adam_access_token') || ''}`,
});

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

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  source_document_ids?: string[];
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
  loadStudyDocuments: (studyId: string) => Promise<void>;
  loadDatasetSelections: (studyId: string) => Promise<void>;
  updateDatasetSelections: (
    studyId: string,
    datasets: Array<{ dataset_name: string; language: string; priority: number }>
  ) => Promise<void>;
  createStudy: (data: Partial<Study>) => Promise<Study>;
  updateStudy: (studyId: string, data: Partial<Study>) => Promise<Study>;
  uploadDocument: (
    studyId: string,
    file: File,
    documentType: string,
    versionLabel?: string,
    tags?: Record<string, any>,
    description?: string
  ) => Promise<StudyDocument>;
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
      },

      // Load studies list
      loadStudies: async (force = false) => {
        const { studiesLoadedAt, studiesLoading } = get();
        const now = Date.now();
        if (!force && (studiesLoading || (studiesLoadedAt && now - studiesLoadedAt < 30000))) {
          return;
        }
        set({ studiesLoading: true });
        try {
          const response = await axios.get<StudyListItem[]>(
            `${API_BASE_URL}/api/v1/studies`,
            { headers: authHeaders() }
          );
          set({ studies: response.data, studiesLoadedAt: Date.now() });
        } catch (error) {
          console.error('Error loading studies:', error);
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;
          if (status === 401 || status === 403) {
            // Clear stale auth and ask app to redirect to login
            localStorage.removeItem('adam_access_token');
            localStorage.removeItem('adam_user');
            window.dispatchEvent(new CustomEvent('adam-ai:auth-required'));
          }
        } finally {
          set({ studiesLoading: false });
        }
      },

      // Load single study
      loadStudy: async (studyId: string): Promise<Study> => {
        try {
          const response = await axios.get<Study>(
            `${API_BASE_URL}/api/v1/studies/${studyId}`,
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
      loadStudyDocuments: async (studyId: string) => {
        set({ documentsLoading: { ...get().documentsLoading, [studyId]: true } });
        try {
          const response = await axios.get<StudyDocument[]>(
            `${API_BASE_URL}/api/v1/studies/${studyId}/documents`,
            { headers: authHeaders() }
          );
          set({
            documents: { ...get().documents, [studyId]: response.data },
            documentsLoading: { ...get().documentsLoading, [studyId]: false }
          });
        } catch (error) {
          console.error('Error loading documents:', error);
          set({ documentsLoading: { ...get().documentsLoading, [studyId]: false } });
        }
      },

      // Load dataset selections
      loadDatasetSelections: async (studyId: string) => {
        try {
          const response = await axios.get<{ datasets: StudyDatasetSelection[] }>(
            `${API_BASE_URL}/api/v1/studies/${studyId}/datasets`,
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
            `${API_BASE_URL}/api/v1/studies/${studyId}/datasets`,
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
          const response = await axios.post<Study>(
            `${API_BASE_URL}/api/v1/studies`,
            data,
            { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
          );
          // Reload studies list
          await get().loadStudies();
          // Set as current study
          await get().setCurrentStudy(response.data.id);
          return response.data;
        } catch (error) {
          console.error('Error creating study:', error);
          throw error;
        }
      },

      // Update study
      updateStudy: async (studyId: string, data: Partial<Study>): Promise<Study> => {
        try {
          const response = await axios.put<Study>(
            `${API_BASE_URL}/api/v1/studies/${studyId}`,
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
            `${API_BASE_URL}/api/v1/studies/${studyId}/documents`,
            formData,
            {
              headers: {
                ...authHeaders(),
                'Content-Type': 'multipart/form-data'
              }
            }
          );

          // Reload documents
          await get().loadStudyDocuments(studyId);
          return response.data;
        } catch (error) {
          console.error('Error uploading document:', error);
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
            `${API_BASE_URL}/api/v1/studies/${studyId}/chat`,
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
                  source_document_ids: response.data.source_document_ids
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
            `${API_BASE_URL}/api/v1/studies/${studyId}/chat/sessions`,
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
            `${API_BASE_URL}/api/v1/studies/${studyId}/chat/sessions/${sessionId}`,
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


