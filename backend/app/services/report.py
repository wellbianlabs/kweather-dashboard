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
from sqlalchemy import select
from sqlalchemy.orm import Session
from xhtml2pdf import pisa

from .. import heat
from ..config import settings
from ..models import Device, ExternalDailyCache, Tenant
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
            external_daily=None, avg_humidity=None, work=None,
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

    # 근무시간(09:00~18:00) 통계 — 근로자 보호 관점의 핵심 구간
    hrs = df["measured_at"].dt.hour
    wdf = df[(hrs >= 9) & (hrs < 18)]
    work = None
    if not wdf.empty:
        wfeels = wdf["feels_like"]
        widx = wfeels.idxmax()
        wpeak = heat.classify(round(float(wfeels.max()), 1))
        work = {
            "max_feels": round(float(wfeels.max()), 1),
            "max_time": pd.to_datetime(wdf.loc[widx, "measured_at"]).strftime("%H:%M"),
            "max_temp": round(float(wdf["temperature"].max()), 1),
            "avg_feels": round(float(wfeels.mean()), 1),
            "danger_minutes": int((wfeels >= th["danger"]).sum()),
            "minutes": {
                "danger": int((wfeels >= th["danger"]).sum()),
                "warning": int(((wfeels >= th["warning"]) & (wfeels < th["danger"])).sum()),
                "caution": int(((wfeels >= th["caution"]) & (wfeels < th["warning"])).sum()),
                "attention": int(((wfeels >= th["attention"]) & (wfeels < th["caution"])).sum()),
                "safe": int((wfeels < th["attention"]).sum()),
            },
            "total": len(wdf),
            "peak_label": wpeak.label, "peak_color": wpeak.color,
        }

    weather = None
    if cmp:
        weather = {
            "provider": cmp.provider, "max_delta": cmp.max_delta, "avg_delta": avg_delta,
            "enclosed_alert": cmp.enclosed_alert, "threshold": cmp.enclosed_threshold,
        }

    # 외부 일별 요약(과거자료): 캐시 우선(불변 과거데이터) → 미스 시 외부 조회 후 캐시
    external_daily = None
    provider = weather_svc.get_provider()
    ds_key = on_date.strftime("%Y%m%d")
    ed = None
    cached = db.scalar(
        select(ExternalDailyCache).where(
            ExternalDailyCache.device_sn == device_sn, ExternalDailyCache.ymd == ds_key
        )
    )
    if cached and (cached.max_temp is not None or cached.avg_temp is not None):
        ed = {
            "avg": float(cached.avg_temp) if cached.avg_temp is not None else None,
            "max": float(cached.max_temp) if cached.max_temp is not None else None,
            "min": float(cached.min_temp) if cached.min_temp is not None else None,
            "humi": float(cached.humidity) if cached.humidity is not None else None,
            "source": cached.source, "region": cached.region,
        }
    elif hasattr(provider, "past_daily"):
        try:
            ed = provider.past_daily(dev.latitude, dev.longitude, dev.region_code, on_date)
        except Exception:  # noqa: BLE001
            ed = None
        if ed and (ed.get("avg") is not None or ed.get("max") is not None):
            try:
                db.add(ExternalDailyCache(
                    device_sn=device_sn, ymd=ds_key,
                    avg_temp=ed.get("avg"), max_temp=ed.get("max"), min_temp=ed.get("min"),
                    humidity=ed.get("humi"), source=ed.get("source"), region=ed.get("region"),
                ))
                db.commit()
            except Exception:  # noqa: BLE001
                db.rollback()

    if ed and (ed.get("avg") is not None or ed.get("max") is not None):
        in_max = round(float(temps.max()), 1)
        in_avg = round(float(temps.mean()), 1)
        external_daily = {
            "region": ed.get("region"), "source": ed.get("source"),
            "out_avg": ed.get("avg"), "out_max": ed.get("max"), "out_min": ed.get("min"), "out_humi": ed.get("humi"),
            "in_avg": in_avg, "in_max": in_max,
            "diff_max": round(in_max - float(ed["max"]), 1) if ed.get("max") is not None else None,
        }

    # 자동 분석 코멘트
    analysis: list[str] = []
    if work:
        analysis.append(
            f"근무시간(09:00~18:00) 중 최고 체감온도는 {work['max_time']}경 {work['max_feels']}°C(단계: {work['peak_label']})이며, "
            f"위험단계(38°C 이상) 노출이 {work['danger_minutes']}분 누적됨."
        )
    if lm["danger"]:
        analysis.append(f"체감온도 38°C(위험) 이상 노출이 일일 {lm['danger']}분 누적되어 고용노동부 기준상 옥외작업 원칙적 중지 대상에 해당함.")
    analysis.append(f"최고 체감온도는 {max_time}경 {max_feels}°C로 관측되어 일중 최고치를 기록함.")
    src_label = "케이웨더" if (cmp and cmp.provider in ("kweather", "kma")) else "참고용 추정"
    if weather and cmp.enclosed_alert:
        analysis.append(
            f"작업장 내부 체감온도가 외부({src_label}) 기온 대비 최대 {cmp.max_delta}°C 높게 측정되어 "
            f"'밀폐형 폭염 사업장'에 해당함(관리 임계 {cmp.enclosed_threshold}°C 초과). 환기·차열·국소냉방 등 작업환경 개선 필요."
        )
    elif weather and avg_delta is not None:
        analysis.append(f"작업장 내부 체감온도가 외부({src_label}) 기온 대비 평균 {avg_delta}°C 높게 측정됨(최대 {cmp.max_delta}°C).")
    if avg_humi is not None and avg_humi >= 70:
        analysis.append(f"평균 습도 {avg_humi}%의 고온다습 환경으로 체열 발산이 저해되어 온열질환 발생 위험이 가중되는 조건임.")

    out.update(
        max_feels=max_feels, max_time=max_time, max_temp=round(float(temps.max()), 1),
        avg_feels=round(float(feels.mean()), 1), avg_humidity=avg_humi, record_count=n,
        range_start=pd.to_datetime(df["measured_at"].min()).strftime("%H:%M"),
        range_end=pd.to_datetime(df["measured_at"].max()).strftime("%H:%M"),
        peak_label=peak.label, peak_color=peak.color, guidance=analytics._GUIDANCE[peak.code],
        level_minutes=lm, total_minutes=n, hours=hours, weather=weather, analysis=analysis,
        external_daily=external_daily, work=work,
    )
    if external_daily and external_daily.get("out_max") is not None:
        analysis.append(
            f"외부({external_daily['source']}) 일 최고기온 {external_daily['out_max']}°C 대비 작업장 최고기온 "
            f"{external_daily['in_max']}°C로 {external_daily['diff_max']}°C 편차를 보임."
        )
    return out


