# guro_huga

간단한 정적 HR/휴가 관리 웹앱입니다.

## 빠른 실행

별도 빌드 없이 정적 파일을 브라우저에서 열어 확인할 수 있습니다.

- `index.html`을 브라우저로 열기
- 또는 로컬 서버 사용 (권장):
  - `python -m http.server 8080`
  - `http://localhost:8080` 접속

## 20명 사무실 운영 방식

- 관리자는 `관리자 모드`에서 직원 추가, 전체 현황, 권한, 엑셀 업로드/다운로드, GitHub 공유 저장을 관리합니다.
- 일반 직원은 `개인 모드`에서 본인 달력, 사용 내역, 연차 설정, 휴가신청서 출력만 사용합니다.
- 직원별 개인 링크는 관리자 모드의 `직원 목록`에서 `개인링크` 버튼으로 복사할 수 있습니다.
- GitHub Pages로 배포할 경우 `data/app-data.json`이 공유 데이터 원본입니다. 관리자 브라우저에만 GitHub 토큰을 저장하고 `공유 저장`을 실행하세요.
- 여러 명이 동시에 수정할 때는 저장 직전 최신 SHA를 다시 확인하며, 충돌이 나면 `공유 데이터 다시 읽기` 후 다시 저장해야 합니다.

## Supabase 실시간 저장

20명 공동수정 운영은 GitHub JSON 대신 Supabase를 우선 사용합니다.

1. Supabase 프로젝트를 만들고 SQL Editor에서 `supabase/schema.sql`을 실행합니다.
2. 앱의 `공유 저장` 메뉴에서 `Supabase 저장 사용`을 켭니다.
3. Supabase Project URL, anon/publishable key, 테이블명 `guro_huga_state`, 행 ID `main`을 입력하고 `Supabase 연결 저장`을 누릅니다.
4. 처음 한 번은 관리자 모드에서 `현재 데이터 초기 저장`을 눌러 현재 직원/휴가 데이터를 DB에 올립니다.
5. 이후 `지금 저장` 또는 `수정 시 자동저장`은 Supabase에 저장되고, 다른 브라우저는 Realtime으로 변경사항을 바로 받습니다.

배포 시 전 직원이 자동으로 같은 DB에 연결되게 하려면 `supabase-config.example.json`을 `supabase-config.json`으로 복사하고 실제 Project URL/anon key를 넣어 함께 배포합니다.

주의: 현재 SQL은 정적 GitHub Pages에서 바로 쓰도록 `anon` 쓰기 정책을 열어둔 시작 설정입니다. 실제 인사/급여 개인정보 운영 전에는 Supabase Auth 로그인과 직원별 RLS 정책으로 강화해야 합니다.

## 양식/엑셀 연동

- `사용 내역`의 `휴가목록 엑셀 업로드`는 일반 `휴가목록/사용내역` 시트와 개인 관리표 형태의 `휴가 시트`를 자동 인식합니다.
- `휴가신청서 출력`은 기존 HWP 양식 구조에 맞춰 소속, 직위, 성명, 휴가 구분, 기간, 사유, 업무 이관, 결재란을 A4 인쇄/PDF 저장용으로 출력합니다.

## 테스트(스모크 체크)

아래 명령으로 핵심 기능(문법/JSON/주요 ERP 버튼 연결) 스모크 테스트를 실행할 수 있습니다.

```bash
./scripts_smoke_test.sh
```

위 스크립트에는 배포 전 필수 점검으로 아래 항목이 포함됩니다.

- `app.js`, `index.html`, `styles.css`, `README.md` 내 머지 충돌 마커(`<<<<<<<`, `=======`, `>>>>>>>`) 검사
- JavaScript 문법 점검
- JSON 유효성 점검
- ERP/생일반차/법령 룰 버튼 및 핸들러 연결 점검

수동으로 개별 체크를 하고 싶다면:

```bash
node --check app.js
python -m json.tool rules/labor/2026.json >/dev/null
```
