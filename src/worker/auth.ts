const SESSION_COOKIE = "session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PBKDF2_DEFAULT_ITERATIONS = 100_000;

export interface SessionUser {
  id: string;
  email: string;
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  if (hex.length === 0 || hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) {
    throw new Error("invalid hex");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

async function derivePasswordBits(
  password: string,
  salt: Uint8Array,
  iterations: number,
  lengthBytes: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    lengthBytes * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordBits(password, salt, PBKDF2_DEFAULT_ITERATIONS, 32);
  return `pbkdf2$${PBKDF2_DEFAULT_ITERATIONS}$${toHex(salt)}$${toHex(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10_000_000) return false;
    salt = fromHex(parts[2]!);
    expected = fromHex(parts[3]!);
  } catch {
    return false;
  }
  const actual = await derivePasswordBits(password, salt, iterations, expected.length);
  return timingSafeEqual(actual, expected);
}

export function randomToken(bytes = 32): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function sessionExpiry(now = Date.now()): string {
  return new Date(now + SESSION_TTL_MS).toISOString();
}

export function isExpired(expiresAt: string, now = Date.now()): boolean {
  const t = new Date(expiresAt).getTime();
  return Number.isNaN(t) || t <= now;
}

export function parseSessionCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name === SESSION_COOKIE && value) return value;
  }
  return null;
}

export function sessionCookie(id: string, expiresAt: string, crossSite = false): string {
  const sameSite = crossSite ? "None" : "Lax";
  return `${SESSION_COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Expires=${expiresAt}`;
}

export function clearedSessionCookie(crossSite = false): string {
  const sameSite = crossSite ? "None" : "Lax";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=0`;
}
