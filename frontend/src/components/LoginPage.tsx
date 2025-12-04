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

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);

    // Helper to perform the actual login request against a given URL
    const performLoginRequest = async (url: string, signal: AbortSignal) => {
      console.log('📡 Sending login request to:', url);

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

      console.log('📥 Response status:', response.status, 'ok:', response.ok, 'url:', url);

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = 'Invalid credentials';
        try {
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.detail || errorData.message || errorMessage;
            } catch {
              // If not JSON, use the text as error message if it's short
              if (errorText.length < 200) {
                errorMessage = errorText;
              }
            }
          }
        } catch (e) {
          console.error('Failed to read error response:', e);
        }

        console.error('❌ Login failed:', errorMessage, 'for url:', url);
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
        console.error('Failed to parse login response:', parseError);
        throw new Error('Server returned invalid JSON response');
      }

      return data;
    };

    try {
      console.log('🔐 Attempting login for user:', values.username);

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      let data: any;

      try {
        // First try via the frontend proxy (/api -> backend on 8002)
        data = await performLoginRequest('/api/v1/auth/login', controller.signal);
      } catch (primaryError: any) {
        console.error('Primary login via proxy failed:', primaryError);

        // Only attempt a direct backend fallback for network-style errors
        if (primaryError?.name === 'AbortError' || primaryError instanceof TypeError) {
          try {
            console.warn('Retrying login directly against backend at http://localhost:8002/api/v1/auth/login');
            data = await performLoginRequest('http://localhost:8002/api/v1/auth/login', controller.signal);
          } catch (fallbackError) {
            console.error('Fallback login attempt failed:', fallbackError);
            throw fallbackError;
          }
        } else {
          // For logical/auth errors, just rethrow
          throw primaryError;
        }
      } finally {
        clearTimeout(timeoutId);
      }

      console.log('✅ Login successful:', data.user);

      // Store token and user data
      localStorage.setItem('adam_access_token', data.access_token);
      localStorage.setItem('adam_user', JSON.stringify(data.user));

      message.success(`Welcome, ${data.user.full_name}!`);
      onLoginSuccess(data);
    } catch (error: any) {
      console.error('💥 Login error:', error);
      console.error('Error name:', error?.name);
      console.error('Error type:', error instanceof TypeError ? 'Network/CORS Error' : 'Unknown Error');
      
      if (error?.name === 'AbortError') {
        message.error('Request timed out. Please check that the backend server is running and reachable (port 8002 via /api proxy).');
      } else if (error instanceof TypeError) {
        message.error('Network error: Cannot connect to backend. Ensure the FastAPI server is running on port 8002 and the frontend proxy is configured.');
      } else {
        message.error(error?.message || 'Login failed. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="gradient-overlay"></div>
      </div>
      
      <Card className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <Lock size={48} color="#667eea" />
          </div>
          <Title level={2} className="login-title">
            ADAM AI Code Generator
          </Title>
          <Text className="login-subtitle">
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
