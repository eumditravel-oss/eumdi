import { json, publicError, col, requireSession } from "./_shared.js";

const COLLECTION_NAME = "app_state";
const LEGACY_FAMILY_ID = "main";

export async function onRequestGet({ request, env }) {
  try {
    const session = await requireSession(env, request);
    const collection = await col(env, COLLECTION_NAME);

    let doc = await collection.findOne(
      { familyId: session.familyId },
      { projection: { _id: 0, familyId: 1, state: 1, updatedAt: 1, createdAt: 1 } },
    );

    // 로그인 도입 이전(familyId: main)에 저장된 데이터가 있다면 첫 로드에서 이어받는다.
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

    return json({
      ok: true,
      familyId: session.familyId,
      state: doc?.state ?? null,
      updatedAt: doc?.updatedAt ?? null,
      migratedFromLegacy,
    });
  } catch (error) {
    return json({ ok: false, error: publicError(error) }, { status: error.status || 500 });
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204 });
}
