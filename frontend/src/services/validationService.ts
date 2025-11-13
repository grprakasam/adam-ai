/**
 * Code Validation Service
 * Validates R and SAS code via the backend API
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface ValidationIssue {
  line: number;
  column: number | null;
  severity: 'error' | 'warning' | 'info' | 'style';
  message: string;
  rule?: string;
  suggestion?: string;
}

export interface ValidationResult {
  isValid: boolean;
  language: string;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  executionTime: number;
}

export interface ValidatorStatus {
  R: {
    available: boolean;
    lintr_available?: boolean;
  };
  SAS: {
    available: boolean;
    note?: string;
  };
}

export interface ValidateCodeRequest {
  code: string;
  language: 'R' | 'SAS';
  check_style?: boolean;
}

/**
 * Validate code for syntax and style issues
 */
export const validateCode = async (
  code: string,
  language: 'R' | 'SAS',
  checkStyle: boolean = true
): Promise<ValidationResult> => {
  const token = localStorage.getItem('token');
  
  try {
    const response = await axios.post<ValidationResult>(
      `${API_BASE_URL}/api/v1/validation/validate`,
      {
        code,
        language,
        check_style: checkStyle
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.detail || 'Validation failed');
    }
    throw new Error('Network error during validation');
  }
};

/**
 * Quick syntax-only check (faster, no style checking)
 */
export const quickSyntaxCheck = async (
  code: string,
  language: 'R' | 'SAS'
): Promise<{
  isValid: boolean;
  language: string;
  issues: ValidationIssue[];
  errorCount: number;
}> => {
  const token = localStorage.getItem('token');
  
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/validation/quick-check`,
      {
        code,
        language,
        check_style: false
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.detail || 'Quick check failed');
    }
    throw new Error('Network error during quick check');
  }
};

/**
 * Get validator status (which tools are available)
 */
export const getValidatorStatus = async (): Promise<ValidatorStatus> => {
  const token = localStorage.getItem('token');
  
  try {
    const response = await axios.get<ValidatorStatus>(
      `${API_BASE_URL}/api/v1/validation/status`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.detail || 'Failed to get validator status');
    }
    throw new Error('Network error');
  }
};

/**
 * Format validation issues for display
 */
export const formatValidationMessage = (issue: ValidationIssue): string => {
  const prefix = issue.column 
    ? `Line ${issue.line}, Col ${issue.column}` 
    : `Line ${issue.line}`;
  
  return `${prefix}: ${issue.message}`;
};

/**
 * Get severity icon/color for display
 */
export const getSeverityDisplay = (severity: string): {
  color: string;
  icon: string;
} => {
  switch (severity) {
    case 'error':
      return { color: 'red', icon: '❌' };
    case 'warning':
      return { color: 'orange', icon: '⚠️' };
    case 'info':
      return { color: 'blue', icon: 'ℹ️' };
    case 'style':
      return { color: 'gray', icon: '✨' };
    default:
      return { color: 'gray', icon: '•' };
  }
};

/**
 * Group issues by severity
 */
export const groupIssuesBySeverity = (issues: ValidationIssue[]): {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  style: ValidationIssue[];
} => {
  return {
    errors: issues.filter(i => i.severity === 'error'),
    warnings: issues.filter(i => i.severity === 'warning'),
    info: issues.filter(i => i.severity === 'info'),
    style: issues.filter(i => i.severity === 'style')
  };
};

export default {
  validateCode,
  quickSyntaxCheck,
  getValidatorStatus,
  formatValidationMessage,
  getSeverityDisplay,
  groupIssuesBySeverity
};
