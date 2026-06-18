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


def _fmt_min(m: int | None) -> str:
    """누적 분 -> "X시간 Y분" / "Y분" (웹 보고서·대시보드와 동일 표기)."""
    if not m or m <= 0:
        return "0분"
    h, mm = divmod(int(m), 60)
    return f"{h}시간 {mm}분" if h else f"{mm}분"


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
            hours=[], level_minutes={}, level_minutes_label={}, total_minutes=0, weather=None, analysis=[],
            external_daily=None, avg_humidity=None, work=None, series=[],
        )
        return out

    feels, temps, humi = df["feels_like"], df["temperature"], df["humidity"]
    n = len(df)
    idx_max = feels.idxmax()
    max_feels = round(float(feels.loc[idx_max]), 1)
    max_time = pd.to_datetime(df.loc[idx_max, "measured_at"]).strftime("%H:%M")
    idx_tmax = temps.idxmax()
    max_temp_time = pd.to_datetime(df.loc[idx_tmax, "measured_at"]).strftime("%H:%M")
    peak = heat.classify(max_feels)

    # 측정 간격(중앙값) 반영 누적 노출시간(분) — 대시보드 KPI·웹 보고서와 동일 기준.
    # 각 단계 = '기준 체감온도 이상' 누적(관심 31 / 주의 33 / 경고 35 / 위험 38℃↑).
    _ts = df["measured_at"].sort_values()
    _diffs = _ts.diff().dropna().dt.total_seconds() / 60.0
    step = float(_diffs.median()) if len(_diffs) else 1.0
    if not step or step <= 0 or step > 60:
        step = 1.0

    def _cum_min(series, thr) -> int:
        return int(round(int((series >= thr).sum()) * step))

    lm = {
        "attention": _cum_min(feels, th["attention"]),
        "caution": _cum_min(feels, th["caution"]),
        "warning": _cum_min(feels, th["warning"]),
        "danger": _cum_min(feels, th["danger"]),
    }
    lm_label = {k: _fmt_min(v) for k, v in lm.items()}
    # 단계별 지속시간 + 해당 기간(전일 측정시간) 대비 비율
    _tot_min = int(round(n * step)) or 1
    level_minutes_pct = {k: f"{lm_label[k]} ({round(lm[k] / _tot_min * 100)}%)" for k in lm}

    # 피크 시점의 동시 관측값(샘플 보고서 항목)
    temp_at_peak = round(float(df.loc[idx_max, "temperature"]), 1)
    _hp = df.loc[idx_max, "humidity"]
    humi_at_peak = int(_hp) if pd.notna(_hp) else None

    # 차트용 10분 시리즈 (시각을 0~24h 실수로)
    s10 = df.set_index("measured_at")["feels_like"].resample("10min").mean().dropna()
    series = [(ts.hour + ts.minute / 60.0, round(float(v), 1)) for ts, v in s10.items()]

    # 시간대별 평균
    s = df.set_index("measured_at")[["temperature", "feels_like", "humidity"]].resample("1h").mean()

    # ---- 외부 시간자료(측정 당시의 기상청 기온·습도·공식 체감온도) ----
    # 캐시-어사이드 + 오늘 일자 staleness 갱신 + 카카오 불가 시 최근접 관측소 폴백은
    # weather.kma_hourly_cached 가 일원화하여 처리(대시보드 compare 와 동일 경로).
    ds_key = on_date.strftime("%Y%m%d")
    # 실계정(KMA 프로바이더)만 기상청 시간자료 조회. 데모는 합성(mock)이라 건너뜀.
    ext_hourly = (
        weather_svc.kma_hourly_cached(db, dev, ds_key)
        if weather_svc._provider_for(tenant).name == "kma" else None
    )
    cache_row = db.scalar(
        select(ExternalDailyCache).where(
            ExternalDailyCache.device_sn == device_sn, ExternalDailyCache.ymd == ds_key
        )
    )

    # 실시간(provider) 비교 — 외부 시간자료가 없을 때의 폴백 소스
    try:
        cmp = weather_svc.compare(db, tenant, device_sn, start, end, 60)
    except Exception:  # noqa: BLE001
        cmp = None
    out_by_h = {pd.Timestamp(p.t).hour: p.outdoor_temperature for p in cmp.points} if cmp else {}
    out_feels_by_h = {pd.Timestamp(p.t).hour: p.outdoor_feels for p in cmp.points} if cmp else {}

    hours = []
    for idx, row in s.iterrows():
        h = idx.hour
        f = None if pd.isna(row["feels_like"]) else round(float(row["feels_like"]), 1)
        lvl = heat.classify(f)
        slot = ext_hourly.get(h) if ext_hourly else None
        o_ta = slot.get("ta") if slot else out_by_h.get(h)
        o_fl = slot.get("feels") if slot else out_feels_by_h.get(h)
        base = o_fl if o_fl is not None else o_ta
        delta = round(f - base, 1) if (f is not None and base is not None) else None
        hours.append({
            "hour": h, "feels": f,
            "temp": None if pd.isna(row["temperature"]) else round(float(row["temperature"]), 1),
            "humidity": None if pd.isna(row["humidity"]) else int(round(float(row["humidity"]))),
            "label": lvl.label, "color": lvl.color,
            # 컬러바 셀: 밝은 단계색(관심 라임·주의 노랑)은 어두운 글자, 그 외 흰 글자
            "fg": "#1f2937" if lvl.code in ("attention", "caution") else "#ffffff",
            "outdoor": o_ta, "out_feels": o_fl, "delta": delta,
        })

    deltas = [x["delta"] for x in hours if x["delta"] is not None]
    avg_delta = round(sum(deltas) / len(deltas), 1) if deltas else None
    avg_humi = round(float(humi.mean()), 1) if humi.notna().any() else None
    has_out_feels = any(x["out_feels"] is not None for x in hours)
    out_feels_vals = [x["out_feels"] for x in hours if x["out_feels"] is not None]
    out_feels_max = round(max(out_feels_vals), 1) if out_feels_vals else None
    out_feels_avg = round(sum(out_feels_vals) / len(out_feels_vals), 1) if out_feels_vals else None

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
            "danger_minutes": _cum_min(wfeels, th["danger"]),
            "minutes": {
                "attention": _cum_min(wfeels, th["attention"]),
                "caution": _cum_min(wfeels, th["caution"]),
                "warning": _cum_min(wfeels, th["warning"]),
                "danger": _cum_min(wfeels, th["danger"]),
            },
            "minutes_label": {
                "attention": _fmt_min(_cum_min(wfeels, th["attention"])),
                "caution": _fmt_min(_cum_min(wfeels, th["caution"])),
                "warning": _fmt_min(_cum_min(wfeels, th["warning"])),
                "danger": _fmt_min(_cum_min(wfeels, th["danger"])),
            },
            "total": len(wdf),
            "peak_label": wpeak.label, "peak_color": wpeak.color,
        }
        # 법정 휴식 의무 — 체감 33℃↑ 작업에 2시간마다 20분 이상(산업안전보건규칙)
        _hot = _cum_min(wfeels, th["caution"])
        work["hot_minutes"] = _hot
        work["hot_label"] = _fmt_min(_hot)
        work["legal_rest_count"] = _hot // 120
        work["legal_rest_minutes"] = (_hot // 120) * 20
        work["legal_rest_label"] = _fmt_min((_hot // 120) * 20)
        # 근무시간 단계별 지속시간 + 근무시간 대비 비율, 최고기온 시각
        _wt = max(1, int(round(len(wdf) * step)))
        work["minutes_pct"] = {
            k: f"{work['minutes_label'][k]} ({round(work['minutes'][k] / _wt * 100)}%)"
            for k in work["minutes"]
        }
        _wti = wdf["temperature"].idxmax()
        work["max_temp_time"] = pd.to_datetime(wdf.loc[_wti, "measured_at"]).strftime("%H:%M")

    weather = None
    if deltas:
        max_delta = round(max(deltas), 1)
        _mdh = max((x for x in hours if x["delta"] is not None), key=lambda x: x["delta"], default=None)
        weather = {
            "provider": "kma" if has_out_feels else (cmp.provider if cmp else "mock"),
            "max_delta": max_delta, "avg_delta": avg_delta,
            "max_delta_time": f"{_mdh['hour']:02d}:00" if _mdh else None,
            "enclosed_alert": max_delta >= settings.ENCLOSED_DELTA_ALERT,
            "threshold": settings.ENCLOSED_DELTA_ALERT,
            "feels_based": has_out_feels,
        }

    # 외부 일별 요약(과거자료): 캐시 우선 → 아카이브/ASOS 일자료 → 시간자료 집계 폴백
    external_daily = None
    provider = weather_svc._provider_for(tenant)
    ed = None
    if cache_row and (cache_row.max_temp is not None or cache_row.avg_temp is not None):
        ed = {
            "avg": float(cache_row.avg_temp) if cache_row.avg_temp is not None else None,
            "max": float(cache_row.max_temp) if cache_row.max_temp is not None else None,
            "min": float(cache_row.min_temp) if cache_row.min_temp is not None else None,
            "humi": float(cache_row.humidity) if cache_row.humidity is not None else None,
            "source": cache_row.source, "region": cache_row.region,
        }
    else:
        if hasattr(provider, "past_daily"):
            try:
                ed = provider.past_daily(dev.latitude, dev.longitude, dev.region_code, on_date)
            except Exception:  # noqa: BLE001
                ed = None
        # 일별 아카이브가 없으면 시간자료에서 직접 집계 (측정 당시 기준)
        if (not ed or ed.get("max") is None) and ext_hourly:
            tas = [v["ta"] for v in ext_hourly.values() if v.get("ta") is not None]
            hms = [v["hm"] for v in ext_hourly.values() if v.get("hm") is not None]
            if tas:
                ed = {
                    "avg": round(sum(tas) / len(tas), 1), "max": round(max(tas), 1),
                    "min": round(min(tas), 1),
                    "humi": round(sum(hms) / len(hms), 1) if hms else None,
                    "source": "케이웨더 기상관측자료", "region": None,
                }
        if ed and (ed.get("avg") is not None or ed.get("max") is not None):
            try:
                if cache_row is None:
                    cache_row = ExternalDailyCache(device_sn=device_sn, ymd=ds_key)
                    db.add(cache_row)
                cache_row.avg_temp = ed.get("avg"); cache_row.max_temp = ed.get("max")
                cache_row.min_temp = ed.get("min"); cache_row.humidity = ed.get("humi")
                cache_row.source = ed.get("source"); cache_row.region = ed.get("region")
                db.commit()
            except Exception:  # noqa: BLE001
                db.rollback()

    if ed and (ed.get("avg") is not None or ed.get("max") is not None):
        in_max = round(float(temps.max()), 1)
        in_avg = round(float(temps.mean()), 1)
        external_daily = {
            "region": ed.get("region"), "source": ed.get("source"),
            "out_avg": ed.get("avg"), "out_max": ed.get("max"), "out_min": ed.get("min"), "out_humi": ed.get("humi"),
            "out_feels_max": out_feels_max, "out_feels_avg": out_feels_avg,
            "in_avg": in_avg, "in_max": in_max,
            "diff_max": round(in_max - float(ed["max"]), 1) if ed.get("max") is not None else None,
            "diff_feels": round(max_feels - out_feels_max, 1) if out_feels_max is not None else None,
        }

    # 자동 분석 코멘트
    analysis: list[str] = []
    if work:
        analysis.append(
            f"근무시간(09:00~18:00) 중 최고 체감온도는 {work['max_time']}경 {work['max_feels']}°C(단계: {work['peak_label']})이며, "
            f"위험단계(38°C 이상) 노출이 {_fmt_min(work['danger_minutes'])} 누적됨."
        )
    if lm["danger"]:
        analysis.append(f"체감온도 38°C 이상(폭염중대경보 기준) 노출이 일일 {_fmt_min(lm['danger'])} 누적되어, 긴급조치 작업을 제외한 옥외작업 원칙적 중지 대상에 해당함.")
    analysis.append(f"최고 체감온도는 {max_time}경 {max_feels}°C로 관측되어 일중 최고치를 기록함"
                    + (f" (당시 기온 {temp_at_peak}°C, 습도 {humi_at_peak}%)." if humi_at_peak is not None else f" (당시 기온 {temp_at_peak}°C)."))
    base_label = "공식 체감온도" if has_out_feels else "기온"
    src_label = "케이웨더" if has_out_feels or (cmp and cmp.provider in ("kweather", "kma")) else "참고용 추정"
    if weather and weather["enclosed_alert"]:
        analysis.append(
            f"작업장 내부 체감온도가 외부({src_label}) {base_label} 대비 최대 {weather['max_delta']}°C 높게 측정되어 "
            f"'밀폐형 폭염 사업장'에 해당함(관리 임계 {weather['threshold']}°C 초과). 환기·차열·국소냉방 등 작업환경 개선 필요."
        )
    elif weather and avg_delta is not None:
        analysis.append(f"작업장 내부 체감온도가 외부({src_label}) {base_label} 대비 평균 {avg_delta}°C 높게 측정됨(최대 {weather['max_delta']}°C).")

    if avg_humi is not None and avg_humi >= 70:
        analysis.append("고온다습한 환경으로 체열 발산이 저해되어 온열질환 발생 위험이 가중되는 조건임.")

    out.update(
        max_feels=max_feels, max_time=max_time, max_temp=round(float(temps.max()), 1),
        avg_feels=round(float(feels.mean()), 1), avg_humidity=avg_humi, record_count=n,
        range_start=pd.to_datetime(df["measured_at"].min()).strftime("%H:%M"),
        range_end=pd.to_datetime(df["measured_at"].max()).strftime("%H:%M"),
        peak_label=peak.label, peak_color=peak.color, guidance=analytics._GUIDANCE[peak.code],
        level_minutes=lm, level_minutes_label=lm_label, level_minutes_pct=level_minutes_pct,
        max_temp_time=max_temp_time, total_minutes=int(round(n * step)),
        hours=hours, weather=weather, analysis=analysis,
        external_daily=external_daily, work=work, series=series,
        temp_at_peak=temp_at_peak, humi_at_peak=humi_at_peak,
    )
    if external_daily and external_daily.get("out_max") is not None and external_daily.get("diff_feels") is None:
        analysis.append(
            f"외부({external_daily['source']}) 일 최고기온 {external_daily['out_max']}°C 대비 작업장 최고기온 "
            f"{external_daily['in_max']}°C로 {external_daily['diff_max']}°C 편차를 보임."
        )
    return out



# ---------------- PIL 경량 차트 (matplotlib 없이 — 로컬/서버리스 동일 출력) ----------------
def _png_data_uri(img) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def _pil_fonts():
    from PIL import ImageFont

    def F(size):
        try:
            return ImageFont.truetype(_FONT_PATH, size)
        except Exception:  # noqa: BLE001
            return ImageFont.load_default()
    return F


def _text_w(d, text, font) -> float:
    try:
        return d.textlength(text, font=font)
    except Exception:  # noqa: BLE001
        b = d.textbbox((0, 0), text, font=font)
        return b[2] - b[0]


def _fill_gradient_area(img, pts, base_y, rgb, top_alpha):
    """라인 아래 영역을 수직 그라데이션(top_alpha→0)으로 채움 — recharts area 감성."""
    from PIL import Image, ImageDraw

    if len(pts) < 2:
        return
    W, H = img.size
    top = max(0, int(min(p[1] for p in pts)) - 1)
    bottom = int(base_y)
    if bottom <= top:
        return
    poly = list(pts) + [(pts[-1][0], base_y), (pts[0][0], base_y)]
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    grad = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(grad)
    span = max(1, bottom - top)
    for y in range(top, bottom + 1):
        gd.line([(0, y), (W, y)], fill=int(top_alpha * (1 - (y - top) / span)))
    alpha = Image.composite(grad, Image.new("L", (W, H), 0), mask)
    img.paste(Image.new("RGB", (W, H), rgb), (0, 0), alpha)


def _pil_hourly(series, th) -> str | None:
    """[PIL 폴백] 시간별 체감온도 라인 차트 — 위험단계 색상 구간선 + 임계선 + 피크 배지."""
    try:
        from PIL import Image, ImageDraw
    except Exception:  # noqa: BLE001
        return None
    if not series or len(series) < 2:
        return None
    F = _pil_fonts()
    W, H = 1560, 345
    L, R, T, B = 100, 36, 24, 52
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    ys = [v for _, v in series]
    ymin = min(min(ys) - 2, 20)
    ymax = max(max(ys) + 3, 41)
    ymin = int(ymin // 5 * 5)
    ymax = int(-(-ymax // 5) * 5)

    def X(x):
        return L + (x / 24.0) * (W - L - R)

    def Y(y):
        return T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B)

    # 그리드/축
    for gy in range(ymin, ymax + 1, 5):
        d.line([(L, Y(gy)), (W - R, Y(gy))], fill="#eef2f6", width=2)
        d.text((L - 14, Y(gy)), str(gy), font=F(24), fill="#94a3b8", anchor="rm")
    for gx in range(0, 25, 3):
        d.line([(X(gx), T), (X(gx), H - B)], fill="#f4f6f9", width=2)
        d.text((X(gx), H - B + 12), f"{gx:02d}시", font=F(24), fill="#94a3b8", anchor="ma")
    d.line([(L, H - B), (W - R, H - B)], fill="#cbd5e1", width=3)
    d.line([(L, T), (L, H - B)], fill="#cbd5e1", width=3)

    # 임계선(점선)
    for code in ("attention", "caution", "warning", "danger"):
        yv = th[code]
        if ymin < yv < ymax:
            color = heat.LEVELS[code].color
            x = L
            while x < W - R:
                d.line([(x, Y(yv)), (min(x + 16, W - R), Y(yv))], fill=color, width=2)
                x += 28
            d.text((W - R - 4, Y(yv) - 4), f"{heat.LEVELS[code].label} {int(yv)}", font=F(20), fill=color, anchor="rs")

    # 근무시간 음영(09~18시)
    band = Image.new("RGBA", (int(X(18)) - int(X(9)), int(H - B - T)), (15, 73, 158, 14))
    img.paste(band, (int(X(9)), int(T)), band)

    # 영역 그라데이션(라인 아래) — recharts area 감성
    line_pts = [(X(x), Y(v)) for x, v in series]
    _fill_gradient_area(img, line_pts, Y(ymin), (220, 38, 38), 46)

    # 단계 색상 구간 폴리라인
    for i in range(len(series) - 1):
        (x1, v1), (x2, v2) = series[i], series[i + 1]
        seg_color = heat.classify((v1 + v2) / 2).color
        d.line([(X(x1), Y(v1)), (X(x2), Y(v2))], fill=seg_color, width=5)

    # 피크 — 점 + 값 배지
    pi = max(range(len(series)), key=lambda i: series[i][1])
    px_, pv = series[pi]
    pc = heat.classify(pv).color
    cx, cy = X(px_), Y(pv)
    d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=pc, outline="white", width=3)
    lab = f"{pv:.1f}°C"
    tw = _text_w(d, lab, F(26))
    by = cy - 14
    bx0, bx1 = cx - tw / 2 - 11, cx + tw / 2 + 11
    if bx0 < L:
        bx0, bx1 = float(L), L + tw + 22
    if bx1 > W - R:
        bx1, bx0 = float(W - R), W - R - tw - 22
    d.rounded_rectangle([bx0, by - 34, bx1, by - 2], radius=9, fill=pc)
    d.text(((bx0 + bx1) / 2, by - 18), lab, font=F(26), fill="white", anchor="mm")

    return _png_data_uri(img)


def _pil_compare(hours) -> str | None:
    """[PIL 폴백] 내부 체감온도 vs 야외 기온 비교 라인 차트 (시간 단위)."""
    try:
        from PIL import Image, ImageDraw
    except Exception:  # noqa: BLE001
        return None
    pts_in = [(h["hour"], h["feels"]) for h in hours if h.get("feels") is not None]
    use_feels = sum(1 for h in hours if h.get("out_feels") is not None) >= 2
    key = "out_feels" if use_feels else "outdoor"
    pts_out = [(h["hour"], h[key]) for h in hours if h.get(key) is not None]
    out_label = "기상청 공식 체감온도" if use_feels else "기상청 기온"
    if len(pts_in) < 2 or len(pts_out) < 2:
        return None
    F = _pil_fonts()
    W, H = 1560, 320
    L, R, T, B = 100, 36, 40, 52
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    ys = [v for _, v in pts_in] + [v for _, v in pts_out]
    ymin = int((min(ys) - 2) // 5 * 5)
    ymax = int(-(-(max(ys) + 3) // 5) * 5)

    def X(x):
        return L + (x / 24.0) * (W - L - R)

    def Y(y):
        return T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B)

    for gy in range(ymin, ymax + 1, 5):
        d.line([(L, Y(gy)), (W - R, Y(gy))], fill="#eef2f6", width=2)
        d.text((L - 14, Y(gy)), str(gy), font=F(24), fill="#94a3b8", anchor="rm")
    for gx in range(0, 25, 3):
        d.text((X(gx), H - B + 12), f"{gx:02d}시", font=F(24), fill="#94a3b8", anchor="ma")
    d.line([(L, H - B), (W - R, H - B)], fill="#cbd5e1", width=3)
    d.line([(L, T), (L, H - B)], fill="#cbd5e1", width=3)

    # 영역 그라데이션(라인 아래) — 외부(블루)·내부(레드)
    _fill_gradient_area(img, [(X(x), Y(v)) for x, v in pts_out], Y(ymin), (23, 144, 205), 28)
    _fill_gradient_area(img, [(X(x), Y(v)) for x, v in pts_in], Y(ymin), (220, 38, 38), 30)

    def poly(pts, color):
        for i in range(len(pts) - 1):
            d.line([(X(pts[i][0]), Y(pts[i][1])), (X(pts[i + 1][0]), Y(pts[i + 1][1]))], fill=color, width=4)
        for x, v in pts:
            d.ellipse([X(x) - 4, Y(v) - 4, X(x) + 4, Y(v) + 4], fill="white", outline=color, width=2)

    poly(pts_out, "#1790cd")
    poly(pts_in, "#dc2626")

    # 범례
    lx = W - R - 430
    d.line([(lx - 120, 28), (lx - 76, 28)], fill="#dc2626", width=6)
    d.text((lx - 66, 28), "현장 체감온도", font=F(24), fill="#334155", anchor="lm")
    d.line([(lx + 120, 28), (lx + 164, 28)], fill="#1790cd", width=6)
    d.text((lx + 174, 28), out_label, font=F(24), fill="#334155", anchor="lm")

    return _png_data_uri(img)


# ---------------- matplotlib 차트 (우선; 없으면 위 PIL 폴백) — 웹 recharts 룩 ----------------
def _mpl_style_axes(ax, ymin, ymax):
    import numpy as np

    ax.set_xlim(0, 24)
    ax.set_ylim(ymin, ymax)
    ax.set_xticks(range(0, 25, 3))
    ax.set_xticklabels([f"{h:02d}시" for h in range(0, 25, 3)], fontsize=9, color="#94a3b8")
    ax.set_yticks(np.arange(ymin, ymax + 1, 5))
    ax.tick_params(axis="y", labelsize=9, colors="#94a3b8", length=0)
    ax.tick_params(axis="x", length=0)
    ax.grid(axis="y", color="#eef2f6", linewidth=1.1)
    ax.set_axisbelow(True)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color("#cbd5e1")
    ax.margins(x=0)


def _mpl_hourly(series, th) -> str | None:
    """[matplotlib] 시간별 체감온도 — 단계색 라인 + 영역 그라데이션 + 임계선 + 피크 배지."""
    import numpy as np
    from matplotlib.collections import LineCollection

    xs = np.array([x for x, _ in series], dtype=float)
    ys = np.array([v for _, v in series], dtype=float)
    ymin = min(float(ys.min()) - 2, 20.0)
    ymax = max(float(ys.max()) + 3, 41.0)
    ymin = float(np.floor(ymin / 5) * 5)
    ymax = float(np.ceil(ymax / 5) * 5)

    fig, ax = plt.subplots(figsize=(11, 2.7), dpi=150)
    ax.axvspan(9, 18, color="#0f499e", alpha=0.05, lw=0)  # 근무시간 음영

    # 영역 그라데이션(라인 아래) — imshow + 폴리곤 클립
    fillc = ax.fill_between(xs, ys, ymin, color="none")
    rgba = np.zeros((256, 1, 4))
    rgba[..., 0] = 0.86  # dc2626
    rgba[..., 1] = 0.15
    rgba[..., 2] = 0.15
    rgba[..., 3] = np.linspace(0.30, 0.0, 256).reshape(-1, 1)  # 위→아래 알파 감소
    im = ax.imshow(rgba, aspect="auto", extent=[0, 24, ymin, ymax], origin="upper", zorder=1)
    im.set_clip_path(fillc.get_paths()[0], transform=ax.transData)

    # 임계선 + 라벨
    for code in ("attention", "caution", "warning", "danger"):
        yv = th[code]
        if ymin < yv < ymax:
            c = heat.LEVELS[code].color
            ax.axhline(yv, color=c, ls=(0, (6, 4)), lw=1.2, alpha=0.85, zorder=2)
            ax.text(23.85, yv + 0.1, f"{heat.LEVELS[code].label} {int(yv)}", color=c,
                    fontsize=8.5, va="bottom", ha="right", zorder=3)

    # 단계색 구간 라인
    pts = np.array([xs, ys]).T.reshape(-1, 1, 2)
    segs = np.concatenate([pts[:-1], pts[1:]], axis=1)
    cols = [heat.classify((ys[i] + ys[i + 1]) / 2).color for i in range(len(ys) - 1)]
    lc = LineCollection(segs, colors=cols, linewidths=3.2, capstyle="round", joinstyle="round", zorder=4)
    ax.add_collection(lc)

    # 피크 — 점 + 값 배지
    pi = int(np.argmax(ys))
    pc = heat.classify(float(ys[pi])).color
    ax.plot(xs[pi], ys[pi], "o", color=pc, mec="white", mew=1.8, ms=8, zorder=6)
    ax.annotate(f"{ys[pi]:.1f}°C", (xs[pi], ys[pi]), xytext=(0, 13), textcoords="offset points",
                ha="center", va="bottom", fontsize=10, fontweight="bold", color="white",
                bbox=dict(boxstyle="round,pad=0.34", fc=pc, ec="none"), zorder=7)

    _mpl_style_axes(ax, ymin, ymax)
    return _fig_to_data_uri(fig)


def _mpl_compare(hours) -> str | None:
    """[matplotlib] 내부 체감 vs 외부 비교 — 두 라인 + 영역 + 흰 점 마커 + 범례."""
    import numpy as np

    pin = [(h["hour"], h["feels"]) for h in hours if h.get("feels") is not None]
    use_feels = sum(1 for h in hours if h.get("out_feels") is not None) >= 2
    key = "out_feels" if use_feels else "outdoor"
    pout = [(h["hour"], h[key]) for h in hours if h.get(key) is not None]
    out_label = "기상청 공식 체감온도" if use_feels else "기상청 기온"
    if len(pin) < 2 or len(pout) < 2:
        return None
    xi = np.array([x for x, _ in pin], dtype=float); yi = np.array([v for _, v in pin], dtype=float)
    xo = np.array([x for x, _ in pout], dtype=float); yo = np.array([v for _, v in pout], dtype=float)
    allv = np.concatenate([yi, yo])
    ymin = float(np.floor((allv.min() - 2) / 5) * 5)
    ymax = float(np.ceil((allv.max() + 3) / 5) * 5)

    fig, ax = plt.subplots(figsize=(11, 2.5), dpi=150)
    ax.fill_between(xo, yo, ymin, color="#1790cd", alpha=0.08, lw=0, zorder=1)
    ax.fill_between(xi, yi, ymin, color="#dc2626", alpha=0.08, lw=0, zorder=1)
    ax.plot(xo, yo, color="#1790cd", lw=2.4, label=out_label, marker="o", ms=4.5,
            mfc="white", mec="#1790cd", mew=1.5, zorder=3)
    ax.plot(xi, yi, color="#dc2626", lw=2.4, label="현장 체감온도", marker="o", ms=4.5,
            mfc="white", mec="#dc2626", mew=1.5, zorder=4)
    ax.legend(loc="upper right", fontsize=9, frameon=False, ncol=2)
    _mpl_style_axes(ax, ymin, ymax)
    return _fig_to_data_uri(fig)


def _chart_hourly_feels(series, th) -> str | None:
    """시간별 체감온도 차트 — matplotlib 우선, 실패/미설치 시 PIL 폴백."""
    if not series or len(series) < 2:
        return None
    if HAS_MPL:
        try:
            return _mpl_hourly(series, th)
        except Exception:  # noqa: BLE001
            pass
    return _pil_hourly(series, th)


def _chart_compare(hours) -> str | None:
    """내외부 비교 차트 — matplotlib 우선, 실패/미설치 시 PIL 폴백."""
    if HAS_MPL:
        try:
            return _mpl_compare(hours)
        except Exception:  # noqa: BLE001
            pass
    return _pil_compare(hours)


def _chart_timeline_band(hours) -> str | None:
    """시간별 위험단계 타임라인 밴드 — 24구간 색 띠 + 피크 마커 + 근무시간 외곽선 + 눈금."""
    try:
        from PIL import Image, ImageDraw
    except Exception:  # noqa: BLE001
        return None
    if not hours:
        return None
    F = _pil_fonts()
    W, H = 1560, 124
    L, R = 8, 8
    band_top, band_h = 36, 40
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    by_hour = {h["hour"]: h for h in hours}
    seg_w = (W - L - R) / 24.0
    peak_h, peak_v = None, -1e9
    for hh in range(24):
        slot = by_hour.get(hh)
        has = slot is not None and slot.get("feels") is not None
        color = slot["color"] if has else "#e2e8f0"
        x0 = L + hh * seg_w
        d.rectangle([x0, band_top, x0 + seg_w, band_top + band_h], fill=color)
        if has and slot["feels"] > peak_v:
            peak_v, peak_h = slot["feels"], hh
    # 근무시간(09~18) 외곽선
    d.rectangle([L + 9 * seg_w, band_top, L + 18 * seg_w, band_top + band_h], outline=(15, 73, 158), width=3)
    # 피크 마커
    if peak_h is not None:
        cx = L + (peak_h + 0.5) * seg_w
        d.text((cx, band_top - 7), f"최고 {peak_v:.1f}°C ▼", font=F(22), fill="#dc2626", anchor="mb")
    # 시각 눈금
    for hh in range(0, 25, 3):
        x = L + hh * seg_w
        anc = "la" if hh == 0 else ("ra" if hh == 24 else "ma")
        d.text((x, band_top + band_h + 8), f"{hh:02d}시", font=F(20), fill="#94a3b8", anchor=anc)
    return _png_data_uri(img)


_DAILY_TEMPLATE = Template(
    """
<html><head><style>
@page { size: A4; margin: 20px; @frame footer_frame { -pdf-frame-content: pageFooter; left: 20pt; bottom: 11pt; width: 555pt; height: 13pt; } }
body { font-family: "{{ pdf_font }}"; font-size: 9pt; color:#0b1220; line-height:1.28; font-weight:bold; }
table { width:100%; border-collapse: collapse; }

/* 헤더 — 미니멀(식별번호) */
.band td { padding: 0 0 5px 0; vertical-align: bottom; border-bottom: 1.5px solid #64748b; }
.band-r { text-align:right; width:30%; }
.band-title { color:#0b1220; font-size:16pt; font-weight:bold; }
.band-id { color:#334155; font-size:8pt; margin-top:2pt; }
.band-meta { color:#475569; font-size:7pt; }
.band-date { color:#0b1220; font-size:12pt; font-weight:bold; margin-top:1pt; }

/* 요약 히어로 */
.hero td { border-bottom:1px solid #cbd5e1; padding:5px 10px; vertical-align:top; }
.hero .mid { border-left:1px solid #cbd5e1; border-right:1px solid #cbd5e1; }
.hero-label { font-size:7.5pt; color:#334155; font-weight:bold; }
.hero-val { font-size:21pt; font-weight:bold; margin-top:0pt; }
.hero-unit { font-size:10pt; color:#475569; font-weight:bold; }
.hero-sub { font-size:7pt; color:#475569; margin-top:1pt; }
.hero-badge { display:inline-block; padding:3px 12px; border-radius:9px; color:#fff; font-weight:bold; font-size:12pt; }

/* 문서정보 — 심리스 */
.docinfo { margin-top:4pt; }
.docinfo td { padding:3px 8px; font-size:8.8pt; border-bottom:1px solid #d8e0ea; color:#0b1220; }
.docinfo .k { color:#1f2937; width:14%; font-weight:bold; }

/* 섹션 — 제목은 항상 다음 내용과 같은 페이지에 유지(제목만 떨어지는 현상 방지). */
h2 { font-size:12pt; color:#0b1220; margin:7pt 0 2pt 0; font-weight:bold; -pdf-keep-with-next: true; page-break-after: avoid; }
h2 .no { color:#0c3d85; font-weight:bold; margin-right:5px; }

/* 데이터 표 — 심리스(세로선·채움 없음, 하단 라인만). 표는 페이지 경계에서 쪼개지지 않도록. */
.tbl { page-break-inside: avoid; }
.tbl th { padding:3.5px 8px; font-size:8.8pt; color:#1f2937; font-weight:bold; text-align:center; border-bottom:1.5px solid #1f2937; }
.tbl td { padding:3px 8px; font-size:9pt; text-align:center; border-bottom:1px solid #d8e0ea; color:#0b1220; font-weight:bold; }
.tbl .k { color:#0b1220; font-weight:bold; }
.num { font-weight:bold; font-size:10.5pt; }
.badge { display:inline-block; padding:1.5px 8px; border-radius:8px; color:#fff; font-weight:bold; font-size:8.5pt; }
.legend { border:1px solid #cbd5e1; }
.legend td { padding:3.5px 7px; font-size:8.4pt; color:#1f2937; }
.tbl.wide th, .tbl.wide td { font-size:6.6pt; padding:3px 1.5px; }
.chartimg { width:540pt; }
.alert { border:1.5px solid #f87171; background:#fef2f2; color:#b91c1c; padding:4px 8px; font-size:8.6pt; margin:3px 0; border-radius:4px; font-weight:bold; }
.gov { margin:0 0 0 0; }
.gov div { margin:1.2pt 0; font-size:9pt; color:#111827; font-weight:bold; }
.gov .b { color:#0c3d85; font-weight:bold; }
.gov2 { margin:0 0 0 0; }
.gov2 div { margin:1.2pt 0; font-size:9pt; color:#111827; font-weight:bold; }
.gov2 .b { color:#16a34a; font-weight:bold; }
.note { font-size:7.8pt; color:#475569; margin:1pt 0; font-weight:normal; }
.footer { margin-top:6pt; border-top:1.5px solid #0c3d85; padding-top:3pt; font-size:7pt; color:#475569; line-height:1.35; font-weight:normal; }
.pagenum { text-align:right; font-size:7.5pt; color:#94a3b8; }
</style></head><body>

<div id="pageFooter" class="pagenum"><pdf:pagenumber> / <pdf:pagecount></div>

<table class="band"><tr>
  <td class="band-l">
    <div class="band-title">폭염 안전관리 일일 보고서</div>
    <div class="band-id">{{ report_no }}</div>
  </td>
  <td class="band-r">
    <div class="band-meta">대상 일자</div>
    <div class="band-date">{{ d.date }}</div>
  </td>
</tr></table>

<table class="docinfo">
  <tr><td class="k">고객명</td><td style="width:30%">{{ d.company_name or '-' }}</td>
      <td class="k">기기명</td><td>{{ d.device_sn }}</td></tr>
  <tr><td class="k">소재지</td><td>{{ d.address or '-' }}</td>
      <td class="k">설치위치</td><td>{{ d.location_name or '-' }}</td></tr>
  <tr><td class="k">측정 기간</td><td colspan="3">{{ d.date }}{% if d.range_start %} ({{ d.range_start }}~{{ d.range_end }}){% endif %}</td></tr>
</table>
<p class="note">※ 모든 측정 데이터는 <b>케이웨더(주) 체감온도계 장비</b>로 측정·수집된 자료임. · 작성 {{ generated }}</p>

{% if d.has_data %}
<pdf:keeptogether>
<h2><span class="no">1.</span> 기온 및 체감온도 분석 <span style="font-size:8pt; color:#475569; font-weight:normal;">(근무시간: 09:00~18:00 · 괄호=발생 시각)</span></h2>
<table class="tbl">
  <tr><th style="width:22%">구분</th><th>최고 체감온도</th><th>최고기온</th><th>체감온도 33°C(주의단계) 이상 지속시간</th></tr>
  {% if d.work %}
  <tr><td class="k"><b>근무시간</b></td>
      <td class="num" style="color:{{ d.work.peak_color }}">{{ d.work.max_feels }}°C ({{ d.work.max_time }})</td>
      <td class="num">{{ d.work.max_temp }}°C ({{ d.work.max_temp_time }})</td>
      <td class="num" style="color:#b45309">{{ d.work.minutes_label['caution'] }}</td></tr>
  {% endif %}
  <tr><td class="k">전일(24시간)</td>
      <td class="num" style="color:{{ d.peak_color }}">{{ d.max_feels }}°C ({{ d.max_time }})</td>
      <td class="num">{{ d.max_temp }}°C ({{ d.max_temp_time }})</td>
      <td class="num" style="color:#b45309">{{ d.level_minutes_label['caution'] }}</td></tr>
</table>
</pdf:keeptogether>

<pdf:keeptogether>
<h2><span class="no">2.</span> 폭염 단계별 지속시간 분석</h2>
<table class="tbl">
  <tr><th style="width:16%; text-align:left;">구분</th>
      <th style="background-color:{{ d.levels['attention'].color }}; color:#fff;">관심<br/>(31°C↑)</th>
      <th style="background-color:{{ d.levels['caution'].color }}; color:#1f2937;">주의·폭염주의보<br/>(33°C↑)</th>
      <th style="background-color:{{ d.levels['warning'].color }}; color:#fff;">경고·폭염경보<br/>(35°C↑)</th>
      <th style="background-color:{{ d.levels['danger'].color }}; color:#fff;">위험·폭염중대경보<br/>(38°C↑)</th></tr>
  {% if d.work %}<tr><td class="k"><b>근무시간</b></td>{% for code in ['attention','caution','warning','danger'] %}<td><b>{{ d.work.minutes_pct[code] }}</b></td>{% endfor %}</tr>{% endif %}
  <tr><td class="k">전일(24시간)</td>{% for code in ['attention','caution','warning','danger'] %}<td>{{ d.level_minutes_pct[code] }}</td>{% endfor %}</tr>
</table>
<p class="note">※ 각 단계 기준 체감온도 <b>이상</b> 누적 지속시간(괄호 = 해당 기간 대비 비율) · 단계 기준: 고용노동부 폭염 단계별 대응요령 · 기상청 폭염특보(주의보 33 / 경보 35 / 중대경보 38°C)</p>
</pdf:keeptogether>

<pdf:keeptogether>
<h2><span class="no">3.</span> 시간별 체감온도 변화 <span style="font-size:8pt; color:#475569; font-weight:normal;">(전일 24시간 · 음영 = 근무시간 09~18시)</span></h2>
<table class="tbl wide" style="margin-bottom:2pt;">
  <tr><th class="k" style="width:12%">시각</th>{% for h in d.hours %}<th>{{ '%02d'|format(h.hour) }}</th>{% endfor %}</tr>
  <tr><td class="k">체감온도(°C)</td>{% for h in d.hours %}<td style="background-color:{{ h.color }}; color:{{ h.fg }}; font-weight:bold;">{{ h.feels if h.feels is not none else '-' }}</td>{% endfor %}</tr>
</table>
{% if chart %}<div style="margin-top:2pt;"><img src="{{ chart }}" class="chartimg"/></div>{% endif %}
<p class="note">※ 셀 색상 = 시간대별 체감온도의 폭염 위험단계 · 그래프 점선 = 단계 임계값(관심31/주의33/경고35/위험38°C), 음영 = 근무시간(09:00~18:00), 점 = 일중 최고 체감</p>
</pdf:keeptogether>

<pdf:keeptogether>
<h2 style="page-break-before: always; margin-top:0;"><span class="no">4.</span> 내·외부 체감온도 분석</h2>
{% if d.external_daily %}
<table class="tbl" style="margin-bottom:3pt;">
  <tr><th style="width:24%">구분</th><th>최고 체감온도</th><th>일 최고기온</th><th>일 평균기온</th></tr>
  <tr><td class="k">외부 · 기상청 AWS</td>
      <td class="num" style="color:#1790cd;">{{ d.external_daily.out_feels_max if d.external_daily.out_feels_max is not none else '-' }}°C</td>
      <td>{{ d.external_daily.out_max if d.external_daily.out_max is not none else '-' }}°C</td>
      <td>{{ d.external_daily.out_avg if d.external_daily.out_avg is not none else '-' }}°C</td></tr>
  <tr><td class="k">작업장(내부 측정)</td>
      <td class="num" style="color:#dc2626;">{{ d.max_feels }}°C</td>
      <td>{{ d.external_daily.in_max }}°C</td><td>{{ d.external_daily.in_avg }}°C</td></tr>
</table>
{% if d.external_daily.diff_feels is not none %}<p class="note">최고 체감온도 차(내-외): <b style="color:#b91c1c;">+{{ d.external_daily.diff_feels }}°C</b> — 작업장 체감온도가 외부보다 높을수록 복사열·밀폐 영향이 큼.</p>{% endif %}
{% endif %}
{% if d.weather and d.weather.enclosed_alert %}
<div class="alert"><b>[경고단계]</b> 작업장 체감온도가 기상청 관측 체감온도보다 최대 {{ d.weather.max_delta }}°C 높게 관측됨{% if d.weather.max_delta_time %} ({{ d.weather.max_delta_time }}경){% endif %}. 해당 시간 환기·국소냉방 등 작업환경 개선 필요.</div>
{% endif %}
{% if chart2 %}<div style="margin:3pt 0;"><img src="{{ chart2 }}" class="chartimg"/></div>{% endif %}
<table class="tbl wide">
  <tr><th class="k" style="width:12%">시각</th>{% for h in d.hours %}<th>{{ '%02d'|format(h.hour) }}</th>{% endfor %}</tr>
  <tr><td class="k">측정 체감(°C)</td>{% for h in d.hours %}<td style="background-color:{{ h.color }}; color:{{ h.fg }}; font-weight:bold;">{{ h.feels if h.feels is not none else '-' }}</td>{% endfor %}</tr>
  <tr><td class="k">기상청 체감(°C)</td>{% for h in d.hours %}<td style="color:#1790cd;">{{ h.out_feels if h.out_feels is not none else '-' }}</td>{% endfor %}</tr>
  <tr><td class="k">차이</td>{% for h in d.hours %}<td{% if h.delta is not none and h.delta >= 5 %} style="color:#b91c1c; font-weight:bold;"{% endif %}>{{ h.delta if h.delta is not none else '-' }}</td>{% endfor %}</tr>
</table>
<p class="note">※ 기상청 체감온도 = 설치위치에서 가장 가까운 기상청 AWS 관측자료 기준 체감온도{% if d.external_daily and d.external_daily.region %} · 관측: {{ d.external_daily.region }}{% endif %} · 차이 = 측정 - 기상청 (°C).</p>
</pdf:keeptogether>

<pdf:keeptogether>
<h2><span class="no">5.</span> 종합 분석</h2>
<div class="gov">{% for a in d.analysis %}<div><span class="b">□</span> {{ a }}</div>{% endfor %}</div>
</pdf:keeptogether>

<pdf:keeptogether>
<h2><span class="no">6.</span> 조치사항 및 권고 <span style="font-size:8pt; color:#64748b; font-weight:normal;">(최고 위험단계 「{{ d.peak_label }}」 기준)</span></h2>
<div class="gov2">{% for g in d.guidance %}<div><span class="b">○</span> {{ g }}</div>{% endfor %}</div>
</pdf:keeptogether>

<pdf:keeptogether>
<h2><span class="no">7.</span> 법정 휴식 의무 <span style="font-size:8pt; color:#64748b; font-weight:normal;">(산업안전보건규칙 — 체감 33°C↑ 작업 시 2시간마다 20분 이상)</span></h2>
{% if d.work and d.work.hot_minutes > 0 %}
<table class="tbl">
  <tr><th style="width:40%">근무시간(09~18) 체감 33°C↑ 작업</th><th>법정 최소 휴식 횟수</th><th>법정 최소 휴식 시간</th></tr>
  <tr><td class="num" style="color:#b45309;">{{ d.work.hot_label }}</td>
      <td class="num">{{ d.work.legal_rest_count }}회</td>
      <td class="num" style="color:#b45309;">{{ d.work.legal_rest_label }}</td></tr>
</table>
<p class="note">※ 측정 체감온도 기반 <b>법정 최소 의무량</b>(2시간 작업당 20분). 실제 부여한 휴식 기록과 대조하여 준수 여부를 확인하십시오.</p>
{% else %}
<p class="note">근무시간 중 체감온도 33°C 이상 작업이 없어 추가 의무 휴식 대상이 아님(통상 안전보건 관리 유지).</p>
{% endif %}
</pdf:keeptogether>

<pdf:keeptogether>
<h2 style="margin-top:9pt;"><span class="no">부록.</span> 시간별 측정데이터 <span style="font-size:8pt; color:#475569; font-weight:normal;">(기온·체감온도·습도 · 시간 평균 · 색상 = 체감 위험단계)</span></h2>
<table class="tbl wide">
  <tr><th class="k" style="width:12%">시각</th>{% for h in d.hours %}<th>{{ '%02d'|format(h.hour) }}시</th>{% endfor %}</tr>
  <tr><td class="k">기온(°C)</td>{% for h in d.hours %}<td>{{ h.temp if h.temp is not none else '-' }}</td>{% endfor %}</tr>
  <tr><td class="k">체감온도(°C)</td>{% for h in d.hours %}<td style="background-color:{{ h.color }}; color:{{ h.fg }}; font-weight:bold;">{{ h.feels if h.feels is not none else '-' }}</td>{% endfor %}</tr>
  <tr><td class="k">습도(%)</td>{% for h in d.hours %}<td>{{ h.humidity if h.humidity is not none else '-' }}</td>{% endfor %}</tr>
</table>
</pdf:keeptogether>
{% else %}
<h2><span class="no">1.</span> 측정 결과</h2>
<p class="note">해당 일자에 수집된 측정 데이터가 없습니다.</p>
{% endif %}

<div class="footer">
  적용 기준: 고용노동부 「2026 폭염 대비 노동자 건강보호 대책」(2026.5.13.) · 폭염안전 5대 기본수칙(시원한 물·냉방장치·휴식(33°C↑ 2시간마다 20분)·보냉장구·119) · 산업안전보건기준에 관한 규칙 제566조 · 기상청 폭염특보(주의보 33°C / 경보 35°C / 중대경보 38°C)<br/>
  측정장비·데이터: 현장 측정값은 <b>케이웨더(주) 체감온도계 장비</b>로 측정되었으며, 외부 기상자료를 포함한 모든 데이터의 출처는 <b>케이웨더(주)</b>입니다. · 본 보고서는 케이웨더(주) 체감온도계 안전보건 대시보드에서 자동 생성되었습니다.
</div>
</body></html>
"""
)


def _html_to_pdf(html: str) -> bytes:
    buf = io.BytesIO()
    pisa.CreatePDF(src=html, dest=buf, encoding="utf-8")
    return buf.getvalue()


def daily_pdf(db: Session, tenant: Tenant, device_sn: str, on_date: date_cls, generated: str) -> bytes:
    d = _daily_detail(db, tenant, device_sn, on_date)
    report_no = f"KW-HS-{on_date.strftime('%Y%m%d')}-{str(device_sn)[-4:]}"
    # 검토안 반영: 시간별 체감 라인차트(시각별 컬러바와 함께) + 내·외부 2선 비교차트.
    chart1 = _chart_hourly_feels(d.get("series") or [], heat.thresholds()) if d.get("has_data") else None
    chart2 = _chart_compare(d.get("hours") or []) if d.get("has_data") else None
    html = _DAILY_TEMPLATE.render(
        d=d, chart=chart1, chart2=chart2, band=None, pdf_font=_PDF_FONT, generated=generated, report_no=report_no
    )
    return _html_to_pdf(html)


def _pil_periodic_bars(daily, th) -> str | None:
    """[PIL] 일자별 최고 체감온도 막대 차트 — 단계색 막대 + 임계 점선 + 값 라벨 (웹 recharts 룩)."""
    try:
        from PIL import Image, ImageDraw
    except Exception:  # noqa: BLE001
        return None
    if not daily:
        return None
    F = _pil_fonts()
    n = len(daily)
    W, H = 1560, 360
    L, R, T, B = 96, 150, 44, 74
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)

    vals = [r["max_feels"] for r in daily]
    ymin = max(20, int((min(vals) - 3) // 5 * 5))
    ymax = max(40, int(-(-(max(vals) + 3) // 5) * 5))

    def Y(y):
        return T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B)

    for gy in range(ymin, ymax + 1, 5):
        d.line([(L, Y(gy)), (W - R, Y(gy))], fill="#eef2f6", width=2)
        d.text((L - 14, Y(gy)), str(gy), font=F(24), fill="#94a3b8", anchor="rm")
    d.line([(L, H - B), (W - R, H - B)], fill="#cbd5e1", width=3)

    slot = (W - R - L) / n
    bar_w = min(slot * 0.6, 72)
    show_val = n <= 16
    step = 1 if n <= 16 else (2 if n <= 31 else 3)
    for i, r in enumerate(daily):
        cx = L + slot * (i + 0.5)
        v = r["max_feels"]
        color = heat.LEVELS.get(r.get("peak_level", "safe"), heat.LEVELS["safe"]).color
        y0 = Y(v)
        d.rounded_rectangle([cx - bar_w / 2, y0, cx + bar_w / 2, H - B], radius=6, fill=color)
        if show_val:
            d.text((cx, y0 - 8), f"{v:.0f}", font=F(22), fill="#475569", anchor="mb")
        if i % step == 0:
            d.text((cx, H - B + 12), r["date"][5:], font=F(20), fill="#94a3b8", anchor="ma")

    # 임계선(점선) + 우측 라벨
    for code in ("caution", "warning", "danger"):
        yv = th[code]
        if ymin < yv < ymax:
            color = heat.LEVELS[code].color
            x = L
            while x < W - R:
                d.line([(x, Y(yv)), (min(x + 16, W - R), Y(yv))], fill=color, width=2)
                x += 28
            d.text((W - R + 8, Y(yv)), f"{heat.LEVELS[code].label} {int(yv)}", font=F(20), fill=color, anchor="lm")

    return _png_data_uri(img)


def _periodic_chart(stats: dict) -> str | None:
    """기간 트렌드 차트 — PIL 단계색 막대(웹 recharts 룩, Vercel 안전)."""
    return _pil_periodic_bars(stats.get("daily") or [], heat.thresholds())


def _periodic_analysis(stats: dict, peak, days: int, danger_days: int) -> list[str]:
    a: list[str] = []
    if stats.get("overall_max_feels") is not None:
        a.append(f"분석 기간({days}일) 중 일 최고 체감온도의 최댓값은 {stats['overall_max_feels']}°C(단계: {peak.label})로 관측됨.")
    if danger_days > 0:
        a.append(f"위험단계(체감 38°C↑) 도달 일수가 {danger_days}일로, 해당 일자에는 긴급조치 작업을 제외한 옥외작업 원칙적 중지 등 긴급대응 검토가 필요함.")
    warn_days = stats["level_counts"]["warning"] + stats["level_counts"]["danger"]
    if warn_days > 0:
        a.append(f"경고 단계(체감 35°C↑) 이상 도달 일수가 누적 {warn_days}일로, 작업·휴식 시간 관리 강화 및 보냉장구 지급이 요구됨.")
    over_days = sum(1 for r in stats["daily"] if r["minutes_over_33"] > 0)
    if over_days:
        a.append(f"주의 단계(체감 33°C↑) 노출이 발생한 일수는 {over_days}일이며, 해당 일자에는 2시간마다 20분 이상 법정 휴식 준수 여부 점검이 필요함.")
    if not a:
        a.append("분석 기간 중 위험단계 도달 일자가 없어 통상적인 안전보건 관리 수준을 유지하면 됨.")
    return a


_PERIODIC_TEMPLATE = Template(
    """
<html><head><style>
@page { size: A4; margin: 30px; @frame footer_frame { -pdf-frame-content: pageFooter; left: 22pt; bottom: 14pt; width: 551pt; height: 16pt; } }
body { font-family: "{{ pdf_font }}"; font-size: 9pt; color:#1f2937; line-height:1.5; }
table { width:100%; border-collapse: collapse; }

/* 헤더 — 미니멀(식별번호) */
.band td { padding: 0 0 9px 0; vertical-align: bottom; border-bottom: 1px solid #cbd5e1; }
.band-r { text-align:right; width:34%; }
.band-title { color:#0f172a; font-size:16pt; font-weight:bold; }
.band-id { color:#64748b; font-size:8pt; margin-top:3pt; }
.band-meta { color:#94a3b8; font-size:7pt; }
.band-date { color:#0f172a; font-size:11pt; font-weight:bold; margin-top:1pt; }

/* 요약 히어로 */
.hero td { border-bottom:1px solid #e2e8f0; padding:8px 12px; vertical-align:top; }
.hero .mid { border-left:1px solid #e8edf3; border-right:1px solid #e8edf3; }
.hero-label { font-size:7pt; color:#64748b; font-weight:bold; }
.hero-val { font-size:21pt; font-weight:bold; margin-top:1pt; }
.hero-unit { font-size:10pt; color:#94a3b8; font-weight:bold; }
.hero-sub { font-size:7pt; color:#94a3b8; margin-top:2pt; }
.hero-badge { display:inline-block; padding:3px 12px; border-radius:9px; color:#fff; font-weight:bold; font-size:12pt; }

/* 문서정보 — 심리스 */
.docinfo { margin-top:8pt; }
.docinfo td { padding:6px 8px; font-size:8.4pt; border-bottom:1px solid #eef2f6; }
.docinfo .k { color:#64748b; width:14%; font-weight:bold; }

/* 섹션 */
h2 { font-size:12pt; color:#0f172a; margin:14pt 0 6pt 0; font-weight:bold; }
h2 .no { color:#0c3d85; font-weight:bold; margin-right:5px; }

/* 데이터 표 — 심리스(세로선·채움 없음, 하단 라인만) */
.tbl th { padding:7px 8px; font-size:8.4pt; color:#64748b; font-weight:bold; text-align:center; border-bottom:1.5px solid #334155; }
.tbl td { padding:6px 8px; font-size:8.8pt; text-align:center; border-bottom:1px solid #eef2f6; }
.tbl .k { color:#475569; font-weight:bold; text-align:left; }
.num { font-weight:bold; font-size:10pt; }
.chartimg { width:540pt; }
.list { margin:2pt 0 0 0; }
.list div { margin:2pt 0; font-size:9pt; }
.list .b { color:#16a34a; font-weight:bold; }
.note { font-size:7.6pt; color:#64748b; margin:2pt 0; }
.footer { margin-top:9pt; border-top:1.5px solid #0c3d85; padding-top:5pt; font-size:7pt; color:#64748b; line-height:1.45; }
.pagenum { text-align:right; font-size:7.5pt; color:#94a3b8; }
</style></head><body>

<div id="pageFooter" class="pagenum"><pdf:pagenumber> / <pdf:pagecount></div>

<table class="band"><tr>
  <td class="band-l">
    <div class="band-title">폭염 안전관리 기간 분석 보고서</div>
    <div class="band-id">{{ report_no }}</div>
  </td>
  <td class="band-r">
    <div class="band-meta">분석 기간</div>
    <div class="band-date">{{ s.start }} ~ {{ s.end }}</div>
  </td>
</tr></table>

{% if s.daily %}
<table class="hero"><tr>
  <td>
    <div class="hero-label">기간 최고 체감온도</div>
    <div class="hero-val" style="color:{{ peak_color }}">{{ s.overall_max_feels }}<span class="hero-unit"> °C</span></div>
    <div class="hero-sub">기간 내 일 최고값</div>
  </td>
  <td class="mid">
    <div class="hero-label">위험단계 도달 일수 (38°C↑)</div>
    <div class="hero-val" style="color:{{ '#dc2626' if danger_days > 0 else '#16a34a' }}">{{ danger_days }}<span class="hero-unit"> 일</span></div>
    <div class="hero-sub">총 {{ days }}일 중</div>
  </td>
  <td>
    <div class="hero-label">최고 위험단계</div>
    <div style="margin-top:5pt;"><span class="hero-badge" style="background:{{ peak_color }}">{{ peak_label }}</span></div>
    <div class="hero-sub">기간 내 최고 단계</div>
  </td>
</tr></table>
{% endif %}

<h2><span class="no">1</span> 측정 대상 개요</h2>
<table class="docinfo">
  <tr><td class="k">사업장</td><td style="width:36%">{{ company or '-' }}</td>
      <td class="k">설치 위치</td><td>{{ location or '-' }}</td></tr>
  <tr><td class="k">분석 기간</td><td>{{ s.start }} ~ {{ s.end }} ({{ days }}일)</td>
      <td class="k">측정기</td><td>케이웨더(주) 체감온도계 · {{ sn }}</td></tr>
</table>
<p class="note">※ 모든 측정 데이터는 <b>케이웨더(주) 체감온도계 장비</b>로 측정·수집된 자료임. · 작성 일시 {{ generated }}</p>

{% if s.daily %}
<pdf:keeptogether>
<h2><span class="no">2</span> 위험 단계별 도달 일수</h2>
<table class="tbl">
  <tr><th style="width:16%; text-align:left;">위험 단계</th>{% for code in ['attention','caution','warning','danger'] %}<th style="color:{{ levels[code].color }}; border-bottom:2.5px solid {{ levels[code].color }};">{{ levels[code].label }} ({{ thresh[code]|int }}°C↑)</th>{% endfor %}</tr>
  <tr><td class="k">도달 일수</td>{% for code in ['attention','caution','warning','danger'] %}<td class="num" style="color:{{ levels[code].color }}">{{ s.level_counts[code] }}일</td>{% endfor %}</tr>
</table>
<p class="note">※ 각 단계 기준 체감온도 이상에 일 최고 체감온도가 도달한 일수 · 단계 기준: 고용노동부 폭염 단계별 대응요령(체감온도)</p>
</pdf:keeptogether>

<pdf:keeptogether>
<h2><span class="no">3</span> 일자별 최고 체감온도 트렌드</h2>
{% if chart %}<div style="margin-top:5pt;"><img src="{{ chart }}" class="chartimg"/></div>{% endif %}
</pdf:keeptogether>
<table class="tbl" repeat="1">
  <thead><tr><th style="text-align:left;">일자</th><th>최고 체감</th><th>최고 기온</th><th>주의(33°C↑) 노출</th><th>최고단계</th></tr></thead>
  <tbody>
  {% for row in s.daily %}
  <tr>
    <td class="k">{{ row.date }}</td>
    <td class="num" style="color:{{ levels[row.peak_level].color }}">{{ row.max_feels }}°C</td>
    <td>{{ row.max_temp }}°C</td>
    <td>{{ (row.minutes_over_33 // 60)|string + '시간 ' + (row.minutes_over_33 % 60)|string + '분' if row.minutes_over_33 >= 60 else (row.minutes_over_33|string + '분') }}</td>
    <td style="color:{{ levels[row.peak_level].color }}; font-weight:bold;">{{ row.peak_label }}</td>
  </tr>
  {% endfor %}
  </tbody>
</table>

<pdf:keeptogether>
<h2><span class="no">4</span> 종합 분석 및 권고</h2>
<div class="list">{% for a in analysis %}<div><span class="b">○</span> {{ a }}</div>{% endfor %}</div>
</pdf:keeptogether>
{% else %}
<h2><span class="no">2</span> 분석 결과</h2>
<p class="note">해당 기간에 수집된 측정 데이터가 없습니다.</p>
{% endif %}

<div class="footer">
  적용 기준: 고용노동부 「2026 폭염 대비 노동자 건강보호 대책」 · 산업안전보건기준에 관한 규칙 제566조 · 기상청 폭염특보(주의보 33°C / 경보 35°C / 중대경보 38°C)<br/>
  측정장비·데이터: 현장 측정값은 <b>케이웨더(주) 체감온도계 장비</b>로 측정되었으며, 외부 기상자료를 포함한 모든 데이터의 출처는 <b>케이웨더(주)</b>입니다. · 본 보고서는 케이웨더(주) 체감온도계 안전보건 대시보드에서 자동 생성되었습니다.
</div>
</body></html>
"""
)


def periodic_pdf(
    db: Session, tenant: Tenant, device_sn: str | None, start: date_cls, end: date_cls, generated: str
) -> bytes:
    stats = analytics.periodic_stats(db, tenant, device_sn, start, end)
    days = len(stats["daily"])
    danger_days = stats["level_counts"]["danger"]
    peak = heat.classify(stats.get("overall_max_feels"))
    report_no = f"KW-HP-{start.strftime('%Y%m%d')}-{(str(device_sn) if device_sn else 'ALL')[-4:]}"
    company = location = None
    if device_sn:
        dev = db.get(Device, device_sn)
        if dev:
            company = dev.company_name
            location = dev.location_name
    html = _PERIODIC_TEMPLATE.render(
        s=stats, levels=heat.LEVELS, thresh=heat.thresholds(), chart=_periodic_chart(stats),
        report_no=report_no, days=days, danger_days=danger_days,
        peak_color=peak.color, peak_label=peak.label,
        company=company, location=location, sn=device_sn or "전체 기기",
        analysis=_periodic_analysis(stats, peak, days, danger_days),
        pdf_font=_PDF_FONT, generated=generated,
    )
    return _html_to_pdf(html)


# ---------------- Excel ----------------
_HEADER_FILL = PatternFill("solid", fgColor="1E293B")
_HEADER_FONT = Font(color="FFFFFF", bold=True)

# 서버리스 응답 한도(4.5MB)·시간 제한 내에서 안전한 로우데이터 상한
EXPORT_RAW_MAX = 100_000


def export_excel(
    db: Session, tenant: Tenant, device_sn: str | None, start: datetime, end: datetime
) -> bytes:
    """Excel 내보내기 — 일일 '측정 기록부'(순수 기록 보고용).

    분석 요약·가이드 없이, 선택한 하루의 기기 측정값(시각·습도·온도·체감온도·위험단계)을
    그대로 나열하고, 안전관리자가 온도 상황에 따른 조치사항·비고를 수기로 기록할 수 있게
    빈 칸을 제공한다.
    """
    from openpyxl.styles import Alignment as _Align, Border, Side
    from openpyxl.worksheet.page import PageMargins
    from openpyxl.worksheet.properties import PageSetupProperties

    from ..models import SensorLog

    on_date = start.date()
    sns = analytics._resolve_scope(db, tenant, device_sn)
    dev = db.get(Device, device_sn) if device_sn else None

    NCOL = 7  # 측정시각·습도·온도·체감온도·위험단계·조치사항·비고
    wb = Workbook()
    ws = wb.active
    ws.title = "측정 기록부"

    # --- A4 세로 인쇄 설정(폭에 맞춰 1페이지 너비로 축소, 가로 중앙) ---
    ws.page_setup.orientation = "portrait"
    ws.page_setup.paperSize = 9  # A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    ws.page_margins = PageMargins(left=0.4, right=0.4, top=0.6, bottom=0.5, header=0.3, footer=0.3)
    ws.print_options.horizontalCentered = True
    ws.sheet_view.showGridLines = False  # 직접 그린 구분선만 표시

    # 열 너비(합 ≈ A4 세로 가용폭) — fitToWidth로 한 페이지 폭에 자동 정렬
    for i, w in enumerate([10, 9, 9, 12, 11, 26, 18], start=1):
        ws.column_dimensions[chr(64 + i)].width = w

    last = chr(64 + NCOL)  # 'G'
    title_font = Font(bold=True, size=16, color="0F172A")
    k_fill = PatternFill("solid", fgColor="F1F5F9")
    k_font = Font(bold=True, color="334155")
    thin = Side(style="thin", color="94A3B8")
    medium = Side(style="medium", color="334155")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    box = Border(left=medium, right=medium, top=medium, bottom=medium)

    def outline(row, c1, c2, b):
        """병합 셀 영역 전체에 외곽선을 적용(병합 시 모서리 셀만 그려지는 문제 보정)."""
        for cc in range(c1, c2 + 1):
            cell = ws.cell(row, cc)
            left = b.left if cc == c1 else thin
            right = b.right if cc == c2 else thin
            cell.border = Border(left=left, right=right, top=b.top, bottom=b.bottom)

    # --- 제목: 전 열 병합 + 가운데 정렬 ---
    r = 1
    ws.merge_cells(f"A{r}:{last}{r}")
    tc = ws.cell(r, 1, "폭염 체감온도 측정 기록부")
    tc.font = title_font
    tc.alignment = _Align(horizontal="center", vertical="center")
    ws.row_dimensions[r].height = 30
    r += 2

    # --- 기록 식별 헤더(라벨 + 병합 값칸, 외곽선) ---
    def lab(row, lcol, vend, label, value):
        a = ws.cell(row, lcol, label); a.fill = k_fill; a.font = k_font
        a.border = box; a.alignment = _Align(horizontal="center", vertical="center")
        ws.merge_cells(start_row=row, start_column=lcol + 1, end_row=row, end_column=vend)
        v = ws.cell(row, lcol + 1, value if value is not None else "-")
        v.alignment = _Align(horizontal="left", vertical="center", indent=1)
        outline(row, lcol + 1, vend, box)

    lab(r, 1, 3, "사업장", dev.company_name if dev else "-")
    lab(r, 4, 7, "대상 일자", on_date.isoformat())
    ws.row_dimensions[r].height = 22
    r += 1
    lab(r, 1, 3, "설치 위치", dev.location_name if dev else "-")
    lab(r, 4, 7, "측정기기", f"케이웨더(주) 체감온도계 · {device_sn}" if device_sn else "-")
    ws.row_dimensions[r].height = 22
    r += 1
    lab(r, 1, 3, "작성자", "")
    lab(r, 4, 7, "확인(관리자)", "")
    ws.row_dimensions[r].height = 24
    r += 2

    # --- 측정 표(위험단계 + 수기 조치사항·비고) ---
    headers = ["측정시각", "습도(%)", "온도(℃)", "체감온도(℃)", "위험단계", "조치사항(수기)", "비고(수기)"]
    head_row = r
    for ci, h in enumerate(headers, start=1):
        cell = ws.cell(r, ci, h)
        cell.fill = _HEADER_FILL
        cell.font = _HEADER_FONT
        cell.alignment = _Align(horizontal="center", vertical="center")
        cell.border = box
    ws.row_dimensions[r].height = 22
    ws.print_title_rows = f"{head_row}:{head_row}"  # 각 인쇄 페이지마다 표 머리글 반복
    r += 1

    if sns:
        cond = [SensorLog.device_sn.in_(sns), SensorLog.measured_at >= start, SensorLog.measured_at <= end]
        q = (
            select(
                SensorLog.measured_at, SensorLog.temperature,
                SensorLog.humidity, SensorLog.feels_like_temperature,
            )
            .where(*cond)
            .order_by(SensorLog.measured_at)
            .limit(EXPORT_RAW_MAX)
        )
        center = _Align(horizontal="center")
        for mt, temp, humi, feels in db.execute(q):
            ts = pd.Timestamp(mt)
            fv = float(feels) if feels is not None else None
            lvl = heat.classify(fv)
            c1 = ws.cell(r, 1, ts.strftime("%H:%M"))
            c2 = ws.cell(r, 2, int(humi) if humi is not None else None)
            c3 = ws.cell(r, 3, round(float(temp), 1) if temp is not None else None)
            c4 = ws.cell(r, 4, round(fv, 1) if fv is not None else None)
            c5 = ws.cell(r, 5, lvl.label if fv is not None else "")
            if fv is not None:
                c5.fill = PatternFill("solid", fgColor=lvl.color.lstrip("#").upper())
                c5.font = Font(bold=True, color="FFFFFF")
            c6 = ws.cell(r, 6, "")  # 조치사항 — 수기
            c7 = ws.cell(r, 7, "")  # 비고 — 수기
            for cc in (c1, c2, c3, c4, c5, c6, c7):
                cc.border = border
                if cc not in (c6, c7):
                    cc.alignment = center
            ws.row_dimensions[r].height = 17
            r += 1

    ws.print_area = f"A1:{last}{r - 1}"  # 빈 열 제외, 표 끝까지만 인쇄

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
