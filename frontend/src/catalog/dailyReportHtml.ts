// 일일 보고서 PDF "생성전 HTML" 리디자인 — 카탈로그 우측 칼럼 프리뷰용.
// xhtml2pdf(pisa) CSS 서브셋 호환: 테이블 레이아웃 + 단순 CSS(flexbox 금지).
// 필드명은 백엔드 _daily_detail()의 `d` 와 동일 → 확정 후 backend report.py Jinja2 로 1:1 포팅.
import type { PdfData } from "./reportSample";

const CODES = ["attention", "caution", "warning", "danger"] as const;

/** 재설계 PDF HTML(문자열). chartImg* 가 주어지면(백엔드 PNG data-uri) 삽입, 없으면(카탈로그) 플레이스홀더. */
export function renderDailyReportHtml(
  d: PdfData,
  opts: { reportNo?: string; generated?: string; chartHourly?: string | null; chartCompare?: string | null; heatmap?: string | null; font?: string; previewMargins?: boolean } = {},
): string {
  const reportNo = opts.reportNo ?? `KW-HS-${d.date.replace(/-/g, "")}-${d.device_sn.slice(-4)}`;
  const generated = opts.generated ?? `${d.date} 09:42`;
  const font = opts.font ?? '"Pretendard Variable", Pretendard, -apple-system, sans-serif';
  // 브라우저 미리보기에서 A4 인쇄 여백(@page margin)을 시뮬레이션 — 실제 PDF는 @page 가 처리(포팅 시 제외).
  const bodyPad = opts.previewMargins ? "padding:60px;" : "margin:0;";

  const chartBox = (label: string, img?: string | null) =>
    img
      ? `<div class="chartwrap"><img src="${img}" class="chartimg"/></div>`
      : `<div class="chartph">${label}<div class="chartph-sub">PDF 생성 시 서버 렌더 PNG 차트가 삽입됩니다</div></div>`;

  const hourlyStrip = `
  <table class="h24">
    <tr><td class="h24k" style="width:34pt;">시각</td>${d.hours.map((h) => `<td class="h24k">${String(h.hour).padStart(2, "0")}</td>`).join("")}</tr>
    <tr><td class="h24k">체감(℃)</td>${d.hours.map((h) => `<td style="background:${h.color}; color:#fff; font-weight:bold;">${h.feels ?? "-"}</td>`).join("")}</tr>
  </table>`;

  // 히트맵: 캡처 PNG(웹 라운드칩 동일) 우선, 없으면 테이블 폴백
  const heatmapHtml = opts.heatmap ? `<img src="${opts.heatmap}" style="width:100%; display:block;"/>` : hourlyStrip;

  const workHours = d.hours.filter((h) => h.hour >= 9 && h.hour < 18);

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
@page { size: A4; margin: 60px; }
body { font-family: ${font}; font-size: 9pt; color:#1f2937; line-height:1.5; ${bodyPad} }
table { width:100%; border-collapse: collapse; }

/* 헤더 — 미니멀(네이비 밴드 제거, 영문 부제 → 식별번호) */
.band { margin-bottom: 0; }
.band td { padding: 0 0 9px 0; vertical-align: bottom; border-bottom: 1px solid #cbd5e1; }
.band-r { text-align:right; width:30%; }
.band-title { color:#0f172a; font-size:16pt; font-weight:bold; letter-spacing:-0.4pt; }
.band-id { color:#64748b; font-size:8pt; letter-spacing:0.3pt; margin-top:3pt; }
.band-meta { color:#94a3b8; font-size:7pt; }
.band-date { color:#0f172a; font-size:12pt; font-weight:bold; margin-top:1pt; }

/* 요약 히어로 스트립 */
.hero td { border-bottom:1px solid #e2e8f0; padding:8px 12px; vertical-align:top; }
.hero .mid { border-left:1px solid #e8edf3; border-right:1px solid #e8edf3; }
.hero-label { font-size:7pt; color:#64748b; font-weight:bold; letter-spacing:0.3pt; }
.hero-val { font-size:21pt; font-weight:bold; letter-spacing:-0.5pt; margin-top:1pt; }
.hero-unit { font-size:10pt; color:#94a3b8; font-weight:bold; }
.hero-sub { font-size:7pt; color:#94a3b8; margin-top:2pt; }
.hero-badge { display:inline-block; padding:3px 12px; border-radius:9px; color:#fff; font-weight:bold; font-size:12pt; }

/* 문서정보 */
.docinfo { margin-top:8pt; }
.docinfo td { border:1px solid #d7dee7; padding:4px 8px; font-size:8.4pt; }
.docinfo .k { background:#f4f7fb; color:#475569; width:14%; font-weight:bold; }

/* 섹션 */
h2 { font-size:11pt; color:#0f172a; margin:11pt 0 4pt 0; padding-left:7px; border-left:3px solid #0c3d85; }
h2 .no { color:#0c3d85; font-weight:bold; }
h2 .ex { font-size:7.8pt; color:#64748b; font-weight:normal; }

.tbl th { border:1px solid #b8c4d2; background:#eef2f7; padding:4px 6px; font-size:8.4pt; color:#334155; text-align:center; }
.tbl td { border:1px solid #d7dee7; padding:3px 5px; font-size:8.6pt; text-align:center; }
.tbl .k { background:#f4f7fb; color:#475569; font-weight:bold; }
.tbl .work { background:#fbfdff; }
.num { font-weight:bold; font-size:10pt; }

.h24 { table-layout:fixed; margin-top:2pt; }
.h24 td { border:1px solid #fff; padding:2px 0; text-align:center; font-size:5.6pt; line-height:1.25; }
.h24 .h24k { background:#f1f5f9; color:#475569; font-size:6pt; font-weight:bold; }

.chartph { border:1px dashed #cbd5e1; background:#f8fafc; color:#94a3b8; text-align:center; padding:22px 0; font-size:9pt; margin-top:5pt; border-radius:6px; }
.chartph-sub { font-size:7pt; margin-top:3pt; color:#b6c2d1; }
.chartwrap { margin-top:5pt; }
.chartimg { width:480pt; }

.alert { border:1px solid #fca5a5; background:#fef2f2; color:#b91c1c; padding:5px 8px; font-size:8.4pt; margin:4px 0; border-radius:4px; }
.list div { margin:2pt 0; font-size:9pt; }
.list .b { color:#0c3d85; font-weight:bold; }
.list.g div .b { color:#16a34a; }
.note { font-size:7.6pt; color:#64748b; margin:2pt 0; }
.footer { margin-top:9pt; border-top:1.5px solid #0c3d85; padding-top:5pt; font-size:7pt; color:#64748b; line-height:1.45; }
</style></head><body>

<table class="band"><tr>
  <td class="band-l">
    <div class="band-title">폭염 안전관리 일일 보고서</div>
    <div class="band-id">${reportNo}</div>
  </td>
  <td class="band-r">
    <div class="band-meta">대상 일자</div>
    <div class="band-date">${d.date}</div>
  </td>
</tr></table>

<table class="hero"><tr>
  <td>
    <div class="hero-label">최고 체감온도</div>
    <div class="hero-val" style="color:${d.peak_color}">${d.max_feels}<span class="hero-unit"> ℃</span></div>
    <div class="hero-sub">${d.max_time} 발생 · 근무시간 기준</div>
  </td>
  <td class="mid">
    <div class="hero-label">위험단계 노출 (38℃↑)</div>
    <div class="hero-val" style="color:#dc2626">${d.level_minutes_label.danger}</div>
    <div class="hero-sub">온열질환 고위험 누적</div>
  </td>
  <td>
    <div class="hero-label">최고 위험단계</div>
    <div style="margin-top:5pt;"><span class="hero-badge" style="background:${d.peak_color}">${d.peak_label}</span></div>
    <div class="hero-sub">기간 내 최고 단계</div>
  </td>
</tr></table>

<h2><span class="no">1</span> 측정 대상 개요</h2>
<table class="docinfo">
  <tr><td class="k">사업장</td><td style="width:36%">${d.company_name || "-"}</td>
      <td class="k">설치 위치</td><td>${d.location_name || "-"}</td></tr>
  <tr><td class="k">소재지</td><td>${d.address || "-"}</td>
      <td class="k">측정기기</td><td>케이웨더(주) 체감온도계 (SN: ${d.device_sn})</td></tr>
</table>
<p class="note">※ 본 보고서의 모든 측정 데이터는 <b>케이웨더(주) 체감온도계 장비</b>로 측정·수집된 자료임. · 작성 일시 ${generated}</p>

<h2><span class="no">2</span> 측정 결과 요약 <span class="ex">(근무시간 09:00~18:00)</span></h2>
<table class="tbl">
  <tr><th style="width:20%">구분</th><th>최고 체감온도</th><th>발생 시각</th><th>최고 기온</th><th>위험단계(38℃↑) 노출</th></tr>
  <tr class="work"><td class="k">근무시간</td>
    <td class="num" style="color:${d.work.peak_color}">${d.work.max_feels}℃</td>
    <td>${d.work.max_time}</td><td class="num">${d.work.max_temp}℃</td>
    <td class="num" style="color:#dc2626">${d.work.minutes_label.danger}</td></tr>
  <tr><td class="k">전일(24시간)</td>
    <td class="num" style="color:${d.peak_color}">${d.max_feels}℃</td>
    <td>${d.max_time}</td><td class="num">${d.max_temp}℃</td>
    <td class="num" style="color:#dc2626">${d.level_minutes_label.danger}</td></tr>
</table>

<h2><span class="no">3</span> 폭염 위험단계별 노출시간 분석</h2>
<table class="tbl">
  <tr><th style="width:16%">위험 단계</th>${CODES.map((c) => `<th style="background:${d.levels[c].color}; color:#fff;">${d.levels[c].label}</th>`).join("")}</tr>
  <tr><td class="k">기준(체감)</td><td>31℃ 이상</td><td>33℃ 이상</td><td>35℃ 이상</td><td>38℃ 이상</td></tr>
  <tr class="work"><td class="k">근무시간 노출</td>${CODES.map((c) => `<td><b>${d.work.minutes_label[c]}</b></td>`).join("")}</tr>
  <tr><td class="k">전일 노출</td>${CODES.map((c) => `<td>${d.level_minutes_label[c]}</td>`).join("")}</tr>
</table>
<p class="note">※ 각 단계 기준 체감온도 이상 누적 노출시간 · 단계 기준: 고용노동부 폭염 단계별 대응요령(체감온도)</p>

<h2><span class="no">4</span> 시간별 체감온도 변화 <span class="ex">(전일 24시간 · 테두리=근무시간)</span></h2>
${heatmapHtml}
${chartBox("시간별 체감온도 변화 그래프", opts.chartHourly)}
<p class="note">※ 표 색상 = 시간대별 폭염 위험단계 · 그래프 점선 = 단계 임계값</p>

<h2><span class="no">5</span> 내·외부 기온 비교 분석 <span class="ex">(외부: 케이웨더 기상관측자료)</span></h2>
<table class="tbl" style="margin-bottom:4pt;">
  <tr><th style="width:24%">구분</th><th>최고 체감온도</th><th>일 최고기온</th><th>일 평균기온</th></tr>
  <tr><td class="k">외부 · 기상청 공식</td>
    <td class="num" style="color:#1790cd;">${d.external_daily.out_feels_max}℃</td>
    <td>${d.external_daily.out_max}℃</td><td>${d.external_daily.out_avg}℃</td></tr>
  <tr><td class="k">작업장(내부 측정)</td>
    <td class="num" style="color:#dc2626;">${d.max_feels}℃</td>
    <td>${d.external_daily.in_max}℃</td><td>${d.external_daily.in_avg}℃</td></tr>
  <tr><td class="k">최고 체감온도 차(내-외)</td>
    <td class="num" style="color:#b91c1c;">+${d.external_daily.diff_feels}℃</td>
    <td colspan="2" style="text-align:left; font-size:8pt; color:#64748b;">작업장 체감온도가 외부 대비 높을수록 복사열·밀폐 영향이 큼</td></tr>
</table>
${d.weather.enclosed_alert ? `<div class="alert"><b>[경고] 밀폐형 폭염 사업장</b> — 내부 체감온도가 외부 공식 체감온도 대비 최대 ${d.weather.max_delta}℃, 평균 ${d.weather.avg_delta}℃ 높게 측정됨(관리 임계 ${d.weather.threshold}℃ 초과). 환기·차열·국소냉방 등 작업환경 개선 필요.</div>` : ""}
${chartBox("내부 체감 vs 외부 기온 비교 그래프", opts.chartCompare)}
<table class="tbl">
  <tr><th class="k" style="width:15%">시각</th>${workHours.map((h) => `<th>${h.hour}시</th>`).join("")}</tr>
  <tr><td class="k">내부 체감(℃)</td>${workHours.map((h) => `<td style="color:${h.color}; font-weight:bold;">${h.feels ?? "-"}</td>`).join("")}</tr>
  <tr><td class="k">외부 체감(℃)</td>${workHours.map((h) => `<td style="color:#1790cd; font-weight:bold;">${h.out_feels ?? "-"}</td>`).join("")}</tr>
  <tr><td class="k">체감차(내-외)</td>${workHours.map((h) => `<td${h.delta >= 5 ? ' style="color:#b91c1c; font-weight:bold;"' : ""}>${h.delta ?? "-"}</td>`).join("")}</tr>
</table>

<h2><span class="no">6</span> 종합 분석</h2>
<div class="list">${d.analysis.map((a) => `<div><span class="b">□</span> ${a}</div>`).join("")}</div>

<h2><span class="no">7</span> 조치사항 및 권고 <span class="ex">(최고 위험단계 「${d.peak_label}」 기준)</span></h2>
<div class="list g">${d.guidance.map((g) => `<div><span class="b">○</span> ${g}</div>`).join("")}</div>

<h2><span class="no">8</span> 법정 휴식 의무 <span class="ex">(산업안전보건규칙 — 체감 33℃↑ 작업 시 2시간마다 20분 이상)</span></h2>
${d.work.hot_minutes > 0 ? `<table class="tbl">
  <tr><th style="width:40%">근무시간(09~18) 체감 33℃↑ 작업</th><th>법정 최소 휴식 횟수</th><th>법정 최소 휴식 시간</th></tr>
  <tr><td class="num" style="color:#b45309;">${d.work.hot_label}</td><td class="num">${d.work.legal_rest_count}회</td><td class="num" style="color:#b45309;">${d.work.legal_rest_label}</td></tr>
</table>
<p class="note">※ 측정 체감온도 기반 <b>법정 최소 의무량</b>(2시간 작업당 20분). 실제 부여한 휴식 기록과 대조하여 준수 여부를 확인하십시오.</p>`
  : `<p class="note">근무시간 중 체감온도 33℃ 이상 작업이 없어 추가 의무 휴식 대상이 아님.</p>`}

<div class="footer">
  적용 기준: 고용노동부 「2026 폭염 대비 노동자 건강보호 대책」 · 폭염안전 5대 기본수칙(시원한 물·냉방장치·휴식(33℃↑ 2시간마다 20분)·보냉장구·119) · 산업안전보건기준에 관한 규칙 제566조 · 기상청 폭염특보(주의보 33℃ / 경보 35℃ / 중대경보 38℃)<br/>
  측정장비·데이터: 현장 측정값은 <b>케이웨더(주) 체감온도계 장비</b>로 측정되었으며, 모든 데이터 출처는 <b>케이웨더(주)</b>입니다. · 본 보고서는 자동 생성되었습니다.
</div>
</body></html>`;
}