_DAILY_TEMPLATE = Template(
    """
<html><head><style>
@page { size: A4; margin: 1.5cm 1.6cm; }
body { font-family: "{{ pdf_font }}"; font-size: 9pt; color:#1f2937; line-height:1.5; }
.title { text-align:center; font-size:16pt; font-weight:bold; color:#0f172a; margin:0 0 3pt 0; }
table { width:100%; border-collapse: collapse; }

/* 문서정보 */
.subtitle { text-align:center; font-size:9pt; color:#64748b; margin:0 0 6pt 0; padding-bottom:6pt; border-bottom:1.5px solid #0f499e; }
.docinfo td { border:1px solid #cbd5e1; padding:4px 8px; font-size:8.5pt; }
.docinfo .k { background:#f8fafc; color:#475569; width:14%; text-align:center; }

/* 섹션 */
h2 { font-size:11pt; color:#0f172a; margin:13pt 0 5pt 0; }
h2 .no { color:#0f499e; }
.tbl th { border:1px solid #94a3b8; background:#eef2f7; padding:4px 6px; font-size:8.5pt; color:#334155; text-align:center; }
.tbl td { border:1px solid #cbd5e1; padding:4px 6px; font-size:8.8pt; text-align:center; }
.tbl .k { background:#f8fafc; color:#475569; text-align:center; }
.num { font-weight:bold; font-size:10pt; }
.badge { display:inline-block; padding:1.5px 8px; border-radius:8px; color:#fff; font-weight:bold; font-size:8.5pt; }
.strip { table-layout:fixed; }
.strip td { border:1px solid #fff; padding:2.5px 0; text-align:center; color:#fff; font-size:6pt; line-height:1.2; }
.alert { border:1px solid #fca5a5; background:#fef2f2; color:#b91c1c; padding:5px 8px; font-size:8.5pt; margin:4px 0; }
.gov { margin:2pt 0 0 0; }
.gov div { margin:2.5pt 0; font-size:9pt; }
.gov .b { color:#0f499e; font-weight:bold; }
.gov2 { margin:2pt 0 0 8pt; }
.gov2 div { margin:2.5pt 0; font-size:9pt; }
.gov2 .b { color:#334155; }
.note { font-size:7.8pt; color:#64748b; }
.footer { margin-top:14pt; border-top:1.5px solid #0f499e; padding-top:5pt; font-size:7.5pt; color:#64748b; }
</style></head><body>

<div class="title">폭염 안전관리 일일 보고서</div>
<div class="subtitle">근로자 온열질환 예방을 위한 작업장 체감온도 분석 자료 · 측정장비: 케이웨더(주) 체감온도계</div>

<table class="docinfo">
  <tr>
    <td class="k">보고서 번호</td><td style="width:36%">{{ report_no }}</td>
    <td class="k">작성 일시</td><td>{{ generated }}</td>
  </tr>
  <tr>
    <td class="k">대상 일자</td><td>{{ d.date }}{% if d.has_data %} ({{ d.range_start }}~{{ d.range_end }}, 총 {{ d.record_count }}건 측정){% endif %}</td>
    <td class="k">최고 위험단계</td><td><span class="badge" style="background:{{ d.peak_color }}">{{ d.peak_label }}</span></td>
  </tr>
</table>

<h2><span class="no">1.</span> 측정 대상 개요</h2>
<table class="tbl">
  <tr><th style="width:14%">사업장</th><td style="width:36%">{{ d.company_name or '-' }}</td>
      <th style="width:14%">설치 위치</th><td>{{ d.location_name or '-' }}</td></tr>
  <tr><th>소재지</th><td>{{ d.address or '-' }}</td>
      <th>측정기기</th><td>케이웨더(주) 체감온도계 (SN: {{ d.device_sn }})</td></tr>
</table>
<p class="note">※ 본 보고서의 모든 측정 데이터는 <b>케이웨더(주) 체감온도계 장비</b>로 측정·수집된 자료임.</p>

{% if d.has_data %}
<h2><span class="no">2.</span> 측정 결과 요약 <span style="font-size:8pt; color:#64748b; font-weight:normal;">(근무시간: 09:00~18:00)</span></h2>
<table class="tbl">
  <tr><th style="width:17%">구분</th><th>최고 체감온도</th><th>발생 시각</th><th>최고 기온</th><th>평균 체감온도</th><th>위험단계(38°C↑) 노출</th></tr>
  {% if d.work %}
  <tr style="background:#fbfdff;">
    <td class="k"><b>근무시간</b></td>
    <td class="num" style="color:{{ d.work.peak_color }}">{{ d.work.max_feels }}°C</td>
    <td>{{ d.work.max_time }}</td>
    <td class="num">{{ d.work.max_temp }}°C</td>
    <td>{{ d.work.avg_feels }}°C</td>
    <td class="num" style="color:#dc2626">{{ d.work.danger_minutes }}분</td>
  </tr>
  {% endif %}
  <tr>
    <td class="k">전일(24시간)</td>
    <td class="num" style="color:{{ d.peak_color }}">{{ d.max_feels }}°C</td>
    <td>{{ d.max_time }}</td>
    <td class="num">{{ d.max_temp }}°C</td>
    <td>{{ d.avg_feels }}°C</td>
    <td class="num" style="color:#dc2626">{{ d.level_minutes['danger'] }}분</td>
  </tr>
</table>
<p class="note">※ 평균 습도(전일): {{ d.avg_humidity if d.avg_humidity is not none else '-' }}% · 근로자 보호 관점에서 근무시간(09~18시) 수치를 우선 검토</p>

<h2><span class="no">3.</span> 폭염 위험단계별 노출시간 분석</h2>
<table class="tbl">
  <tr><th style="width:14%">위험 단계</th>{% for code in ['safe','attention','caution','warning','danger'] %}<th style="background:{{ d.levels[code].color }}; color:#fff;">{{ d.levels[code].label }}</th>{% endfor %}</tr>
  <tr><td class="k">기준(체감)</td><td>31°C 미만</td><td>31°C 이상</td><td>33°C 이상</td><td>35°C 이상</td><td>38°C 이상</td></tr>
  {% if d.work %}<tr style="background:#fbfdff;"><td class="k"><b>근무시간 노출</b></td>{% for code in ['safe','attention','caution','warning','danger'] %}<td><b>{{ d.work.minutes[code] }}분</b></td>{% endfor %}</tr>{% endif %}
  <tr><td class="k">전일 노출</td>{% for code in ['safe','attention','caution','warning','danger'] %}<td>{{ d.level_minutes[code] }}분</td>{% endfor %}</tr>
  <tr><td class="k">전일 비율</td>{% for code in ['safe','attention','caution','warning','danger'] %}<td>{{ ((d.level_minutes[code] / d.total_minutes * 100) | round(1)) if d.total_minutes else 0 }}%</td>{% endfor %}</tr>
</table>
<p class="note">※ 측정주기(1분) 기준 누적 노출시간 · 근무시간 = 09:00~18:00 · 단계 기준: 고용노동부 폭염 단계별 대응요령(체감온도)</p>

<h2><span class="no">4.</span> 근무시간대 체감온도 현황 <span style="font-size:8pt; color:#64748b; font-weight:normal;">(09:00~18:00, 시간평균)</span></h2>
{% if d.hours %}
<table class="strip"><tr>
{% for h in d.hours if h.hour >= 9 and h.hour < 18 %}
  <td style="background:{{ h.color }}; font-size:7.5pt; padding:4px 0;">{{ '%02d'|format(h.hour) }}~{{ '%02d'|format(h.hour+1) }}시<br/><b style="font-size:9pt;">{{ h.feels if h.feels is not none else '-' }}</b><br/>{{ h.label }}</td>
{% endfor %}
</tr></table>
<p class="note">※ 셀 색상·표기는 해당 시간대 평균 체감온도의 폭염 위험단계 · 출퇴근(09시 이전/18시 이후) 시간대는 전일 통계에 포함</p>
{% endif %}
{% if chart %}<div style="margin-top:4pt;"><img src="{{ chart }}" style="width:480pt;"/></div>{% endif %}

<div style="page-break-before: always;"></div>
<h2 style="margin-top:0;"><span class="no">5.</span> 내·외부 기온 비교 분석 <span style="font-size:8pt; color:#64748b; font-weight:normal;">(근무시간 기준 · 외부: 케이웨더 기상관측자료)</span></h2>
{% if d.external_daily %}
  <table class="tbl" style="margin-bottom:4pt;">
    <tr><th style="width:22%">구분</th><th>일 평균기온</th><th>일 최고기온</th><th>일 최저기온</th><th>평균 습도</th></tr>
    <tr><td class="k">외부 ({{ d.external_daily.region or '관측' }})</td>
        <td>{{ d.external_daily.out_avg if d.external_daily.out_avg is not none else '-' }}°C</td>
        <td>{{ d.external_daily.out_max if d.external_daily.out_max is not none else '-' }}°C</td>
        <td>{{ d.external_daily.out_min if d.external_daily.out_min is not none else '-' }}°C</td>
        <td>{{ d.external_daily.out_humi if d.external_daily.out_humi is not none else '-' }}%</td></tr>
    <tr><td class="k">작업장(내부)</td>
        <td>{{ d.external_daily.in_avg }}°C</td>
        <td class="num" style="color:#dc2626;">{{ d.external_daily.in_max }}°C</td>
        <td>-</td><td>{{ d.avg_humidity if d.avg_humidity is not none else '-' }}%</td></tr>
  </table>
  <p class="note">※ 출처: {{ d.external_daily.source }} · 작업장 최고기온이 외부 일 최고기온 대비 {{ d.external_daily.diff_max }}°C {{ '높음' if (d.external_daily.diff_max or 0) >= 0 else '낮음' }} (복사열·환기 영향 지표)</p>
{% endif %}
{% if d.weather %}
  {% if d.weather.enclosed_alert %}
  <div class="alert"><b>[경고] 밀폐형 폭염 사업장</b> — 내부 체감온도가 외부 기온 대비 최대 {{ d.weather.max_delta }}°C, 평균 {{ d.weather.avg_delta }}°C 높게 측정됨(관리 임계 {{ d.weather.threshold }}°C 초과). 환기·차열·국소냉방 등 작업환경 개선 필요.</div>
  {% endif %}
  <table class="tbl">
    <tr><th class="k" style="width:14%">시각</th>{% for h in d.hours if h.hour >= 9 and h.hour < 18 %}<th>{{ h.hour }}시</th>{% endfor %}</tr>
    <tr><td class="k">내부 체감(°C)</td>{% for h in d.hours if h.hour >= 9 and h.hour < 18 %}<td style="color:{{ h.color }}; font-weight:bold;">{{ h.feels if h.feels is not none else '-' }}</td>{% endfor %}</tr>
    <tr><td class="k">외부 기온(°C)</td>{% for h in d.hours if h.hour >= 9 and h.hour < 18 %}<td>{{ h.outdoor if h.outdoor is not none else '-' }}</td>{% endfor %}</tr>
    <tr><td class="k">편차(내-외)</td>{% for h in d.hours if h.hour >= 9 and h.hour < 18 %}<td>{{ h.delta if h.delta is not none else '-' }}</td>{% endfor %}</tr>
  </table>
  <p class="note">※ 외부 기상자료 출처: {{ '케이웨더(주)' if d.weather.provider in ('kweather', 'kma') else '참고용 추정치' }}</p>
{% elif not d.external_daily %}
  <p class="note">해당 일자의 외부 관측자료가 아직 제공되지 않아 비교 분석을 생략함.</p>
{% endif %}

<h2><span class="no">6.</span> 종합 분석</h2>
<div class="gov">{% for a in d.analysis %}<div><span class="b">□</span> {{ a }}</div>{% endfor %}</div>

<h2><span class="no">7.</span> 조치사항 및 권고 <span style="font-size:8pt; color:#64748b; font-weight:normal;">(최고 위험단계 「{{ d.peak_label }}」 기준)</span></h2>
<div class="gov2">{% for g in d.guidance %}<div><span class="b">○</span> {{ g }}</div>{% endfor %}</div>
{% else %}
<h2><span class="no">2.</span> 측정 결과</h2>
<p class="note">해당 일자에 수집된 측정 데이터가 없습니다.</p>
{% endif %}

<div class="footer">
  적용 기준: 고용노동부 「온열질환 예방가이드」(물·그늘·휴식) · 산업안전보건기준에 관한 규칙 제566조 · 폭염특보 발표 기준<br/>
  측정장비·데이터: 본 보고서의 현장 측정값은 <b>케이웨더(주) 체감온도계 장비</b>로 측정되었으며, 외부 기상자료를 포함한 모든 데이터의 출처는 <b>케이웨더(주)</b>입니다.<br/>
  본 보고서는 케이웨더(주) 체감온도계 안전보건 대시보드에서 자동 생성된 분석 자료입니다.
</div>
</body></html>
"""
)


