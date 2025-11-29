import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, MessageSquare, Settings, Database, CheckCircle2, Loader2, Save, Plus } from 'lucide-react';
import { StudySelector } from './StudySelector';
import { StudyChatbotPanel } from './StudyChatbotPanel';
import { useStudyStore, Study } from '../store/studyStore';
import { message } from 'antd';
import { FormBlock } from './FormBlock';
import { TextField } from './TextField';
import { SelectField } from './SelectField';
import './EnterStudyDetailsPage.css';

interface EnterStudyDetailsPageEnhancedProps {
  onBack?: () => void;
  onStudyCreated?: (studyId: string) => void;
}

type TabType = 'basic' | 'standards' | 'datasets' | 'documents' | 'chat';

// New study form data interface
interface NewStudyFormData {
  name: string;
  protocol_number: string;
  sponsor: string;
  therapeutic_area: string;
  phase: string;
  description: string;
  sdtm_version: string;
  adam_ig_version: string;
  meddra_version: string;
  selectedDatasets: string[];
}

const EnterStudyDetailsPageEnhanced: React.FC<EnterStudyDetailsPageEnhancedProps> = ({ onBack, onStudyCreated }) => {
  const {
    currentStudyId,
    currentStudy,
    documents,
    datasetSelections,
    documentsLoading,
    loadStudy,
    loadStudyDocuments,
    loadDatasetSelections,
    updateStudy,
    uploadDocument,
    setCurrentStudy,
    createStudy,
    loadStudies,
    updateDatasetSelections
  } = useStudyStore();

  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Local state for form fields to enable immediate UI updates
  const [localStudyData, setLocalStudyData] = useState<Partial<Study> | null>(null);
  
  // New study form state with default values
  const [newStudyForm, setNewStudyForm] = useState<NewStudyFormData>({
    name: '',
    protocol_number: '',
    sponsor: '',
    therapeutic_area: 'Oncology', // Default value
    phase: 'Phase II', // Default value
    description: '',
    sdtm_version: 'SDTM v2.0', // Default to latest
    adam_ig_version: 'ADaM IG v1.3', // Default to latest
    meddra_version: 'MedDRA v27.1', // Default to latest
    selectedDatasets: ['ADSL'] // Default to ADSL
  });
  const [isCreating, setIsCreating] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Load study data when study changes
  useEffect(() => {
    if (currentStudyId) {
      loadStudy(currentStudyId);
      loadStudyDocuments(currentStudyId);
      loadDatasetSelections(currentStudyId);
    }
  }, [currentStudyId, loadStudy, loadStudyDocuments, loadDatasetSelections]);

  // Sync local state with store when currentStudy changes (but only if localStudyData is null or the study ID changed)
  useEffect(() => {
    if (currentStudy) {
      // Only update if we don't have local data, or if the study ID changed
      if (!localStudyData || localStudyData.id !== currentStudy.id) {
        setLocalStudyData(currentStudy);
      }
    } else if (currentStudyId && !localStudyData) {
      // If we have a study ID but no study data yet, initialize with empty object
      // This allows the form to be editable while data loads
      setLocalStudyData({ id: currentStudyId } as Partial<Study>);
    } else if (!currentStudyId) {
      setLocalStudyData(null);
    }
  }, [currentStudy?.id, currentStudyId]); // Only depend on IDs to avoid overwriting user input

  // Auto-save on field changes (debounced) - using ref for timeout
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleFieldChange = (field: string, value: any) => {
    if (!currentStudyId) {
      console.warn('Cannot update field: no study selected');
      return;
    }

    // Initialize localStudyData if it doesn't exist
    const currentData = localStudyData || { id: currentStudyId } as Partial<Study>;
    
    // Immediately update local state for instant UI feedback
    const updatedData = { ...currentData, [field]: value };
    setLocalStudyData(updatedData);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const updatedStudy = await updateStudy(currentStudyId, { [field]: value });
        // Update local state with server response
        setLocalStudyData(updatedStudy);
      } catch (error) {
        console.error('Error saving field:', error);
        message.error(`Failed to save ${field}. Please try again.`);
        // Revert to original value on error - reload from store
        if (currentStudy) {
          setLocalStudyData(currentStudy);
        }
      } finally {
        setIsSaving(false);
        saveTimeoutRef.current = null;
      }
    }, 1000); // 1 second debounce
  };

  // Cleanup timeout on unmount or study change
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [currentStudyId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !currentStudyId) return;

    try {
      setUploadProgress({ [file.name]: 0 });
      await uploadDocument(
        currentStudyId,
        file,
        'SPECIFICATION',
        undefined,
        undefined,
        `Uploaded ${file.name}`
      );
      setUploadProgress({ [file.name]: 100 });
      setTimeout(() => setUploadProgress({}), 2000);
    } catch (error) {
      console.error('Error uploading file:', error);
      message.error('Failed to upload file. Please try again.');
    }
  };

  const handleDatasetUpdate = async (datasets: Array<{ dataset_name: string; language: string; priority: number }>) => {
    if (!currentStudyId) return;

    try {
      await updateDatasetSelections(currentStudyId, datasets);
        await loadDatasetSelections(currentStudyId);
    } catch (error) {
      console.error('Error updating datasets:', error);
      message.error('Failed to update dataset selections. Please try again.');
    }
  };

  const studyDocuments = currentStudyId ? (documents[currentStudyId] || []) : [];
  const studyDatasets = currentStudyId ? (datasetSelections[currentStudyId] || []) : [];

  const therapeuticAreas = [
    { value: 'Oncology', label: 'Oncology' },
    { value: 'Cardiology', label: 'Cardiology' },
    { value: 'Neurology', label: 'Neurology' },
    { value: 'Immunology', label: 'Immunology' },
    { value: 'Respiratory', label: 'Respiratory' },
    { value: 'Endocrinology', label: 'Endocrinology' },
    { value: 'Infectious Disease', label: 'Infectious Disease' },
    { value: 'Dermatology', label: 'Dermatology' },
  ];

  const studyPhases = [
    { value: 'Phase I', label: 'Phase I - First-in-Human' },
    { value: 'Phase II', label: 'Phase II - Proof of Concept' },
    { value: 'Phase III', label: 'Phase III - Pivotal' },
    { value: 'Phase IV', label: 'Phase IV - Post-Marketing' },
  ];

  const sdtmVersions = [
    { value: 'SDTM v2.0', label: 'SDTM v2.0 (Latest)' },
    { value: 'SDTM v1.7', label: 'SDTM v1.7' },
    { value: 'SDTM v1.6', label: 'SDTM v1.6' },
  ];

  const adamVersions = [
    { value: 'ADaM IG v1.3', label: 'ADaM IG v1.3 (Latest)' },
    { value: 'ADaM IG v1.2', label: 'ADaM IG v1.2' },
    { value: 'ADaM IG v1.1', label: 'ADaM IG v1.1' },
  ];

  const medraVersions = [
    { value: 'MedDRA v27.1', label: 'MedDRA v27.1 (Latest)' },
    { value: 'MedDRA v27.0', label: 'MedDRA v27.0' },
    { value: 'MedDRA v26.1', label: 'MedDRA v26.1' },
  ];

  const adamDatasets = [
    { value: 'ADSL', label: 'ADSL', description: 'Subject Level Analysis Dataset' },
    { value: 'ADAE', label: 'ADAE', description: 'Adverse Events Analysis Dataset' },
    { value: 'ADLB', label: 'ADLB', description: 'Laboratory Analysis Dataset' },
    { value: 'ADTTE', label: 'ADTTE', description: 'Time to Event Analysis Dataset' },
    { value: 'ADVS', label: 'ADVS', description: 'Vital Signs Analysis Dataset' },
  ];

  // Handle new study form field changes
  const handleNewStudyFieldChange = (field: keyof NewStudyFormData, value: any) => {
    console.log(`EnterStudyDetails: Field ${field} changed to:`, value);
    setNewStudyForm(prev => {
      const updated = { ...prev, [field]: value };
      console.log('Updated form state:', updated);
      return updated;
    });
    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate new study form
  const validateNewStudyForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!newStudyForm.name.trim()) {
      errors.name = 'Study name is required';
    }
    
    // Optional: validate other fields if needed
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle storing new study
  const handleStoreStudyDetails = async () => {
    if (!validateNewStudyForm()) {
      return;
    }

    setIsCreating(true);
    try {
      // Prepare study data
      const studyData: any = {
        name: newStudyForm.name.trim(),
        protocol_number: newStudyForm.protocol_number.trim() || undefined,
        sponsor: newStudyForm.sponsor.trim() || undefined,
        therapeutic_area: newStudyForm.therapeutic_area || undefined,
        phase: newStudyForm.phase || undefined,
        description: newStudyForm.description.trim() || undefined,
        sdtm_version: newStudyForm.sdtm_version || undefined,
        adam_ig_version: newStudyForm.adam_ig_version || undefined,
        meddra_version: newStudyForm.meddra_version || undefined,
      };

      // Create the study
      const createdStudy = await createStudy(studyData);

      // If datasets were selected, add them
      if (newStudyForm.selectedDatasets.length > 0 && createdStudy.id) {
        try {
          const datasets = newStudyForm.selectedDatasets.map((datasetName, index) => ({
            dataset_name: datasetName,
            language: 'Both',
            priority: index
          }));

          await updateDatasetSelections(createdStudy.id, datasets);
          await loadDatasetSelections(createdStudy.id);
        } catch (error) {
          console.error('Error adding datasets:', error);
          // Don't fail the whole operation if dataset update fails
        }
      }

      // Reload studies list to ensure dropdown is updated
      await loadStudies();

      // Reset form with default values
      setNewStudyForm({
        name: '',
        protocol_number: '',
        sponsor: '',
        therapeutic_area: 'Oncology',
        phase: 'Phase II',
        description: '',
        sdtm_version: 'SDTM v2.0',
        adam_ig_version: 'ADaM IG v1.3',
        meddra_version: 'MedDRA v27.1',
        selectedDatasets: ['ADSL']
      });

      // Success message
      message.success(`Study "${createdStudy.name}" has been created successfully.`);
      
      // Navigate to workspace if callback provided
      if (onStudyCreated && createdStudy.id) {
        // Small delay to ensure study is fully loaded
        setTimeout(() => {
          onStudyCreated(createdStudy.id);
        }, 500);
      }
    } catch (error: any) {
      console.error('Error creating study:', error);
      message.error(`Failed to create study: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Render create new study form when no study is selected
  if (!currentStudyId) {
    return (
      <div className="enter-study-details-page">
        <div className="study-selector-container">
          <StudySelector showCreateButton={true} />
        </div>

        <div className="create-study-container">
          <div className="create-study-header">
            <h2>Create New Study</h2>
            <p className="create-study-subtitle">
              Enter the study details below. All fields marked with <span className="required-asterisk">*</span> are required.
            </p>
          </div>

          {/* Tab Navigation for Create Form */}
          <div className="study-tabs">
            <button
              className={`study-tab ${activeTab === 'basic' ? 'active' : ''}`}
              onClick={() => setActiveTab('basic')}
            >
              <Settings size={18} />
              Enter Basic Study Info
            </button>
            <button
              className={`study-tab ${activeTab === 'standards' ? 'active' : ''}`}
              onClick={() => setActiveTab('standards')}
            >
              <Database size={18} />
              Set CDISC Standards Version
            </button>
            <button
              className={`study-tab ${activeTab === 'datasets' ? 'active' : ''}`}
              onClick={() => setActiveTab('datasets')}
            >
              <Database size={18} />
              Select ADAM Datasets to create
            </button>
          </div>

          {/* Form Content */}
          <div className="study-tab-content">
            {activeTab === 'basic' && (
              <>
                <FormBlock title="Study Identification" description="Basic information to identify your clinical study">
                  <TextField
                    label="Study Name"
                    value={newStudyForm.name}
                    onChange={(value) => handleNewStudyFieldChange('name', value)}
                    placeholder="e.g., Efficacy Study 2024"
                    required
                    error={formErrors.name}
                    disabled={isCreating}
                  />
                  <TextField
                    label="Protocol Number"
                    value={newStudyForm.protocol_number}
                    onChange={(value) => handleNewStudyFieldChange('protocol_number', value)}
                    placeholder="e.g., PROTO-2024-001"
                    disabled={isCreating}
                  />
                  <TextField
                    label="Sponsor"
                    value={newStudyForm.sponsor}
                    onChange={(value) => handleNewStudyFieldChange('sponsor', value)}
                    placeholder="e.g., Pharma Corporation"
                    disabled={isCreating}
                  />
                </FormBlock>

                <FormBlock title="Study Details" description="Clinical and operational study characteristics">
                  <SelectField
                    label="Therapeutic Area"
                    value={newStudyForm.therapeutic_area}
                    options={therapeuticAreas}
                    onChange={(value) => handleNewStudyFieldChange('therapeutic_area', value)}
                    placeholder="Select therapeutic area"
                    disabled={isCreating}
                  />
                  <SelectField
                    label="Study Phase"
                    value={newStudyForm.phase}
                    options={studyPhases}
                    onChange={(value) => handleNewStudyFieldChange('phase', value)}
                    placeholder="Select study phase"
                    disabled={isCreating}
                  />
                  <TextField
                    label="Description"
                    value={newStudyForm.description}
                    onChange={(value) => handleNewStudyFieldChange('description', value)}
                    placeholder="Study description..."
                    multiline
                    rows={4}
                    disabled={isCreating}
                  />
                </FormBlock>
              </>
            )}

            {activeTab === 'standards' && (
              <>
                <FormBlock title="CDISC Standards" description="Select the CDISC implementation guide versions">
                  <SelectField
                    label="SDTM Version"
                    value={newStudyForm.sdtm_version}
                    options={sdtmVersions}
                    onChange={(value) => handleNewStudyFieldChange('sdtm_version', value)}
                    placeholder="Select SDTM version"
                    disabled={isCreating}
                  />
                  <SelectField
                    label="ADaM IG Version"
                    value={newStudyForm.adam_ig_version}
                    options={adamVersions}
                    onChange={(value) => handleNewStudyFieldChange('adam_ig_version', value)}
                    placeholder="Select ADaM IG version"
                    disabled={isCreating}
                  />
                  <SelectField
                    label="MedDRA Version"
                    value={newStudyForm.meddra_version}
                    options={medraVersions}
                    onChange={(value) => handleNewStudyFieldChange('meddra_version', value)}
                    placeholder="Select MedDRA version"
                    disabled={isCreating}
                  />
                </FormBlock>
              </>
            )}

            {activeTab === 'datasets' && (
              <>
                <FormBlock title="ADAM Datasets" description="Select datasets to generate for this study (optional)">
                  <div className="dataset-selection">
                    {adamDatasets.map((dataset) => {
                      const selected = newStudyForm.selectedDatasets.includes(dataset.value);
                      return (
                        <label key={dataset.value} className="dataset-checkbox">
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={isCreating}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) {
                                handleNewStudyFieldChange('selectedDatasets', [...newStudyForm.selectedDatasets, dataset.value]);
                              } else {
                                handleNewStudyFieldChange('selectedDatasets', newStudyForm.selectedDatasets.filter(d => d !== dataset.value));
                              }
                            }}
                          />
                          <div className="dataset-info">
                            <span className="dataset-name">{dataset.label}</span>
                            <span className="dataset-description">{dataset.description}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </FormBlock>
              </>
            )}
          </div>

          {/* Save Study Information Button */}
          <div className="save-study-button-container">
            <button
              type="button"
              className="btn btn-primary btn-save-study"
              onClick={handleStoreStudyDetails}
              disabled={isCreating || !newStudyForm.name.trim()}
            >
              {isCreating ? (
                <>
                  <Loader2 className="spinner" size={20} />
                  Saving Study Information...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Save Study Information
                </>
              )}
            </button>
            {!newStudyForm.name.trim() && (
              <p className="save-button-help-text">
                Please enter a study name to save
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="enter-study-details-page">
      {/* Study Selector Header */}
      <div className="study-selector-container">
        <StudySelector value={currentStudyId} showCreateButton={true} />
        {isSaving && (
          <div className="saving-indicator">
            <Loader2 className="spinner" size={16} />
            <span>Saving...</span>
          </div>
        )}
        {currentStudyId && (
          <button
            className="btn btn-secondary create-new-study-banner-btn"
            onClick={async () => {
              await setCurrentStudy(null);
              setActiveTab('basic');
              message.info('Switched to Create New Study mode');
            }}
            style={{
              marginLeft: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.625rem 1.25rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#059669';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#10b981';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Plus size={18} />
            Create New Study
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="study-tabs">
        <button
          className={`study-tab ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          <Settings size={18} />
          Enter Basic Study Info
        </button>
        <button
          className={`study-tab ${activeTab === 'standards' ? 'active' : ''}`}
          onClick={() => setActiveTab('standards')}
        >
          <Database size={18} />
          Set CDISC Standards Version
        </button>
        <button
          className={`study-tab ${activeTab === 'datasets' ? 'active' : ''}`}
          onClick={() => setActiveTab('datasets')}
        >
          <Database size={18} />
          Select ADAM Datasets to create
        </button>
        <button
          className={`study-tab ${activeTab === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveTab('documents')}
        >
          <FileText size={18} />
          Upload study Documents
        </button>
        <button
          className={`study-tab ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={18} />
          Study chatbot
        </button>
      </div>

      {/* Tab Content */}
      <div className="study-tab-content">
        {activeTab === 'basic' && (
          <>
            <FormBlock title="Study Identification" description="Basic information to identify your clinical study">
              <TextField
                label="Study Name"
                value={localStudyData?.name || ''}
                onChange={(value) => handleFieldChange('name', value)}
                placeholder="e.g., Efficacy Study 2024"
                required
              />
              <TextField
                label="Study ID"
                value={localStudyData?.id || currentStudy?.id || ''}
                onChange={() => {}}
                placeholder="Auto-generated"
                disabled
                readOnly
                helpText="Auto-generated unique identifier (read-only)"
              />
              <TextField
                label="Protocol Number"
                value={localStudyData?.protocol_number || ''}
                onChange={(value) => handleFieldChange('protocol_number', value)}
                placeholder="e.g., PROTO-2024-001"
              />
              <TextField
                label="Sponsor"
                value={localStudyData?.sponsor || ''}
                onChange={(value) => handleFieldChange('sponsor', value)}
                placeholder="e.g., Pharma Corporation"
              />
            </FormBlock>

            <FormBlock title="Study Details" description="Clinical and operational study characteristics">
              <SelectField
                label="Therapeutic Area"
                value={localStudyData?.therapeutic_area || ''}
                options={therapeuticAreas}
                onChange={(value) => handleFieldChange('therapeutic_area', value)}
                placeholder="Select therapeutic area"
              />
              <SelectField
                label="Study Phase"
                value={localStudyData?.phase || ''}
                options={studyPhases}
                onChange={(value) => handleFieldChange('phase', value)}
                placeholder="Select study phase"
              />
              <TextField
                label="Description"
                value={localStudyData?.description || ''}
                onChange={(value) => handleFieldChange('description', value)}
                placeholder="Study description..."
                multiline
                rows={4}
              />
            </FormBlock>
          </>
        )}

        {activeTab === 'standards' && (
          <>
            <FormBlock title="CDISC Standards" description="Select the CDISC implementation guide versions">
              <SelectField
                label="SDTM Version"
                value={localStudyData?.sdtm_version || ''}
                options={sdtmVersions}
                onChange={(value) => handleFieldChange('sdtm_version', value)}
                required
              />
              <SelectField
                label="ADaM IG Version"
                value={localStudyData?.adam_ig_version || ''}
                options={adamVersions}
                onChange={(value) => handleFieldChange('adam_ig_version', value)}
                required
              />
              <SelectField
                label="MedDRA Version"
                value={localStudyData?.meddra_version || ''}
                options={medraVersions}
                onChange={(value) => handleFieldChange('meddra_version', value)}
                required
              />
            </FormBlock>
          </>
        )}

        {activeTab === 'datasets' && (
          <>
            <FormBlock title="ADAM Datasets" description="Select datasets to generate for this study">
              <div className="dataset-selection">
                {adamDatasets.map((dataset) => {
                  const selected = studyDatasets.find(d => d.dataset_name === dataset.value);
                  return (
                    <label key={dataset.value} className="dataset-checkbox">
                      <input
                        type="checkbox"
                        checked={!!selected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleDatasetUpdate([
                              ...studyDatasets,
                              { dataset_name: dataset.value, language: 'Both', priority: studyDatasets.length }
                            ]);
                          } else {
                            handleDatasetUpdate(studyDatasets.filter(d => d.dataset_name !== dataset.value));
                          }
                        }}
                      />
                      <div className="dataset-info">
                        <span className="dataset-name">{dataset.label}</span>
                        <span className="dataset-description">{dataset.description}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </FormBlock>
          </>
        )}

        {activeTab === 'documents' && (
          <>
            <FormBlock title="Study Documents" description="Upload and manage study documents">
              <div className="document-upload-section">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.xlsx,.txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} />
                  Upload Document
                </button>
              </div>

              <div className="documents-list">
                {documentsLoading[currentStudyId] ? (
                  <div className="loading">Loading documents...</div>
                ) : studyDocuments.length === 0 ? (
                  <div className="empty-state">No documents uploaded yet</div>
                ) : (
                  studyDocuments.map((doc) => (
                    <div key={doc.id} className="document-item">
                      <FileText size={20} />
                      <div className="document-info">
                        <div className="document-name">{doc.original_file_name}</div>
                        <div className="document-meta">
                          <span>{doc.document_type}</span>
                          {doc.size_bytes && <span>{(doc.size_bytes / 1024).toFixed(1)} KB</span>}
                          <span className={`status status-${doc.processing_status}`}>
                            {doc.processing_status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </FormBlock>
          </>
        )}

        {activeTab === 'chat' && currentStudyId && (
          <div className="chat-tab-content">
            <StudyChatbotPanel studyId={currentStudyId} />
          </div>
        )}
      </div>
    </div>
  );
};

export default EnterStudyDetailsPageEnhanced;


