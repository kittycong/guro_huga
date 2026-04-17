# guro_huga

간단한 정적 HR/휴가 관리 웹앱입니다.

## 빠른 실행

별도 빌드 없이 정적 파일을 브라우저에서 열어 확인할 수 있습니다.

- `index.html`을 브라우저로 열기
- 또는 로컬 서버 사용 (권장):
  - `python -m http.server 8080`
  - `http://localhost:8080` 접속

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
