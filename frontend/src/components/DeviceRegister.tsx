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
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm({ ...form, [k]: v });
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
          <label className="flex flex-col gap-1 md:col-span-1">
            <span className="text-xs font-medium text-slate-600">주소</span>
            <input className={inp} value={form.address} onChange={(e) => set("address", e.target.value)}
                   placeholder="예: 부산 사하구 다대로" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">위도</span>
            <input className={inp} value={form.latitude} onChange={(e) => set("latitude", e.target.value)}
                   placeholder="예: 35.0966" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">경도</span>
            <input className={inp} value={form.longitude} onChange={(e) => set("longitude", e.target.value)}
                   placeholder="예: 128.9663" />
          </label>
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
