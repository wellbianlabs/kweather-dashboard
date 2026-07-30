# 핸드오프 — KWEATHER 체감온도계 데이터 분석 소프트웨어 (STS)

> 작성: 2026-06-22 · 브랜치 `Dev` (자가호스트 트랙) / `main` (Vercel 트랙)
> 이 문서 하나로 (1) 현재 시스템을 인수인계받고 (2) **이 시스템을 토대로 별도의 "IoT 기반 실시간 폭염대응 솔루션"을 새 대화에서 바로 이어서** 시작할 수 있도록 구성함.
> 운영·자격증명 등 민감정보는 값 없이 "위치"만 표기(이 저장소는 공개 GitHub). 실제 값은 운영자/어시스턴트 로컬 메모리/서버 DB에 보관.

---

## 1. 시스템 개요

케이웨더 **체감온도계(STS) 단말기**가 측정한 TXT 로그(체감온도/온도/습도, 10분 간격)를 업로드해 사업장·기기별로 분석하고, **폭염 안전관리 보고서(일일/기간 PDF·Excel)**를 자동 생성하는 웹 소프트웨어. 멀티테넌트(회사=계정 격리), 평생무료(단말기 이용자 전용) 콘셉트.

**핵심 성격:** *과거 측정기록 분석 전용*. (실시간/라이브/IoT 기능은 사용자 요청으로 과거에 의도적으로 제거됨 — 새 IoT 프로젝트는 이 부분을 정반대로 가져가는 별도 트랙.)

**라이브:**
- 자가호스트(주력): **https://sts.kweather.co.kr** (브랜치 `Dev`)
- Vercel(서버리스): web `kweather-dashboard-web.vercel.app` / api `kweather-dashboard-api.vercel.app` (브랜치 `main`, GitHub 자동배포)
- 저장소(공개): https://github.com/wellbianlabs/kweather-dashboard

---

## 2. 아키텍처 & 스택

```
[브라우저] ──HTTPS──> nginx:443 ──> uvicorn 127.0.0.1:8000 (systemd: kweather)
                                      └─ FastAPI (SPA dist 서빙 X — nginx가 dist 서빙)
                                      └─ /api/* (FastAPI)  ──> PostgreSQL 16.9 :5433
```

- **백엔드:** Python 3.11 · FastAPI · SQLAlchemy · Pandas · matplotlib(차트) · xhtml2pdf+Jinja2(PDF) · openpyxl(Excel). 경로 `backend/`.
- **프론트:** React 19 · Mantine 9.3 · Vite · Recharts · React-Router. 경로 `frontend/`. 빌드 산출물 `frontend/dist`.
- **DB:** 자가호스트=로컬 PostgreSQL **16.9 (포트 5433, public 스키마)**. Vercel 트랙=Supabase(`kweather` 스키마). `.env`의 `DATABASE_URL` 한 줄로 전환(코드 무관).
- **인증:** 이메일/비번 회원가입·로그인, 토큰=테넌트 `api_key`, 프론트 `localStorage('kw_api_key')` + `X-API-Key` 헤더. 데모계정 토큰 `demo-key`(읽기전용).

---

## 3. 배포 구조 & 방법 (자가호스트 = 주력)

**서버:** `220.95.232.202`, 계정 `hduser`. SSH 키 없음 → **paramiko로 tar 업로드 + sudo(stdin 비번)**.
앱 경로: `/opt/kweather/{backend(.venv py3.11, .env), frontend/dist, backups, maint}`.

**배포 패턴(이 세션에서 반복 사용):**
1. (백엔드 변경) `report.py` 등 파일을 sftp로 `/opt/kweather/backend/...`에 put → `systemctl restart kweather`.
2. (프론트 변경) 로컬 `cd frontend && npm run build` → `dist`를 tar로 묶어 `/opt/kweather/frontend/dist`에 풀기(`rm -rf dist/assets` 후 전개) → nginx가 즉시 서빙(재시작 불필요).
3. 비번은 `$env:STS_PW`로 전달(스크립트에 하드코딩 금지). 임시 스크립트 파일명은 `_*.py`/`_cm.txt` (.gitignore됨 — `git add -A` 금지, 한 번 실수로 `_cm.txt` 커밋된 적 있음).

**SSH 차단 주의(이 세션 실제 발생):** 연결 재시도를 빠르게 반복하면 서버 **fail2ban이 내 공인 IP를 SSH(22)만 차단**(웹 443은 정상). 해제는 서버 콘솔/다른 IP에서 `sudo fail2ban-client set sshd unbanip <IP>`. 재시도는 60초 간격 이상으로, 빠른 연타 금지.

