import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true, // Send httpOnly cookies (refresh token)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: 夾帶 JWT Access Token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token && !token.startsWith('mock-token-') && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response interceptor: 401 自動無感刷新權杖 (Silent Token Refresh)
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 如果非 401 或屬於登入/註冊/刷新本身的請求，不進行重試
    if (
      error.response?.status !== 401 ||
      originalRequest._retry ||
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/register') ||
      originalRequest.url?.includes('/auth/refresh')
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        })
        .catch((err) => Promise.reject(err));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );

      const newAccessToken = data?.data?.accessToken;
      if (newAccessToken) {
        useAuthStore.getState().setToken(newAccessToken);
        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      }
      throw new Error('Refresh token failed');
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      useAuthStore.getState().logout();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);
