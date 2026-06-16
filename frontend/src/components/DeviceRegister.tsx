import { useState } from "react";
import { Paper, Title, Text, SimpleGrid, TextInput, Button, Alert, Group, Stack } from "@mantine/core";
import { IconSearch, IconMapPin } from "@tabler/icons-react";
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
      // 행정동 코드까지 폼에 담아 등록 시 1회 저장 — 이후 날씨 조회 때 재요청 불필요
      setForm((f) => ({ ...f, address: addr, latitude: r.lat, longitude: r.lon, region_code: r.region_code ?? "" }));
      setGeoMsg(
        `매칭됨(${r.provider === "kakao" ? "카카오" : "OSM·근사"}): ${r.matched} → 위도 ${r.lat}, 경도 ${r.lon}` +
        (r.region_code ? " · 행정구역 확정" : "") +
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
    if (!form.device_sn.trim()) { setError("기기명을 입력하세요."); return; }
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
      setError(msg.includes("409") || msg.includes("이미") ? "이미 등록된 기기명입니다. 다른 이름을 사용해 주세요." : msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="md">
      <Paper radius="lg" p="lg" withBorder shadow="xs">
        <Title order={3} fz="md" c="#0f172a">사업장 · 기기 등록</Title>
        <Text size="xs" c="dimmed" mt={4}>
          데이터를 올리기 전에 먼저 기기를 등록하세요. 기기명은 <b>관리자가 알아보기 쉬운 이름으로 자유롭게</b> 입력하면 되며,
          <b>여러 대를 각각 추가 등록</b>할 수 있습니다. (위경도를 입력하면 기상청 외부 날씨 비교가 활성화됩니다.)
        </Text>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm" mt="md">
          <TextInput
            label="기기명"
            withAsterisk
            value={form.device_sn}
            onChange={(e) => set("device_sn", e.target.value)}
            placeholder="예: 1공장 정련로, 본관 사무실 등 (자유 입력)"
          />
          <TextInput
            label="회사명"
            value={form.company_name}
            onChange={(e) => set("company_name", e.target.value)}
          />
          <TextInput
            label="설치 위치 (장소)"
            value={form.location_name}
            onChange={(e) => set("location_name", e.target.value)}
            placeholder="예: 제2공장 정련로 앞"
          />
        </SimpleGrid>

        <div style={{ marginTop: "var(--mantine-spacing-sm)" }}>
          <Group gap="sm" align="flex-end" wrap="nowrap">
            <TextInput
              label="주소"
              readOnly
              onClick={openPostcode}
              value={form.address}
              placeholder="주소 검색을 눌러 도로명·지번 주소를 선택하세요"
              style={{ flex: 1 }}
            />
            <Button onClick={openPostcode} leftSection={<IconSearch size={16} />}>주소 검색</Button>
            <Button
              variant="default"
              onClick={() => geocodeAddress(form.address)}
              disabled={geoBusy || !form.address}
              leftSection={<IconMapPin size={16} />}
              title="현재 주소로 좌표 다시 찾기"
            >
              {geoBusy ? "…" : "좌표 변환"}
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mt={4}>
            — '주소 검색'으로 도로명/지번을 선택하면 주소·위경도가 자동 입력됩니다
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm" mt="sm">
          <TextInput
            label="위도"
            value={form.latitude}
            onChange={(e) => set("latitude", e.target.value)}
            placeholder="자동/직접 입력"
          />
          <TextInput
            label="경도"
            value={form.longitude}
            onChange={(e) => set("longitude", e.target.value)}
            placeholder="자동/직접 입력"
          />
        </SimpleGrid>

        {geoMsg && <Alert color="teal" variant="light" mt="sm">{geoMsg}</Alert>}
        {error && <Alert color="red" variant="light" mt="sm">{error}</Alert>}
        {okMsg && <Alert color="teal" variant="light" mt="sm">{okMsg}</Alert>}

        <Button loading={busy} onClick={register} mt="md">기기 등록</Button>
      </Paper>

      <DeviceManager devices={devices} onChange={onChange} />
    </Stack>
  );
}
