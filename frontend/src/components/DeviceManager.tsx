import { useState } from "react";
import { Paper, Title, Table, TextInput, Button, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { api } from "../api";
import type { Device } from "../types";

export function DeviceManager({ devices, onChange }: { devices: Device[]; onChange: () => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Device>>({});
  const [saving, setSaving] = useState(false);

  function startEdit(d: Device) {
    setEditing(d.device_sn);
    setDraft({ ...d });
  }

  async function save(sn: string) {
    setSaving(true);
    try {
      await api.updateDevice(sn, {
        company_name: draft.company_name ?? null,
        location_name: draft.location_name ?? null,
        address: draft.address ?? null,
        latitude: draft.latitude === undefined || (draft.latitude as any) === "" ? null : Number(draft.latitude),
        longitude: draft.longitude === undefined || (draft.longitude as any) === "" ? null : Number(draft.longitude),
        region_code: draft.region_code ?? null,
      });
      setEditing(null);
      onChange();
    } finally {
      setSaving(false);
    }
  }

  function remove(sn: string) {
    modals.openConfirmModal({
      title: "기기 삭제",
      children: <Text size="sm">기기 {sn} 와(과) 해당 측정 데이터를 모두 삭제할까요?</Text>,
      labels: { confirm: "삭제", cancel: "취소" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        await api.deleteDevice(sn);
        onChange();
      },
    });
  }

  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs">
      <Title order={3} fz="md" c="#0f172a" mb="sm">기기 / 사업장 메타데이터 관리</Title>
      <Table.ScrollContainer minWidth={760}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>기기명</Table.Th>
              <Table.Th>회사명</Table.Th>
              <Table.Th>설치 위치</Table.Th>
              <Table.Th>주소</Table.Th>
              <Table.Th>위도</Table.Th>
              <Table.Th>경도</Table.Th>
              <Table.Th>지역코드</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {devices.map((d) => {
              const ed = editing === d.device_sn;
              return (
                <Table.Tr key={d.device_sn}>
                  <Table.Td fw={600} c="#0f172a">{d.device_sn}</Table.Td>
                  {ed ? (
                    <>
                      <Table.Td><TextInput size="xs" value={draft.company_name ?? ""} onChange={(e) => setDraft({ ...draft, company_name: e.target.value })} /></Table.Td>
                      <Table.Td><TextInput size="xs" value={draft.location_name ?? ""} onChange={(e) => setDraft({ ...draft, location_name: e.target.value })} /></Table.Td>
                      <Table.Td><TextInput size="xs" value={draft.address ?? ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} /></Table.Td>
                      <Table.Td><TextInput size="xs" value={draft.latitude ?? ""} onChange={(e) => setDraft({ ...draft, latitude: e.target.value as any })} /></Table.Td>
                      <Table.Td><TextInput size="xs" value={draft.longitude ?? ""} onChange={(e) => setDraft({ ...draft, longitude: e.target.value as any })} /></Table.Td>
                      <Table.Td><TextInput size="xs" value={draft.region_code ?? ""} onChange={(e) => setDraft({ ...draft, region_code: e.target.value })} /></Table.Td>
                      <Table.Td style={{ whiteSpace: "nowrap" }}>
                        <Button size="xs" disabled={saving} onClick={() => save(d.device_sn)}>저장</Button>
                        <Button size="xs" variant="default" ml="xs" onClick={() => setEditing(null)}>취소</Button>
                      </Table.Td>
                    </>
                  ) : (
                    <>
                      <Table.Td>{d.company_name || <Text span c="dimmed">-</Text>}</Table.Td>
                      <Table.Td>{d.location_name || <Text span c="dimmed">-</Text>}</Table.Td>
                      <Table.Td c="dimmed">{d.address || "-"}</Table.Td>
                      <Table.Td c="dimmed">{d.latitude ?? "-"}</Table.Td>
                      <Table.Td c="dimmed">{d.longitude ?? "-"}</Table.Td>
                      <Table.Td c="dimmed">{d.region_code || "-"}</Table.Td>
                      <Table.Td style={{ whiteSpace: "nowrap" }}>
                        <Button size="xs" variant="default" onClick={() => startEdit(d)}>편집</Button>
                        <Button size="xs" color="red" variant="subtle" ml="xs" onClick={() => remove(d.device_sn)}>삭제</Button>
                      </Table.Td>
                    </>
                  )}
                </Table.Tr>
              );
            })}
            {devices.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8} ta="center" c="dimmed" py="md">
                  등록된 기기가 없습니다. 위 양식에서 기기명을 입력해 등록하세요.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}