**검증 방법(필수 습관):**
- 배포 후 라이브 번들 확인: `curl -s -k https://localhost/ -H 'Host: sts.kweather.co.kr' | grep index-*.js`.
- **PDF 보고서 검증: PyMuPDF(fitz)로 PDF→PNG 렌더 후 육안** + `pypdf`로 페이지별 텍스트 추출해 섹션 배치/페이지수 확인(이 세션에서 일일보고서 1~4번 1페이지 배치 검증에 사용).
- 프론트 UI 검증: `preview_*` 도구(데모 토큰 `localStorage.setItem('kw_api_key','demo-key')` 주입 후 렌더, DOM/스크린샷 확인). 단 preview는 uvicorn이 **빌드된 dist를 서빙**하므로 소스 수정 후 반드시 `npm run build` 먼저.

**Vercel 트랙:** `main` push 시 자동 프로덕션 배포(GitHub 연동). 모노레포 Root: api=`backend`, web=`frontend`. 서버리스라 matplotlib 제외(PDF 차트 PIL 폴백).

---

## 4. 코드 맵 (주요 파일)

**백엔드 `backend/app/`**
- `services/heat.py` — 위험단계 분류(`classify`), 단계별 색/라벨/임계(LEVELS). **재사용 핵심.**
- `services/weather.py` — 외부(기상청) 연동·체감온도 산식. `kma_feels_like`(기상청 공식 여름 체감, Stull 습구), `_kma_asos_hourly_stn`(data.go.kr ASOS 시간자료), `_kma_ncst_hourly`+`_dfs_grid`(초단기실황·격자변환), `kma_hourly_cached`(공용 캐시), `_provider_for`(데모=mock/실계정=실연동), `compare()`.
- `services/analytics.py` — KPI·노출시간 집계(`kpi_summary`, `daily_report_data`), 권고문구(`_GUIDANCE`).
- `services/report.py` — **보고서 생성 엔진.** `_daily_detail`+`_DAILY_TEMPLATE`(일일 PDF), `export_excel`(측정 기록부, 출력 단위 인자), `_mpl_*`/`_mpl_compare`(matplotlib 차트), `periodic_pdf`.
- `services/ingest.py` — TXT 업로드 파싱(`_assert_kweather_txt` 케이웨더 고유 포맷만 통과, `_upsert_logs` 배치 upsert).
- `routers/` — `auth, devices, upload, data, dashboard(kpi/timeseries/data-range), weather(compare), reports(daily/periodic/export.xlsx), admin(overview/system), geocode`.
- `models.py`(Tenant/Device/SensorLog/ExternalDailyCache/AccessLog), `deps.py`(get_tenant/block_demo/is_admin), `database.py`(_ensure_columns 부팅시 ALTER 보강).

**프론트 `frontend/src/`**
- `renew/` — 현 운영 UI(Dev 트랙). `DashboardProvider.tsx`(상태·데이터 로드, weekly 7일 집계), `RenewRoot.tsx`(셸), `pages/{DashboardPage,ReportPage}.tsx`.
- `components/ui/NavbarNested.tsx`(+`.module.css`) — 좌측 사이드바(STS 기기 이미지 상단·측정기 목록·위험단계 범례).
- `components/{AuthScreen,TimeSeriesChart,AdminPage,SiteFooterLinks}.tsx`.
- `public/sts-device.jpg` — STS 실제 제품 사진. `api.ts`/`types.ts` — API 클라이언트·타입.

---

## 5. 핵심 도메인 규칙 (반드시 보존)

