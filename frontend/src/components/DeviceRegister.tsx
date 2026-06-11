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

  async function geocodeAddress(addr: string) {
    setGeoMsg(null); setError(null);
    addr = (addr || "").trim();
    if (!addr) { setError("주소를 먼저 입력하세요."); return; }
    setGeoBusy(true);
    try {
      const r = await api.geocode(addr);
      setForm((f) => ({ ...f, address: addr, latitude: r.lat, longitude: r.lon }));
      setGeoMsg(
        `매칭됨(${r.provider === "kakao" ? "카카오" : "OSM·근사"}): ${r.matched} → 위도 ${r.lat}, 경도 ${r.lon}` +
        (r.provider === "nominatim" ? " · 정확도가 낮을 수 있어 확인 후 사용하세요." : "")
      );
    } catch (e: any) {
      const m = String(e.message || e);
      setError(m.includes("404") || m.includes("찾지") ? "주소를 찾지 못했습니다. 주소 검색으로 선택해 주세요." : m);
    } finally {
      setGeoBusy(false);
    }
  }

  // 다음(카카오) 우편번호 주소검색 팝업 — 도로명/지번 자동완성. 선택 시 주소+위경도 자동 입력.
  function openPostcode() {
    setError(null);
    const onComplete = (data: any) => {
      const road = data.roadAddress || data.jibunAddress || data.address;
      const full = data.buildingName ? `${road} (${data.buildingName})` : road;
      geocodeAddress(road);          // 공식 주소 → 위경도 (정확)
      setForm((f) => ({ ...f, address: full }));
    };
    const open = () => new (window as any).daum.Postcode({ oncomplete: onComplete }).open();
    if ((window as any).daum?.Postcode) { open(); return; }
    const script = document.createElement("script");
    script.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.onload = open;
    script.onerror = () => setError("주소검색 모듈을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    document.body.appendChild(script);
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

  const inp = "input";

  return (
    <div className="space-y-4">
      <div className="card">
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
              주소 <span className="text-slate-400">— '주소 검색'으로 도로명/지번을 선택하면 주소·위경도가 자동 입력됩니다</span>
            </span>
            <div className="flex gap-2">
              <input className={`${inp} flex-1`} value={form.address} readOnly onClick={openPostcode}
                     placeholder="주소 검색을 눌러 도로명·지번 주소를 선택하세요" />
              <button type="button" onClick={openPostcode}
                      className="btn-primary shrink-0">
                🔍 주소 검색
              </button>
              <button type="button" onClick={() => geocodeAddress(form.address)} disabled={geoBusy || !form.address}
                      className="btn-ghost shrink-0"
                      title="현재 주소로 좌표 다시 찾기">
                {geoBusy ? "..." : "📍 좌표"}
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
                className="btn-primary mt-4">
          {busy ? "등록 중..." : "+ 기기 등록"}
        </button>
      </div>

      <DeviceManager devices={devices} onChange={onChange} />
    </div>
  );
}
