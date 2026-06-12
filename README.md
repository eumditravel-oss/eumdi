# MommyFlow 통합 임신·출산 로드맵

성남시 예비부모 기준 임신 주차별 타임라인, 출산 준비물, 지원금, 행정, 병원·조리원 비교, 예산표를 한 번에 관리하는 웹앱입니다.

## 로그인 & 저장 구조

- 사용자 데이터는 GitHub 코드에 저장되지 않습니다. 모든 상태는 Cloudflare Pages Functions(`/api/*`)를 통해 MongoDB Atlas에 저장됩니다.
- **로그인 필수**: `/api/signup`, `/api/login`으로 계정을 만들고, 발급된 세션 토큰(Bearer)으로 `/api/load`, `/api/save`가 동작합니다. 토큰 없이 호출하면 401이 반환됩니다.
- **가족 코드**: 첫 가입자에게 6자리 가족 코드가 발급됩니다. 배우자가 회원가입 시 이 코드를 입력하면 같은 `familyId`로 묶여 두 사람이 같은 데이터를 실시간 공유합니다. (앱의 ‘전체 메뉴 시트’ 또는 사이드바 하단에서 복사 가능)
- 비밀번호는 PBKDF2-SHA256(salt 포함)으로 해시되어 `users` 컬렉션에 저장되고, 세션은 토큰 해시만 `sessions` 컬렉션에 90일간 보관됩니다.
- 컬렉션: `users`, `sessions`, `families`, `app_state` (DB: `mommyflow`)
- 로그인 도입 전 `familyId: "main"`으로 저장된 기존 데이터는 새 가족의 첫 로드시 자동으로 이어받습니다.
- 브라우저 `localStorage`는 오프라인/서버 장애 시 백업 용도로만, 가족별 키로 분리되어 사용됩니다.

## 모바일 앱(PWA)

- iPhone Safari에서 **공유 → 홈 화면에 추가**를 누르면 주소창 없는 standalone 앱으로 설치됩니다.
- 하단 탭바(타임라인/로드맵/체크/지원금/전체), safe-area 대응, 16px 입력(자동 확대 방지), 서비스워커 캐시가 적용되어 있습니다.

## Cloudflare Pages 배포

1. Cloudflare Pages에서 이 GitHub 저장소를 연결합니다.
2. Build command는 비워두거나 `npm run check`처럼 검증만 실행해도 됩니다.
3. Build output directory는 저장소 루트 `.`를 사용합니다.
4. Pages 프로젝트의 Settings > Environment variables에서 `MONGODB_URI`를 Secret/환경변수로 추가합니다.
5. MongoDB Atlas Network Access에서 Cloudflare Functions가 접속할 수 있도록 허용 범위를 설정합니다.
6. 배포 후 `https://프로젝트명.pages.dev`에서 앱을 열면 `/api/load`로 `familyId: main` 데이터를 불러옵니다.

`MONGODB_URI`에 비밀번호 특수문자(`@`, `<`, `>`, `#`, `/` 등)가 포함되어 있으면 URL encoding 후 입력해야 합니다. Atlas가 보여주는 샘플 코드의 `<password>` 꺾쇠괄호는 자리표시자이므로 실제 환경변수에는 넣지 않습니다.

## 로컬 개발

```bash
npm install
cp .dev.vars.example .dev.vars
# .dev.vars에 실제 MONGODB_URI를 직접 입력합니다. 이 파일은 커밋하지 않습니다.
npm run dev
```

## 보안 메모

`MONGODB_URI`, DB 비밀번호, secret key, `.dev.vars`, `.env` 파일은 절대 GitHub에 커밋하지 않습니다. `.gitignore`가 이 파일들을 제외하도록 설정되어 있습니다.

## 연결 진단

배포 후 앱 상단의 `진단` 버튼을 누르거나 `/api/health`를 직접 열면 MongoDB Atlas ping 결과를 확인할 수 있습니다. `MONGODB_URI is not configured`가 나오면 Cloudflare Pages 환경변수가 빠진 것이고, `querySrv`, `authentication failed`, `timed out` 계열 오류가 나오면 URI 형식, 계정/비밀번호, Atlas Network Access 설정을 확인해야 합니다.

## 주의

지원금, 휴가·휴직, 보건소 사업, 성남시 지원 항목은 정책 변경 가능성이 있습니다. 실제 신청 전에는 복지로, 고용24, 성남시 또는 관할 보건소의 최신 공지를 확인해야 합니다.
