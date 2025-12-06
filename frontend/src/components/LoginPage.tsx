import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Lock } from 'lucide-react';
import './LoginPage.css';

const { Title, Text } = Typography;

interface LoginPageProps {
  onLoginSuccess: (userData: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);

    // Helper to perform the actual login request against a given URL
    const performLoginRequest = async (url: string, signal: AbortSignal) => {
      const formData = new URLSearchParams();
      formData.append('username', values.username);
      formData.append('password', values.password);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
        signal,
      });

      if (!response.ok) {
        let errorMessage = 'Invalid credentials';
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch {
              if (errorText.length < 200) {
                errorMessage = errorText;
              }
            }
          }
        } catch (e) {
          // Silent error
        }

        throw new Error(errorMessage);
      }

      const responseText = await response.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Server returned an empty response');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('Server returned invalid JSON response');
      }

      return data;
    };

    try {

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      let data: any;

      try {
        // First try via the frontend proxy (/api -> backend on 8000)
        data = await performLoginRequest('/api/v1/auth/login', controller.signal);
      } catch (primaryError: any) {
        // Only attempt a direct backend fallback for network-style errors
        if (primaryError?.name === 'AbortError' || primaryError instanceof TypeError) {
          try {
            data = await performLoginRequest('http://localhost:8000/api/v1/auth/login', controller.signal);
          } catch (fallbackError) {
            throw fallbackError;
          }
        } else {
          // For logical/auth errors, just rethrow
          throw primaryError;
        }
      } finally {
        clearTimeout(timeoutId);
      }

      // Store token and user data
      localStorage.setItem('adam_access_token', data.access_token);
      localStorage.setItem('adam_user', JSON.stringify(data.user));

      message.success(`Welcome, ${data.user.full_name}!`);
      onLoginSuccess(data);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        message.error('Request timed out. Please check that the backend server is running.');
      } else if (error instanceof TypeError) {
        message.error('Network error: Cannot connect to backend. Ensure the server is running.');
      } else {
        message.error(error?.message || 'Login failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Render error fallback
  if (renderError) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          padding: '40px',
          borderRadius: '16px',
          maxWidth: '420px',
          width: '100%'
        }}>
          <h2>Login Error</h2>
          <p>{renderError}</p>
          <button onClick={() => setRenderError(null)}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="login-container"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        padding: '20px',
        width: '100vw',
        height: '100dvh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        zIndex: 9999,
        overflow: 'auto'
      }}
    >
      <div className="login-background" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }}>
        <div className="gradient-overlay"></div>
      </div>

      <Card
        className="login-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          borderRadius: '16px',
          padding: '40px',
          position: 'relative',
          zIndex: 1,
          background: 'rgba(255, 255, 255, 0.98)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div className="login-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="login-icon" style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            marginBottom: '16px',
            boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)'
          }}>
            <Lock size={48} color="white" />
          </div>
          <Title level={2} className="login-title" style={{ margin: '16px 0 8px 0', color: '#1a202c', fontWeight: 700 }}>
            ADAM AI Code Generator
          </Title>
          <Text className="login-subtitle" style={{ color: '#718096', fontSize: '14px' }}>
            AI-Powered Clinical Programming Assistant
          </Text>
        </div>

        <Form
          name="login"
          onFinish={handleLogin}
          layout="vertical"
          requiredMark={false}
          initialValues={{ username: 'admin', password: 'admin' }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please enter your username' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Username"
              size="large"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
              size="large"
              disabled={loading}
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
              className="login-button"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          <div className="default-credentials">
            <Text type="secondary" style={{ fontSize: '12px' }}>
              <strong>Default Credentials:</strong>
            </Text>
            <div style={{ marginTop: '8px', fontSize: '11px', lineHeight: '1.6' }}>
              <div>• <strong>Admin:</strong> admin / admin</div>
              <div>• <strong>Senior Dev:</strong> developer / admin</div>
              <div>• <strong>User:</strong> user / admin</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="login-features">
        <div className="feature-item">
          <div className="feature-icon">🚀</div>
          <Text>AI-Powered Code Generation</Text>
        </div>
        <div className="feature-item">
          <div className="feature-icon">📊</div>
          <Text>CDISC Standards Compliant</Text>
        </div>
        <div className="feature-item">
          <div className="feature-icon">⚡</div>
          <Text>Real-time Collaboration</Text>
        </div>
      </div>
    </div>
  );
};