def _html_to_pdf(html: str) -> bytes:
    buf = io.BytesIO()
    pisa.CreatePDF(src=html, dest=buf, encoding="utf-8")
    return buf.getvalue()


def daily_pdf(db: Session, tenant: Tenant, device_sn: str, on_date: date_cls, generated: str) -> bytes:
    # 시간대별 히트스트립(섹션Ⅳ)이 추이를 시각화하므로, 한 페이지에 담기 위해 별도 라인차트는 생략.
    d = _daily_detail(db, tenant, device_sn, on_date)
    report_no = f"KW-HS-{on_date.strftime('%Y%m%d')}-{str(device_sn)[-4:]}"
    html = _DAILY_TEMPLATE.render(
        d=d, chart=None, pdf_font=_PDF_FONT, generated=generated, report_no=report_no
    )
    return _html_to_pdf(html)


_PERIODIC_TEMPLATE = Template(
    """
<html><head><style>
body { font-family: "{{ pdf_font }}"; font-size: 10pt; color:#111; }
h1 { font-size: 16pt; text-align:center; border-bottom: 2px solid #0f499e; padding-bottom:6px; color:#0f172a; }
.sub { color:#475569; font-size:9pt; margin-bottom:10px; }
table { width:100%; border-collapse: collapse; margin: 8px 0; }
th, td { border:1px solid #cbd5e1; padding:4px 6px; text-align:center; }
th { background:#f1f5f9; }
.footer { color:#94a3b8; font-size:8pt; margin-top:16px; }
</style></head><body>
<h1>폭염 안전관리 기간 분석 보고서</h1>
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
<table repeat="1">
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
