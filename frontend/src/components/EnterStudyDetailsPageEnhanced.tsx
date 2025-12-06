import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, MessageSquare, Settings, Database, Loader2, Save, Trash2 } from 'lucide-react';
import { StudyChatbotPanel } from './StudyChatbotPanel';
import { useStudyStore, Study } from '../store/studyStore';
import { useProjectStore } from '../store/projectStore';
import { message, Popconfirm } from 'antd';
import { FormBlock } from './FormBlock';
import { TextField } from './TextField';
import { SelectField } from './SelectField';
import { adamApi } from '../services/api';
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

const EnterStudyDetailsPageEnhanced: React.FC<EnterStudyDetailsPageEnhancedProps> = ({ onStudyCreated }) => {
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
    deleteDocument,
    createStudy,
    loadStudies,
    updateDatasetSelections
  } = useStudyStore();

  const { setSpecificationFile, setProjectConfig, setCategorizedVariables, setTempSpecFile } = useProjectStore();

  const [activeTab, setActiveTab] = useState<TabType>('basic');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
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
    if (!file) return;
    if (!currentStudyId) {
      message.warning('Select or create a study before uploading documents.');
      return;
    }

    // Check if it's an Excel file for specification
    const isExcelFile = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    // Show immediate loading feedback
    setIsUploading(true);
    const loadingMessage = message.loading(`Uploading "${file.name}"...`, 0);

    try {
      setUploadProgress({ [file.name]: 0 });

      console.log('Starting upload for file:', file.name);

      const uploadedDoc = await uploadDocument(
        currentStudyId,
        file,
        isExcelFile ? 'SPECIFICATION' : 'GENERAL',
        undefined,
        undefined,
        `Uploaded ${file.name}`
      );

      console.log('Upload response:', uploadedDoc);

      setUploadProgress({ [file.name]: 100 });

      // Reload documents to get the updated list
      await loadStudyDocuments(currentStudyId);
      console.log('Documents reloaded');

      // Hide loading message
      loadingMessage();

      // If it's an Excel specification file, also set it in projectStore for pair programming
      if (isExcelFile && uploadedDoc) {
        // Store the temp file for categorization
        setTempSpecFile(file);

        setSpecificationFile({
          name: uploadedDoc.original_file_name,
          path: uploadedDoc.storage_path,
          size: uploadedDoc.size_bytes || file.size,
          uploadedAt: uploadedDoc.uploaded_at,
          isDefault: true, // Mark as server-accessible for re-categorization
        });

        // Also update project config with study context
        setProjectConfig({
          studyId: currentStudyId,
          studyName: currentStudy?.name,
          studyPhase: currentStudy?.phase,
          adamDataset: 'ADSL', // Default to ADSL
        } as any);

        console.log('Specification file set in project store');

        // Trigger automatic categorization
        try {
          const categorizationMessage = message.loading('Categorizing variables...', 0);

          // Call categorization API
          const categorizationResult = await adamApi.categorizeSpecificationFile(
            file,
            'ADSL', // Default dataset type
            { timeoutMs: 120000 }
          );

          categorizationMessage();

          console.log('=== CATEGORIZATION COMPLETED ===');
          console.log('Total variables:', categorizationResult.total_variables);
          console.log('Categories:', categorizationResult.categories.length);
          console.log('Full result:', categorizationResult);

          // Save categorization result to project store
          setCategorizedVariables(categorizationResult);
          console.log('Categorization result saved to project store');

          // Show success message with categorization info
          const totalVariables = categorizationResult?.total_variables || 0;
          const categoryCount = categorizationResult?.categories?.length || 0;

          message.success({
            content: (
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>✅ Specification uploaded & categorized!</div>
                <div style={{ fontSize: '0.875rem', color: '#059669', marginBottom: '0.25rem' }}>
                  📊 File: {file.name}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#059669', marginBottom: '0.25rem' }}>
                  📋 Variables: {totalVariables} found and categorized into {categoryCount} categories
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  Ready for pair programming! Navigate to "Variables Analysis" tab to review and generate code.
                </div>
              </div>
            ),
            duration: 10,
          });
        } catch (catError: any) {
          console.error('Categorization error:', catError);
          // Still show success for upload, but warn about categorization
          message.warning({
            content: (
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>⚠️ File uploaded but categorization failed</div>
                <div style={{ fontSize: '0.875rem', color: '#d97706' }}>
                  📊 File: {file.name}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#d97706', marginTop: '0.25rem' }}>
                  Error: {catError.message || 'Unknown error'}
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
                  You can manually categorize from the Variables Analysis tab.
                </div>
              </div>
            ),
            duration: 8,
          });
        }
      } else {
        message.success({
          content: (
            <div>
              <div style={{ fontWeight: 600 }}>✅ Document uploaded successfully!</div>
              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                {file.name}
              </div>
            </div>
          ),
          duration: 4,
        });
      }

      // Clear progress after delay
      setTimeout(() => setUploadProgress({}), 2000);
    } catch (error: any) {
      console.error('Error uploading file:', error);

      // Hide loading message
      loadingMessage();

      // Show detailed error
      const errorMessage = error?.response?.data?.detail || error?.message || 'Unknown error occurred';
      message.error({
        content: (
          <div>
            <div style={{ fontWeight: 600 }}>❌ Upload Failed</div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              {errorMessage}
            </div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#9ca3af' }}>
              Please try again or contact support if the issue persists.
            </div>
          </div>
        ),
        duration: 6,
      });
      setUploadProgress({});
    } finally {
      setIsUploading(false);

      // Reset file input
      if (event.target) {
        event.target.value = '';
      }
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
      {/* Current Study Header */}
      <div className="study-header-container">
        <div className="current-study-info">
          <h2>{localStudyData?.name || currentStudy?.name || 'Study Details'}</h2>
          <p className="study-id-display">Study ID: {currentStudyId}</p>
        </div>
        {isSaving && (
          <div className="saving-indicator">
            <Loader2 className="spinner" size={16} />
            <span>Saving...</span>
          </div>
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
                onChange={() => { }}
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
                  accept=".pdf,.docx,.xlsx,.xls,.txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    style={{
                      opacity: isUploading ? 0.6 : 1,
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      justifyContent: 'center'
                    }}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={18} className="spinner" style={{ animation: 'spin 1s linear infinite' }} />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={18} />
                        Upload Document
                      </>
                    )}
                  </button>
                  <div style={{
                    padding: '0.75rem 1rem',
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    color: '#0369a1'
                  }}>
                    <strong>💡 Tip:</strong> Upload your ADAM specification Excel file (.xlsx or .xls) to enable pair programming and code generation.
                  </div>
                </div>
              </div>

              <div className="documents-list">
                {documentsLoading[currentStudyId] ? (
                  <div className="loading">Loading documents...</div>
                ) : studyDocuments.length === 0 ? (
                  <div className="empty-state">No documents uploaded yet</div>
                ) : (
                  studyDocuments.map((doc) => {
                    const isActiveSpec = doc.document_type === 'SPECIFICATION';

                    const handleDeleteDocument = async () => {
                      try {
                        await deleteDocument(currentStudyId, doc.id);
                        message.success(`Document "${doc.original_file_name}" deleted`);
                        // Reload documents
                        await loadStudyDocuments(currentStudyId, true);
                      } catch (error: any) {
                        message.error(error?.message || 'Failed to delete document');
                      }
                    };

                    return (
                      <div key={doc.id} className="document-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
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
                        <Popconfirm
                          title={isActiveSpec ? "Delete Specification File?" : "Delete this document?"}
                          description={
                            isActiveSpec
                              ? "This is an active specification file. Deleting it may affect pair programming. Continue?"
                              : `Are you sure you want to delete "${doc.original_file_name}"?`
                          }
                          onConfirm={handleDeleteDocument}
                          okText="Delete"
                          cancelText="Cancel"
                          okButtonProps={{ danger: true }}
                        >
                          <button
                            type="button"
                            className="btn btn-icon btn-danger-subtle"
                            title="Delete document"
                            style={{
                              padding: '0.5rem',
                              background: 'transparent',
                              border: '1px solid transparent',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              color: '#6b7280',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#fee2e2';
                              e.currentTarget.style.color = '#dc2626';
                              e.currentTarget.style.borderColor = '#fecaca';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#6b7280';
                              e.currentTarget.style.borderColor = 'transparent';
                            }}
                          >
                            <Trash2 size={18} />
                          </button>
                        </Popconfirm>
                      </div>
                    );
                  })
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


