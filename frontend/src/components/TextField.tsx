import React, { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import './TextField.css';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'>, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helpText?: string;
  required?: boolean;
  multiline?: boolean;
  rows?: number;
}

export const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChange,
  error,
  helpText,
  required = false,
  multiline = false,
  rows = 4,
  id,
  disabled,
  readOnly,
  ...inputProps
}) => {
  const inputId = id || `textfield-${label.toLowerCase().replace(/\s+/g, '-')}`;

  // Ensure onChange is properly bound
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (disabled || readOnly) {
      return;
    }
    // Don't stop propagation - let the event bubble normally
    const newValue = e.target.value;
    console.log(`TextField: ${label} value changed to:`, newValue); // Debug log
    onChange(newValue);
  };


  // Remove conflicting props from inputProps
  const {
    onChange: _onChange,
    value: _value,
    id: _id,
    className: _className,
    ...restInputProps
  } = inputProps;

  const inputClassName = multiline 
    ? `input textarea ${error ? 'input-error' : ''}`
    : `input ${error ? 'input-error' : ''}`;

  return (
    <div className="text-field">
      <label htmlFor={inputId} className={`label ${required ? 'label-required' : ''}`}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={inputId}
          value={value || ''}
          onChange={handleChange}
          className={inputClassName}
          aria-describedby={helpText ? `${inputId}-help` : error ? `${inputId}-error` : undefined}
          aria-invalid={!!error}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          rows={rows}
          tabIndex={disabled || readOnly ? -1 : 0}
          autoComplete="off"
          {...(restInputProps as Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'onInput' | 'value' | 'id' | 'className'>)}
        />
      ) : (
        <input
          id={inputId}
          type="text"
          value={value || ''}
          onChange={handleChange}
          className={inputClassName}
          aria-describedby={helpText ? `${inputId}-help` : error ? `${inputId}-error` : undefined}
          aria-invalid={!!error}
          required={required}
          disabled={disabled}
          readOnly={readOnly}
          tabIndex={disabled || readOnly ? -1 : 0}
          autoComplete="off"
          {...(restInputProps as Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onInput' | 'value' | 'id' | 'className'>)}
        />
      )}
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
