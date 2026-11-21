// 기간 통계 보고서 PDF "생성전 HTML" — xhtml2pdf 호환, 일일 보고서와 동일 디자인(심리스 표·미니멀 헤더·페이지번호).
import { PERIODIC_CODES, PERIODIC_LEVELS, type PeriodicData } from "./periodicSample";

const THRESH: Record<string, number> = { attention: 31, caution: 33, warning: 35, danger: 38 };
const fmtMin = (m: number) => (!m || m <= 0 ? "0분" : (m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`));

export function renderPeriodicReportHtml(
  d: PeriodicData,
  opts: { generated?: string; trendChart?: string | null; font?: string; previewMargins?: boolean } = {},
): string {
  const generated = opts.generated ?? `${d.end} 09:42`;
  const font = opts.font ?? '"Pretendard Variable", Pretendard, -apple-system, sans-serif';
  const bodyPad = opts.previewMargins ? "padding:30px;" : "margin:0;";
  const chartBox = opts.trendChart
    ? `<div style="margin-top:5pt;"><img src="${opts.trendChart}" style="width:100%; display:block;"/></div>`
    : `<div class="chartph">일자별 최고 체감온도 트렌드 그래프<div class="chartph-sub">PDF 생성 시 서버 렌더 PNG 차트가 삽입됩니다</div></div>`;
  const pageFooter = opts.previewMargins
    ? `<div class="pagenum">1 / 1</div>`
    : `<div id="pageFooter" class="pagenum"><pdf:pagenumber> / <pdf:pagecount></div>`;

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
@page { size: A4; margin: 30px; @frame footer_frame { -pdf-frame-content: pageFooter; bottom: 12px; left: 30px; right: 30px; height: 14px; } }
body { font-family: ${font}; font-size: 9pt; color:#1f2937; line-height:1.5; ${bodyPad} }
table { width:100%; border-collapse: collapse; }

.band td { padding: 0 0 9px 0; vertical-align: bottom; border-bottom: 1px solid #cbd5e1; }
.band-r { text-align:right; width:34%; }
.band-title { color:#0f172a; font-size:16pt; font-weight:bold; letter-spacing:-0.4pt; }
.band-id { color:#64748b; font-size:8pt; letter-spacing:0.3pt; margin-top:3pt; }
.band-meta { color:#94a3b8; font-size:7pt; }
.band-date { color:#0f172a; font-size:11pt; font-weight:bold; margin-top:1pt; }

.hero td { border-bottom:1px solid #e2e8f0; padding:8px 12px; vertical-align:top; }
.hero .mid { border-left:1px solid #e8edf3; border-right:1px solid #e8edf3; }
.hero-label { font-size:7pt; color:#64748b; font-weight:bold; letter-spacing:0.3pt; }
.hero-val { font-size:21pt; font-weight:bold; letter-spacing:-0.5pt; margin-top:1pt; }
.hero-unit { font-size:10pt; color:#94a3b8; font-weight:bold; }
.hero-sub { font-size:7pt; color:#94a3b8; margin-top:2pt; }
.hero-badge { display:inline-block; padding:3px 12px; border-radius:9px; color:#fff; font-weight:bold; font-size:12pt; }

.docinfo { margin-top:8pt; }
.docinfo td { padding:6px 8px; font-size:8.4pt; border-bottom:1px solid #eef2f6; }
.docinfo .k { color:#64748b; width:14%; font-weight:bold; }

h2 { font-size:12pt; color:#0f172a; margin:15pt 0 6pt 0; padding:0; font-weight:bold; }
h2 .no { color:#0c3d85; font-weight:bold; margin-right:5px; }

.tbl th { padding:7px 8px; font-size:8.4pt; color:#64748b; font-weight:bold; text-align:center; border-bottom:1.5px solid #334155; }
.tbl td { padding:6px 8px; font-size:8.8pt; text-align:center; border-bottom:1px solid #eef2f6; }
.tbl .k { color:#475569; font-weight:bold; text-align:left; }
.num { font-weight:bold; font-size:10pt; }

.chartph { border:1px dashed #cbd5e1; background:#f8fafc; color:#94a3b8; text-align:center; padding:22px 0; font-size:9pt; margin-top:5pt; border-radius:6px; }
.chartph-sub { font-size:7pt; margin-top:3pt; color:#b6c2d1; }
.list div { margin:2pt 0; font-size:9pt; }
.list .b { color:#16a34a; font-weight:bold; }
.note { font-size:7.6pt; color:#64748b; margin:2pt 0; }
.footer { margin-top:9pt; border-top:1.5px solid #0c3d85; padding-top:5pt; font-size:7pt; color:#64748b; line-height:1.45; }
.pagenum { text-align:right; font-size:7.5pt; color:#94a3b8; margin-top:6pt; }
</style></head><body>

<table class="band"><tr>
  <td class="band-l">
    <div class="band-title">폭염 안전관리 기간 분석 보고서</div>
    <div class="band-id">${d.reportNo}</div>
  </td>
  <td class="band-r">
    <div class="band-meta">분석 기간</div>
    <div class="band-date">${d.start} ~ ${d.end}</div>
  </td>
</tr></table>

<table class="hero"><tr>
  <td>
    <div class="hero-label">기간 최고 체감온도</div>
    <div class="hero-val" style="color:${d.peak_level.color}">${d.overall_max_feels}<span class="hero-unit"> ℃</span></div>
    <div class="hero-sub">기간 내 일 최고값</div>
  </td>
  <td class="mid">
    <div class="hero-label">위험단계 도달 일수 (38℃↑)</div>
    <div class="hero-val" style="color:${d.danger_days > 0 ? "#dc2626" : "#16a34a"}">${d.danger_days}<span class="hero-unit"> 일</span></div>
    <div class="hero-sub">총 ${d.days}일 중</div>
  </td>
  <td>
    <div class="hero-label">최고 위험단계</div>
    <div style="margin-top:5pt;"><span class="hero-badge" style="background:${d.peak_level.color}">${d.peak_level.label}</span></div>
    <div class="hero-sub">기간 내 최고 단계</div>
  </td>
</tr></table>

<h2><span class="no">1</span> 측정 대상 개요</h2>
<table class="docinfo">
  <tr><td class="k">사업장</td><td style="width:36%">${d.company}</td>
      <td class="k">설치 위치</td><td>${d.location}</td></tr>
  <tr><td class="k">분석 기간</td><td>${d.start} ~ ${d.end} (${d.days}일)</td>
      <td class="k">측정기</td><td>케이웨더(주) 체감온도계 (SN: ${d.sn})</td></tr>
</table>
<p class="note">※ 모든 측정 데이터는 <b>케이웨더(주) 체감온도계 장비</b>로 측정·수집된 자료임. · 작성 일시 ${generated}</p>

<h2><span class="no">2</span> 위험 단계별 도달 일수</h2>
<table class="tbl">
  <tr><th style="width:16%; text-align:left;">위험 단계</th>${PERIODIC_CODES.map((c) => `<th style="color:${PERIODIC_LEVELS[c].color}; border-bottom:2.5px solid ${PERIODIC_LEVELS[c].color};">${PERIODIC_LEVELS[c].label} (${THRESH[c]}℃↑)</th>`).join("")}</tr>
  <tr><td class="k">도달 일수</td>${PERIODIC_CODES.map((c) => `<td class="num" style="color:${PERIODIC_LEVELS[c].color}">${d.level_counts[c]}일</td>`).join("")}</tr>
</table>
<p class="note">※ 각 단계 기준 체감온도 이상에 일 최고 체감온도가 도달한 일수 · 단계 기준: 고용노동부 폭염 단계별 대응요령(체감온도)</p>

<h2><span class="no">3</span> 일자별 최고 체감온도 트렌드</h2>
${chartBox}
<table class="tbl">
  <tr><th style="text-align:left;">일자</th><th>최고 체감</th><th>최고 기온</th><th>주의(33℃↑) 노출</th><th>최고단계</th></tr>
  ${d.daily.map((row) => `<tr>
    <td class="k">${row.date}</td>
    <td class="num" style="color:${row.level.color}">${row.max_feels}℃</td>
    <td>${row.max_temp}℃</td>
    <td>${fmtMin(row.minutes_over_33)}</td>
    <td style="color:${row.level.color}; font-weight:bold;">${row.level.label}</td>
  </tr>`).join("")}
</table>

<h2><span class="no">4</span> 종합 분석 및 권고</h2>
<div class="list">${d.analysis.map((a) => `<div><span class="b">○</span> ${a}</div>`).join("")}</div>

<div class="footer">
  적용 기준: 고용노동부 「2026 폭염 대비 노동자 건강보호 대책」 · 산업안전보건기준에 관한 규칙 제566조 · 기상청 폭염특보(주의보 33℃ / 경보 35℃ / 중대경보 38℃)<br/>
  측정장비·데이터: 현장 측정값은 <b>케이웨더(주) 체감온도계 장비</b>로 측정되었으며, 모든 데이터 출처는 <b>케이웨더(주)</b>입니다. · 본 보고서는 자동 생성되었습니다.
</div>
${pageFooter}
</body></html>`;
}
