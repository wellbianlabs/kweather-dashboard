import { useEffect, useRef, useState } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { api } from "../api";
import { IconDownload, IconFileText, IconLoader2 } from "@tabler/icons-react";
import type { DailyReport, DailyHourPoint } from "../types";
import { HeatBadge } from "./HeatBadge";

// 삭제된 ./Icons 대체(병합) — 원작자 보고서 UI(Tailwind) 유지, 아이콘만 tabler 로 매핑. (Mantine 재변환은 후속)
const IconFile = ({ className }: { className?: string }) => <IconFileText className={className} />;
const IconSpinner = ({ className }: { className?: string }) => <IconLoader2 className={`animate-spin ${className ?? ""}`} />;

function fmtMin(min: number): string {
  if (!min || min <= 0) return "0분";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

const KIND_LABEL: Record<string, string> = {
  daily: "일일 안전 보고서(PDF)",
  periodic: "기간 통계 보고서(PDF)",
  excel: "Excel 데이터 파일",
};

type Preview = { kind: string; url: string; blob: Blob; filename: string } | null;

export function ReportPanel({
  deviceSn, date, rangeStart, rangeEnd,
}: { deviceSn: string | null; date: string; rangeStart: string; rangeEnd: string }) {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deviceSn) { setReport(null); return; }
    setLoading(true);
    api.dailyReport(deviceSn, date).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false));
  }, [deviceSn, date]);

  // 미리보기 objectURL 정리(언마운트/교체 시 메모리 해제)
  useEffect(() => {
    return () => { if (preview?.url) URL.revokeObjectURL(preview.url); };
  }, [preview]);

  function friendlyError(e: any): string {
    let msg = String(e?.message || e);
    try { msg = JSON.parse(msg).detail ?? msg; } catch {}
    if (msg.includes("504") || msg.toLowerCase().includes("timeout")) {
      return "기간이 너무 길어 생성 시간이 초과되었습니다. 리포트 기간을 줄여 다시 시도해 주세요.";
    }
    return msg;
  }

  // PDF 로 변환하여 화면에 표출(미리보기). 인증 헤더로 Blob 을 받아 임베드한다.
  async function showPreview(kind: string, url: string, filename: string) {
    setBusy(kind); setDlError(null);
    try {
      const blob = await api.fetchBlob(url);
      setPreview((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { kind, url: URL.createObjectURL(blob), blob, filename };
      });
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e: any) {
      setDlError(`PDF 변환 실패: ${friendlyError(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function downloadOnly(kind: string, url: string, filename: string) {
    setBusy(kind); setDlError(null);
    try {
      await api.download(url, filename);
    } catch (e: any) {
      setDlError(`다운로드 실패: ${friendlyError(e)}`);
    } finally {
      setBusy(null);
    }
  }

  function closePreview() {
    setPreview((prev) => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
  }

  const btn = "rounded-xl px-4 py-2.5 text-sm font-semibold transition";

  return (
    <div className="card">
      {/* 생성 중 로딩 오버레이 */}
      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-[2px]">
          <div className="mx-4 flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-white px-8 py-9 shadow-lift">
            <IconSpinner className="h-11 w-11 text-kw" />
            <div className="text-center">
              <div className="text-base font-bold tracking-tight text-slate-900">
                {KIND_LABEL[busy] ?? "파일"} 생성 중
              </div>
              <div className="mt-1.5 text-sm leading-relaxed text-slate-500">
                데이터 양에 따라 최대 1분 정도 소요될 수 있습니다.<br />잠시만 기다려 주세요.
              </div>
            </div>
            <div className="h-1 w-40 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-1/3 animate-[loading_1.2s_ease-in-out_infinite] rounded-full bg-kw" />
            </div>
          </div>
        </div>
      )}

      <h3 className="mb-1 font-semibold text-slate-900">안전관리 리포트</h3>
      <p className="mb-3 text-xs text-slate-400">웹 보고서로 먼저 확인한 뒤, PDF로 변환해 보거나 내려받을 수 있습니다.</p>

      {/* 1) 웹 보고서 — 화면에 먼저 표출 (하단 요약을 통합) */}
      {loading ? (
        <p className="text-sm text-slate-400">불러오는 중...</p>
      ) : !deviceSn ? (
        <p className="text-sm text-slate-400">기기를 선택하면 웹 보고서가 표시됩니다.</p>
      ) : report ? (
        <WebReport report={report} deviceSn={deviceSn} />
      ) : (
        <p className="text-sm text-slate-400">해당 일자 데이터가 없습니다.</p>
      )}

      {/* 변환/내보내기 버튼 */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          disabled={!deviceSn || busy !== null}
          onClick={() => deviceSn && showPreview("daily", api.dailyPdfUrl(deviceSn, date), `daily_${deviceSn}_${date}.pdf`)}
          className={`${btn} bg-kw text-white hover:bg-kw-dark disabled:opacity-40`}
        ><span className="inline-flex items-center gap-2">{busy === "daily" ? <IconSpinner className="h-4 w-4" /> : <IconFile className="h-4 w-4" />}{busy === "daily" ? "변환 중…" : "일일 보고서 PDF로 보기"}</span></button>
        <button
          disabled={busy !== null}
          onClick={() => showPreview("periodic", api.periodicPdfUrl(deviceSn, rangeStart, rangeEnd), `periodic_${rangeStart}_${rangeEnd}.pdf`)}
          className={`${btn} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40`}
        ><span className="inline-flex items-center gap-2">{busy === "periodic" ? <IconSpinner className="h-4 w-4" /> : <IconFile className="h-4 w-4" />}{busy === "periodic" ? "변환 중…" : "기간 통계 보고서 PDF로 보기"}</span></button>
        <button
          disabled={!deviceSn || busy !== null}
          onClick={() => deviceSn && downloadOnly("excel", api.excelUrl(deviceSn, date, date), `data_${deviceSn}_${date}.xlsx`)}
          className={`${btn} border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40`}
        ><span className="inline-flex items-center gap-2">{busy === "excel" ? <IconSpinner className="h-4 w-4" /> : <IconDownload className="h-4 w-4" />}{busy === "excel" ? "생성 중…" : "당일 측정데이터 내보내기 (10분·Excel)"}</span></button>
      </div>
      {dlError && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dlError}</p>
      )}

      {/* 2) PDF 변환 미리보기 — 웹 보고서 다음에 표출 */}
      {preview && (
        <div ref={previewRef} className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-sm font-semibold text-slate-700">{KIND_LABEL[preview.kind] ?? "보고서"} — PDF 변환 미리보기</span>
            <div className="flex gap-2">
              <button
                onClick={() => api.saveBlob(preview.blob, preview.filename)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-kw px-3 py-1.5 text-xs font-semibold text-white hover:bg-kw-dark"
              ><IconDownload className="h-3.5 w-3.5" />다운로드</button>
              <button
                onClick={closePreview}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100"
              >닫기</button>
            </div>
          </div>
          <iframe
            src={`${preview.url}#toolbar=1&view=FitH`}
            title="보고서 PDF 미리보기"
            className="h-[760px] w-full bg-slate-100"
          />
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-center text-[11px] text-slate-400">
            미리보기가 보이지 않으면 상단의 “다운로드”로 파일을 내려받아 확인하세요.
          </div>
        </div>
      )}
    </div>
  );
}

