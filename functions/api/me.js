import { json, publicError, col, requireSession, getFamilyCode } from "./_shared.js";

export async function onRequestGet({ request, env }) {
  try {
    const session = await requireSession(env, request);
    const users = await col(env, "users");
    const user = await users.findOne(
      { _id: session.userId },
      { projection: { _id: 0, email: 1, name: 1, familyId: 1 } },
    );
    if (!user) return json({ ok: false, error: "사용자를 찾을 수 없습니다" }, { status: 401 });
    const familyCode = await getFamilyCode(env, user.familyId);
    return json({ ok: true, user: { ...user, familyCode } });
  } catch (error) {
    return json({ ok: false, error: publicError(error) }, { status: error.status || 500 });
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
