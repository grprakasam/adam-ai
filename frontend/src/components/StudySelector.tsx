import React, { useState, useEffect } from 'react';
import { Search, Plus, ChevronDown } from 'lucide-react';
import { useStudyStore } from '../store/studyStore';
import { message } from 'antd';
import './StudySelector.css';

interface StudySelectorProps {
  value?: string; // currentStudyId
  onChange?: (studyId: string) => void;
  onStudyChange?: (study: any) => void;
  showCreateButton?: boolean;
  compact?: boolean; // Deprecated, use variant
  variant?: 'default' | 'compact' | 'hero';
}

export const StudySelector: React.FC<StudySelectorProps> = ({
  value,
  onChange,
  onStudyChange,
  showCreateButton = true,
  compact = false,
  variant = compact ? 'compact' : 'default'
}) => {
  const {
    studies,
    currentStudyId,
    currentStudy,
    studiesLoading,
    studiesLoadedAt,
    loadStudies,
    setCurrentStudy,
    createStudy
  } = useStudyStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Load studies on mount only (prevent infinite loop)
  useEffect(() => {
    // Import diagnostics
    import('../utils/studyDiagnostics').then(({ checkStudyLoadingDiagnostics, testStudyApiAccess }) => {
      checkStudyLoadingDiagnostics();

      console.log('StudySelector mounted, checking studies:', {
        studiesLoadedAt,
        studiesLoading,
        studiesCount: studies.length
      });

      // Test API access if no studies
      if (studies.length === 0 && !studiesLoading) {
        testStudyApiAccess()
          .then(() => {
            console.log('API test passed, loading studies...');
            loadStudies(true);
          })
          .catch((error) => {
            console.error('API test failed, but attempting to load anyway:', error);
            loadStudies(true);
          });
      } else if (!studiesLoadedAt && !studiesLoading) {
        console.log('Loading studies from StudySelector...');
        loadStudies(true); // Force load to ensure fresh data
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen to study store updates and study creation events
  useEffect(() => {
    const handleStudyUpdate = (event: CustomEvent) => {
      console.log('StudySelector: Received study store update event', event.detail);
      // Force re-render by updating local state if needed
      // The Zustand store will automatically trigger re-render
    };

    const handleStudyCreated = (event: CustomEvent) => {
      console.log('StudySelector: New study created', event.detail);
      // Studies are already in store via optimistic update
      // Just ensure dropdown is aware
      if (isOpen) {
        // Keep dropdown open to show new study
      }
    };

    window.addEventListener('study-store-updated', handleStudyUpdate as EventListener);
    window.addEventListener('study-created', handleStudyCreated as EventListener);

    return () => {
      window.removeEventListener('study-store-updated', handleStudyUpdate as EventListener);
      window.removeEventListener('study-created', handleStudyCreated as EventListener);
    };
  }, [isOpen]);

  useEffect(() => {
    if (value && value !== currentStudyId) {
      setCurrentStudy(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const filteredStudies = studies.filter(study =>
    study.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    study.protocol_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    study.sponsor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Debug logging when studies change
  useEffect(() => {
    console.log('StudySelector - Studies updated:', {
      totalStudies: studies.length,
      filteredStudies: filteredStudies.length,
      searchTerm,
      studiesList: studies.map(s => ({ id: s.id, name: s.name, protocol: s.protocol_number }))
    });
  }, [studies.length, filteredStudies.length, searchTerm]);

  const handleStudySelect = async (studyId: string) => {
    await setCurrentStudy(studyId);
    onChange?.(studyId);
    if (currentStudy) {
      onStudyChange?.(currentStudy);
    }
    setIsOpen(false);
    setSearchTerm('');
    // Broadcast change
    window.dispatchEvent(new CustomEvent('study-changed', { detail: { studyId } }));
  };

  const handleCreateStudy = async () => {
    setIsCreating(true);
    try {
      const newStudy = await createStudy({
        name: `New Study ${new Date().toLocaleDateString()}`,
        description: 'Created from Study Selector'
      });
      await handleStudySelect(newStudy.id);
      message.success(`Study "${newStudy.name}" created.`);
    } catch (error) {
      console.error('Error creating study:', error);
      message.error('Failed to create study. Please try again.');
    } finally {
      setIsCreating(false);
      setIsOpen(false);
    }
  };

  const selectedStudy = studies.find(s => s.id === (value || currentStudyId));

  if (variant === 'compact') {
    return (
      <div className="study-selector-compact">
        <button
          className="study-selector-trigger-compact"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{selectedStudy?.name || 'Select Study'}</span>
          <ChevronDown size={16} />
        </button>
        {isOpen && (
          <div className="study-selector-dropdown">
            <div className="study-selector-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search studies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <div className="study-selector-list">
              {studiesLoading ? (
                <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
                  Loading studies...
                </div>
              ) : filteredStudies.length === 0 ? (
                <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
                  {studies.length === 0
                    ? 'No studies found. Check console for errors.'
                    : `No studies match "${searchTerm}"`}
                </div>
              ) : (
                filteredStudies.map(study => (
                  <button
                    key={study.id}
                    className={`study-selector-item ${study.id === (value || currentStudyId) ? 'active' : ''}`}
                    onClick={() => handleStudySelect(study.id)}
                  >
                    <div className="study-item-name">{study.name}</div>
                    {study.protocol_number && (
                      <div className="study-item-meta">Protocol: {study.protocol_number}</div>
                    )}
                  </button>
                ))
              )}
            </div>
            {showCreateButton && (
              <button
                className="study-selector-create"
                onClick={handleCreateStudy}
                disabled={isCreating}
                style={{ borderTop: '1px solid #e2e8f0', borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}
              >
                <Plus size={16} />
                {isCreating ? 'Creating...' : 'Create New Study'}
              </button>
            )}
            <div className="study-details-link-wrapper" style={{ padding: '8px', textAlign: 'center', borderTop: '1px solid #f0f0f0', background: '#fafafa' }}>
              <a
                href="/enter-study-details"
                className="study-details-link"
                style={{ fontSize: '12px', color: '#64748b' }}
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({}, '', '/enter-study-details');
                  window.dispatchEvent(new Event('popstate'));
                }}
              >
                Go to Study Details Page
              </a>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <div className="study-selector-hero">
        <div className="study-selector-row-top">
          <div className="study-section-title">Study</div>
          <div className="study-selector-content">
            <button
              className="study-selector-trigger-hero"
              onClick={() => setIsOpen(!isOpen)}
            >
              <span className="study-hero-value">{selectedStudy?.name || 'Select Study'}</span>
              <ChevronDown size={20} className="study-hero-icon" />
            </button>
          </div>
        </div>

        <div className="study-selector-row-bottom">
          <div className="study-details-link-wrapper">
            <a
              href="/enter-study-details"
              className="study-details-link"
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/enter-study-details');
                window.dispatchEvent(new Event('popstate'));
              }}
            >
              Study Details
            </a>
          </div>
        </div>

        {isOpen && (
          <div className="study-selector-dropdown study-selector-dropdown-hero">
            <div className="study-selector-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search studies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <div className="study-selector-list">
              {studiesLoading ? (
                <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
                  Loading studies...
                </div>
              ) : filteredStudies.length === 0 ? (
                <div className="study-selector-empty">
                  {studies.length === 0
                    ? 'No studies available.'
                    : `No studies match "${searchTerm}"`}
                </div>
              ) : (
                filteredStudies.map(study => (
                  <button
                    key={study.id}
                    className={`study-selector-item ${study.id === (value || currentStudyId) ? 'active' : ''}`}
                    onClick={() => handleStudySelect(study.id)}
                  >
                    <div className="study-item-header">
                      <div className="study-item-name">{study.name}</div>
                      {study.validation_status && (
                        <span className={`study-status status-${study.validation_status}`}>
                          {study.validation_status}
                        </span>
                      )}
                    </div>
                    <div className="study-item-meta">
                      {study.protocol_number && (
                        <span>Protocol: {study.protocol_number}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="study-selector">
      <div className="study-selector-header">
        <label>Study</label>
        {showCreateButton && (
          <button
            className="create-study-btn"
            onClick={handleCreateStudy}
            disabled={isCreating}
          >
            <Plus size={16} />
            {isCreating ? 'Creating...' : 'New Study'}
          </button>
        )}
      </div>
      <div className="study-selector-wrapper">
        <button
          className="study-selector-trigger"
          onClick={() => setIsOpen(!isOpen)}
          disabled={studiesLoading}
        >
          <span>
            {selectedStudy ? (
              <>
                <strong>{selectedStudy.name}</strong>
                {selectedStudy.protocol_number && (
                  <span className="study-protocol"> ({selectedStudy.protocol_number})</span>
                )}
              </>
            ) : (
              'Select a study...'
            )}
          </span>
          <ChevronDown size={20} />
        </button>
        {isOpen && (
          <div className="study-selector-dropdown">
            <div className="study-selector-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search studies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <div className="study-selector-list">
              {studiesLoading ? (
                <div style={{ padding: '12px', textAlign: 'center', color: '#666' }}>
                  Loading studies...
                </div>
              ) : filteredStudies.length === 0 ? (
                <div className="study-selector-empty">
                  {studies.length === 0
                    ? 'No studies found. Check console for errors or try reloading.'
                    : searchTerm
                      ? `No studies match "${searchTerm}"`
                      : 'No studies available'}
                </div>
              ) : (
                filteredStudies.map(study => (
                  <button
                    key={study.id}
                    className={`study-selector-item ${study.id === (value || currentStudyId) ? 'active' : ''}`}
                    onClick={() => handleStudySelect(study.id)}
                  >
                    <div className="study-item-header">
                      <div className="study-item-name">{study.name}</div>
                      {study.validation_status && (
                        <span className={`study-status status-${study.validation_status}`}>
                          {study.validation_status}
                        </span>
                      )}
                    </div>
                    <div className="study-item-meta">
                      {study.protocol_number && (
                        <span>Protocol: {study.protocol_number}</span>
                      )}
                      {study.sponsor && (
                        <span>Sponsor: {study.sponsor}</span>
                      )}
                    </div>
                    <div className="study-item-footer">
                      <span className="study-datasets">{study.datasets_count || 0} dataset(s)</span>
                      <span className="study-date">
                        {new Date(study.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
