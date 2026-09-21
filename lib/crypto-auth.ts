// Legacy dm_ tokens were issued without checking passwords and cannot be trusted.
// Supabase Auth is now the sole session authority; keep this compatibility boundary.
export function verifySessionToken(_token: string): null { return null; }
