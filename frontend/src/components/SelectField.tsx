import React, { SelectHTMLAttributes } from 'react';
import './SelectField.css';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  error?: string;
  helpText?: string;
  required?: boolean;
  placeholder?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  options,
  onChange,
  error,
  helpText,
  required = false,
  placeholder = 'Select an option',
  id,
  ...selectProps
}) => {
  const selectId = id || `selectfield-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="select-field">
      <label htmlFor={selectId} className={`label ${required ? 'label-required' : ''}`}>
        {label}
      </label>
      <select
        id={selectId}
        value={value || ''}
        onChange={(e) => {
          if (!selectProps.disabled) {
            console.log(`SelectField: ${label} value changed to:`, e.target.value); // Debug log
            onChange(e.target.value);
          }
        }}
        className={`select ${error ? 'input-error' : ''} ${selectProps.disabled ? 'select-disabled' : ''}`}
        aria-describedby={helpText ? `${selectId}-help` : error ? `${selectId}-error` : undefined}
        aria-invalid={!!error}
        required={required}
        tabIndex={selectProps.disabled ? -1 : 0}
        {...selectProps}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {helpText && !error && (
        <span id={`${selectId}-help`} className="help-text">
          {helpText}
        </span>
      )}
      {error && (
        <span id={`${selectId}-error`} className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
