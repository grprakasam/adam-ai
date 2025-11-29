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
  compact?: boolean;
}

export const StudySelector: React.FC<StudySelectorProps> = ({
  value,
  onChange,
  onStudyChange,
  showCreateButton = true,
  compact = false
}) => {
  const {
    studies,
    currentStudyId,
    currentStudy,
    studiesLoading,
    loadStudies,
    setCurrentStudy,
    createStudy
  } = useStudyStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadStudies();
  }, [loadStudies]);

  useEffect(() => {
    if (value && value !== currentStudyId) {
      setCurrentStudy(value);
    }
  }, [value, currentStudyId, setCurrentStudy]);

  const filteredStudies = studies.filter(study =>
    study.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    study.protocol_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    study.sponsor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  if (compact) {
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
              {filteredStudies.map(study => (
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
              ))}
              {showCreateButton && (
                <button
                  className="study-selector-create"
                  onClick={handleCreateStudy}
                  disabled={isCreating}
                >
                  <Plus size={16} />
                  {isCreating ? 'Creating...' : 'Create New Study'}
                </button>
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
              {filteredStudies.length === 0 ? (
                <div className="study-selector-empty">
                  {searchTerm ? 'No studies found' : 'No studies available'}
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
                      <span className="study-datasets">{study.datasets_count} dataset(s)</span>
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
