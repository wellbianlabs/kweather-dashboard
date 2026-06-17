// 리포트 페이지 — ContextBar 흐름: 측정기 → 분석 일자 → 보고서 유형 → [보고서 생성] submit.
//  · 일일: 생성 시 화면에 웹 보고서 표출(+PDF 보기/다운로드)
//  · 기간: 생성 시 PDF 미리보기(+다운로드/Excel)
//  다운로드/미리보기는 기존 api 헬퍼(fetchBlob/download/saveBlob, *PdfUrl/excelUrl, dailyReport) 재사용.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Center, Group, Loader, Modal, Paper, Progress,
  SegmentedControl, Select, Stack, Text,
} from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import {
  IconCalendar, IconDeviceDesktopAnalytics, IconDownload, IconFileSpreadsheet, IconFileText,
} from "@tabler/icons-react";
import { api } from "../../api";
import type { DailyReport } from "../../types";
import { useDashboard } from "../DashboardProvider";
import { WebReport } from "../../components/ReportPanel";

type ReportType = "daily" | "periodic";
const KIND_LABEL: Record<string, string> = {
  daily: "일일 안전 보고서(PDF)", periodic: "기간 통계 보고서(PDF)", report: "일일 안전 보고서", excel: "Excel 데이터 파일",
};
type Preview = { kind: string; url: string; blob: Blob; filename: string } | null;

function friendlyError(e: unknown): string {
  let msg = String((e as { message?: string })?.message ?? e);
  try { msg = JSON.parse(msg).detail ?? msg; } catch { /* not JSON */ }
  if (msg.includes("504") || msg.toLowerCase().includes("timeout")) {
    return "기간이 너무 길어 생성 시간이 초과되었습니다. 리포트 기간을 줄여 다시 시도해 주세요.";
  }
  return msg;
}

