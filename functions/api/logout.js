import { json, publicError, col, readBearer, sha256Hex } from "./_shared.js";

export async function onRequestPost({ request, env }) {
  try {
    const token = readBearer(request);
    if (token) {
      const sessions = await col(env, "sessions");
      await sessions.deleteOne({ tokenHash: await sha256Hex(token) });
    }
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: publicError(error) }, { status: 500 });
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
