import { MongoClient, ServerApiVersion } from "mongodb";

const DB_NAME = "mommyflow";
const COLLECTION_NAME = "app_state";
const FAMILY_ID = "main";

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

function publicError(error) {
  const reason = safeString(error?.reason);
  const cause = safeString(error?.cause);
  const parts = [
    error?.name,
    error?.code ? `code=${error.code}` : "",
    safeString(error?.message || "MongoDB health check failed"),
    reason ? `reason=${reason}` : "",
    cause ? `cause=${cause}` : "",
  ].filter(Boolean);

  return parts
    .join(" | ")
    .replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, "mongodb$1://***@")
    .slice(0, 600);
}

async function getClient(env) {
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (!clientPromise) {
    const client = new MongoClient(env.MONGODB_URI, {
      appName: "mommyflow-cloudflare-pages",
      maxPoolSize: 1,
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

  return clientPromise;
}

export async function onRequestGet({ env }) {
  const startedAt = Date.now();

  try {
    const client = await getClient(env);
    await client.db("admin").command({ ping: 1 });

    return json({
      ok: true,
      mongodbUriConfigured: Boolean(env.MONGODB_URI),
      dbName: DB_NAME,
      collectionName: COLLECTION_NAME,
      familyId: FAMILY_ID,
      latencyMs: Date.now() - startedAt,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        mongodbUriConfigured: Boolean(env.MONGODB_URI),
        dbName: DB_NAME,
        collectionName: COLLECTION_NAME,
        familyId: FAMILY_ID,
        error: publicError(error),
      },
      { status: 500 },
    );
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
