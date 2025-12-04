/**
 * Diagnostic utilities for debugging study loading issues
 */
export function checkStudyLoadingDiagnostics() {
  const diagnostics = {
    hasToken: !!localStorage.getItem('adam_access_token'),
    token: localStorage.getItem('adam_access_token')?.substring(0, 50) || 'none',
    apiBaseUrl: import.meta.env.VITE_API_URL || 'not set (using relative URLs)',
    timestamp: new Date().toISOString()
  };

  console.log('🔍 Study Loading Diagnostics:', diagnostics);
  
  return diagnostics;
}

export function testStudyApiAccess() {
  const token = localStorage.getItem('adam_access_token');
  
  if (!token) {
    console.warn('❌ No authentication token found. Please log in first.');
    return Promise.reject(new Error('No token'));
  }

  const apiUrl = import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL}/api/v1/studies`
    : '/api/v1/studies';

  console.log('🧪 Testing API access:', apiUrl);

  return fetch(apiUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then(response => {
      console.log('📡 API Response Status:', response.status);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      return response.json();
    })
    .then(studies => {
      console.log('✅ API Test Successful:', {
        count: studies.length,
        studies: studies.map((s: any) => ({ id: s.id, name: s.name }))
      });
      return studies;
    })
    .catch(error => {
      console.error('❌ API Test Failed:', error);
      throw error;
    });
}