- **위험단계(체감온도):** 관심 31 / 주의 33 / 경고 35 / 위험 38 ℃. 색: `#84cc16 / #eab308(주의는 일부 UI #facc15) / #f97316 / #dc2626`. KPI 배지는 "기간 최고" 기준.
- **폭염 정책(고용노동부 2026 대책, 2026.5.13.):** 폭염중대경보(체감 38℃↑) 신설, 단계별 작업중지(주의=조정·단축 / 경고=14~17시 옥외중지 / 위험=긴급조치 외 중지), **체감 33℃↑ 작업 시 2시간마다 20분 휴식 법적의무**(산안규칙 '25.7.17.), 폭염안전 5대 기본수칙. 반영 위치 4곳 동기화: `analytics._GUIDANCE`, `report.py`(분석문구·푸터), `HeatGuidelines.tsx`.
- **노출시간 산정:** 측정간격(중앙값) 반영 + "기준 이상" 누적, 표기 "X시간 Y분". KPI·웹보고서·PDF 3곳 동일.
- **외부 기상청 체감 매칭:** 측정 당시 매시각 외부 ta/hm → `kma_feels_like`로 외부 체감 산출 → 내부(측정) vs 외부(기상청) **체감 vs 체감** 비교.

---

## 6. 외부 기상청 데이터 연동 (실계정)

- **시간자료:** data.go.kr **ASOS `getWthrDataList`**(JSON). 키 = data.go.kr 서비스키(64hex, 서버 DB appsettings에만). 일 한도 **1,000,000건**(사실상 무제한, 앱은 기기·일자당 1회+캐시).
- **당일/최근 보완:** ASOS 발표지연으로 당일이 비어 → **초단기실황 `getUltraSrtNcst`(VilageFcstInfoService_2.0)** 폴백(위경도→격자 변환). 둘 다 없으면 보고서에 "발표 지연" 안내(`has_external` 플래그).
- **런타임 설정(서버 DB appsettings):** `WEATHER_PROVIDER=kma`, `KMA_API_KEY=<data.go.kr 서비스키>`. 데모는 `_provider_for`로 mock 합성(실호출 안 함).
- apihub.kma.go.kr은 이 서버에서 **아웃바운드 차단**(IP 등록 필요) — 그래서 data.go.kr 경로 사용.

---

## 7. 이번 세션(2026-06-22) 작업 요약 — 전부 배포·커밋 완료

| 커밋 | 내용 |
|------|------|
| `43624af` | **측정 기록부 Excel 출력 단위 선택**(10/30/60분·사용자지정, 기본 1시간=24행, 평균 집계) |
| `09f817e` | **초단기실황 폴백** — ASOS 미발표 당일/최근 외부 빈 날짜 메움 |
| `ff77f60` | 시작화면 글자 확대·가독성, **배경=야외 작업현장**, 명칭 "프로그램→**소프트웨어**" 전체 통일 |
| `a8180c7`→`66fd355`→`b5a490d` | 좌측 사이드바: 소프트웨어 제목 + **STS 기기 이미지**(실제 사진) + 위험단계 범례, **기기 이미지 맨 상단 / 측정기 목록 그 아래** 재배치 |
| `ff24e96` | **최근 7일 체감온도 위젯 과학화** — 값 라벨·일평균 선·위험단계 임계 점선·℃축·상세 툴팁·범례 |
| `02aedff` | **일일 보고서 1~4번을 1페이지에** 채워 배치(공백 최소화), 5~7·부록은 2페이지(총 2페이지 유지) |

(미커밋: `frontend/public/favicon.png` 로컬 수정만 남아있음 — 의도 확인 필요.)

---

## 8. 운영·유지보수

- **PostgreSQL 16.9 (5433)** 사용 중. PG12(5432)는 롤백용 보존. 백업 `pg_dump`는 **`/usr/lib/postgresql/16/bin/pg_dump`** 사용(시스템 기본은 12).
- **cron(hduser):** 02:00 일일 백업(`/opt/kweather/maint/backup_db.sh`, 14개 보존), 03:30 access_logs 90일 정리.
- **관리자 페이지:** `ADMIN_EMAILS` 일치 계정만. `/api/admin/overview`(이용현황) + `/api/admin/system`(DB/디스크/메모리/외부호출/백업 모니터링).

---

## 9. 자격증명·시크릿 위치 (값은 비공개)

| 항목 | 위치 |
|------|------|
| 서버 SSH(hduser 비번) | 운영자 보관 · 배포 시 `$env:STS_PW`로 주입 |
| data.go.kr 서비스키 | 서버 DB appsettings(`KMA_API_KEY`) — 깃·로그 금지 |
| Supabase/Vercel/Kakao 키 | 어시스턴트 로컬 메모리(`kweather-dashboard.md`) · Vercel env |
| DB 접속 | 서버 `/opt/kweather/backend/.env` (`DATABASE_URL`) |

⚠️ 이 저장소는 공개 — **시크릿을 커밋 금지.** `_*.py`/`_cm.txt`는 .gitignore.

---

## 10. 다음 단계 — IoT 기반 실시간 폭염대응 솔루션 (별도 신규 프로젝트)

> **목표:** 이 시스템(STS, 과거기록 분석)을 토대로, **실시간 IoT 센서 스트림 → 즉시 위험감지 → 자동 알림·작업중지 권고**까지 수행하는 별도 솔루션을 만든다. 새 대화에서 이 절을 출발점으로 사용.

### 10.1 그대로 재사용할 자산 (이 저장소에서)
- **도메인 로직:** `heat.py`(위험단계 분류·색), `weather.kma_feels_like`(체감온도 공식), `analytics`의 노출시간/권고 산정, 폭염정책 문구.
- **보고서 엔진:** `report.py`(실시간 솔루션의 *정기 요약 리포트*로 재사용 — 일일/주간).
- **프론트 디자인 시스템:** Mantine 테마·`NavbarNested`·`TimeSeriesChart`·STS 이미지·위험단계 범례·AuthScreen·관리자 패널.
- **인프라 패턴:** FastAPI+SQLAlchemy 구조, 멀티테넌트 인증, PostgreSQL, paramiko 배포 파이프라인, 관리자 모니터링.

### 10.2 새로 필요한 것 (실시간 IoT 고유)
1. **실시간 수집(ingestion):** 두 갈래 중 선택 —
   - (A) **케이웨더 IoT Open API 폴링** — 과거 이 저장소에 `KW_IOT_*`(base `iot/groups/v2`, `KW_IOT_USER_ID`, 단일 키)로 구현했다가 제거한 이력 있음(git 히스토리·메모리 참조). 키 하나로 IoT+날씨 모두 동작했음.
   - (B) **MQTT 브로커**(EMQX/Mosquitto) — 센서가 직접 publish, 백엔드 subscribe. 가장 "실시간"답고 확장적.
2. **시계열 저장·조회:** PostgreSQL + **TimescaleDB**(하이퍼테이블) 권장. 최신값은 Redis 캐시.
3. **실시간 푸시:** FastAPI **WebSocket/SSE** → 대시보드 라이브 게이지·라이브 지도·알림 피드.
4. **경보 엔진(핵심 차별점):** 임계 교차(관심→주의→경고→위험) 감지 → **단계별 자동 대응**: 알림(카카오 알림톡/SMS/이메일/Slack/webhook), 작업중지·휴식의무 자동 권고, 에스컬레이션·중복억제(디바운스)·이력.
5. **백그라운드 워커:** 폴링/평가 루프(Celery/APScheduler/asyncio task) + Redis pub/sub.

### 10.3 권장 아키텍처(초안)
```
[STS IoT 센서]──(MQTT 또는 KW IoT API)──> [수집 워커]──> [Redis(최신값/pub-sub)] + [TimescaleDB(이력)]
                                                  └──> [경보 엔진]──> 알림(알림톡/SMS/메일/webhook)
[FastAPI]──WebSocket/SSE──> [React 라이브 대시보드]   (정기요약은 기존 report.py 재사용)
```

### 10.4 새 대화 첫 스텝(제안 순서)
1. 이 저장소를 **베이스로 복제/포크**(또는 신규 repo). "기록 분석 전용" 가드(`block_demo`·라이브 제거 잔재) 정리.
2. **데이터 소스 결정**(케이웨더 IoT API vs 직접 MQTT) — 사용자 확인 필요.
3. 수집 워커 + Timescale 스키마 + WebSocket 엔드포인트 PoC.
4. 경보 엔진 + 1개 알림 채널(예: 카카오 알림톡) MVP.
5. 라이브 대시보드(게이지/지도/알림 피드) — 기존 컴포넌트 재활용.

### 10.5 새 대화 시작 시 사용자에게 먼저 확인할 것
- 센서 데이터 **수집 방식**(케이웨더 IoT Open API 사용 가능 여부·키 / 아니면 MQTT 직결).
- **알림 채널** 우선순위(카카오 알림톡 / SMS / 이메일 / Slack / webhook)와 발송 계정·승인.
- **실시간 인프라** 도입 허용(TimescaleDB·Redis·MQTT 브로커) 및 **호스팅**(현 sts 서버 공용 vs 신규 서버).
- 신규 repo로 분리 여부(권장) vs 현 repo 내 별도 디렉터리.

---

### 빠른 참조
- 자가호스트 배포: 로컬 빌드 → paramiko tar 업로드 → (백엔드)`systemctl restart kweather` / (프론트)dist 교체. 비번 `$env:STS_PW`.
- PDF 검증: fitz로 PNG 렌더 + pypdf 텍스트 추출.
- 데모 미리보기: `localStorage 'kw_api_key'='demo-key'` 후 preview.
- 상세 운영지식은 어시스턴트 메모리 `kweather-dashboard.md`(자동 로드)에 누적되어 있음.
