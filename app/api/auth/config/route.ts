export async function GET() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey)
    return Response.json(
      { error: 'Autenticação não configurada.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  return Response.json(
    { url, publishableKey },
    { headers: { 'cache-control': 'public, max-age=300' } },
  );
}

