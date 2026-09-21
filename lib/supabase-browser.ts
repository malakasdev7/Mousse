'use client';
let refreshPromise: Promise<Response> | null = null;
export async function getAuthConfig() {
  const response = await fetch('/api/auth/config', { cache: 'no-store' });
  if (!response.ok) throw new Error('Autenticação indisponível.');
  return response.json();
}
export async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const send = () => fetch(input, { ...init, credentials: 'same-origin', cache: 'no-store' });
  let response = await send();
  if (response.status === 401) {
    refreshPromise ??= fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' }).finally(() => { refreshPromise = null; });
    if ((await refreshPromise).ok) response = await send();
    if (response.status === 401) window.dispatchEvent(new Event('dm:session-expired'));
  }
  return response;
}
export async function signInWithUsername(username: string, password: string) {
  const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (!response.ok) throw new Error((await response.json()).error || 'Não foi possível entrar.');
  localStorage.removeItem('mousse_token');
}
export async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' });
  localStorage.removeItem('mousse_token');
  window.dispatchEvent(new Event('dm:session-expired'));
}
async function adoptLegacySession() {
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      const session = parsed?.currentSession || parsed;
      if (!session?.access_token && !session?.refresh_token) continue;
      const response = await fetch('/api/auth/adopt-session', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }) });
      if (response.ok) { localStorage.removeItem(key); return true; }
    } catch {}
  }
  return false;
}
// Existing component API, backed by Supabase sessions in HttpOnly cookies.
export async function getSupabaseBrowserClient() {
  return { auth: {
    getSession: async () => {
      let response = await authenticatedFetch('/api/me');
      if (!response.ok && await adoptLegacySession()) response = await authenticatedFetch('/api/me');
      return { data: { session: response.ok ? { access_token: '' } : null }, error: null };
    },
    signOut: async () => { await signOut(); return { error: null }; },
    updateUser: async ({ password }: { password: string }) => {
      const response = await authenticatedFetch('/api/auth/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      return { error: response.ok ? null : new Error((await response.json()).error) };
    },
  } };
}
