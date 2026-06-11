"""리포트 자동 생성 (PRD 3.4).

- PDF: (있으면) matplotlib 차트(서버 렌더) + Jinja2 HTML + xhtml2pdf (A4, page-break)
- Excel: openpyxl (요약 + 로우데이터, 정렬된 .xlsx)
한글 폰트는 번들된 NanumGothic 우선, 없으면 Windows '맑은 고딕'.

서버리스(Vercel) 용량 한도를 위해 matplotlib 는 선택적 의존성으로 처리한다.
설치되어 있으면 PDF 에 차트 이미지를 임베드하고, 없으면 표·가이드만 출력한다.
"""
from __future__ import annotations

import base64
import io
import os
from datetime import date as date_cls, datetime, time

import pandas as pd
from jinja2 import Template
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy.orm import Session
from xhtml2pdf import pisa

from .. import heat
from ..config import settings
from ..models import Device, Tenant
from . import analytics

# ---- matplotlib (선택적): 없으면 차트 이미지 생략 ----
try:
    import matplotlib

    matplotlib.use("Agg")  # GUI 없는 서버 렌더
    import matplotlib.dates as mdates
    import matplotlib.pyplot as plt
    from matplotlib import font_manager

    HAS_MPL = True
except Exception:  # noqa: BLE001
    HAS_MPL = False

# ---- 한글 폰트 등록 ----
from reportlab.pdfbase import pdfmetrics  # noqa: E402
from reportlab.pdfbase.ttfonts import TTFont as RLTTFont  # noqa: E402
from xhtml2pdf.default import DEFAULT_FONT  # noqa: E402

_BUNDLED_FONT = os.path.join(os.path.dirname(__file__), "..", "fonts", "NanumGothic-Regular.ttf")
_FONT_CANDIDATES = [
    os.path.normpath(_BUNDLED_FONT),  # 배포(Linux)/로컬 공통 — 저장소에 동봉
    r"C:\Windows\Fonts\malgun.ttf",
    r"C:\Windows\Fonts\malgunsl.ttf",
]
_FONT_PATH = next((p for p in _FONT_CANDIDATES if os.path.exists(p)), None)
_PDF_FONT = "Helvetica"  # 폴백
if _FONT_PATH:
    if HAS_MPL:
        font_manager.fontManager.addfont(_FONT_PATH)
        plt.rcParams["font.family"] = font_manager.FontProperties(fname=_FONT_PATH).get_name()
    # reportlab 에 폰트 등록 + 패밀리(굵게/기울임도 동일 한글 폰트로) 매핑.
    # @font-face 는 Windows 에서 임시파일 잠금 버그가 있으므로 사용하지 않고,
    # xhtml2pdf 의 폰트 매핑 테이블(DEFAULT_FONT)에 직접 등록해 font-family 를 해석시킨다.
    try:
        pdfmetrics.registerFont(RLTTFont("KFont", _FONT_PATH))
        pdfmetrics.registerFontFamily(
            "KFont", normal="KFont", bold="KFont", italic="KFont", boldItalic="KFont"
        )
        DEFAULT_FONT["kfont"] = "KFont"
        _PDF_FONT = "KFont"
    except Exception:  # noqa: BLE001
        _PDF_FONT = "Helvetica"
if HAS_MPL:
    plt.rcParams["axes.unicode_minus"] = False


