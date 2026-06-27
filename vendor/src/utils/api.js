import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vendor_token');
  const user = JSON.parse(localStorage.getItem('vendor_user') || 'null');
  const vendorId = user?.id || 'UNAUTHENTICATED';
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  console.log(`[DEBUG] API Request - VendorID: ${vendorId} | Method: ${config.method?.toUpperCase()} | URL: ${config.url}`);
  return config;
});

api.interceptors.response.use(
  (response) => {
    const user = JSON.parse(localStorage.getItem('vendor_user') || 'null');
    const vendorId = user?.id || 'UNAUTHENTICATED';
    
    console.log(`[DEBUG] API Response Success - VendorID: ${vendorId} | URL: ${response.config.url} | Status: ${response.status}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const user = JSON.parse(localStorage.getItem('vendor_user') || 'null');
    const vendorId = user?.id || 'UNAUTHENTICATED';
    
    console.error(`[DEBUG] API Response Error - VendorID: ${vendorId} | URL: ${originalRequest?.url} | Status: ${error.response?.status} | Error:`, error.response?.data || error.message);

    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('vendor_token');
      localStorage.removeItem('vendor_user');
      window.location.href = '/login';
      return Promise.reject(error);
    }
    
    // Retry failed API calls once
    if (originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      console.warn(`[RETRY] Retrying API request once for URL: ${originalRequest.url}`);
      try {
        return await api(originalRequest);
      } catch (retryErr) {
        console.error(`[RETRY FAILED] Retry failed for URL: ${originalRequest.url}`, retryErr.response?.data || retryErr.message);
        return Promise.reject(retryErr);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