/** 웹 보고서 — 일일 보고서를 PDF 변환 전 HTML 레이아웃으로 표출. */
function WebReport({ report, deviceSn }: { report: DailyReport; deviceSn: string }) {
  const lv = report.peak_level;
  const Info = ({ k, v }: { k: string; v: string }) => (
    <div className="flex">
      <div className="w-24 shrink-0 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">{k}</div>
      <div className="flex-1 px-3 py-2 text-sm text-slate-800">{v}</div>
    </div>
  );
  const Metric = ({ label, value, unit, sub, accent }:
    { label: string; value: string; unit?: string; sub?: string; accent?: string }) => (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline justify-center gap-1">
        <span className="text-xl font-bold tracking-tight" style={{ color: accent || "#0f172a" }}>{value}</span>
        {unit && <span className="text-xs text-slate-400">{unit}</span>}
      </div>
      <div className="mt-0.5 h-4 text-[11px] text-slate-400">{sub || ""}</div>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* 제목 */}
      <div className="border-b-2 border-kw px-5 py-4 text-center">
        <div className="text-lg font-extrabold tracking-tight text-slate-900">폭염 안전관리 일일 보고서</div>
        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
          Heat Stress Daily Management Report
        </div>
      </div>

      {/* 문서 정보 */}
      <div className="grid grid-cols-1 divide-y divide-slate-100 border-b border-slate-100 sm:grid-cols-2 sm:divide-y-0">
        <div className="divide-y divide-slate-100 sm:border-r sm:border-slate-100">
          <Info k="사업장" v={report.company_name || "-"} />
          <Info k="설치 위치" v={report.location_name || "-"} />
        </div>
        <div className="divide-y divide-slate-100">
          <Info k="대상 일자" v={report.date} />
          <div className="flex items-center">
            <div className="w-24 shrink-0 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">최고 위험단계</div>
            <div className="flex-1 px-3 py-1.5"><HeatBadge level={lv} size="sm" /></div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {/* 측정 결과 요약 */}
        <section>
          <h4 className="mb-2 text-sm font-bold text-slate-800"><span className="text-kw">1.</span> 측정 결과 요약</h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Metric label="최고 체감온도" value={`${report.max_feels_like ?? "-"}`} unit="℃"
                    accent={lv.color} sub={report.max_feels_like_time ? `${report.max_feels_like_time} 발생` : ""} />
            <Metric label="최고 온도" value={`${report.max_temperature ?? "-"}`} unit="℃" />
            <Metric label="위험단계 노출 (38℃↑)" value={fmtMin(report.minutes_over_38)}
                    accent={report.minutes_over_38 > 0 ? "#dc2626" : undefined}
                    sub={report.minutes_over_38 > 0 ? "온열질환 고위험" : "미발생"} />
          </div>
        </section>

        {/* 위험단계별 노출시간 — 관심/주의/경고/위험 4단계 */}
        <section>
          <h4 className="mb-2 text-sm font-bold text-slate-800"><span className="text-kw">2.</span> 폭염 위험단계별 노출시간</h4>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-center text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500">
                  <th className="py-1.5 font-medium">관심 (31℃↑)</th>
                  <th className="py-1.5 font-medium">주의 (33℃↑)</th>
                  <th className="py-1.5 font-medium">경고 (35℃↑)</th>
                  <th className="py-1.5 font-medium">위험 (38℃↑)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="font-bold text-slate-800">
                  <td className="border-t border-slate-100 py-2" style={{ color: "#84cc16" }}>{fmtMin(report.minutes_over_31)}</td>
                  <td className="border-t border-slate-100 py-2" style={{ color: "#eab308" }}>{fmtMin(report.minutes_over_33)}</td>
                  <td className="border-t border-slate-100 py-2" style={{ color: "#f97316" }}>{fmtMin(report.minutes_over_35)}</td>
                  <td className="border-t border-slate-100 py-2" style={{ color: "#dc2626" }}>{fmtMin(report.minutes_over_38)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 시간별 체감온도 변화 — 표 + 그래프 */}
        <section>
          <h4 className="mb-2 text-sm font-bold text-slate-800"><span className="text-kw">3.</span> 시간별 체감온도 변화</h4>
          <HourlyTable hours={report.hours} />
          <HourlyChart hours={report.hours} />
        </section>

        {/* 법정 휴식 의무 (산업안전보건규칙) */}
        <section>
          <h4 className="mb-2 text-sm font-bold text-slate-800"><span className="text-kw">4.</span> 법정 휴식 의무 <span className="text-xs font-normal text-slate-400">(산업안전보건규칙 — 체감 33℃↑ 작업 시 2시간마다 20분 이상)</span></h4>
          {report.work_hot_minutes > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <div className="text-slate-700">
                근무시간(09:00~18:00) 중 체감온도 <b>33℃ 이상 작업</b>이
                <b className="text-amber-700"> {fmtMin(report.work_hot_minutes)}</b> 발생 →
                <b className="text-amber-700"> 최소 {report.legal_rest_count}회 · 총 {fmtMin(report.legal_rest_minutes)}</b>의
                휴식을 부여해야 합니다.
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                ※ 본 수치는 측정 체감온도 기반 <b>법정 최소 의무량</b>입니다. 실제 부여한 휴식 기록과 대조하여 준수 여부를 확인하세요.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              근무시간 중 체감온도 33℃ 이상 작업이 없어 추가 의무 휴식 대상이 아닙니다(통상 안전보건 관리 유지).
            </div>
          )}
        </section>

        {/* 안전조치 가이드 */}
        <section>
          <h4 className="mb-2 text-sm font-bold text-slate-800"><span className="text-kw">5.</span> 안전조치 이행 가이드</h4>
          <ul className="space-y-1.5">
            {report.guidance.map((g, i) => (
              <li key={i} className="flex gap-2 text-sm leading-snug text-slate-700">
                <span className="mt-0.5 text-kw">○</span>{g}
              </li>
            ))}
          </ul>
        </section>

        <p className="border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-400">
          측정기기: 케이웨더(주) 체감온도계 (기기: {deviceSn}) · 모든 측정 데이터는 케이웨더(주) 체감온도계 장비로
          측정·수집되었으며, 외부 기상자료를 포함한 출처는 케이웨더(주)입니다.
        </p>
      </div>
    </div>
  );
}

