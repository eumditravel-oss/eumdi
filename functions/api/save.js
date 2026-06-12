import { json, publicError, httpError, col, requireSession } from "./_shared.js";

const COLLECTION_NAME = "app_state";
const MAX_BODY_BYTES = 1024 * 1024;

async function readState(request) {
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) throw httpError("Payload too large", 413);
  const body = await request.json();
  if (!body || typeof body !== "object" || !body.state || Array.isArray(body.state) || typeof body.state !== "object") {
    throw httpError("Request body must include an object state", 400);
  }
  return body.state;
}

export async function onRequestPost({ request, env }) {
  try {
    const session = await requireSession(env, request);
    const state = await readState(request);
    const collection = await col(env, COLLECTION_NAME);
    const now = new Date();

    await collection.updateOne(
      { familyId: session.familyId },
      {
        $set: { familyId: session.familyId, state, updatedAt: now, updatedBy: session.email },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );

    return json({ ok: true, familyId: session.familyId, updatedAt: now.toISOString() });
  } catch (error) {
    return json({ ok: false, error: publicError(error) }, { status: error.status || 500 });
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
