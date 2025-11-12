import React, { useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { FormBlock } from '../FormBlock';
import { useProjectStore } from '../../store/projectStore';
import { showFileUploadConfirmation } from '../ConfirmationDialog';
import './SpecificationUploadTab.css';

const SpecificationUploadTab: React.FC = () => {
  const specificationFile = useProjectStore((state) => state.specificationFile);
  const setSpecificationFile = useProjectStore((state) => state.setSpecificationFile);
  const setTempSpecFile = useProjectStore((state) => state.setTempSpecFile);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <div className="tab-container">
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
    </div>
  );
};

export default SpecificationUploadTab;
