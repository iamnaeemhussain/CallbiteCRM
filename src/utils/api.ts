export const TOKEN_KEY = 'callbite_staff_token';
export const USER_KEY = 'callbite_staff_user';

class ApiClient {
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem(TOKEN_KEY);
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        this.token = stored;
        return stored;
      }
    }
    return null;
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['x-callbite-token'] = token;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const isLoginEndpoint = endpoint.includes('/api/auth/login');

    if (response.status === 401 && !isLoginEndpoint) {
      this.setToken(null);
    }

    const data = await response.json().catch(() => ({ success: false, error: 'Invalid response from server' }));

    if (!response.ok || data.success === false) {
      const errorMsg = data.error || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  }

  get<T = any>(endpoint: string, queryParams?: Record<string, any>): Promise<T> {
    let url = endpoint;
    if (queryParams) {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, val]) => {
        if (val !== undefined && val !== null && val !== '') {
          params.append(key, String(val));
        }
      });
      const qs = params.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }
    return this.request<T>(url, { method: 'GET' });
  }

  post<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T = any>(endpoint: string, body?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
