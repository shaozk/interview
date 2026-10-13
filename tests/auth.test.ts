import { describe, expect, it } from "vitest";
import {
  hashPassword,
  isExpired,
  parseSessionCookie,
  randomToken,
  sessionCookie,
  sessionExpiry,
  timingSafeEqual,
  verifyPassword,
} from "../src/worker/auth";

const DUMMY_HASH = `pbkdf2$100000$${"0".repeat(32)}$${"0".repeat(64)}`;

describe("password hashing", () => {
  it("roundtrips a correct password", async () => {
    const stored = await hashPassword("s3cret-password");
    expect(await verifyPassword("s3cret-password", stored)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const stored = await hashPassword("s3cret-password");
    expect(await verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("salts so identical passwords hash differently", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
  });

  it("rejects malformed stored hashes without throwing", async () => {
    await expect(verifyPassword("x", "not-a-hash")).resolves.toBe(false);
    await expect(verifyPassword("x", "md5$abc$def$ghi")).resolves.toBe(false);
    await expect(verifyPassword("x", "pbkdf2$abc$zz$00")).resolves.toBe(false);
    await expect(verifyPassword("x", "pbkdf2$0$00$00")).resolves.toBe(false);
    await expect(verifyPassword("x", DUMMY_HASH)).resolves.toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("matches equal buffers and rejects different ones", () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false);
  });
});

describe("sessions", () => {
  it("expiry is in the future and isExpired judges correctly", () => {
    const expiresAt = sessionExpiry();
    expect(isExpired(expiresAt)).toBe(false);
    expect(isExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isExpired("not-a-date")).toBe(true);
  });

  it("randomToken is hex of the requested length and unique", () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(randomToken(32)).not.toBe(token);
  });

  it("parses the session cookie out of a cookie header", () => {
    expect(parseSessionCookie("session=abc123; other=x")).toBe("abc123");
    expect(parseSessionCookie("other=x; session=abc123")).toBe("abc123");
    expect(parseSessionCookie("other=x")).toBeNull();
    expect(parseSessionCookie(null)).toBeNull();
    expect(parseSessionCookie("session=")).toBeNull();
  });

  it("session cookie carries security attributes", () => {
    const cookie = sessionCookie("tok", "2026-11-13T00:00:00.000Z");
    expect(cookie).toContain("session=tok");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });
});
