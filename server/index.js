import "dotenv/config";
import express from "express";
import { MongoClient, ServerApiVersion } from "mongodb";
import { webcrypto } from "node:crypto";

const DB_NAME = "mommyflow";
const APP_STATE_COLLECTION = "app_state";
const LEGACY_FAMILY_ID = "main";
const SESSION_DAYS = 90;
const PBKDF2_ITERATIONS = 50000;
const MAX_BODY_SIZE = "1mb";

let clientPromise;
let indexesPromise;

const app = express();

app.disable("x-powered-by");
app.use(corsMiddleware);
app.use(express.json({ limit: MAX_BODY_SIZE }));

function json(res, data, status = 200) {
  res.set("cache-control", "no-store");
  return res.status(status).json(data);
}

function publicError(error) {
  const name = error?.name ? `${error.name}: ` : "";
  return `${name}${String(error?.message || "Request failed")}`
    .replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, "mongodb$1://***@")
    .slice(0, 220);
}

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function corsMiddleware(req, res, next) {
  const origin = req.headers.origin;
  const allowed = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!origin || allowed.length === 0 || allowed.includes("*")) {
    res.set("access-control-allow-origin", origin || "*");
  } else if (allowed.includes(origin)) {
    res.set("access-control-allow-origin", origin);
    res.set("vary", "Origin");
  } else {
    return json(res, { ok: false, error: "Origin is not allowed" }, 403);
  }

  res.set("access-control-allow-methods", "GET,POST,OPTIONS");
  res.set("access-control-allow-headers", "Content-Type, Authorization, Accept");

  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
}

async function getDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw httpError("MONGODB_URI is not configured", 500);

  if (!clientPromise) {
    const client = new MongoClient(uri, {
      appName: "mommyflow-node-api",
      maxPoolSize: 10,
      connectTimeoutMS: 15000,
      serverSelectionTimeoutMS: 30000,
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);
  if (!indexesPromise) indexesPromise = ensureIndexes(db);
  await indexesPromise;
  return db;
}

async function col(name) {
  return (await getDb()).collection(name);
}

async function ensureIndexes(db) {
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("families").createIndex({ code: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection(APP_STATE_COLLECTION).createIndex({ familyId: 1 }, { unique: true }),
  ]);
}

function bytesToHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let index = 0; index < out.length; index += 1) {
    out[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return out;
}

async function sha256Hex(text) {
  const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return bytesToHex(digest);
}

async function hashPassword(password, saltHex) {
  const salt = saltHex ? hexToBytes(saltHex) : webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return { salt: bytesToHex(salt), hash: bytesToHex(bits) };
}

async function verifyPassword(password, saltHex, expectedHashHex) {
  const { hash } = await hashPassword(password, saltHex);
  if (hash.length !== expectedHashHex.length) return false;
  let diff = 0;
  for (let index = 0; index < hash.length; index += 1) {
    diff |= hash.charCodeAt(index) ^ expectedHashHex.charCodeAt(index);
  }
  return diff === 0;
}

function randomToken(byteLength = 24) {
  return bytesToHex(webcrypto.getRandomValues(new Uint8Array(byteLength)));
}

function randomFamilyCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = webcrypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function readBearer(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+([a-f0-9]{32,128})$/i);
  return match ? match[1] : "";
}

async function createSession(user) {
  const token = randomToken();
  const tokenHash = await sha256Hex(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const sessions = await col("sessions");
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

async function requireSession(req) {
  const token = readBearer(req);
  if (!token) throw httpError("로그인이 필요합니다", 401);
  const sessions = await col("sessions");
  const session = await sessions.findOne({ tokenHash: await sha256Hex(token) });
  if (!session) throw httpError("세션이 만료되었거나 올바르지 않습니다", 401);
  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    await sessions.deleteOne({ _id: session._id });
    throw httpError("세션이 만료되었습니다. 다시 로그인해 주세요", 401);
  }
  return session;
}

async function getFamilyCode(familyId) {
  const families = await col("families");
  const family = await families.findOne({ familyId }, { projection: { _id: 0, code: 1 } });
  return family?.code || "";
}

function asyncRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      json(res, { ok: false, error: publicError(error) }, error.status || 500);
    }
  };
}

