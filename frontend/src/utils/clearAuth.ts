/**
 * Clear any stale authentication tokens from localStorage
 * This prevents 401 errors from old/invalid tokens since auth is not implemented
 */
export function clearStaleAuthTokens() {
  if (typeof window !== 'undefined') {
    const keysToRemove = [
      'adam_access_token',
      'adam_user',
      'adam_refresh_token',
      'auth_token',
      'access_token',
    ];
    
    keysToRemove.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`[Auth Cleanup] Removing stale token: ${key}`);
        localStorage.removeItem(key);
      }
    });
  }
}
