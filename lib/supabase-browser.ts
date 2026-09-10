'use client';

type PublicAuthConfig = {
  configured?: boolean;
  url?: string;
  publishableKey?: string;
  defaultUser?: { username: string; password?: string };
};

let configPromise: Promise<PublicAuthConfig> | null = null;

export function getAuthConfig(): Promise<PublicAuthConfig> {
  configPromise ??= fetch('/api/auth/config', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) {
        return { configured: false, defaultUser: { username: 'Gustavo', password: 'admin' } };
      }
      return response.json() as Promise<PublicAuthConfig>;
    })
    .catch(() => ({ configured: false, defaultUser: { username: 'Gustavo', password: 'admin' } }));
  return configPromise;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('mousse_token');
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('mousse_token', token);
  } else {
    localStorage.removeItem('mousse_token');
  }
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const token = getStoredToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}

export async function signInWithUsername(username: string, password?: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: username || 'Gustavo', password: password || 'admin' }),
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    error?: string;
  } | null;
  if (!response.ok || !body?.access_token) {
    throw new Error(body?.error || 'Não foi possível entrar.');
  }
  setStoredToken(body.access_token);
}

export async function signOut() {
  setStoredToken(null);
}

export async function getSupabaseBrowserClient() {
  return {
    auth: {
      getSession: async () => {
        const token = getStoredToken();
        if (!token) return { data: { session: null }, error: null };
        return { data: { session: { access_token: token } }, error: null };
      },
      signOut: async () => {
        await signOut();
        return { error: null };
      },
      setSession: async () => ({ error: null }),
    },
  };
}


