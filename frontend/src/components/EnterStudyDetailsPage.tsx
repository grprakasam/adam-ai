import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { FormBlock } from './FormBlock';
import { TextField } from './TextField';
import { SelectField } from './SelectField';
import { useProjectStore } from '../store/projectStore';
import { showFileUploadConfirmation } from './ConfirmationDialog';
import './EnterStudyDetailsPage.css';

interface EnterStudyDetailsPageProps {
  onBack?: () => void;
}

const EnterStudyDetailsPage: React.FC<EnterStudyDetailsPageProps> = ({ onBack }) => {
  const specificationFile = useProjectStore((state) => state.specificationFile);
  const setSpecificationFile = useProjectStore((state) => state.setSpecificationFile);
  const setTempSpecFile = useProjectStore((state) => state.setTempSpecFile);
  const projectConfig = useProjectStore((state) => state.projectConfig);
  const setProjectConfig = useProjectStore((state) => state.setProjectConfig);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Standards version state
  const sdtmVersion = useProjectStore((state) => state.sdtmVersion);
  const adamIgVersion = useProjectStore((state) => state.adamIgVersion);
  const medraVersion = useProjectStore((state) => state.medraVersion);
  const setStandards = useProjectStore((state) => state.setStandards);

  // Tab state for the steps within this page
  const [activeStep, setActiveStep] = useState<'project' | 'specification' | 'standards' | 'dataset'>('project');

  // Validate Study ID length
  const studyIdError = projectConfig.studyId && projectConfig.studyId.trim().length > 0 && projectConfig.studyId.trim().length < 3
    ? 'Study ID must be at least 3 characters'
    : undefined;

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

  const programmingLanguages = [
    { value: 'R', label: 'R (Recommended)' },
    { value: 'SAS', label: 'SAS' },
  ];

  const sdtmVersions = [
    { value: 'SDTM v2.0', label: 'SDTM v2.0 (Latest)' },
    { value: 'SDTM v1.7', label: 'SDTM v1.7' },
    { value: 'SDTM v1.6', label: 'SDTM v1.6' },
    { value: 'SDTM v1.5', label: 'SDTM v1.5' },
    { value: 'SDTM v1.4', label: 'SDTM v1.4' },
  ];

  const adamVersions = [
    { value: 'ADaM IG v1.3', label: 'ADaM IG v1.3 (Latest)' },
    { value: 'ADaM IG v1.2', label: 'ADaM IG v1.2' },
    { value: 'ADaM IG v1.1', label: 'ADaM IG v1.1' },
    { value: 'ADaM IG v1.0', label: 'ADaM IG v1.0' },
  ];

  const medraVersions = [
    { value: 'MedDRA v27.1', label: 'MedDRA v27.1 (Latest)' },
    { value: 'MedDRA v27.0', label: 'MedDRA v27.0' },
    { value: 'MedDRA v26.1', label: 'MedDRA v26.1' },
    { value: 'MedDRA v26.0', label: 'MedDRA v26.0' },
    { value: 'MedDRA v25.1', label: 'MedDRA v25.1' },
    { value: 'MedDRA v25.0', label: 'MedDRA v25.0' },
  ];

  const adamDatasets = [
    { value: 'ADSL', label: 'ADSL', description: 'Subject Level Analysis Dataset' },
    { value: 'ADAE', label: 'ADAE', description: 'Adverse Events Analysis Dataset' },
    { value: 'ADLB', label: 'ADLB', description: 'Laboratory Analysis Dataset' },
  ];

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if it's an Excel file
      const validExtensions = ['.xlsx', '.xls'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

      if (!validExtensions.includes(fileExtension)) {
        alert('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }

      // Function to update the file
      const updateFile = () => {
        const filePath = `Content/UserInputs/ADAMSpecifications/${file.name}`;

        setSpecificationFile({
          name: file.name,
          path: filePath,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        });
        // Store the transient file blob for later upload during analysis
        setTempSpecFile(file);
      };

      // If there's already a file uploaded (and it's not the default), show confirmation
      if (specificationFile && !specificationFile.isDefault) {
        await showFileUploadConfirmation(file.name, updateFile);
      } else {
        // No existing file or it's the default, upload directly
        updateFile();
      }
    }
  };

  // Set default file on component mount if no file is uploaded
  React.useEffect(() => {
    if (!specificationFile) {
      // Default to specification file in Content\UserInputs
      setSpecificationFile({
        name: 'ADSLSpec.xlsx',
        path: 'Content/UserInputs/ADAMSpecifications/ADSLSpec.xlsx',
        size: 0,
        uploadedAt: new Date().toISOString(),
        isDefault: true,
      });
    }
  }, [specificationFile, setSpecificationFile]);

  return (
    <div className="enter-study-details-page">
      {/* Step Navigation */}
      <div className="steps-navigation">
        <button
          className={`step-button ${activeStep === 'project' ? 'active' : ''} ${projectConfig.studyId ? 'completed' : ''}`}
          onClick={() => setActiveStep('project')}
        >
          <div className="step-icon">📋</div>
          <div className="step-label">Enter Project Information</div>
          {projectConfig.studyId && <div className="step-check">✓</div>}
        </button>
        <button
          className={`step-button ${activeStep === 'specification' ? 'active' : ''} ${specificationFile ? 'completed' : ''}`}
          onClick={() => setActiveStep('specification')}
        >
          <div className="step-icon">📄</div>
          <div className="step-label">Upload ADAM Specification</div>
          {specificationFile && <div className="step-check">✓</div>}
        </button>
        <button
          className={`step-button ${activeStep === 'standards' ? 'active' : ''} ${sdtmVersion && adamIgVersion ? 'completed' : ''}`}
          onClick={() => setActiveStep('standards')}
        >
          <div className="step-icon">⚙️</div>
          <div className="step-label">Choose Standards Version</div>
          {sdtmVersion && adamIgVersion && <div className="step-check">✓</div>}
        </button>
        <button
          className={`step-button ${activeStep === 'dataset' ? 'active' : ''} ${projectConfig.adamDataset ? 'completed' : ''}`}
          onClick={() => setActiveStep('dataset')}
        >
          <div className="step-icon">📊</div>
          <div className="step-label">Specify ADAM Dataset Name</div>
          {projectConfig.adamDataset && <div className="step-check">✓</div>}
        </button>
      </div>

      {/* Step Content */}
      <div className="page-content">
        {activeStep === 'project' && (
          <>
            <FormBlock
              title="Study Identification"
              description="Basic information to identify your clinical study"
            >
              <TextField
                label="Study ID"
                value={projectConfig.studyId}
                onChange={(value) => setProjectConfig({ studyId: value })}
                placeholder="e.g., CDISC01"
                required
                error={studyIdError}
                helpText="Unique identifier for your clinical study (minimum 3 characters)"
              />
              <TextField
                label="Protocol Number"
                value={projectConfig.protocolNumber}
                onChange={(value) => setProjectConfig({ protocolNumber: value })}
                placeholder="e.g., PROTO-2024-001"
                helpText="Official protocol document number"
              />
              <TextField
                label="Sponsor"
                value={projectConfig.sponsor}
                onChange={(value) => setProjectConfig({ sponsor: value })}
                placeholder="e.g., Pharma Corporation"
                helpText="Organization sponsoring the study"
              />
            </FormBlock>

            <FormBlock
              title="Study Details"
              description="Clinical and operational study characteristics"
            >
              <SelectField
                label="Therapeutic Area"
                value={projectConfig.therapeuticArea}
                options={therapeuticAreas}
                onChange={(value) => setProjectConfig({ therapeuticArea: value })}
                placeholder="Select therapeutic area"
                helpText="Primary disease or condition being studied"
              />
              <SelectField
                label="Study Phase"
                value={projectConfig.studyPhase}
                options={studyPhases}
                onChange={(value) => setProjectConfig({ studyPhase: value })}
                placeholder="Select study phase"
                helpText="Clinical development phase"
              />
              <SelectField
                label="Programming Language"
                value={projectConfig.programmingLanguage}
                options={programmingLanguages}
                onChange={(value) => setProjectConfig({ programmingLanguage: value })}
                helpText="Language for generated code"
              />
            </FormBlock>

            <div className="contextual-help">
              <h4>Project information tips</h4>
              <ul>
                <li>Provide the study ID, sponsor, and therapeutic area exactly as they appear in the protocol.</li>
                <li>Optional fields such as phase and indication help tailor the generation prompt.</li>
              </ul>
            </div>
          </>
        )}

        {activeStep === 'specification' && (
          <>
            <FormBlock
              title="Upload ADAM Specification"
              description="Upload the Excel specification file for ADAM dataset generation"
            >
              <div className="upload-section">
                <div className="upload-info">
                  <FileSpreadsheet size={48} className="upload-icon" />
                  <p className="upload-description">
                    Select an Excel file (.xlsx or .xls) containing the ADAM dataset specifications.
                    This file is required for code generation.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  className="btn btn-secondary btn-browse"
                  onClick={handleBrowseClick}
                >
                  <Upload size={18} />
                  Browse
                </button>

                {specificationFile && (
                  <div className="file-status">
                    <CheckCircle2 size={20} className="status-icon" />
                    <div className="file-info">
                      <span className="file-name">{specificationFile.name}</span>
                      {specificationFile.isDefault && (
                        <span className="file-badge">Default</span>
                      )}
                      <span className="file-path">{specificationFile.path}</span>
                    </div>
                  </div>
                )}
              </div>
            </FormBlock>

            <div className="contextual-help">
              <h4>Upload the ADaM specification</h4>
              <ul>
                <li>Only XLSX/XLS files are accepted. Use the template from Content/UserInputs/ADAMSpecifications.</li>
                <li>After uploading, confirm the sheet name matches the dataset (e.g., ADSL, ADAE).</li>
              </ul>
            </div>
          </>
        )}

        {activeStep === 'standards' && (
          <>
            <FormBlock
              title="CDISC Standards"
              description="Select the CDISC implementation guide versions for your study"
              helpText="These versions determine the structure and rules applied to your data"
            >
              <SelectField
                label="SDTM Version"
                value={sdtmVersion}
                options={sdtmVersions}
                onChange={(value) => setStandards({ sdtmVersion: value })}
                required
                helpText="Study Data Tabulation Model version"
              />
              <SelectField
                label="ADaM IG Version"
                value={adamIgVersion}
                options={adamVersions}
                onChange={(value) => setStandards({ adamIgVersion: value })}
                required
                helpText="Analysis Data Model Implementation Guide version"
              />
            </FormBlock>

            <FormBlock
              title="Medical Dictionaries"
              description="Select the controlled terminology versions"
            >
              <SelectField
                label="MedDRA Version"
                value={medraVersion}
                options={medraVersions}
                onChange={(value) => setStandards({ medraVersion: value })}
                required
                helpText="Medical Dictionary for Regulatory Activities version"
              />
            </FormBlock>

            <div className="contextual-help">
              <h4>Choose CDISC versions</h4>
              <ul>
                <li>Select SDTM, ADaM IG, and MedDRA versions that match the protocol amendment.</li>
                <li>Changing versions will re-run the validation checks automatically.</li>
              </ul>
            </div>
          </>
        )}

        {activeStep === 'dataset' && (
          <>
            <FormBlock
              title="ADAM Dataset to be Generated"
              description="Select the ADAM dataset you want to generate"
            >
              <div className="radio-group">
                <div className="radio-options">
                  {adamDatasets.map((dataset) => (
                    <label key={dataset.value} className="radio-option">
                      <input
                        type="radio"
                        name="adamDataset"
                        value={dataset.value}
                        checked={projectConfig.adamDataset === dataset.value}
                        onChange={(e) => setProjectConfig({ adamDataset: e.target.value })}
                        className="radio-input"
                      />
                      <div className="radio-content">
                        <span className="radio-label">{dataset.label}</span>
                        <span className="radio-description">{dataset.description}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </FormBlock>

            <div className="contextual-help">
              <h4>Confirm dataset name</h4>
              <ul>
                <li>Use uppercase dataset names (ADSL, ADAE, BDS, OCCDS).</li>
                <li>The dataset selection drives validation and traceability outputs.</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EnterStudyDetailsPage;

