import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import DOMPurify from 'isomorphic-dompurify';
import { getSession, signOut } from 'next-auth/react';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// Sanitize strings against XSS before sending
function sanitize(value: unknown): unknown {
  if (typeof value === 'string')
    return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === 'object' && !(value instanceof File) && !(value instanceof Blob)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitize(v);
    return out;
  }
  return value;
}

// Request: attach JWT + sanitize body
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const session = await getSession();
    const token = (session as any)?.accessToken;
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch { /* SSR or no session */ }

  if (config.data && !(config.data instanceof FormData))
    config.data = sanitize(config.data);

  return config;
});

// Response: handle 401 with refresh, 429 warning
let refreshing: Promise<string | null> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      if (!refreshing) {
        refreshing = (async () => {
          try {
            const session = await getSession();
            const refresh = (session as any)?.refreshToken;
            if (!refresh) return null;
            const { data } = await axios.post(`${BASE_URL}/api/v1/auth/token/refresh/`, { refresh });
            return data.access as string;
          } catch { return null; }
          finally { refreshing = null; }
        })();
      }
      const newToken = await refreshing;
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      await signOut({ redirect: false });
    }

    return Promise.reject(error);
  }
);

export default api;
