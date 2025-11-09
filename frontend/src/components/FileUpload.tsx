import React, { useRef } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import './FileUpload.css';

interface FileUploadProps {
  label: string;
  value: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in MB
  error?: string;
  helpText?: string;
  required?: boolean;
  id?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  value,
  onChange,
  accept,
  multiple = false,
  maxSize = 10,
  error,
  helpText,
  required = false,
  id,
}) => {
  const fieldId = id || `fileupload-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((file) => {
      const sizeMB = file.size / 1024 / 1024;
      return sizeMB <= maxSize;
    });

    if (multiple) {
      onChange([...value, ...validFiles]);
    } else {
      onChange(validFiles.slice(0, 1));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="file-upload-field">
      <label htmlFor={fieldId} className={`label ${required ? 'label-required' : ''}`}>
        {label}
      </label>

      <div
        className={`file-upload-zone ${isDragging ? 'dragging' : ''} ${error ? 'input-error' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <Upload size={32} className="upload-icon" />
        <div className="upload-text">
          <span className="upload-primary">Click to upload</span>
          <span className="upload-secondary">or drag and drop</span>
        </div>
        <span className="upload-meta">
          {accept ? `${accept.toUpperCase()} files` : 'Any file type'} (max {maxSize}MB)
        </span>
      </div>

      <input
        ref={inputRef}
        id={fieldId}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => handleFiles(e.target.files)}
        className="file-input"
        aria-describedby={helpText ? `${fieldId}-help` : error ? `${fieldId}-error` : undefined}
        required={required}
      />

      {value.length > 0 && (
        <div className="file-list">
          {value.map((file, index) => (
            <div key={index} className="file-item">
              <FileText size={16} className="file-icon" />
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{formatFileSize(file.size)}</span>
              </div>
              <button
                type="button"
                className="file-remove"
                onClick={() => removeFile(index)}
                aria-label={`Remove ${file.name}`}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {helpText && !error && (
        <span id={`${fieldId}-help`} className="help-text">
          {helpText}
        </span>
      )}
      {error && (
        <span id={`${fieldId}-error`} className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
