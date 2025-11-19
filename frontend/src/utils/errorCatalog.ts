import type { AxiosError } from 'axios';

export interface UserFacingError {
  code: string;
  title: string;
  message: string;
  suggestion?: string;
}

const ERROR_LIBRARY: Record<string, UserFacingError> = {
  NETWORK: {
    code: 'NETWORK',
    title: 'Connection Issue',
    message: 'We could not reach the ADAM AI backend.',
    suggestion: 'Check your VPN or network connection and try again.',
  },
  TIMEOUT: {
    code: 'TIMEOUT',
    title: 'Request Timeout',
    message: 'The request is taking longer than expected.',
    suggestion: 'Retry in a moment or reduce the batch size.',
  },
  VALIDATION: {
    code: 'VALIDATION',
    title: 'Validation Error',
    message: 'Some of the submitted inputs are invalid.',
    suggestion: 'Review the highlighted fields and correct the values.',
  },
  SERVER: {
    code: 'SERVER',
    title: 'Server Error',
    message: 'An unexpected error occurred on the server.',
    suggestion: 'Check backend logs or try again after a short break.',
  },
  UNKNOWN: {
    code: 'UNKNOWN',
    title: 'Unexpected Error',
    message: 'An unknown error occurred.',
    suggestion: 'Retry the action or contact the ADAM AI team.',
  },
};

const mapStatusToCode = (status?: number) => {
  if (!status) return 'UNKNOWN';
  if (status >= 500) return 'SERVER';
  if (status === 408 || status === 504) return 'TIMEOUT';
  if (status === 400 || status === 422) return 'VALIDATION';
  if (status === 401 || status === 403) {
    return 'VALIDATION';
  }
  return 'UNKNOWN';
};

export const translateError = (error: unknown, context?: string): UserFacingError => {
  const base = { ...ERROR_LIBRARY.UNKNOWN };

  if ((error as any)?.code === 'ECONNABORTED') {
    return { ...ERROR_LIBRARY.TIMEOUT, message: 'The request timed out before finishing.', suggestion: 'Retry in a moment.' };
  }

  const axiosError = error as AxiosError;
  if (axiosError?.isAxiosError) {
    if (!navigator.onLine || axiosError.code === 'ERR_NETWORK') {
      return { ...ERROR_LIBRARY.NETWORK };
    }

    const status = axiosError.response?.status;
    const code = mapStatusToCode(status);
    const catalogEntry = ERROR_LIBRARY[code] || base;
    const detail = (axiosError.response?.data as any)?.detail || axiosError.message;
    return {
      ...catalogEntry,
      message: detail ? `${catalogEntry.message} (${detail})` : catalogEntry.message,
    };
  }

  if (error instanceof Error) {
    return {
      ...base,
      message: error.message,
    };
  }

  return context
    ? { ...base, message: `${base.message} (${context})` }
    : base;
};
