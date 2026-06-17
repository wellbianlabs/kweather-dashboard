// 공통 측정 데이터 업로더(모달) — Mantine 규격 디자인. nav 측정기별 [+] · 대시보드 위젯 공용.
// Dropzone(공식 예제 패턴) + Progress + 결과 요약(Paper/ThemeIcon/통계 그리드). 기기 사전선택 지원.
import { useEffect, useMemo, useState } from "react";
import {
  Alert, Button, Group, Modal, Paper, Progress, Select, SimpleGrid, Stack, Text, ThemeIcon,
} from "@mantine/core";
import { Dropzone, type FileWithPath } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import { IconCheck, IconCloudUpload, IconUpload, IconX } from "@tabler/icons-react";
import { api } from "../api";
import type { Device, UploadResult } from "../types";

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <Paper radius="md" p="sm" bg="var(--mantine-color-gray-0)" ta="center">
      <Text fw={800} fz="xl" lh={1.1} c={color}>{value.toLocaleString()}</Text>
      <Text fz="xs" c="dimmed" mt={4}>{label}</Text>
    </Paper>
  );
}

export function UploadModal({
  opened, onClose, devices = [], targetSn, onUploaded,
}: {
  opened: boolean;
  onClose: () => void;
  devices?: Device[];
  targetSn?: string | null;
  onUploaded: (results: UploadResult[]) => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  const [sn, setSn] = useState<string>("");

  useEffect(() => {
    if (!opened) return;
    setSn(targetSn || devices[0]?.device_sn || "");
    setResults(null);
    setProgress(null);
  }, [opened, targetSn, devices]);

  async function handleDrop(files: FileWithPath[]) {
    if (!files.length) return;
    setBusy(true);
    setResults(null);
    setProgress({ done: 0, total: files.length });
    try {
      const res = await api.upload(files, (done, total) => setProgress({ done, total }), sn || null);
      setResults(res);
      await onUploaded(res);
    } catch (e: any) {
      notifications.show({ color: "red", title: "업로드 실패", message: String(e?.message || e) });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function handleReject(files: { file: File }[]) {
    const names = files.map((f) => f.file.name).slice(0, 5).join(", ");
    notifications.show({
      color: "orange", title: "업로드할 수 없는 파일",
      message: `케이웨더 단말기 TXT 파일만 업로드할 수 있습니다${names ? `: ${names}` : ""}`,
    });
  }

  const summary = useMemo(() => {
    if (!results) return null;
    const inserted = results.reduce((s, r) => s + r.rows_inserted, 0);
    const updated = results.reduce((s, r) => s + r.rows_updated, 0);
    const skipped = results.reduce((s, r) => s + r.rows_skipped, 0);
    const devs = Array.from(new Set(results.flatMap((r) => r.affected_devices)));
    const failed = results.filter((r) => r.errors.length > 0);
    const dates = results.flatMap((r) => [r.min_date, r.max_date]).filter(Boolean) as string[];
    return {
      files: results.length, inserted, updated, skipped, devices: devs, failed,
      min: dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null,
      max: dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null,
    };
  }, [results]);

  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Modal
      opened={opened} onClose={onClose} centered size="lg" radius="lg" padding="lg"
      closeOnClickOutside={!busy} closeOnEscape={!busy} withCloseButton={!busy}
      overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
      title={
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" color="kw" size={38} radius="md"><IconCloudUpload size={20} /></ThemeIcon>
          <div>
            <Text fw={700} lh={1.2}>측정 데이터 업로드</Text>
            <Text fz="xs" c="dimmed">케이웨더 단말기 TXT 파일</Text>
          </div>
        </Group>
      }
    >
      <Stack gap="md">
        {devices.length > 0 && (
          <Select
            label="데이터를 연결할 기기" description="선택한 기기로 측정 데이터가 기록됩니다."
            size="sm" disabled={busy} allowDeselect={false} value={sn} onChange={(v) => v && setSn(v)}
            data={devices.map((d) => ({
              value: d.device_sn,
              label: d.company_name ? `${d.company_name} / ${d.location_name ?? ""} (${d.device_sn})` : d.device_sn,
            }))}
          />
        )}

        <Dropzone
          onDrop={handleDrop} onReject={handleReject} accept={{ "text/plain": [".txt"] }}
          loading={busy} multiple radius="md"
          styles={{ root: { borderWidth: 2, borderStyle: "dashed", background: "var(--mantine-color-gray-0)" } }}
        >
          <Group justify="center" gap="xl" mih={170} style={{ pointerEvents: "none" }} wrap="nowrap">
            <Dropzone.Accept><IconUpload size={52} stroke={1.3} color="var(--mantine-color-kw-6)" /></Dropzone.Accept>
            <Dropzone.Reject><IconX size={52} stroke={1.3} color="var(--mantine-color-red-6)" /></Dropzone.Reject>
            <Dropzone.Idle><IconCloudUpload size={52} stroke={1.3} color="var(--mantine-color-gray-5)" /></Dropzone.Idle>
            <div>
              <Text size="lg" fw={600} inline>{busy ? "업로드 처리 중…" : "파일을 끌어다 놓거나 클릭하여 선택"}</Text>
              <Text size="sm" c="dimmed" inline mt={7}>다중 파일·대량 업로드 지원 · 케이웨더 단말기 TXT 전용</Text>
            </div>
          </Group>
        </Dropzone>

        {progress && (
          <Stack gap={6}>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">{progress.done.toLocaleString()} / {progress.total.toLocaleString()} 파일 처리</Text>
              <Text size="sm" fw={600}>{pct}%</Text>
            </Group>
            <Progress value={pct} size="lg" radius="xl" animated />
          </Stack>
        )}

        {summary && (
          <Paper withBorder radius="md" p="md">
            <Group gap="sm" wrap="nowrap" mb="sm">
              <ThemeIcon color={summary.failed.length ? "orange" : "teal"} variant="light" size={40} radius="xl">
                <IconCheck size={20} />
              </ThemeIcon>
              <div>
                <Text fw={700} lh={1.2}>업로드 완료</Text>
                <Text fz="xs" c="dimmed">파일 {summary.files.toLocaleString()}개 처리{summary.min ? ` · ${summary.min} ~ ${summary.max}` : ""}</Text>
              </div>
            </Group>
            <SimpleGrid cols={3} spacing="xs">
              <Stat label="신규" value={summary.inserted} color="var(--mantine-color-kw-6)" />
              <Stat label="갱신" value={summary.updated} />
              <Stat label="제외" value={summary.skipped} />
            </SimpleGrid>
            {summary.devices.length > 0 && <Text fz="xs" c="dimmed" mt="sm">기기: {summary.devices.join(", ")}</Text>}
            {summary.failed.length > 0 && (
              <Alert color="red" variant="light" mt="sm" p="sm" title={`실패 ${summary.failed.length}건`}>
                <Stack gap={2}>
                  {summary.failed.slice(0, 8).map((r, i) => (<Text key={i} size="xs">· {r.filename}: {r.errors[0]}</Text>))}
                  {summary.failed.length > 8 && <Text size="xs">… 외 {summary.failed.length - 8}건</Text>}
                </Stack>
              </Alert>
            )}
          </Paper>
        )}

        <Group justify="flex-end" gap="xs">
          {summary
            ? <Button onClick={onClose}>확인</Button>
            : <Button variant="default" onClick={onClose} disabled={busy}>닫기</Button>}
        </Group>
      </Stack>
    </Modal>
  );
}
