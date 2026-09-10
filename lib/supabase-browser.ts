'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type PublicAuthConfig = { url: string; publishableKey: string };

let configPromise: Promise<PublicAuthConfig> | null = null;
let clientPromise: Promise<SupabaseClient> | null = null;

export function getAuthConfig() {
  configPromise ??= fetch('/api/auth/config', { cache: 'no-store' }).then(
    async (response) => {
      if (!response.ok) throw new Error('A autenticação está indisponível.');
      return response.json() as Promise<PublicAuthConfig>;
    },
  );
  return configPromise;
}

export function getSupabaseBrowserClient() {
  clientPromise ??= getAuthConfig().then(({ url, publishableKey }) =>
    createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }),
  );
  return clientPromise;
}

export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const client = await getSupabaseBrowserClient();
  const { data } = await client.auth.getSession();
  const headers = new Headers(init.headers);
  if (data.session?.access_token)
    headers.set('authorization', `Bearer ${data.session.access_token}`);
  return fetch(input, { ...init, headers });
}

export async function signInWithUsername(username: string, password: string) {
  const [client, config] = await Promise.all([
    getSupabaseBrowserClient(),
    getAuthConfig(),
  ]);
  const response = await fetch(`${config.url}/functions/v1/login-username`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });
  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
  } | null;
  if (!response.ok || !body?.access_token || !body.refresh_token)
    throw new Error(body?.error || 'Usuário ou senha inválidos.');
  const { error } = await client.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  });
  if (error) throw new Error('Não foi possível iniciar a sessão.');
}

