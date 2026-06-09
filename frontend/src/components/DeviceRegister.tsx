import { useState } from "react";
import { api } from "../api";
import type { Device } from "../types";
import { DeviceManager } from "./DeviceManager";

const EMPTY = (company: string) => ({
  device_sn: "", company_name: company, location_name: "", address: "",
  latitude: "" as string | number, longitude: "" as string | number, region_code: "",
});

export function DeviceRegister({
  devices, defaultCompany, onChange,
}: { devices: Device[]; defaultCompany: string; onChange: () => void }) {
  const [form, setForm] = useState(EMPTY(defaultCompany));
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm({ ...form, [k]: v });
  }

  async function geocode() {
    const addr = (form.address || "").trim();
    setGeoMsg(null); setError(null);
    if (!addr) { setError("주소를 먼저 입력하세요."); return; }
    setGeoBusy(true);
    try {
      const r = await api.geocode(addr);
      setForm((f) => ({ ...f, latitude: r.lat, longitude: r.lon }));
      setGeoMsg(
        `매칭됨(${r.provider === "kakao" ? "카카오" : "OSM·근사"}): ${r.matched} → 위도 ${r.lat}, 경도 ${r.lon}` +
        (r.provider === "nominatim" ? " · 정확도가 낮을 수 있어 확인 후 사용하세요." : "")
      );
    } catch (e: any) {
      const m = String(e.message || e);
      setError(m.includes("404") || m.includes("찾지") ? "주소를 찾지 못했습니다. 더 구체적으로(시/구/도로명) 입력해 주세요." : m);
    } finally {
      setGeoBusy(false);
    }
  }

  async function register() {
    setError(null); setOkMsg(null);
    if (!form.device_sn.trim()) { setError("기기 시리얼번호(SN)를 입력하세요."); return; }
    setBusy(true);
    try {
      await api.createDevice({
        device_sn: form.device_sn.trim(),
        company_name: form.company_name?.trim() || null,
        location_name: form.location_name?.trim() || null,
        address: form.address?.trim() || null,
        latitude: form.latitude === "" ? null : Number(form.latitude),
        longitude: form.longitude === "" ? null : Number(form.longitude),
        region_code: form.region_code?.trim() || null,
      });
      setOkMsg(`기기 ${form.device_sn.trim()} 등록 완료. 같은 회사의 다른 장소·기기도 계속 추가할 수 있습니다.`);
      // 회사명은 유지하고 나머지 비움 → 연속 등록 편의
      setForm({ ...EMPTY(form.company_name) });
      setGeoMsg(null);
      onChange();
    } catch (e: any) {
      const msg = String(e.message || e);
      setError(msg.includes("409") || msg.includes("이미") ? "이미 등록된 기기 SN 입니다." : msg);
    } finally {
      setBusy(false);
    }
  }

  const inp = "w-full rounded border border-slate-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
        <h3 className="font-semibold text-slate-800">사업장 · 기기 등록</h3>
        <p className="mt-1 text-xs text-slate-500">
          데이터를 올리기 전에 먼저 기기를 등록하세요. <b>같은 회사라도 장소·기기별로 각각 추가 등록</b>할 수 있습니다.
          (위경도를 입력하면 기상청 외부 날씨 비교가 활성화됩니다.)
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">기기 시리얼번호 (SN) *</span>
            <input className={inp} value={form.device_sn} onChange={(e) => set("device_sn", e.target.value)}
                   placeholder="예: IST4W1800044" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">회사명</span>
            <input className={inp} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">설치 위치 (장소)</span>
            <input className={inp} value={form.location_name} onChange={(e) => set("location_name", e.target.value)}
                   placeholder="예: 제2공장 정련로 앞" />
          </label>
          <div className="md:col-span-3">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              주소 <span className="text-slate-400">— 입력 후 '좌표 찾기'를 누르면 위경도가 자동 입력됩니다</span>
            </span>
            <div className="flex gap-2">
              <input className={`${inp} flex-1`} value={form.address} onChange={(e) => set("address", e.target.value)}
                     onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); geocode(); } }}
                     placeholder="예: 부산 사하구 다대로 627" />
              <button type="button" onClick={geocode} disabled={geoBusy}
                      className="shrink-0 rounded bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50">
                {geoBusy ? "찾는 중..." : "📍 좌표 찾기"}
              </button>
            </div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">위도</span>
            <input className={inp} value={form.latitude} onChange={(e) => set("latitude", e.target.value)}
                   placeholder="자동/직접 입력" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">경도</span>
            <input className={inp} value={form.longitude} onChange={(e) => set("longitude", e.target.value)}
                   placeholder="자동/직접 입력" />
          </label>
          {geoMsg && (
            <div className="rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700 md:col-span-3">{geoMsg}</div>
          )}
        </div>

        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {okMsg && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{okMsg}</p>}

        <button onClick={register} disabled={busy}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {busy ? "등록 중..." : "+ 기기 등록"}
        </button>
      </div>

      <DeviceManager devices={devices} onChange={onChange} />
    </div>
  );
}