export function ReportPage() {
  const { devices, deviceSn: ctxDeviceSn, availableDates, date, rangeStart, rangeEnd } = useDashboard();

  const [deviceSn, setDeviceSn] = useState<string | null>(ctxDeviceSn);
  useEffect(() => { setDeviceSn((cur) => cur ?? ctxDeviceSn); }, [ctxDeviceSn]);

  const [type, setType] = useState<ReportType>("daily");
  const [onDate, setOnDate] = useState(date);
  const [start, setStart] = useState(rangeStart);
  const [end, setEnd] = useState(rangeEnd);
  useEffect(() => { setOnDate(date); }, [date]);
  useEffect(() => { setStart(rangeStart); }, [rangeStart]);
  useEffect(() => { setEnd(rangeEnd); }, [rangeEnd]);

  const [busy, setBusy] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview>(null);
  const [report, setReport] = useState<DailyReport | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const deviceData = useMemo(
    () => [
      { value: "", label: "(전체 사업장)" },
      ...devices.map((d) => ({
        value: d.device_sn,
        label: `${d.device_sn}${d.location_name ? ` · ${d.location_name}` : (d.company_name ? ` · ${d.company_name}` : "")}`,
      })),
    ],
    [devices],
  );

  // 입력 변경 시 이전 결과/미리보기 초기화(재생성 유도)
  useEffect(() => {
    setReport(null);
    setPreview((p) => { if (p?.url) URL.revokeObjectURL(p.url); return null; });
    setDlError(null);
  }, [type, deviceSn, onDate, start, end]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview]);

  const dailyReady = !!deviceSn && !!onDate;
  const periodReady = !!start && !!end && start <= end;
  const submitReady = type === "daily" ? dailyReady : periodReady;

  async function showPreview(kind: string, url: string, filename: string) {
    setBusy(kind); setDlError(null);
    try {
      const blob = await api.fetchBlob(url);
      setPreview((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { kind, url: URL.createObjectURL(blob), blob, filename };
      });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setDlError(`PDF 생성 실패: ${friendlyError(e)}`);
    } finally { setBusy(null); }
  }

  async function downloadOnly(kind: string, url: string, filename: string) {
    setBusy(kind); setDlError(null);
    try { await api.download(url, filename); }
    catch (e) { setDlError(`다운로드 실패: ${friendlyError(e)}`); }
    finally { setBusy(null); }
  }

  // submit — 보고서 생성
  async function onSubmit() {
    setDlError(null);
    if (type === "daily") {
      if (!dailyReady) return;
      setBusy("report"); setReport(null);
      try {
        const r = await api.dailyReport(deviceSn!, onDate);
        setReport(r);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      } catch (e) { setDlError(`보고서 조회 실패: ${friendlyError(e)}`); }
      finally { setBusy(null); }
    } else {
      if (!periodReady) return;
      showPreview("periodic", api.periodicPdfUrl(deviceSn, start, end), `periodic_${deviceSn ?? "all"}_${start}_${end}.pdf`);
    }
  }

  const onDailyPdfPreview = () =>
    dailyReady && showPreview("daily", api.dailyPdfUrl(deviceSn!, onDate), `daily_${deviceSn}_${onDate}.pdf`);
  const onDailyDownload = () =>
    dailyReady && downloadOnly("daily", api.dailyPdfUrl(deviceSn!, onDate), `daily_${deviceSn}_${onDate}.pdf`);
  // 엑셀은 '일일 측정데이터' — 분석 일자(onDate) 하루치. 측정기 선택 필수.
  const onExcel = () =>
    dailyReady && downloadOnly("excel", api.excelUrl(deviceSn, onDate, onDate), `data_${deviceSn}_${onDate}.xlsx`);

  const DateField = ({ label, value, onChange }:
    { label: string; value: string; onChange: (v: string) => void }) =>
    availableDates.length > 0 ? (
      <Select label={label} size="sm" w={160} allowDeselect={false} leftSection={<IconCalendar size={16} />}
        value={value} onChange={(v) => v && onChange(v)} data={availableDates} />
    ) : (
      <DatePickerInput label={label} size="sm" w={160} valueFormat="YYYY-MM-DD" leftSection={<IconCalendar size={16} />}
        value={value} onChange={(v) => v && onChange(v)} />
    );

  function closePreview() {
    setPreview((prev) => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
  }

  return (
    <Stack gap="md">
      {/* 생성 중 로딩 오버레이 */}
      <Modal opened={busy !== null} onClose={() => {}} withCloseButton={false}
        closeOnClickOutside={false} closeOnEscape={false} centered radius="lg"
        overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}>
        <Stack align="center" gap="md" py="sm">
          <Loader color="kw" size="lg" />
          <Box ta="center">
            <Text fw={700} fz="md">{(busy && KIND_LABEL[busy]) ?? "보고서"} 생성 중</Text>
            <Text size="sm" c="dimmed" mt={6}>데이터 양에 따라 최대 1분 정도 소요될 수 있습니다.<br />잠시만 기다려 주세요.</Text>
          </Box>
          <Progress value={100} striped animated w={180} size="sm" radius="xl" color="kw" />
        </Stack>
      </Modal>

      {/* ContextBar — 측정기 → 분석 일자 → 보고서 유형 → 생성 */}
      <Paper radius="lg" p="md" withBorder shadow="xs">
        <Group align="flex-end" gap="md" wrap="wrap">
          <Select label="측정기" size="sm" w={240} allowDeselect={false}
            leftSection={<IconDeviceDesktopAnalytics size={16} />}
            value={deviceSn ?? ""} onChange={(v) => setDeviceSn(v || null)} data={deviceData} />

          {/* 분석 일자: 일일 보고서 & 일일 Excel 공용 기준(항상 표시) */}
          <DateField label="분석 일자" value={onDate} onChange={setOnDate} />
          {type === "periodic" && (
            <>
              <DateField label="시작 일자" value={start} onChange={setStart} />
              <DateField label="종료 일자" value={end} onChange={setEnd} />
            </>
          )}

          <Box>
            <Text component="label" size="sm" fw={500} display="block" mb={5}>보고서 유형</Text>
            <SegmentedControl color="kw" value={type} onChange={(v) => setType(v as ReportType)}
              data={[{ label: "일일 보고서", value: "daily" }, { label: "기간 통계 보고서", value: "periodic" }]} />
          </Box>

          {/* 메뉴 항상 노출: 보고서 생성 + 일일 Excel */}
          <Button color="kw" leftSection={<IconFileText size={16} />}
            loading={busy === "report" || busy === "periodic"} disabled={!submitReady || busy !== null}
            onClick={onSubmit}>보고서 생성</Button>
          <Button variant="light" color="teal" leftSection={<IconFileSpreadsheet size={16} />}
            loading={busy === "excel"} disabled={!dailyReady || busy !== null} onClick={onExcel}>일일 Excel</Button>
        </Group>
        {type === "periodic" && start > end && (
          <Text size="xs" c="red.7" mt="xs">종료 일자는 시작 일자 이후여야 합니다.</Text>
        )}
        {dlError && <Alert color="red" variant="light" mt="sm">{dlError}</Alert>}
      </Paper>

      <div ref={resultRef}>
        {/* 일일 — 생성된 웹 보고서 */}
        {type === "daily" && report && deviceSn && (
          <Paper radius="lg" p="lg" withBorder shadow="xs">
            <Group justify="space-between" align="center" mb="md" wrap="wrap" gap="xs">
              <Text fw={700} fz="sm">일일 안전 보고서</Text>
              <Group gap="xs" wrap="nowrap">
                <Button size="xs" variant="light" color="kw" leftSection={<IconFileText size={14} />}
                  loading={busy === "daily"} onClick={onDailyPdfPreview}>PDF 보기</Button>
                <Button size="xs" variant="default" leftSection={<IconDownload size={14} />}
                  loading={busy === "daily"} onClick={onDailyDownload}>PDF 다운로드</Button>
              </Group>
            </Group>
            <WebReport report={report} deviceSn={deviceSn} />
          </Paper>
        )}
        {type === "daily" && !report && busy !== "report" && (
          <Paper radius="lg" p="xl" withBorder shadow="xs">
            <Center><Text size="sm" c="dimmed">측정기·분석 일자를 선택하고 <b>보고서 생성</b>을 누르세요.</Text></Center>
          </Paper>
        )}

        {/* PDF 미리보기(기간 또는 일일 PDF) */}
        {preview && (
          <Paper radius="lg" withBorder shadow="xs" mt={type === "daily" ? "md" : 0} style={{ overflow: "hidden" }}>
            <Group justify="space-between" wrap="wrap" gap="xs" px="md" py={10}
              style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", background: "var(--mantine-color-gray-0)" }}>
              <Text size="sm" fw={600}>{KIND_LABEL[preview.kind] ?? "보고서"} — 미리보기</Text>
              <Group gap="xs" wrap="nowrap">
                <Button size="xs" color="kw" leftSection={<IconDownload size={14} />}
                  onClick={() => api.saveBlob(preview.blob, preview.filename)}>다운로드</Button>
                <Button size="xs" variant="default" onClick={closePreview}>닫기</Button>
              </Group>
            </Group>
            <iframe title="report-preview" src={preview.url}
              style={{ width: "100%", height: 760, border: "none", display: "block" }} />
            <Text size="xs" c="dimmed" ta="center" px="sm" py={6}
              style={{ borderTop: "1px solid var(--mantine-color-gray-1)", background: "var(--mantine-color-gray-0)" }}>
              미리보기가 보이지 않으면 상단의 “다운로드”로 파일을 내려받아 확인하세요.
            </Text>
          </Paper>
        )}
      </div>
    </Stack>
  );
}
