import { useCallback, useEffect, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { api } from "../api";
import type { AdminOverview } from "../types";

const KIND_LABEL: Record<string, string> = {
  visit: "방문/인증", upload: "업로드", report: "리포트", api: "조회",
};
const KIND_STYLE: Record<string, string> = {
  visit: "bg-sky-50 text-sky-700",
  upload: "bg-emerald-50 text-emerald-700",
  report: "bg-violet-50 text-violet-700",
  api: "bg-slate-100 text-slate-600",
};

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card !p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold tracking-tight ${accent ?? "text-slate-900"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function AdminPage({ onClose }: { onClose: () => void }) {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true); setErr(null);
    api.adminOverview(days)
      .then(setData)
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const n = (v: number) => v.toLocaleString();

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-5 py-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">관리자 대시보드</h2>
          <p className="text-xs text-slate-400">
            일 방문 · 이용 트래픽 · 데이터 업로드 현황 {data && `· 기준 ${data.generated_at} (KST)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-slate-100/80 p-1 text-xs font-medium">
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded-lg px-3 py-1.5 ${days === d ? "bg-white text-slate-900 shadow" : "text-slate-500"}`}>
                {d}일
              </button>
            ))}
          </div>
          <button onClick={load} className="btn-ghost !py-2 text-sm">새로고침</button>
          <button onClick={onClose} className="btn-primary !py-2 text-sm">대시보드로</button>
        </div>
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      {loading && !data && <div className="py-16 text-center text-slate-400">불러오는 중...</div>}

      {data && (
        <>
          {/* 오늘 지표 */}
          <div>
            <div className="mb-2 text-sm font-semibold text-slate-700">오늘 현황</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Kpi label="오늘 방문(고유)" value={n(data.today.visits)} accent="text-kw" />
              <Kpi label="오늘 요청(트래픽)" value={n(data.today.requests)} />
              <Kpi label="오늘 업로드" value={`${n(data.today.uploads)}건`} sub={`${n(data.today.rows)}행 반영`} accent="text-emerald-600" />
              <Kpi label="오늘 신규가입" value={n(data.today.signups)} />
              <Kpi label="누적 측정행" value={n(data.totals.rows)} sub={`회원 ${n(data.totals.members)} · 기기 ${n(data.totals.devices)}`} />
            </div>
          </div>

          {/* 일자별 추이 */}
          <div className="card">
            <h3 className="mb-2 font-semibold text-slate-900">일자별 이용 추이 (최근 {days}일)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={data.daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={20}
                       tickFormatter={(d) => String(d).slice(5)} />
                <YAxis yAxisId="l" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="l" dataKey="requests" name="요청수" fill="#dbe7f7" radius={[3, 3, 0, 0]} />
                <Bar yAxisId="l" dataKey="uploads" name="업로드" fill="#a7f3d0" radius={[3, 3, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="visits" name="방문(고유)" stroke="#0f499e" strokeWidth={2.2} dot={false} />
                <Line yAxisId="r" type="monotone" dataKey="signups" name="신규가입" stroke="#f97316" strokeWidth={1.6} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* 테넌트별 현황 */}
          <div className="card">
            <h3 className="mb-3 font-semibold text-slate-900">사업장(회원)별 데이터 현황</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3">회사</th>
                    <th className="py-2 pr-3">이메일</th>
                    <th className="py-2 pr-3 text-right">기기</th>
                    <th className="py-2 pr-3 text-right">측정행</th>
                    <th className="py-2 pr-3">데이터 기간</th>
                    <th className="py-2 pr-3">가입일</th>
                    <th className="py-2">최근 활동</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tenants.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-medium text-slate-800">
                        {t.company}
                        {t.is_demo && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">데모</span>}
                      </td>
                      <td className="py-2 pr-3 text-slate-500">{t.email ?? "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{n(t.devices)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{n(t.rows)}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">
                        {t.first_date ? `${t.first_date} ~ ${t.last_date}` : "—"}
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{t.created_at ?? "—"}</td>
                      <td className="py-2 text-xs text-slate-500">{t.last_active ?? "—"}</td>
                    </tr>
                  ))}
                  {data.tenants.length === 0 && (
                    <tr><td colSpan={7} className="py-4 text-center text-slate-400">회원이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 최근 이벤트 */}
          <div className="card">
            <h3 className="mb-3 font-semibold text-slate-900">최근 접근 로그</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3">시각</th>
                    <th className="py-2 pr-3">구분</th>
                    <th className="py-2 pr-3">회사</th>
                    <th className="py-2 pr-3">요청</th>
                    <th className="py-2 text-right">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((e, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5 pr-3 font-mono text-xs text-slate-500">{e.ts}</td>
                      <td className="py-1.5 pr-3">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] ${KIND_STYLE[e.kind] ?? KIND_STYLE.api}`}>
                          {KIND_LABEL[e.kind] ?? e.kind}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-slate-600">{e.company ?? (e.email ?? "익명")}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs text-slate-500">{e.method} {e.path}</td>
                      <td className={`py-1.5 text-right tabular-nums ${e.status >= 400 ? "text-red-600" : "text-slate-500"}`}>{e.status}</td>
                    </tr>
                  ))}
                  {data.recent.length === 0 && (
                    <tr><td colSpan={5} className="py-4 text-center text-slate-400">기록이 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
