# MommyFlow 통합 임신·출산 로드맵

성남시 예비부모 기준 임신 주차별 타임라인, 출산 준비물, 지원금, 행정, 병원·조리원 비교, 예산표를 한 번에 관리하는 웹앱입니다.

## 저장 구조

- 프론트엔드는 사용자 데이터를 GitHub 코드에 저장하지 않습니다.
- 앱 상태는 Cloudflare Pages Functions의 `/api/load`, `/api/save`를 통해 MongoDB Atlas에 저장됩니다.
- MongoDB 연결 문자열은 Cloudflare 환경변수 `MONGODB_URI`에서만 읽습니다.
- DB 이름은 `mommyflow`, 컬렉션 이름은 `app_state`입니다.
- 현재 가족 식별자 `familyId`는 `main`으로 고정되어 있어 두 사람이 다른 기기에서 접속해도 같은 데이터를 공유합니다.
- 브라우저 `localStorage`는 MongoDB 장애나 오프라인 상황의 백업 용도로만 사용합니다.

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
