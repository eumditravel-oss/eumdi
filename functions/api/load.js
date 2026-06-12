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

export async function onRequestGet({ env }) {
  try {
    const collection = await getCollection(env);
    const doc = await collection.findOne(
      { familyId: FAMILY_ID },
      { projection: { _id: 0, familyId: 1, state: 1, updatedAt: 1, createdAt: 1 } },
    );

    return json({
      ok: true,
      familyId: FAMILY_ID,
      state: doc?.state ?? null,
      updatedAt: doc?.updatedAt ?? null,
      createdAt: doc?.createdAt ?? null,
    });
  } catch (error) {
    return json(
      { ok: false, error: error.message || "Failed to load app state" },
      { status: 500 },
    );
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
