export async function GET() {
  return Response.json({ configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY) }, { headers: { 'cache-control': 'no-store' } });
}
