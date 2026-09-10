import { verifySessionToken } from './crypto-auth';

export type AppRole = 'admin' | 'employee' | 'viewer';
export type CurrentUser = {
  id: string;
  username: string;
  name: string;
  role: AppRole;
  storeId: string;
  dataOwnerId: string;
};

type AuthUser = { id?: string };
type Profile = { username?: string; display_name?: string };
type Membership = {
  store_id?: string;
  role?: AppRole;
  stores?: { legacy_owner_id?: string | null } | null;
};

async function supabaseJson<T>(path: string, token: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const response = await fetch(`${url}${path}`, {
    headers: { apikey: key, authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!response.ok) return null;
  return response.json() as Promise<T>;
}

export async function requireUser(request: Request): Promise<CurrentUser | null> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  // 1. Direct cryptographically signed session token
  if (token.startsWith('dm_')) {
    const verified = verifySessionToken(token);
    if (verified) {
      return {
        id: verified.id,
        username: verified.username,
        name: verified.name,
        role: verified.role,
        storeId: verified.storeId,
        dataOwnerId: verified.dataOwnerId,
      };
    }
    return null;
  }


  // 2. Supabase token fallback
  const authUser = await supabaseJson<AuthUser>('/auth/v1/user', token);
  if (!authUser?.id) return null;
  const userId = encodeURIComponent(authUser.id);
  const [profiles, memberships] = await Promise.all([
    supabaseJson<Profile[]>(
      `/rest/v1/profiles?select=username,display_name&user_id=eq.${userId}&limit=1`,
      token,
    ),
    supabaseJson<Membership[]>(
      `/rest/v1/store_members?select=store_id,role,stores(legacy_owner_id)&user_id=eq.${userId}&limit=1`,
      token,
    ),
  ]);
  const profile = profiles?.[0];
  const membership = memberships?.[0];
  if (
    !profile?.username ||
    !profile.display_name ||
    !membership?.store_id ||
    !membership.role
  )
    return null;

  return {
    id: authUser.id,
    username: profile.username,
    name: profile.display_name,
    role: membership.role,
    storeId: membership.store_id,
    dataOwnerId: membership.stores?.legacy_owner_id || authUser.id,
  };
}
