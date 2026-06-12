import {
  json, publicError, httpError, col,
  hashPassword, createSession, randomToken, randomFamilyCode,
  normalizeEmail, validEmail,
} from "./_shared.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const name = String(body.name || "").trim().slice(0, 30);
    const familyCode = String(body.familyCode || "").trim().toUpperCase();

    if (!validEmail(email)) throw httpError("올바른 이메일 주소를 입력해 주세요", 400);
    if (password.length < 8) throw httpError("비밀번호는 8자 이상이어야 합니다", 400);
    if (!name) throw httpError("이름(닉네임)을 입력해 주세요", 400);

    const users = await col(env, "users");
    const existing = await users.findOne({ email }, { projection: { _id: 1 } });
    if (existing) throw httpError("이미 가입된 이메일입니다. 로그인해 주세요", 409);

    const families = await col(env, "families");
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
    const inserted = await users.insertOne({
      email, name, salt, hash, familyId, createdAt: now,
    });
    const user = { _id: inserted.insertedId, email, name, familyId };
    const { token } = await createSession(env, user);

    return json({
      ok: true,
      token,
      user: { email, name, familyId, familyCode: codeForClient },
    });
  } catch (error) {
    return json({ ok: false, error: publicError(error) }, { status: error.status || 500 });
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
