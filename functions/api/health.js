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

function publicError(error) {
  return String(error?.message || "MongoDB health check failed")
    .replace(/mongodb(\+srv)?:\/\/[^@\s]+@/gi, "mongodb$1://***@")
    .slice(0, 300);
}

async function getClient(env) {
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
