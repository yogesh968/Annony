const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const AUTH_TOKEN_KEY = 'anonymeet_auth_token';

export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
};

const getAuthToken = () => localStorage.getItem(AUTH_TOKEN_KEY);

const buildHeaders = (customHeaders = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const request = async (path, options = {}) => {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: buildHeaders(options.headers),
    });

    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
      } catch (error) {
        console.warn('Failed to parse JSON response:', error);
        data = null;
      }
    } else {
      // Try to get text response for non-JSON errors
      try {
        const text = await response.text();
        data = text ? { message: text } : null;
      } catch (error) {
        data = null;
      }
    }

    if (!response.ok) {
      // Handle validation errors (array format from express-validator)
      let errorMessage = null;
      
      // First try to get a direct error message
      if (data?.error) {
        errorMessage = data.error;
      } else if (data?.message) {
        errorMessage = data.message;
      } 
      // Then try validation errors array
      else if (data?.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        // express-validator returns errors with 'msg' property
        errorMessage = data.errors[0].msg || data.errors[0].message;
      }
      
      // Fallback to status-based message
      if (!errorMessage) {
        errorMessage = `Request failed with status ${response.status}`;
      }
      
      console.error('API Error Details:', {
        path,
        status: response.status,
        statusText: response.statusText,
        responseData: data,
        extractedMessage: errorMessage,
      });
      
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('Network Error:', {
        path,
        baseUrl: API_BASE_URL,
        error: error.message,
      });
      throw new Error('Unable to connect to server. Please check if the backend is running.');
    }
    // Re-throw other errors
    throw error;
  }
};

export const apiClient = {
  get: (path) => request(path, { method: 'GET' }),
  post: (path, body) =>
    request(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: (path, body) =>
    request(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: (path, body) =>
    request(path, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    }),
};

export const authStorage = {
  getToken: getAuthToken,
  clear: () => localStorage.removeItem(AUTH_TOKEN_KEY),
};

