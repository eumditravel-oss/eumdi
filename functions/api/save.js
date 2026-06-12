import { MongoClient, ServerApiVersion } from "mongodb";

const DB_NAME = "mommyflow";
const COLLECTION_NAME = "app_state";
const FAMILY_ID = "main";
const MAX_BODY_BYTES = 1024 * 1024;

let clientPromise;

function json(data, init = {}) {
  return Response.json(data, {
    ...init,
    headers: {
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function publicError(error) {
  return String(error?.message || "Failed to save app state")
    .replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, "mongodb$1://***@")
    .slice(0, 300);
}

async function getCollection(env) {
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!clientPromise) {
    const client = new MongoClient(env.MONGODB_URI, {
      appName: "mommyflow-cloudflare-pages",
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 8000,
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  return client.db(DB_NAME).collection(COLLECTION_NAME);
}

async function readState(request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) {
    const error = new Error("Payload too large");
    error.status = 413;
    throw error;
  }

  const body = await request.json();
  if (!body || typeof body !== "object" || !body.state || Array.isArray(body.state) || typeof body.state !== "object") {
    const error = new Error("Request body must include an object state");
    error.status = 400;
    throw error;
  }

  return body.state;
}

export async function onRequestPost({ request, env }) {
  try {
    const state = await readState(request);
    const collection = await getCollection(env);
    const now = new Date();

    await collection.updateOne(
      { familyId: FAMILY_ID },
      {
        $set: {
          familyId: FAMILY_ID,
          state,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true },
    );

    return json({ ok: true, familyId: FAMILY_ID, updatedAt: now.toISOString() });
  } catch (error) {
    return json(
      { ok: false, error: publicError(error) },
      { status: error.status || 500 },
    );
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
