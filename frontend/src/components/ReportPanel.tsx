import { useEffect, useState } from "react";
import { api } from "../api";
import {
  Paper,
  Title,
  Group,
  Button,
  Alert,
  Modal,
  Stack,
  Loader,
  Text,
  List,
} from "@mantine/core";
import { IconFileText, IconDownload } from "@tabler/icons-react";

const KIND_LABEL: Record<string, string> = {
  daily: "일일 안전 보고서(PDF)",
  periodic: "기간 통계 보고서(PDF)",
  excel: "Excel 데이터 파일",
};
import type { DailyReport } from "../types";
import { HeatBadge } from "./HeatBadge";

export function ReportPanel({
  deviceSn, date, rangeStart, rangeEnd,
}: { deviceSn: string | null; date: string; rangeStart: string; rangeEnd: string }) {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deviceSn) { setReport(null); return; }
    setLoading(true);
    api.dailyReport(deviceSn, date).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false));
  }, [deviceSn, date]);

  const [downloading, setDownloading] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);

  async function download(kind: string, url: string, filename: string) {
    setDownloading(kind); setDlError(null);
    try {
      await api.download(url, filename);
    } catch (e: any) {
      let msg = String(e.message || e);
      try { msg = JSON.parse(msg).detail ?? msg; } catch {}
      if (msg.includes("504") || msg.toLowerCase().includes("timeout")) {
        msg = "기간이 너무 길어 생성 시간이 초과되었습니다. 리포트 기간을 줄여 다시 시도해 주세요.";
      }
      setDlError(`다운로드 실패: ${msg}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs" pos="relative">
      {/* 생성 중 로딩 오버레이 */}
      <Modal
        opened={downloading !== null}
        onClose={() => {}}
        withCloseButton={false}
        centered
        radius="lg"
        overlayProps={{ blur: 2 }}
      >
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text fw={700} ta="center">
            {KIND_LABEL[downloading ?? ""] ?? "파일"} 생성 중
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            데이터 양에 따라 최대 1분 정도 소요될 수 있습니다. 잠시만 기다려 주세요.
          </Text>
        </Stack>
      </Modal>

      <Title order={3} fz="md" c="#0f172a" mb="md">안전관리 리포트</Title>

      {/* 다운로드 버튼 */}
      <Group gap="xs" mb="xs">
        <Button
          leftSection={<IconFileText size={16} />}
          loading={downloading === "daily"}
          disabled={!deviceSn || downloading !== null}
          onClick={() => deviceSn && download("daily", api.dailyPdfUrl(deviceSn, date), `daily_${deviceSn}_${date}.pdf`)}
        >일일 안전 보고서 (PDF)</Button>
        <Button
          variant="default"
          leftSection={<IconFileText size={16} />}
          loading={downloading === "periodic"}
          disabled={downloading !== null}
          onClick={() => download("periodic", api.periodicPdfUrl(deviceSn, rangeStart, rangeEnd), `periodic_${rangeStart}_${rangeEnd}.pdf`)}
        >기간 통계 보고서 (PDF)</Button>
        <Button
          color="teal"
          variant="light"
          leftSection={<IconDownload size={16} />}
          loading={downloading === "excel"}
          disabled={downloading !== null}
          onClick={() => download("excel", api.excelUrl(deviceSn, rangeStart, rangeEnd), `export_${rangeStart}_${rangeEnd}.xlsx`)}
        >데이터 내보내기 (Excel)</Button>
      </Group>
      {dlError && (
        <Alert color="red" variant="light" mb="md">{dlError}</Alert>
      )}

      {/* 일일 보고서 미리보기 */}
      {loading ? (
        <Text size="sm" c="gray.5">불러오는 중...</Text>
      ) : !deviceSn ? (
        <Text size="sm" c="gray.5">기기를 선택하면 일일 보고서 미리보기가 표시됩니다.</Text>
      ) : report ? (
        <Paper withBorder radius="md" p="md">
          <Group justify="space-between" mb="xs">
            <Text size="sm" c="dimmed">
              {report.company_name} · {report.location_name} · {report.date}
            </Text>
            <Group gap="xs">
              <Text size="sm">최고단계</Text>
              <HeatBadge level={report.peak_level} size="sm" />
            </Group>
          </Group>
          <Group grow align="stretch" gap="xs" wrap="wrap">
            <Stat label="최고 체감온도" value={`${report.max_feels_like ?? "-"}℃`} sub={report.max_feels_like_time ?? ""} />
            <Stat label="최고 온도" value={`${report.max_temperature ?? "-"}℃`} />
            <Stat label="33℃↑ 누적" value={`${report.minutes_over_33}분`} sub={`35℃ ${report.minutes_over_35}/38℃ ${report.minutes_over_38}`} />
          </Group>
          <Stack gap={4} mt="md">
            <Text size="xs" fw={600} c="dimmed">안전조치 이행 가이드</Text>
            <List size="sm" c="#334155">
              {report.guidance.map((g, i) => <List.Item key={i}>{g}</List.Item>)}
            </List>
          </Stack>
        </Paper>
      ) : (
        <Text size="sm" c="gray.5">해당 일자 데이터가 없습니다.</Text>
      )}
    </Paper>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Paper bg="gray.0" p="xs" radius="md">
      <Text size="xs" c="dimmed">{label}</Text>
      <Text size="lg" fw={700} c="#1e293b">{value}</Text>
      {sub && <Text size="xs" c="gray.5">{sub}</Text>}
    </Paper>
  );
}
