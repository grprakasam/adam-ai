import React, { InputHTMLAttributes } from 'react';
import './TextField.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helpText?: string;
  required?: boolean;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChange,
  error,
  helpText,
  required = false,
  id,
  ...inputProps
}) => {
  const inputId = id || `textfield-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="text-field">
      <label htmlFor={inputId} className={`label ${required ? 'label-required' : ''}`}>
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`input ${error ? 'input-error' : ''}`}
        aria-describedby={helpText ? `${inputId}-help` : error ? `${inputId}-error` : undefined}
        aria-invalid={!!error}
        required={required}
        {...inputProps}
      />
      {helpText && !error && (
        <span id={`${inputId}-help`} className="help-text">
          {helpText}
        </span>
      )}
      {error && (
        <span id={`${inputId}-error`} className="error-text" role="alert">
          {error}
        </span>
      )}
    </div>
  );
};
