export async function GET() {
  const url = process.env.SUPABASE_URL || '';
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';
  return Response.json(
    {
      configured: Boolean(url && publishableKey),
      url,
      publishableKey,
      defaultUser: {
        username: 'Gustavo',
        password: 'admin',
      },
    },
    { headers: { 'cache-control': 'public, max-age=300' } },
  );
}