app.get("/", (_req, res) => {
  json(res, { ok: true, service: "mommyflow-api" });
});

app.get("/api/health", asyncRoute(async (_req, res) => {
  const startedAt = Date.now();
  const db = await getDb();
  await db.admin().command({ ping: 1 });
  json(res, {
    ok: true,
    dbName: DB_NAME,
    collectionName: APP_STATE_COLLECTION,
    familyId: LEGACY_FAMILY_ID,
    latencyMs: Date.now() - startedAt,
  });
}));

app.post("/api/signup", asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const name = String(req.body?.name || "").trim().slice(0, 30);
  const role = String(req.body?.role || "").trim();
  const familyCode = String(req.body?.familyCode || "").trim().toUpperCase();

  if (!validEmail(email)) throw httpError("올바른 이메일 주소를 입력해 주세요", 400);
  if (password.length < 8) throw httpError("비밀번호는 8자 이상이어야 합니다", 400);
  if (!name) throw httpError("이름(닉네임)을 입력해 주세요", 400);
  if (!["husband", "wife"].includes(role)) throw httpError("남편/아내 중 역할을 선택해 주세요", 400);

  const users = await col("users");
  const existing = await users.findOne({ email }, { projection: { _id: 1 } });
  if (existing) throw httpError("이미 가입된 이메일입니다. 로그인해 주세요", 409);

  const families = await col("families");
  let familyId;
  let codeForClient;
  if (familyCode) {
    const family = await families.findOne({ code: familyCode });
    if (!family) throw httpError("가족 코드를 찾을 수 없습니다. 코드를 다시 확인해 주세요", 404);
    familyId = family.familyId;
    codeForClient = family.code;
  } else {
    familyId = `fam_${randomToken(12)}`;
    codeForClient = randomFamilyCode();
    await families.insertOne({ familyId, code: codeForClient, createdAt: new Date() });
  }

  const { salt, hash } = await hashPassword(password);
  const now = new Date();
  const inserted = await users.insertOne({ email, name, role, salt, hash, familyId, createdAt: now });
  const user = { _id: inserted.insertedId, email, name, familyId };
  const { token } = await createSession(user);

  json(res, {
    ok: true,
    token,
    user: { email, name, role, familyId, familyCode: codeForClient },
  });
}));

app.post("/api/login", asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!email || !password) throw httpError("이메일과 비밀번호를 입력해 주세요", 400);

  const users = await col("users");
  const user = await users.findOne({ email });
  if (!user) throw httpError("이메일 또는 비밀번호가 올바르지 않습니다", 401);

  const ok = await verifyPassword(password, user.salt, user.hash);
  if (!ok) throw httpError("이메일 또는 비밀번호가 올바르지 않습니다", 401);

  const { token } = await createSession(user);
  const familyCode = await getFamilyCode(user.familyId);
  json(res, {
    ok: true,
    token,
    user: { email: user.email, name: user.name, role: user.role || "", familyId: user.familyId, familyCode },
  });
}));

app.get("/api/me", asyncRoute(async (req, res) => {
  const session = await requireSession(req);
  const users = await col("users");
  const user = await users.findOne(
    { _id: session.userId },
    { projection: { _id: 0, email: 1, name: 1, role: 1, familyId: 1 } },
  );
  if (!user) throw httpError("사용자를 찾을 수 없습니다", 401);
  const familyCode = await getFamilyCode(user.familyId);
  json(res, { ok: true, user: { ...user, familyCode } });
}));

app.post("/api/logout", asyncRoute(async (req, res) => {
  const token = readBearer(req);
  if (token) {
    const sessions = await col("sessions");
    await sessions.deleteOne({ tokenHash: await sha256Hex(token) });
  }
  json(res, { ok: true });
}));


