import {
  json, publicError, httpError, col,
  verifyPassword, createSession, getFamilyCode, normalizeEmail,
} from "./_shared.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!email || !password) throw httpError("이메일과 비밀번호를 입력해 주세요", 400);

    const users = await col(env, "users");
    const user = await users.findOne({ email });
    if (!user) throw httpError("이메일 또는 비밀번호가 올바르지 않습니다", 401);

    const ok = await verifyPassword(password, user.salt, user.hash);
    if (!ok) throw httpError("이메일 또는 비밀번호가 올바르지 않습니다", 401);

    const { token } = await createSession(env, user);
    const familyCode = await getFamilyCode(env, user.familyId);

    return json({
      ok: true,
      token,
      user: { email: user.email, name: user.name, familyId: user.familyId, familyCode },
    });
  } catch (error) {
    return json({ ok: false, error: publicError(error) }, { status: error.status || 500 });
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