def _fig_to_data_uri(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight")
    plt.close(fig)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _daily_chart(db: Session, tenant: Tenant, device_sn: str, on_date: date_cls) -> str | None:
    if not HAS_MPL:
        return None
    start = datetime.combine(on_date, time.min)
    end = datetime.combine(on_date, time.max)
    ts = analytics.time_series(db, tenant, device_sn, start, end, 10)
    if not ts.points:
        return None
    xs = [p.t for p in ts.points]
    feels = [p.feels_like for p in ts.points]
    temps = [p.temperature for p in ts.points]

    fig, ax = plt.subplots(figsize=(9, 3.6))
    ax.plot(xs, feels, color="#dc2626", linewidth=2, label="체감온도(A-TEMP)")
    ax.plot(xs, temps, color="#2563eb", linewidth=1.2, alpha=0.7, label="온도(TEMP)")
    for key, lvl in (("attention", "관심"), ("caution", "주의"), ("warning", "경고"), ("danger", "위험")):
        ax.axhline(heat.thresholds()[key], color=heat.LEVELS[key].color, linestyle="--", linewidth=0.9, alpha=0.7)
    ax.set_ylabel("온도 (°C)")
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%H:%M"))
    ax.legend(loc="upper left", fontsize=8)
    ax.grid(True, alpha=0.25)
    ax.set_title(f"{device_sn} — {on_date.isoformat()} 체감온도 추이")
    return _fig_to_data_uri(fig)


def _daily_detail(db: Session, tenant: Tenant, device_sn: str, on_date: date_cls) -> dict:
    """일일 상세 리포트용 데이터 — KPI, 단계별 지속시간, 시간대별 집계, 내부 vs 외부(기상청) 비교, 분석 코멘트."""
    from . import weather as weather_svc  # 지연 임포트(순환 방지)

    start = datetime.combine(on_date, time.min)
    end = datetime.combine(on_date, time.max)
    dev = db.get(Device, device_sn)
    th = heat.thresholds()
    df = analytics.load_logs(db, [device_sn], start, end)

    out: dict = {
        "device_sn": device_sn,
        "company_name": dev.company_name if dev else None,
        "location_name": dev.location_name if dev else None,
        "address": dev.address if dev else None,
        "date": on_date.isoformat(),
        "levels": heat.LEVELS,
        "has_data": not df.empty,
    }
    if df.empty:
        safe = heat.LEVELS["safe"]
        out.update(
            peak_label=safe.label, peak_color=safe.color, guidance=analytics._GUIDANCE["safe"],
            hours=[], level_minutes={}, total_minutes=0, weather=None, analysis=[],
            external_daily=None, avg_humidity=None,
        )
        return out

    feels, temps, humi = df["feels_like"], df["temperature"], df["humidity"]
    n = len(df)
    idx_max = feels.idxmax()
    max_feels = round(float(feels.loc[idx_max]), 1)
    max_time = pd.to_datetime(df.loc[idx_max, "measured_at"]).strftime("%H:%M")
    peak = heat.classify(max_feels)

    # 단계별 누적 분 (1분 주기 가정)
    lm = {
        "danger": int((feels >= th["danger"]).sum()),
        "warning": int(((feels >= th["warning"]) & (feels < th["danger"])).sum()),
        "caution": int(((feels >= th["caution"]) & (feels < th["warning"])).sum()),
        "attention": int(((feels >= th["attention"]) & (feels < th["caution"])).sum()),
        "safe": int((feels < th["attention"]).sum()),
    }

    # 시간대별 평균
    s = df.set_index("measured_at")[["temperature", "feels_like", "humidity"]].resample("1h").mean()

    # 외부(기상청) 비교 — 시간단위
    try:
        cmp = weather_svc.compare(db, tenant, device_sn, start, end, 60)
    except Exception:  # noqa: BLE001
        cmp = None
    out_by_h = {pd.Timestamp(p.t).hour: p.outdoor_temperature for p in cmp.points} if cmp else {}
    del_by_h = {pd.Timestamp(p.t).hour: p.delta for p in cmp.points} if cmp else {}

    hours = []
    for idx, row in s.iterrows():
        h = idx.hour
        f = None if pd.isna(row["feels_like"]) else round(float(row["feels_like"]), 1)
        lvl = heat.classify(f)
        hours.append({
            "hour": h, "feels": f,
            "temp": None if pd.isna(row["temperature"]) else round(float(row["temperature"]), 1),
            "humidity": None if pd.isna(row["humidity"]) else int(round(float(row["humidity"]))),
            "label": lvl.label, "color": lvl.color,
            "outdoor": out_by_h.get(h), "delta": del_by_h.get(h),
        })

    deltas = [x["delta"] for x in hours if x["delta"] is not None]
    avg_delta = round(sum(deltas) / len(deltas), 1) if deltas else None
    avg_humi = round(float(humi.mean()), 1) if humi.notna().any() else None

    weather = None
    if cmp:
        weather = {
            "provider": cmp.provider, "max_delta": cmp.max_delta, "avg_delta": avg_delta,
            "enclosed_alert": cmp.enclosed_alert, "threshold": cmp.enclosed_threshold,
        }

    # 외부 일별 요약(과거자료): 해당 일자의 외부 평균/최고/최저 기온 + 평균 습도
    external_daily = None
    provider = weather_svc.get_provider()
    if hasattr(provider, "past_daily"):
        try:
            ed = provider.past_daily(dev.latitude, dev.longitude, dev.region_code, on_date)
            if ed and (ed.get("avg") is not None or ed.get("max") is not None):
                in_max = round(float(temps.max()), 1)
                in_avg = round(float(temps.mean()), 1)
                external_daily = {
                    "region": ed.get("region"), "source": ed.get("source"),
                    "out_avg": ed.get("avg"), "out_max": ed.get("max"), "out_min": ed.get("min"), "out_humi": ed.get("humi"),
                    "in_avg": in_avg, "in_max": in_max,
                    "diff_max": round(in_max - float(ed["max"]), 1) if ed.get("max") is not None else None,
                }
        except Exception:  # noqa: BLE001
            external_daily = None

    # 자동 분석 코멘트
    analysis: list[str] = []
    if lm["danger"]:
        analysis.append(f"체감온도 38°C(위험) 이상이 하루 {lm['danger']}분 지속되어 옥외작업 원칙적 중지 기준에 해당합니다.")
    analysis.append(f"최고 체감온도는 {max_time}에 {max_feels}°C 로 정점에 도달했습니다.")
    if weather and cmp.enclosed_alert:
        analysis.append(
            f"내부 체감온도가 외부({cmp.provider}) 기온보다 최대 {cmp.max_delta}°C 높아 '밀폐형 폭염 사업장'으로 "
            f"분류됩니다(경고 임계 {cmp.enclosed_threshold}°C). 환기·차열·국소냉방 등 작업환경 개선이 시급합니다."
        )
    elif weather and avg_delta is not None:
        analysis.append(f"내부 체감온도가 외부 기온보다 평균 {avg_delta}°C 높습니다(최대 {cmp.max_delta}°C).")
    if avg_humi is not None and avg_humi >= 70:
        analysis.append(f"평균 습도 {avg_humi}%의 고온다습 환경으로 땀 증발이 저해되어 온열질환 위험이 가중됩니다.")

    out.update(
        max_feels=max_feels, max_time=max_time, max_temp=round(float(temps.max()), 1),
        avg_feels=round(float(feels.mean()), 1), avg_humidity=avg_humi, record_count=n,
        range_start=pd.to_datetime(df["measured_at"].min()).strftime("%H:%M"),
        range_end=pd.to_datetime(df["measured_at"].max()).strftime("%H:%M"),
        peak_label=peak.label, peak_color=peak.color, guidance=analytics._GUIDANCE[peak.code],
        level_minutes=lm, total_minutes=n, hours=hours, weather=weather, analysis=analysis,
        external_daily=external_daily,
    )
    if external_daily and external_daily.get("out_max") is not None:
        analysis.append(
            f"외부({external_daily['source']}) 일 최고기온 {external_daily['out_max']}°C 대비 현장 최고온도 "
            f"{external_daily['in_max']}°C 로 {external_daily['diff_max']}°C 차이입니다."
        )
    return out


_DAILY_TEMPLATE = Template(
    """
<html><head><style>
@page { size: A4; margin: 1.4cm; }
body { font-family: "{{ pdf_font }}"; font-size: 9pt; color:#1e293b; }
h1 { font-size: 15pt; margin:0 0 2px 0; }
h2 { font-size: 10.5pt; margin:12px 0 4px 0; padding-bottom:2px; border-bottom:1.5px solid #1e293b; }
.sub { color:#64748b; font-size:8.5pt; }
.hr { border:0; border-top:2px solid #1e293b; margin:4px 0 8px 0; }
table { width:100%; border-collapse: collapse; }
.kpi td { border:1px solid #e2e8f0; padding:6px 8px; }
.kpi .k { background:#f8fafc; color:#475569; font-size:8pt; width:16%; }
.kpi .v { font-weight:bold; font-size:11pt; width:17%; }
.badge { display:inline-block; padding:2px 9px; border-radius:9px; color:#fff; font-weight:bold; }
.bars td { padding:2px 4px; vertical-align:middle; }
.bars .bl { width:120px; font-size:8.5pt; }
.bars .bv { width:70px; text-align:right; font-size:8.5pt; color:#334155; }
.track { background:#f1f5f9; width:100%; }
.strip { table-layout:fixed; margin-top:4px; }
.strip td { border:1px solid #fff; padding:3px 0; text-align:center; color:#fff; font-size:6pt; line-height:1.15; }
.cmp th, .cmp td { border:1px solid #e2e8f0; padding:3px 4px; text-align:center; font-size:8pt; }
.cmp .rowh { background:#f8fafc; text-align:left; color:#475569; }
.alert { border:1px solid #fecaca; background:#fef2f2; color:#b91c1c; padding:6px 9px; border-radius:6px; font-size:8.5pt; margin:4px 0; }
.note li, .guide li { margin:2px 0; font-size:8.8pt; }
.footer { color:#94a3b8; font-size:7.5pt; margin-top:12px; border-top:1px solid #e2e8f0; padding-top:4px; }
</style></head><body>

<h1>일일 안전관리 종합 보고서</h1>
<div class="sub">
  사업장: <b>{{ d.company_name or '-' }}</b> &nbsp;|&nbsp; 설치위치: {{ d.location_name or '-' }} &nbsp;|&nbsp; {{ d.address or '' }}<br/>
  기기 SN: {{ d.device_sn }} &nbsp;|&nbsp; 일자: {{ d.date }} ({{ d.range_start }}~{{ d.range_end }}, {{ d.record_count }}건)
  &nbsp;|&nbsp; 최고 위험단계: <span class="badge" style="background:{{ d.peak_color }}">{{ d.peak_label }}</span>
</div>
<hr class="hr"/>

<h2>1. 측정 요약</h2>
<table class="kpi">
  <tr>
    <td class="k">최고 체감온도</td><td class="v" style="color:{{ d.peak_color }}">{{ d.max_feels }}°C</td>
    <td class="k">발생 시각</td><td class="v">{{ d.max_time }}</td>
    <td class="k">최고 온도</td><td class="v">{{ d.max_temp }}°C</td>
  </tr>
  <tr>
    <td class="k">평균 체감온도</td><td class="v">{{ d.avg_feels }}°C</td>
    <td class="k">평균 습도</td><td class="v">{{ d.avg_humidity if d.avg_humidity is not none else '-' }}%</td>
    <td class="k">위험(38°C↑) 지속</td><td class="v" style="color:#dc2626">{{ d.level_minutes['danger'] }}분</td>
  </tr>
</table>

<h2>2. 폭염 위험 단계별 지속시간</h2>
<table class="cmp">
  <tr><th class="rowh">위험 단계</th>{% for code in ['safe','attention','caution','warning','danger'] %}<th style="background:{{ d.levels[code].color }}; color:#fff;">{{ d.levels[code].label }}</th>{% endfor %}</tr>
  <tr><td class="rowh">지속시간</td>{% for code in ['safe','attention','caution','warning','danger'] %}<td>{{ d.level_minutes[code] }}분</td>{% endfor %}</tr>
  <tr><td class="rowh">비율</td>{% for code in ['safe','attention','caution','warning','danger'] %}<td>{{ ((d.level_minutes[code] / d.total_minutes * 100) | round(0) | int) if d.total_minutes else 0 }}%</td>{% endfor %}</tr>
</table>

<h2>3. 시간대별 체감온도 추이 (시간평균, 단계 색상)</h2>
{% if d.hours %}
<table class="strip"><tr>
{% for h in d.hours %}
  <td style="background:{{ h.color }}">{{ '%02d'|format(h.hour) }}시<br/><b>{{ h.feels if h.feels is not none else '-' }}</b></td>
{% endfor %}
</tr></table>
{% else %}<p class="sub">해당 일자의 측정 데이터가 없습니다.</p>{% endif %}
{% if chart %}<div style="margin-top:6px;"><img src="{{ chart }}" style="width:480pt;"/></div>{% endif %}

<h2>4. 내부(현장) vs 외부 날씨 비교 분석</h2>
{% if d.external_daily %}
  <table class="cmp" style="margin-bottom:6px;">
    <tr><th class="rowh">구분</th><th>일 평균기온</th><th>일 최고기온</th><th>일 최저기온</th><th>평균 습도</th></tr>
    <tr><td class="rowh">외부 ({{ d.external_daily.region or '관측' }})</td>
        <td>{{ d.external_daily.out_avg if d.external_daily.out_avg is not none else '-' }}°C</td>
        <td>{{ d.external_daily.out_max if d.external_daily.out_max is not none else '-' }}°C</td>
        <td>{{ d.external_daily.out_min if d.external_daily.out_min is not none else '-' }}°C</td>
        <td>{{ d.external_daily.out_humi if d.external_daily.out_humi is not none else '-' }}%</td></tr>
    <tr><td class="rowh">현장(내부)</td>
        <td>{{ d.external_daily.in_avg }}°C</td>
        <td style="font-weight:bold; color:#dc2626;">{{ d.external_daily.in_max }}°C</td>
        <td>-</td><td>{{ d.avg_humidity if d.avg_humidity is not none else '-' }}%</td></tr>
  </table>
  <div class="sub" style="margin-bottom:6px;">※ 외부 출처: {{ d.external_daily.source }} · 현장 최고온도가 외부 일 최고보다 <b>{{ d.external_daily.diff_max }}°C</b> {{ '높음' if (d.external_daily.diff_max or 0) >= 0 else '낮음' }} (복사열·밀폐 영향 지표)</div>
{% endif %}
{% if d.weather %}
  {% if d.weather.enclosed_alert %}
  <div class="alert">⚠️ <b>밀폐형 폭염 사업장 경고</b> — 내부 체감온도가 외부({{ d.weather.provider }}) 대비 최대 {{ d.weather.max_delta }}°C, 평균 {{ d.weather.avg_delta }}°C 높습니다(경고 임계 {{ d.weather.threshold }}°C 초과).</div>
  {% endif %}
  <table class="cmp">
    <tr><th class="rowh">시각</th>{% for h in d.hours if h.hour % 2 == 0 %}<th>{{ h.hour }}시</th>{% endfor %}</tr>
    <tr><td class="rowh">내부 체감(°C)</td>{% for h in d.hours if h.hour % 2 == 0 %}<td style="color:{{ h.color }}; font-weight:bold;">{{ h.feels if h.feels is not none else '-' }}</td>{% endfor %}</tr>
    <tr><td class="rowh">외부 기온(°C)</td>{% for h in d.hours if h.hour % 2 == 0 %}<td>{{ h.outdoor if h.outdoor is not none else '-' }}</td>{% endfor %}</tr>
    <tr><td class="rowh">격차(내부-외부)</td>{% for h in d.hours if h.hour % 2 == 0 %}<td>{{ h.delta if h.delta is not none else '-' }}</td>{% endfor %}</tr>
  </table>
  <div class="sub" style="margin-top:3px;">※ 외부 로우데이터 출처: {{ '기상청 관측(케이웨더 제공)' if d.weather.provider == 'kweather' else ('기상청 ASOS' if d.weather.provider == 'kma' else '시뮬레이션(키 미설정)') }}. 격차가 클수록 복사열·밀폐 영향이 큼.</div>
{% elif not d.external_daily %}
  <p class="sub">해당 일자의 외부 과거 날씨 데이터가 없습니다. (케이웨더 과거 아카이브는 약 4개월 지연 — 최근 날짜 미수록. 기상청 ASOS 직접연동 키 설정 시 최근 일자도 조회됩니다.)</p>
{% endif %}

<h2>5. 종합 분석</h2>
<ul class="note">{% for a in d.analysis %}<li>{{ a }}</li>{% endfor %}</ul>

<h2>6. 안전조치 이행 가이드</h2>
<ul class="guide">{% for g in d.guidance %}<li>{{ g }}</li>{% endfor %}</ul>

<div class="footer">본 보고서는 케이웨더 체감온도계 연동 대시보드에서 자동 생성되었습니다. · 위험단계 기준(체감온도): 관심 31 / 주의 33 / 경고 35 / 위험 38°C · 생성일 {{ generated }}</div>
</body></html>
"""
)


def _html_to_pdf(html: str) -> bytes:
    buf = io.BytesIO()
    pisa.CreatePDF(src=html, dest=buf, encoding="utf-8")
    return buf.getvalue()


def daily_pdf(db: Session, tenant: Tenant, device_sn: str, on_date: date_cls, generated: str) -> bytes:
    # 시간대별 히트스트립(섹션3)이 추이를 시각화하므로, 한 페이지에 담기 위해 별도 라인차트는 생략.
    d = _daily_detail(db, tenant, device_sn, on_date)
    html = _DAILY_TEMPLATE.render(d=d, chart=None, pdf_font=_PDF_FONT, generated=generated)
    return _html_to_pdf(html)


_PERIODIC_TEMPLATE = Template(
    """
<html><head><style>
body { font-family: "{{ pdf_font }}"; font-size: 10pt; color:#111; }
h1 { font-size: 16pt; border-bottom: 2px solid #1e293b; padding-bottom:4px; }
.sub { color:#475569; font-size:9pt; margin-bottom:10px; }
table { width:100%; border-collapse: collapse; margin: 8px 0; }
th, td { border:1px solid #cbd5e1; padding:4px 6px; text-align:center; }
th { background:#f1f5f9; }
.footer { color:#94a3b8; font-size:8pt; margin-top:16px; }
</style></head><body>
<h1>기간 통계 보고서 (주간/월간)</h1>
<div class="sub">대상: {{ scope }} &nbsp;|&nbsp; 기간: {{ s.start }} ~ {{ s.end }}</div>

<table>
  <tr><th>기간 최고 체감온도</th><td>{{ s.overall_max_feels if s.overall_max_feels is not none else '-' }} °C</td>
      <th>기간 평균 체감온도</th><td>{{ s.overall_avg_feels if s.overall_avg_feels is not none else '-' }} °C</td></tr>
</table>

<h3>위험 단계 도달 일수</h3>
<table><tr>
  {% for code, lvl in levels.items() %}<th style="background:{{ lvl.color }}; color:#fff">{{ lvl.label }}</th>{% endfor %}
</tr><tr>
  {% for code in levels %}<td>{{ s.level_counts[code] }} 일</td>{% endfor %}
</tr></table>

{% if chart %}<img src="{{ chart }}" style="width:480pt;"/>{% endif %}

<h3>일자별 트렌드</h3>
<table>
<tr><th>일자</th><th>최고 체감(°C)</th><th>평균 체감(°C)</th><th>최고온도(°C)</th><th>평균습도(%)</th><th>33°C↑(분)</th><th>단계</th></tr>
{% for row in s.daily %}
<tr><td>{{ row.date }}</td><td>{{ row.max_feels }}</td><td>{{ row.avg_feels }}</td>
<td>{{ row.max_temp }}</td><td>{{ row.avg_humidity if row.avg_humidity is not none else '-' }}</td>
<td>{{ row.minutes_over_33 }}</td><td>{{ row.peak_label }}</td></tr>
{% endfor %}
</table>
<div class="footer">자동 생성 {{ generated }}</div>
</body></html>
"""
)


def _periodic_chart(stats: dict) -> str | None:
    if not HAS_MPL or not stats["daily"]:
        return None
    days = [r["date"] for r in stats["daily"]]
    maxf = [r["max_feels"] for r in stats["daily"]]
    avgf = [r["avg_feels"] for r in stats["daily"]]
    fig, ax = plt.subplots(figsize=(9, 3.4))
    ax.plot(days, maxf, "o-", color="#dc2626", label="일 최고 체감온도")
    ax.plot(days, avgf, "o-", color="#f59e0b", label="일 평균 체감온도")
    ax.set_ylabel("체감온도 (°C)")
    ax.tick_params(axis="x", rotation=45, labelsize=7)
    ax.legend(fontsize=8)
    ax.grid(True, alpha=0.25)
    return _fig_to_data_uri(fig)


def periodic_pdf(
    db: Session, tenant: Tenant, device_sn: str | None, start: date_cls, end: date_cls, generated: str
) -> bytes:
    stats = analytics.periodic_stats(db, tenant, device_sn, start, end)
    scope = device_sn or "전체 기기"
    if device_sn:
        dev = db.get(Device, device_sn)
        if dev and dev.company_name:
            scope = f"{dev.company_name} ({device_sn})"
    html = _PERIODIC_TEMPLATE.render(
        s=stats, scope=scope, levels=heat.LEVELS, chart=_periodic_chart(stats),
        pdf_font=_PDF_FONT, generated=generated,
    )
    return _html_to_pdf(html)


# ---------------- Excel ----------------
_HEADER_FILL = PatternFill("solid", fgColor="1E293B")
_HEADER_FONT = Font(color="FFFFFF", bold=True)


def _style_header(ws, ncols: int):
    for c in range(1, ncols + 1):
        cell = ws.cell(row=1, column=c)
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
        cell.alignment = Alignment(horizontal="center")


def export_excel(
    db: Session, tenant: Tenant, device_sn: str | None, start: datetime, end: datetime
) -> bytes:
    sns = analytics._resolve_scope(db, tenant, device_sn)
    df = analytics.load_logs(db, sns, start, end)

    wb = Workbook()

    # --- 시트1: 일자별 요약 ---
    ws1 = wb.active
    ws1.title = "일자별요약"
    headers1 = ["일자", "기기SN", "최고체감(°C)", "평균체감(°C)", "최고온도(°C)", "평균습도(%)", "33°C↑(분)", "최고단계"]
    ws1.append(headers1)
    if not df.empty:
        df["day"] = df["measured_at"].dt.date
        for (day, sn), g in df.groupby(["day", "device_sn"]):
            lvl = heat.classify(float(g["feels_like"].max()))
            ws1.append([
                day.isoformat(), sn,
                round(float(g["feels_like"].max()), 1),
                round(float(g["feels_like"].mean()), 1),
                round(float(g["temperature"].max()), 1),
                round(float(g["humidity"].mean()), 1) if g["humidity"].notna().any() else None,
                int((g["feels_like"] >= settings.HEAT_CAUTION).sum()),
                lvl.label,
            ])
    _style_header(ws1, len(headers1))

    # --- 시트2: 로우데이터 ---
    ws2 = wb.create_sheet("로우데이터")
    headers2 = ["측정일시", "기기SN", "온도(°C)", "습도(%)", "체감온도(°C)"]
    ws2.append(headers2)
    if not df.empty:
        for r in df.sort_values(["device_sn", "measured_at"]).itertuples(index=False):
            ws2.append([
                pd.Timestamp(r.measured_at).strftime("%Y-%m-%d %H:%M:%S"),
                r.device_sn,
                None if pd.isna(r.temperature) else round(float(r.temperature), 1),
                None if pd.isna(r.humidity) else int(r.humidity),
                None if pd.isna(r.feels_like) else round(float(r.feels_like), 1),
            ])
    _style_header(ws2, len(headers2))

    for ws, widths in ((ws1, [12, 16, 12, 12, 12, 12, 10, 10]), (ws2, [22, 16, 10, 10, 12])):
        for i, w in enumerate(widths, start=1):
            ws.column_dimensions[chr(64 + i)].width = w

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