app.post("/api/profile", asyncRoute(async (req, res) => {
  const session = await requireSession(req);
  const users = await col("users");
  const user = await users.findOne({ _id: session.userId });
  if (!user) throw httpError("사용자를 찾을 수 없습니다", 401);

  const updates = {};
  const name = String(req.body?.name || "").trim().slice(0, 30);
  const role = String(req.body?.role || "").trim();
  if (name) updates.name = name;
  if (role) {
    if (!["husband", "wife"].includes(role)) throw httpError("역할은 남편/아내 중에서 선택해 주세요", 400);
    updates.role = role;
  }

  const newPassword = String(req.body?.newPassword || "");
  if (newPassword) {
    if (newPassword.length < 8) throw httpError("새 비밀번호는 8자 이상이어야 합니다", 400);
    const currentPassword = String(req.body?.currentPassword || "");
    const ok = await verifyPassword(currentPassword, user.salt, user.hash);
    if (!ok) throw httpError("현재 비밀번호가 올바르지 않습니다", 401);
    const { salt, hash } = await hashPassword(newPassword);
    updates.salt = salt;
    updates.hash = hash;
  }

  if (Object.keys(updates).length === 0) throw httpError("변경할 내용이 없습니다", 400);
  updates.updatedAt = new Date();
  await users.updateOne({ _id: user._id }, { $set: updates });

  const familyCode = await getFamilyCode(user.familyId);
  json(res, {
    ok: true,
    user: {
      email: user.email,
      name: updates.name || user.name,
      role: updates.role || user.role || "",
      familyId: user.familyId,
      familyCode,
    },
  });
}));

app.get("/api/family-settings", asyncRoute(async (req, res) => {
  const session = await requireSession(req);
  const families = await col("families");
  const family = await families.findOne(
    { familyId: session.familyId },
    { projection: { _id: 0, settings: 1 } },
  );
  json(res, { ok: true, settings: { geminiApiKey: family?.settings?.geminiApiKey || "" } });
}));

app.post("/api/family-settings", asyncRoute(async (req, res) => {
  const session = await requireSession(req);
  const geminiApiKey = String(req.body?.geminiApiKey ?? "").trim().slice(0, 200);
  const families = await col("families");
  await families.updateOne(
    { familyId: session.familyId },
    { $set: { "settings.geminiApiKey": geminiApiKey, "settings.updatedAt": new Date(), "settings.updatedBy": session.email } },
  );
  json(res, { ok: true, settings: { geminiApiKey } });
}));

app.get("/api/load", asyncRoute(async (req, res) => {
  const session = await requireSession(req);
  const collection = await col(APP_STATE_COLLECTION);

  let doc = await collection.findOne(
    { familyId: session.familyId },
    { projection: { _id: 0, familyId: 1, state: 1, updatedAt: 1, createdAt: 1 } },
  );

  let migratedFromLegacy = false;
  if (!doc) {
    const legacy = await collection.findOne(
      { familyId: LEGACY_FAMILY_ID },
      { projection: { _id: 0, state: 1, updatedAt: 1 } },
    );
    if (legacy?.state) {
      doc = { familyId: session.familyId, state: legacy.state, updatedAt: legacy.updatedAt };
      migratedFromLegacy = true;
    }
  }

  json(res, {
    ok: true,
    familyId: session.familyId,
    state: doc?.state ?? null,
    updatedAt: doc?.updatedAt ?? null,
    migratedFromLegacy,
  });
}));

app.post("/api/save", asyncRoute(async (req, res) => {
  const session = await requireSession(req);
  const state = req.body?.state;
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    throw httpError("Request body must include an object state", 400);
  }

  const collection = await col(APP_STATE_COLLECTION);
  const now = new Date();
  await collection.updateOne(
    { familyId: session.familyId },
    {
      $set: { familyId: session.familyId, state, updatedAt: now, updatedBy: session.email },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  json(res, { ok: true, familyId: session.familyId, updatedAt: now.toISOString() });
}));

app.use((_req, res) => {
  json(res, { ok: false, error: "Not found" }, 404);
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`MommyFlow API listening on ${port}`);
});
