import { MongoClient, ServerApiVersion } from "mongodb";

export const DB_NAME = "mommyflow";
export const SESSION_DAYS = 90;
const PBKDF2_ITERATIONS = 50000;

let clientPromise;

export function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: { "cache-control": "no-store", ...(init.headers || {}) },
  });
}

function safeString(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.message) return value.message;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function publicError(error) {
  const name = error?.name ? `${error.name}: ` : "";
  return `${name}${safeString(error?.message || "Request failed")}`
    .replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, "mongodb$1://***@")
    .slice(0, 220);
}

export function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function getDb(env) {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is not configured");
  if (!clientPromise) {
    const client = new MongoClient(env.MONGODB_URI, {
      appName: "mommyflow-cloudflare-pages",
      maxPoolSize: 1,
      connectTimeoutMS: 15000,
      serverSelectionTimeoutMS: 30000,
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    });
    clientPromise = client.connect();
  }
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export async function col(env, name) {
  return (await getDb(env)).collection(name);
}

/* ───────── crypto helpers (Web Crypto) ───────── */
function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToHex(digest);
}
export async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key, 256,
  );
  return { salt: bytesToHex(salt), hash: bytesToHex(bits) };
}
export async function verifyPassword(password, saltHex, expectedHashHex) {
  const { hash } = await hashPassword(password, saltHex);
  if (hash.length !== expectedHashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  return diff === 0;
}
export function randomToken(byteLength = 24) {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(byteLength)));
}
export function randomFamilyCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // 혼동 문자 제외
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

/* ───────── session ───────── */
export async function createSession(env, user) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const sessions = await col(env, "sessions");
  await sessions.insertOne({
    tokenHash,
    userId: user._id,
    email: user.email,
    familyId: user.familyId,
    createdAt: now,
    expiresAt,
  });
  return { token, expiresAt };
}

export function readBearer(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+([a-f0-9]{32,128})$/i);
  return match ? match[1] : "";
}

export async function requireSession(env, request) {
  const token = readBearer(request);
  if (!token) throw httpError("로그인이 필요합니다", 401);
  const sessions = await col(env, "sessions");
  const session = await sessions.findOne({ tokenHash: await sha256Hex(token) });
  if (!session) throw httpError("세션이 만료되었거나 올바르지 않습니다", 401);
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    await sessions.deleteOne({ _id: session._id });
    throw httpError("세션이 만료되었습니다. 다시 로그인해 주세요", 401);
  }
  return session;
}

export async function getFamilyCode(env, familyId) {
  const families = await col(env, "families");
  const family = await families.findOne({ familyId }, { projection: { _id: 0, code: 1 } });
  return family?.code || "";
}

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}