// 24시간 고정으로 정렬(없는 시간은 빈 칸)
function fill24(hours: DailyHourPoint[]): (DailyHourPoint | null)[] {
  const map = new Map(hours.map((h) => [h.hour, h]));
  return Array.from({ length: 24 }, (_, h) => map.get(h) ?? null);
}

/** 시간별 체감온도 색상 표(24시간). */
function HourlyTable({ hours }: { hours: DailyHourPoint[] }) {
  const cells = fill24(hours);
  if (!hours.length) return <p className="text-sm text-slate-400">시간별 데이터가 없습니다.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full table-fixed text-center" style={{ minWidth: 720 }}>
        <tbody>
          <tr>
            <td className="w-12 bg-slate-50 px-1 py-1 text-[10px] font-medium text-slate-500">시각</td>
            {cells.map((_, h) => (
              <td key={h} className="bg-slate-50 px-0.5 py-1 text-[10px] font-medium text-slate-500">
                {String(h).padStart(2, "0")}
              </td>
            ))}
          </tr>
          <tr>
            <td className="w-12 bg-slate-50 px-1 py-1 text-[10px] font-medium text-slate-500">체감</td>
            {cells.map((c, h) => (
              <td key={h} className="px-0.5 py-1.5 text-[10px] font-bold text-white"
                  style={{ background: c?.feels != null ? c.color : "#f1f5f9", color: c?.feels != null ? "#fff" : "#cbd5e1" }}>
                {c?.feels != null ? c.feels.toFixed(1) : "-"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** 시간별 체감온도 변화 그래프(단계 임계선 포함). */
function HourlyChart({ hours }: { hours: DailyHourPoint[] }) {
  if (!hours.length) return null;
  const data = fill24(hours).map((c, h) => ({ time: `${String(h).padStart(2, "0")}시`, 체감온도: c?.feels ?? null }));
  return (
    <div className="mt-3">
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={20} />
          <YAxis tick={{ fontSize: 10 }} unit="℃" domain={["auto", "auto"]} />
          <Tooltip />
          <ReferenceLine y={31} stroke="#84cc16" strokeDasharray="4 4" label={{ value: "관심 31", fontSize: 9, fill: "#65a30d", position: "right" }} />
          <ReferenceLine y={33} stroke="#eab308" strokeDasharray="4 4" label={{ value: "주의 33", fontSize: 9, fill: "#a16207", position: "right" }} />
          <ReferenceLine y={35} stroke="#f97316" strokeDasharray="4 4" label={{ value: "경고 35", fontSize: 9, fill: "#c2410c", position: "right" }} />
          <ReferenceLine y={38} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "위험 38", fontSize: 9, fill: "#b91c1c", position: "right" }} />
          <Line type="monotone" dataKey="체감온도" stroke="#dc2626" strokeWidth={2.2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
