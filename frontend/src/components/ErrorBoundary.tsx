import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button } from 'antd';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }

    // Update state with error details
    this.setState({
      error,
      errorInfo
    });

    // Here you could send error to logging service
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div style={{
          padding: '40px',
          maxWidth: '600px',
          margin: '0 auto',
          marginTop: '60px'
        }}>
          <Result
            status="error"
            icon={<AlertTriangle size={64} color="#ff4d4f" />}
            title="Something Went Wrong"
            subTitle="We're sorry, but something unexpected happened. Please try again."
            extra={[
              <Button type="primary" key="reset" onClick={this.handleReset}>
                Try Again
              </Button>,
              <Button key="reload" onClick={this.handleReload}>
                Reload Page
              </Button>
            ]}
          >
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#f5f5f5',
                borderRadius: '4px',
                textAlign: 'left'
              }}>
                <details>
                  <summary style={{ cursor: 'pointer', marginBottom: '8px', fontWeight: 'bold' }}>
                    Error Details (Development Only)
                  </summary>
                  <div style={{
                    marginTop: '8px',
                    padding: '12px',
                    background: 'white',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    maxHeight: '200px'
                  }}>
                    <div style={{ marginBottom: '8px', color: '#cf1322' }}>
                      <strong>Error:</strong> {this.state.error.toString()}
                    </div>
                    {this.state.errorInfo && (
                      <div style={{ color: '#595959' }}>
                        <strong>Component Stack:</strong>
                        <pre style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0 0' }}>
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
