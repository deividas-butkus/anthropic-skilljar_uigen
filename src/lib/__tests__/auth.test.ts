// @vitest-environment node
import { test, expect, vi, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const cookieStore = {
  store: new Map<string, { value: string; options?: unknown }>(),
  get(name: string) {
    const entry = this.store.get(name);
    return entry ? { name, value: entry.value } : undefined;
  },
  set(name: string, value: string, options?: unknown) {
    this.store.set(name, { value, options });
  },
  delete(name: string) {
    this.store.delete(name);
  },
};

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

beforeEach(() => {
  cookieStore.store.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const COOKIE_NAME = "auth-token";

async function importAuth() {
  return await import("../auth");
}

test("createSession sets an auth-token cookie that getSession can read back", async () => {
  const { createSession, getSession } = await importAuth();

  await createSession("user-123", "alice@example.com");

  const session = await getSession();
  expect(session).not.toBeNull();
  expect(session?.userId).toBe("user-123");
  expect(session?.email).toBe("alice@example.com");
});

test("createSession sets cookie with httpOnly and 7-day expiry", async () => {
  const { createSession } = await importAuth();

  const before = Date.now();
  await createSession("u1", "a@b.com");
  const after = Date.now();

  const entry = cookieStore.store.get(COOKIE_NAME)!;
  expect(entry).toBeDefined();
  const opts = entry.options as {
    httpOnly: boolean;
    sameSite: string;
    path: string;
    expires: Date;
    secure: boolean;
  };
  expect(opts.httpOnly).toBe(true);
  expect(opts.sameSite).toBe("lax");
  expect(opts.path).toBe("/");

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const expiresMs = opts.expires.getTime();
  expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(expiresMs).toBeLessThanOrEqual(after + sevenDaysMs + 1000);
});

test("getSession returns null when no cookie is set", async () => {
  const { getSession } = await importAuth();

  expect(await getSession()).toBeNull();
});

test("getSession returns null for a tampered token", async () => {
  const { createSession, getSession } = await importAuth();

  await createSession("u1", "a@b.com");
  const entry = cookieStore.store.get(COOKIE_NAME)!;
  cookieStore.store.set(COOKIE_NAME, {
    value: entry.value.slice(0, -2) + "xx",
    options: entry.options,
  });

  expect(await getSession()).toBeNull();
});

test("getSession returns null for a token signed with a different secret", async () => {
  const { getSession } = await importAuth();

  const foreignToken = await new SignJWT({ userId: "u1", email: "a@b.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(new TextEncoder().encode("a-different-secret"));

  cookieStore.store.set(COOKIE_NAME, { value: foreignToken });

  expect(await getSession()).toBeNull();
});

test("getSession returns null for an expired token", async () => {
  const { getSession } = await importAuth();

  const expired = await new SignJWT({ userId: "u1", email: "a@b.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
    .sign(new TextEncoder().encode("development-secret-key"));

  cookieStore.store.set(COOKIE_NAME, { value: expired });

  expect(await getSession()).toBeNull();
});

test("deleteSession removes the auth-token cookie", async () => {
  const { createSession, deleteSession, getSession } = await importAuth();

  await createSession("u1", "a@b.com");
  expect(await getSession()).not.toBeNull();

  await deleteSession();
  expect(cookieStore.store.has(COOKIE_NAME)).toBe(false);
  expect(await getSession()).toBeNull();
});

test("verifySession reads the token from a NextRequest", async () => {
  const { createSession, verifySession } = await importAuth();

  await createSession("u1", "a@b.com");
  const token = cookieStore.store.get(COOKIE_NAME)!.value;

  const fakeRequest = {
    cookies: {
      get: (name: string) =>
        name === COOKIE_NAME ? { name, value: token } : undefined,
    },
  } as unknown as Parameters<typeof verifySession>[0];

  const session = await verifySession(fakeRequest);
  expect(session?.userId).toBe("u1");
  expect(session?.email).toBe("a@b.com");
});

test("verifySession returns null when the request has no auth cookie", async () => {
  const { verifySession } = await importAuth();

  const fakeRequest = {
    cookies: { get: () => undefined },
  } as unknown as Parameters<typeof verifySession>[0];

  expect(await verifySession(fakeRequest)).toBeNull();
});

test("verifySession returns null for a malformed token", async () => {
  const { verifySession } = await importAuth();

  const fakeRequest = {
    cookies: {
      get: (name: string) =>
        name === COOKIE_NAME ? { name, value: "not-a-jwt" } : undefined,
    },
  } as unknown as Parameters<typeof verifySession>[0];

  expect(await verifySession(fakeRequest)).toBeNull();
});
