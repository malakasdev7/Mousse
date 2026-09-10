import crypto from "crypto";

const DEFAULT_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "mousse_production_secure_signing_secret_99f2a01bc8";

export type SessionPayload = {
  id: string;
  username: string;
  name: string;
  role: "admin" | "employee" | "viewer";
  storeId: string;
  dataOwnerId: string;
  iat: number;
  exp: number;
};

export function signSessionToken(
  payload: Omit<SessionPayload, "iat" | "exp">,
  expiresInDays = 30
): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInDays * 24 * 60 * 60,
  };

  const payloadEncoded = Buffer.from(JSON.stringify(fullPayload)).toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", DEFAULT_SECRET)
    .update(payloadEncoded)
    .digest("base64url");

  return `dm_${payloadEncoded}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.startsWith("dm_")) return null;

  try {
    const raw = token.slice(3);
    const parts = raw.split(".");
    if (parts.length !== 2) return null;

    const [payloadEncoded, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", DEFAULT_SECRET)
      .update(payloadEncoded)
      .digest("base64url");

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(payloadEncoded, "base64url").toString("utf-8")
    ) as SessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string, salt = "mousse_salt_v1"): string {
  return crypto
    .pbkdf2Sync(password, salt, 10000, 64, "sha512")
    .toString("hex");
}
