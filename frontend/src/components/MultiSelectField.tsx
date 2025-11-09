import React from 'react';
import { X } from 'lucide-react';
import './MultiSelectField.css';

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFieldProps {
  label: string;
  value: string[];
  options: MultiSelectOption[];
  onChange: (value: string[]) => void;
  error?: string;
  helpText?: string;
  required?: boolean;
  placeholder?: string;
  id?: string;
}

export const MultiSelectField: React.FC<MultiSelectFieldProps> = ({
  label,
  value,
  options,
  onChange,
  error,
  helpText,
  required = false,
  placeholder = 'Select options',
  id,
}) => {
  const fieldId = id || `multiselect-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const removeOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const getSelectedLabels = () => {
    return options.filter((opt) => value.includes(opt.value));
  };

  return (
    <div className="multi-select-field" ref={dropdownRef}>
      <label htmlFor={fieldId} className={`label ${required ? 'label-required' : ''}`}>
        {label}
      </label>
      
      <div
        className={`multi-select-trigger ${error ? 'input-error' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
      >
        {value.length === 0 ? (
          <span className="multi-select-placeholder">{placeholder}</span>
        ) : (
          <div className="multi-select-pills">
            {getSelectedLabels().map((option) => (
              <span key={option.value} className="multi-select-pill">
                {option.label}
                <button
                  type="button"
                  className="pill-remove"
                  onClick={(e) => removeOption(option.value, e)}
                  aria-label={`Remove ${option.label}`}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="multi-select-dropdown" role="listbox">
          {options.map((option) => {
            const isSelected = value.includes(option.value);
            return (
              <div
                key={option.value}
                className={`multi-select-option ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleOption(option.value)}
                role="option"
                aria-selected={isSelected}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="checkbox"
                  tabIndex={-1}
                />
                <span>{option.label}</span>
              </div>
            );
          })}
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
