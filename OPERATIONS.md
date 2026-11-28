# 현장노트 운영 인수인계 (새 대화에서 이어갈 때 먼저 읽기)

최종 갱신: 2026-11-28. 글쓰기 규칙은 `CLAUDE.md`, 이 문서는 **운영 상태와 결정 사항**만 담는다. 비밀값(키·토큰)은 절대 적지 않는다.

## 1. 구성
| 항목 | 값 |
|---|---|
| 블로그 | https://field.ynote.co.kr (저장소 SugilYang/fieldnote, GitHub Pages, `pages.yml`) |
| 허브 | https://ynote.co.kr (저장소 SugilYang/ynote-root, 매일 19:30 UTC 빌드로 posts.json 가져옴) |
| 네이버 블로그(미러) | https://blog.naver.com/fedor0725 — 운영자가 매일 `naver/YYYY-MM-DD.html` 페이지에서 복사·사진 저장 후 앱에서 직접 올림 |
| 통계 | GA4 G-GMS58YZHEH, Search Console 속성 556486591. `scripts/fetch-stats.js`가 배포 때 `stats.json` 갱신(GA·SC·URL 검사 60개/일) |
| 수익 | 쿠팡파트너스 상품 카드(`products.json` 22개, 빌드 시 자동 삽입). 애드센스는 11/6 거절("가치가 별로 없는 콘텐츠") → 구글 색인 회복 후 재신청 |
| 비밀값 | GitHub Secrets에만: UNSPLASH_KEY, GA_SERVICE_ACCOUNT. 대화에 붙이지 않는다 |

## 2. 자동 글쓰기 예약 (Claude Code 예약 작업)
- 예약 `trig_01MRgGuqYnciUHJNgjKRCkKF` "현장노트 매일 글쓰기 (12월 세션)": `CRON_TZ=Asia/Seoul 52 2 * * 1-5`, 세션 `session_01W9NbUMcMFgsdUb3N3Q12Qp` (2026-11-28 생성).
- 옛 예약 `trig_01Lc4rsq2y6z4rrBdmEWLXwU`(세션 `session_01Nd3yEMWxbFVMgk1XpJhavY`, 9/29~11/27)는 **중지됨**. 두 달치 기록을 매일 다시 읽어 사용량이 커져서 교체했다.
- **규칙: 글쓰기 세션은 한 달에 한 번 새로 만든다.** 방법: 같은 환경(`env_014JRcSNBeQBFVZbGYDenVva`)에 fieldnote main 소스로 세션 생성 → 같은 cron으로 새 예약을 그 세션에 바인딩 → 옛 예약 비활성화 → 이 문서 갱신.
- 예약 프롬프트는 "CLAUDE.md를 따라라" 수준만 적는다. 분량·형식 변경은 CLAUDE.md에서 한다.

## 3. 현재 상태 (2026-11-28)
- 글 250편, 그중 87편 noindex(사고사례·트렌드 전체 + 구글이 거절한 글).
- **구글**: 11/10부터 노출 0, 색인 153→3개(알고리즘 판단, 수동 조치 없음). 대응: 하루 2편(깊은 글 1 + 네이버용 1)으로 축소, noindex, 저자·검토 기준 문구, 사이트맵 재제출(11/18 구글이 읽음). **다음 점검 12/8** — Search Console 색인 페이지 수와 노출 확인.
- **방문자**: 평일 평균 약 13명(11/24~27), 누적 315. 유입: 네이버 5~11, 빙 2~4, 다음, 덕덕고, ChatGPT. 구글 0.
- **네이버 블로그**: 사진 넣은 뒤 일 3→12 조회. 애드포스트 신청 조건 50편 → 1월 중순 예상.
- **쿠팡**: 첫 수익 11/11 (클릭 20, 구매 2). 운영자 본인 구매 금지.

## 4. 운영자(사용자)가 매일 하는 일
1. 새벽 예약이 끝나면 배포(5~10분) 후 `https://field.ynote.co.kr/naver/오늘날짜.html` 열기.
2. 사진 1·2를 길게 눌러 JPG로 저장 → 네이버 앱에서 글 붙여넣고 `[사진 1 자리]`/`[사진 2 자리]` 위치에 사진 업로드(붙여넣은 외부 이미지는 네이버가 사진으로 인정하지 않음).
3. 격주 금요일은 네이버 글 없음(파일이 안 생김).

## 5. 다음 할 일 / 점검일
- 12/8 구글 색인 점검 → 회복 조짐 있으면 12월 중순 이후 애드센스 재신청.
- 1월 중순 네이버 50편 → 애드포스트 신청.
- 미착수 제안: 노출 있는 20편 제목·첫 문단 정렬, 허브 페이지(안전화·교대근무·지도사), 보호구 교체 알림판 도구, 주 2회(월·목) 방문자 분석.

## 6. 자주 나는 문제와 처리
- 배포 봇 푸시 거부/`deploy-pages` 일시 실패 → 다음 배포에서 자동 반영, 급하면 `pages.yml` 수동 실행(workflow_dispatch).
- Unsplash 한도 초과로 사진 비어 있음 → 다음 배포 때 자동 채움. 엉뚱한 사진은 `scripts/add-photos.js`의 `BAD`/`relevance()`에서 걸러진다; 특정 글만 다시 받으려면 posts.json의 `image` 필드를 비운다.
- 네이버 글 안 열림 → 오늘 배포가 실패한 경우. Actions 확인 후 수동 실행.
- 모든 Search Console 안내에는 직접 링크를 붙인다(예: https://search.google.com/search-console/index?resource_id=sc-domain%3Aynote.co.kr).

## 7. 로컬 확인
`python3 -m http.server 8765` + Playwright(`executablePath:'/opt/pw-browsers/chromium'`). 빌드는 `node scripts/build.js`.
