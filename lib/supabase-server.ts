import { NextResponse } from 'next/server';

export const noStore = { 'cache-control': 'private, no-store' };
export function authConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('AUTH_UNAVAILABLE');
  return { url, key };
}
export function readCookie(request: Request, name: string) {
  const value = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return value ? decodeURIComponent(value.slice(name.length + 1)) : '';
}
export function accessToken(request: Request) {
  return readCookie(request, 'dm_access') || request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1] || '';
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
export async function supabaseRequest(path: string, token: string, init: RequestInit = {}) {
  const { url, key } = authConfig();
  const headers = new Headers(init.headers);
  headers.set('apikey', key);
  if (token) headers.set('authorization', `Bearer ${token}`);
  headers.set('content-type', 'application/json');
  return fetch(url + path, { ...init, headers, cache: 'no-store', signal: AbortSignal.timeout(15000) });
}
export function sessionResponse(session: {access_token: string; refresh_token: string; expires_in?: number} | null) {
  const response = NextResponse.json({ ok: true }, { headers: noStore });
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
  response.cookies.set('dm_access', session?.access_token || '', { ...options, maxAge: session ? (session.expires_in || 3600) : 0 });
  response.cookies.set('dm_refresh', session?.refresh_token || '', { ...options, maxAge: session ? 60 * 60 * 24 * 30 : 0 });
  return response;
}
