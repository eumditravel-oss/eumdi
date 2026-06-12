# MommyFlow 통합 임신·출산 로드맵

성남시 예비부모 기준 임신 주차별 타임라인, 출산 준비물, 지원금, 행정, 병원·조리원 비교, 예산표를 한 번에 관리하는 웹앱입니다.

## 로그인 & 저장 구조

- 사용자 데이터는 GitHub 코드에 저장되지 않습니다. 모든 상태는 별도 Node API 서버가 MongoDB Atlas에 저장합니다.
- Cloudflare Pages는 정적 PWA 화면을 제공하고, Pages Functions(`/api/*`)는 `API_BASE_URL`로 지정한 Node API 서버에 요청을 프록시합니다.
- **로그인 필수**: `/api/signup`, `/api/login`으로 계정을 만들고, 발급된 세션 토큰(Bearer)으로 `/api/load`, `/api/save`가 동작합니다. 토큰 없이 호출하면 401이 반환됩니다.
- **가족 코드**: 첫 가입자에게 6자리 가족 코드가 발급됩니다. 배우자가 회원가입 시 이 코드를 입력하면 같은 `familyId`로 묶여 두 사람이 같은 데이터를 실시간 공유합니다. (앱의 ‘전체 메뉴 시트’ 또는 사이드바 하단에서 복사 가능)
- 비밀번호는 PBKDF2-SHA256(salt 포함)으로 해시되어 `users` 컬렉션에 저장되고, 세션은 토큰 해시만 `sessions` 컬렉션에 90일간 보관됩니다.
- 컬렉션: `users`, `sessions`, `families`, `app_state` (DB: `mommyflow`)
- 로그인 도입 전 `familyId: "main"`으로 저장된 기존 데이터는 새 가족의 첫 로드시 자동으로 이어받습니다.
- 브라우저 `localStorage`는 오프라인/서버 장애 시 백업 용도로만, 가족별 키로 분리되어 사용됩니다.


## AI 도우미 (Google AI Studio)

- 화면 우측 하단 **AI 플로팅 버튼**으로 대화창을 엽니다.
- 답변 우선순위: ① 앱에 정리된 데이터(주차별 정보·체크리스트·지원금·준비물)에서 먼저 근거를 찾고 → ② 그 외 질문은 Gemini의 구글 검색 그라운딩으로 인터넷을 검색해 **관련 자료 링크와 함께** 답합니다.
- API 키는 https://aistudio.google.com/app/apikey 에서 무료 발급한 뒤, AI 대화창의 ⚙️ 설정에서 입력합니다. 키는 `families` 컬렉션(가족 단위)에 서버 저장되어 **남편/아내 중 한 명만 입력하면 둘 다 사용**할 수 있고, GitHub 코드에는 절대 들어가지 않습니다.
- 키가 없을 때도 앱 데이터 검색 모드로 기본 답변은 동작합니다.

## 계정·프로필

- 회원가입 시 **역할(남편/아내)** 을 선택합니다. 부부 태교 일기장의 "남편이 아내에게 / 아내가 남편에게" 기본값과 아바타에 사용됩니다.
- 사이드바·전체 메뉴의 **내 정보** 버튼에서 이름, 역할, 비밀번호를 언제든 수정할 수 있습니다(`POST /api/profile`).

## 모바일 앱(PWA)

- iPhone Safari에서 **공유 → 홈 화면에 추가**를 누르면 주소창 없는 standalone 앱으로 설치됩니다.
- 하단 탭바(타임라인/로드맵/체크/지원금/전체), safe-area 대응, 16px 입력(자동 확대 방지), 서비스워커 캐시가 적용되어 있습니다.

## Node API 서버 배포

Render 기준 권장 구성입니다.

1. Render에서 이 GitHub 저장소를 Web Service로 연결합니다.
2. Build command: `npm install`
3. Start command: `npm start`
4. Environment variables:
   - `MONGODB_URI`: MongoDB Atlas 연결 문자열
   - `CORS_ORIGIN`: `https://eumdi.pages.dev`
   - `NODE_ENV`: `production`
5. 배포 후 `https://렌더서비스명.onrender.com/api/health`가 `ok: true`를 반환하는지 확인합니다.

`MONGODB_URI`에 비밀번호 특수문자(`@`, `<`, `>`, `#`, `/` 등)가 포함되어 있으면 URL encoding 후 입력해야 합니다. Atlas가 보여주는 샘플 코드의 `<password>` 꺾쇠괄호는 자리표시자이므로 실제 환경변수에는 넣지 않습니다.

## Cloudflare Pages 배포

1. Cloudflare Pages에서 이 GitHub 저장소를 연결합니다.
2. Build command는 비워두거나 `npm run check`처럼 검증만 실행해도 됩니다.
3. Build output directory는 저장소 루트 `.`를 사용합니다.
4. Pages 프로젝트의 Settings > Environment variables에서 `API_BASE_URL`을 Node API 서버 주소로 추가합니다. 예: `https://렌더서비스명.onrender.com`
5. Cloudflare Pages에는 `MONGODB_URI`를 넣지 않아도 됩니다. MongoDB 비밀번호는 Node API 서버 환경변수에만 둡니다.
6. 배포 후 `https://eumdi.pages.dev/api/health`가 Node API 서버의 상태를 프록시해서 보여주면 연결된 것입니다.

프론트에서 Cloudflare 프록시를 거치지 않고 API 서버를 직접 호출하고 싶다면 `src/config.js`의 `window.MOMMYFLOW_API_BASE_URL`에 공개 API 서버 주소를 넣으면 됩니다. 이 값은 비밀값이 아니지만, MongoDB URI나 비밀번호는 절대 넣지 않습니다.

## 로컬 개발

```bash
npm install

# 터미널 1: Node API 서버
cp .env.example .env
# .env에 실제 MONGODB_URI를 직접 입력합니다. 이 파일은 커밋하지 않습니다.
npm run dev:api

# 터미널 2: Cloudflare Pages 프론트/프록시
cp .dev.vars.example .dev.vars
# .dev.vars의 API_BASE_URL은 기본값 http://localhost:8787을 사용합니다.
npm run dev
```

## 보안 메모

`MONGODB_URI`, DB 비밀번호, secret key, `.dev.vars`, `.env` 파일은 절대 GitHub에 커밋하지 않습니다. `.gitignore`가 이 파일들을 제외하도록 설정되어 있습니다.

## 연결 진단

배포 후 앱 상단의 `진단` 버튼을 누르거나 `/api/health`를 직접 열면 Node API 서버와 MongoDB Atlas ping 결과를 확인할 수 있습니다. `API_BASE_URL is not configured`가 나오면 Cloudflare Pages의 `API_BASE_URL` 환경변수가 빠진 것이고, `MONGODB_URI is not configured`가 나오면 Node API 서버 환경변수가 빠진 것입니다.

## 주의

지원금, 휴가·휴직, 보건소 사업, 성남시 지원 항목은 정책 변경 가능성이 있습니다. 실제 신청 전에는 복지로, 고용24, 성남시 또는 관할 보건소의 최신 공지를 확인해야 합니다.
