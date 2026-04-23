const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ApiOptions extends RequestInit {
  params?: Record<string, string>;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}${path}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += `?${qs}`;
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const res = await fetch(url, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ accessToken: string; refreshToken: string; mfaRequired?: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  verifyMfa: (code: string, sessionToken: string) =>
    api<{ accessToken: string; refreshToken: string }>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ code, sessionToken }),
    }),
  ssoRedirect: (provider: 'google' | 'microsoft') =>
    `${API_BASE}/auth/sso/${provider}`,
  me: () => api<{ id: string; email: string; firstName: string; roles: string[] }>('/auth/me'),
};
