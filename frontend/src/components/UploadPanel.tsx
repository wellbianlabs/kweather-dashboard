import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { Device, UploadResult } from "../types";
import {
  Alert,
  Box,
  Button,
  Group,
  Paper,
  Progress,
  Select,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { Dropzone, type FileWithPath } from "@mantine/dropzone";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { IconUpload, IconX, IconTrash } from "@tabler/icons-react";

export function UploadPanel({
  devices = [],
  onUploaded,
  onReset,
}: {
  devices?: Device[];
  onUploaded: (results: UploadResult[]) => void;
  onReset?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<UploadResult[] | null>(null);
  // TXT 파일(파일 내 SN 없음)을 연결할 기기 — 기본값은 첫 번째 등록 기기
  const [targetSn, setTargetSn] = useState<string>(devices[0]?.device_sn ?? "");

  // 기기 목록이 늦게 로드되거나 선택 기기가 삭제된 경우 기본값 재설정
  useEffect(() => {
    if (devices.length && !devices.some((d) => d.device_sn === targetSn)) {
      setTargetSn(devices[0].device_sn);
    }
  }, [devices, targetSn]);

  async function handleDrop(files: FileWithPath[]) {
    if (!files.length) return;
    setBusy(true);
    setResults(null);
    setProgress({ done: 0, total: files.length });
    try {
      const res = await api.upload(files, (done, total) => setProgress({ done, total }), targetSn || null);
      setResults(res);
      onUploaded(res);
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
      color: "orange",
      title: "업로드할 수 없는 파일",
      message: `케이웨더 단말기 TXT 파일만 업로드할 수 있습니다${names ? `: ${names}` : ""}`,
    });
  }

  async function handleReset(scopeSn: string | null) {
    setBusy(true);
    try {
      const r = await api.resetData(scopeSn);
      setResults(null);
      notifications.show({
        color: "teal",
        title: "데이터 초기화 완료",
        message: scopeSn
          ? `기기 ${scopeSn}의 측정 데이터 ${r.deleted_logs.toLocaleString()}건을 삭제했습니다.`
          : `전체 측정 데이터 ${r.deleted_logs.toLocaleString()}건을 삭제했습니다. (기기 등록 정보는 유지)`,
      });
      onReset?.();
    } catch (e: any) {
      notifications.show({ color: "red", title: "초기화 실패", message: String(e?.message || e) });
    } finally {
      setBusy(false);
    }
  }

  function openResetModal() {
    const id = modals.open({
      title: "측정 데이터 삭제",
      children: (
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            업로드된 측정 데이터를 삭제합니다. 삭제 후에는 되돌릴 수 없으며, 기기 등록 정보와 계정은
            유지됩니다. 파일을 다시 업로드하면 복원됩니다.
          </Text>
          <Group justify="flex-end" gap="xs">
            {targetSn && devices.length > 1 && (
              <Button
                color="red"
                variant="light"
                onClick={() => {
                  modals.close(id);
                  handleReset(targetSn);
                }}
              >
                선택 기기({targetSn})만 삭제
              </Button>
            )}
            <Button
              color="red"
              onClick={() => {
                modals.close(id);
                handleReset(null);
              }}
            >
              전체 데이터 삭제
            </Button>
            <Button variant="default" onClick={() => modals.close(id)}>
              취소
            </Button>
          </Group>
        </Stack>
      ),
    });
  }

  // 대량 업로드 요약
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
    <Paper radius="lg" p="lg" withBorder shadow="xs">
      <Group justify="space-between" mb="sm">
        <Title order={3} fz="md" c="#0f172a">측정 데이터 업로드</Title>
        <Button
          size="xs"
          variant="light"
          color="red"
          leftSection={<IconTrash size={14} />}
          disabled={busy}
          onClick={openResetModal}
        >
          데이터 초기화
        </Button>
      </Group>

      {devices.length > 0 && (
        <Select
          label="데이터를 연결할 기기"
          description="선택한 기기로 측정 데이터가 기록됩니다."
          size="sm"
          mb="sm"
          maw={420}
          disabled={busy}
          allowDeselect={false}
          value={targetSn}
          onChange={(v) => v && setTargetSn(v)}
          data={devices.map((d) => ({
            value: d.device_sn,
            label: d.company_name
              ? `${d.company_name} / ${d.location_name ?? ""} (${d.device_sn})`
              : d.device_sn,
          }))}
        />
      )}

      <Dropzone
        onDrop={handleDrop}
        onReject={handleReject}
        accept={{ "text/plain": [".txt"] }}
        loading={busy}
        multiple
        radius="lg"
        styles={{ root: { borderStyle: "dashed", borderWidth: 2 } }}
      >
        <Stack align="center" justify="center" gap={6} mih={140} style={{ pointerEvents: "none" }}>
          <Dropzone.Accept>
            <ThemeIcon size={48} radius="lg" variant="light"><IconUpload size={22} /></ThemeIcon>
          </Dropzone.Accept>
          <Dropzone.Reject>
            <ThemeIcon size={48} radius="lg" variant="light" color="red"><IconX size={22} /></ThemeIcon>
          </Dropzone.Reject>
          <Dropzone.Idle>
            <ThemeIcon size={48} radius="lg" variant="light"><IconUpload size={22} /></ThemeIcon>
          </Dropzone.Idle>
          <Text size="sm" c="dimmed" mt={4}>
            {busy ? "업로드 중..." : "파일을 끌어다 놓거나 클릭하여 선택하세요"}
          </Text>
          <Text size="xs" c="dimmed">다중 파일·대량 업로드 지원 · 케이웨더 단말기 TXT 전용</Text>
        </Stack>
      </Dropzone>

      {progress && (
        <Box mt="sm">
          <Group justify="space-between" mb={4}>
            <Text size="xs" c="dimmed">
              {progress.done.toLocaleString()} / {progress.total.toLocaleString()} 파일 처리
            </Text>
            <Text size="xs" c="dimmed">{pct}%</Text>
          </Group>
          <Progress value={pct} animated />
        </Box>
      )}

      {summary && (
        <Paper mt="sm" p="md" radius="md" bg="gray.0">
          <Text fw={600} c="#0f172a">업로드 완료 — 파일 {summary.files.toLocaleString()}개</Text>
          <Text size="sm" c="dimmed" mt={2}>
            신규 {summary.inserted.toLocaleString()} · 갱신 {summary.updated.toLocaleString()} · 제외{" "}
            {summary.skipped.toLocaleString()}건
            {summary.min && <> · 기간 {summary.min}~{summary.max}</>}
          </Text>
          {summary.devices.length > 0 && (
            <Text size="xs" c="dimmed" mt={2}>기기: {summary.devices.join(", ")}</Text>
          )}
          {summary.failed.length > 0 && (
            <Alert color="red" variant="light" mt="sm" p="sm" title={`실패 ${summary.failed.length}건`}>
              <Stack gap={2}>
                {summary.failed.slice(0, 8).map((r, i) => (
                  <Text key={i} size="xs">· {r.filename}: {r.errors[0]}</Text>
                ))}
                {summary.failed.length > 8 && <Text size="xs">… 외 {summary.failed.length - 8}건</Text>}
              </Stack>
            </Alert>
          )}
        </Paper>
      )}
    </Paper>
  );
}
