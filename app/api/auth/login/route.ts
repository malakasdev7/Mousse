import { signSessionToken } from "@/lib/crypto-auth";

// Basic in-memory rate limiting map for login attempts
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxAttempts = 15; // Max 15 attempts per minute per IP

  const record = loginAttempts.get(ip);
  if (!record || now - record.firstAttempt > windowMs) {
    loginAttempts.set(ip, { count: 1, firstAttempt: now });
    return true;
  }

  if (record.count >= maxAttempts) {
    return false;
  }

  record.count += 1;
  return true;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Muitas tentativas de login. Aguarde um momento." },
      { status: 429 }
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      username?: string;
      password?: string;
    };

    const rawUsername = String(body.username || "Gustavo").trim();
    if (!rawUsername || rawUsername.length < 2 || rawUsername.length > 50) {
      return Response.json(
        { error: "O nome de usuário deve ter entre 2 e 50 caracteres." },
        { status: 400 }
      );
    }

    // Capitalize display name cleanly
    const name = rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1);
    const safeKey = rawUsername.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const userId = `user_${safeKey}`;
    const storeId = `store_${safeKey}`;
    const dataOwnerId = userId;

    const token = signSessionToken({
      id: userId,
      username: rawUsername,
      name: name,
      role: "admin",
      storeId: storeId,
      dataOwnerId: dataOwnerId,
    });

    return Response.json({
      access_token: token,
      user: {
        id: userId,
        username: rawUsername,
        name: name,
        role: "admin",
        storeId: storeId,
      },
    });
  } catch {
    return Response.json(
      { error: "Erro ao autenticar." },
      { status: 500 }
    );
  }
}
