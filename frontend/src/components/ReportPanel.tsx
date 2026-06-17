import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot,
} from "recharts";
import {
  Alert, Box, Button, Center, Group, List, Loader, Modal, Paper, Progress,
  SimpleGrid, Stack, Table, Text, ThemeIcon, Title,
} from "@mantine/core";
import { IconDownload, IconFileText } from "@tabler/icons-react";
import { api } from "../api";
import type { DailyReport, DailyHourPoint } from "../types";
import { HeatBadge } from "./HeatBadge";
import { ChartTooltip } from "./chartkit";
// 지연 로드: react-pdf/pdf.js(~150KB gz)를 PDF 미리보기 클릭 시에만 별도 청크로 로드(초기 번들 보호)
const PdfViewer = lazy(() => import("./PdfViewer").then((m) => ({ default: m.PdfViewer })));

function fmtMin(min: number): string {
  if (!min || min <= 0) return "0분";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

const KIND_LABEL: Record<string, string> = {
  daily: "일일 안전 보고서(PDF)",
  periodic: "기간 통계 보고서(PDF)",
  excel: "Excel 데이터 파일",
};

type Preview = { kind: string; url: string; blob: Blob; filename: string } | null;

export function ReportPanel({
  deviceSn, date, rangeStart, rangeEnd,
}: { deviceSn: string | null; date: string; rangeStart: string; rangeEnd: string }) {
  const [report, setReport] = useState<DailyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [dlError, setDlError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!deviceSn) { setReport(null); return; }
    setLoading(true);
    api.dailyReport(deviceSn, date).then(setReport).catch(() => setReport(null)).finally(() => setLoading(false));
  }, [deviceSn, date]);

  // 미리보기 objectURL 정리(언마운트/교체 시 메모리 해제)
  useEffect(() => {
    return () => { if (preview?.url) URL.revokeObjectURL(preview.url); };
  }, [preview]);

  function friendlyError(e: any): string {
    let msg = String(e?.message || e);
    try { msg = JSON.parse(msg).detail ?? msg; } catch {}
    if (msg.includes("504") || msg.toLowerCase().includes("timeout")) {
      return "기간이 너무 길어 생성 시간이 초과되었습니다. 리포트 기간을 줄여 다시 시도해 주세요.";
    }
    return msg;
  }

  // PDF 로 변환하여 화면에 표출(미리보기). 인증 헤더로 Blob 을 받아 임베드한다.
  async function showPreview(kind: string, url: string, filename: string) {
    setBusy(kind); setDlError(null);
    try {
      const blob = await api.fetchBlob(url);
      setPreview((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        return { kind, url: URL.createObjectURL(blob), blob, filename };
      });
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e: any) {
      setDlError(`PDF 변환 실패: ${friendlyError(e)}`);
    } finally {
      setBusy(null);
    }
  }

  async function downloadOnly(kind: string, url: string, filename: string) {
    setBusy(kind); setDlError(null);
    try {
      await api.download(url, filename);
    } catch (e: any) {
      setDlError(`다운로드 실패: ${friendlyError(e)}`);
    } finally {
      setBusy(null);
    }
  }

  function closePreview() {
    setPreview((prev) => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
  }

  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs" pos="relative">
      {/* 생성 중 로딩 오버레이 — Modal */}
      <Modal
        opened={busy !== null}
        onClose={() => {}}
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        centered
        radius="lg"
        overlayProps={{ backgroundOpacity: 0.35, blur: 2 }}
      >
        <Stack align="center" gap="md" py="sm">
          <Loader color="kw" size="lg" />
          <Box ta="center">
            <Text fw={700} fz="md">{(busy && KIND_LABEL[busy]) ?? "파일"} 생성 중</Text>
            <Text size="sm" c="dimmed" mt={6}>
              데이터 양에 따라 최대 1분 정도 소요될 수 있습니다.<br />잠시만 기다려 주세요.
            </Text>
          </Box>
          <Progress value={100} striped animated w={180} size="sm" radius="xl" color="kw" />
        </Stack>
      </Modal>

      <Title order={3} fz="md" mb={4}>안전관리 리포트</Title>
      <Text size="xs" c="dimmed" mb="sm">웹 보고서로 먼저 확인한 뒤, PDF로 변환해 보거나 내려받을 수 있습니다.</Text>

      {/* 1) 웹 보고서 — 화면에 먼저 표출 (하단 요약을 통합) */}
      {loading ? (
        <Text size="sm" c="dimmed">불러오는 중...</Text>
      ) : !deviceSn ? (
        <Text size="sm" c="dimmed">기기를 선택하면 웹 보고서가 표시됩니다.</Text>
      ) : report ? (
        <WebReport report={report} deviceSn={deviceSn} />
      ) : (
        <Text size="sm" c="dimmed">해당 일자 데이터가 없습니다.</Text>
      )}

      {/* 변환/내보내기 버튼 */}
      <Group gap="sm" mt="md">
        <Button
          color="kw"
          leftSection={<IconFileText size={16} />}
          loading={busy === "daily"}
          disabled={!deviceSn || busy !== null}
          onClick={() => deviceSn && showPreview("daily", api.dailyPdfUrl(deviceSn, date), `daily_${deviceSn}_${date}.pdf`)}
        >일일 보고서 PDF로 보기</Button>
        <Button
          variant="default"
          leftSection={<IconFileText size={16} />}
          loading={busy === "periodic"}
          disabled={busy !== null}
          onClick={() => showPreview("periodic", api.periodicPdfUrl(deviceSn, rangeStart, rangeEnd), `periodic_${rangeStart}_${rangeEnd}.pdf`)}
        >기간 통계 보고서 PDF로 보기</Button>
        <Button
          color="teal"
          variant="light"
          leftSection={<IconDownload size={16} />}
          loading={busy === "excel"}
          disabled={!deviceSn || busy !== null}
          onClick={() => deviceSn && downloadOnly("excel", api.excelUrl(deviceSn, date, date), `data_${deviceSn}_${date}.xlsx`)}
        >당일 측정데이터 내보내기 (10분·Excel)</Button>
      </Group>
      {dlError && (
        <Alert color="red" variant="light" mt="sm">{dlError}</Alert>
      )}

      {/* 2) PDF 변환 미리보기 — 웹 보고서 다음에 표출 */}
      {preview && (
        <Paper ref={previewRef} withBorder radius="md" mt="md" style={{ overflow: "hidden" }}>
          <Group justify="space-between" wrap="wrap" gap="xs" px="sm" py={8}
            style={{ borderBottom: "1px solid var(--mantine-color-gray-2)", background: "var(--mantine-color-gray-0)" }}>
            <Text size="sm" fw={600}>{KIND_LABEL[preview.kind] ?? "보고서"} — PDF 변환 미리보기</Text>
            <Group gap="xs" wrap="nowrap">
              <Button size="xs" color="kw" leftSection={<IconDownload size={14} />}
                onClick={() => api.saveBlob(preview.blob, preview.filename)}>다운로드</Button>
              <Button size="xs" variant="default" onClick={closePreview}>닫기</Button>
            </Group>
          </Group>
          <Suspense fallback={<Center h={160}><Loader /></Center>}>
            <PdfViewer
              file={preview.blob}
              url={preview.url}
              height={760}
              onDownload={() => api.saveBlob(preview.blob, preview.filename)}
            />
          </Suspense>
          <Text size="xs" c="dimmed" ta="center" px="sm" py={6}
            style={{ borderTop: "1px solid var(--mantine-color-gray-1)", background: "var(--mantine-color-gray-0)" }}>
            미리보기가 보이지 않으면 상단의 “다운로드”로 파일을 내려받아 확인하세요.
          </Text>
        </Paper>
      )}
    </Paper>
  );
}

/** 섹션 제목 — 네이비 번호 칩 + 라벨. */
function SectionTitle({ n, children, extra }: { n: number; children: ReactNode; extra?: ReactNode }) {
  return (
    <Group gap="xs" mb="sm" wrap="nowrap" align="center">
      <ThemeIcon size={22} radius="sm" variant="filled" color="kw">
        <Text fz={11} fw={800} c="#fff">{n}</Text>
      </ThemeIcon>
      <Text fw={700} size="sm">
        {children}
        {extra && <Text span size="xs" fw={400} c="dimmed"> {extra}</Text>}
      </Text>
    </Group>
  );
}

/** 요약 히어로 셀 — 보고서 상단 at-a-glance 지표. */
function HeroCell({ label, value, unit, sub, accent, node, divider }: {
  label: string; value?: string; unit?: string; sub?: string; accent?: string; node?: ReactNode; divider?: boolean;
}) {
  return (
    <Box px="lg" py="md" style={divider ? { borderLeft: "1px solid var(--mantine-color-gray-2)" } : undefined}>
      <Text size="xs" c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: "0.04em" }}>{label}</Text>
      <Group gap={4} align="flex-end" mt={6} mih={34}>
        {node ?? (
          <>
            <Text fw={800} fz={28} lh={1} style={{ color: accent ?? "var(--mantine-color-dark-9)", letterSpacing: "-0.02em" }}>{value}</Text>
            {unit && <Text fz="sm" fw={700} c="dimmed" mb={3}>{unit}</Text>}
          </>
        )}
      </Group>
      {sub && <Text size="xs" c="dimmed" mt={6}>{sub}</Text>}
    </Box>
  );
}

/** 웹 보고서 — 일일 보고서를 PDF 변환 전 HTML 레이아웃으로 표출. */
export function WebReport({ report, deviceSn }: { report: DailyReport; deviceSn: string }) {
  const lv = report.peak_level;
  const Info = ({ k, v }: { k: string; v: ReactNode }) => (
    <Group gap={0} wrap="nowrap" align="stretch"
      style={{ borderBottom: "1px solid var(--mantine-color-gray-1)" }}>
      <Box w={96} px="sm" py={8} style={{ flexShrink: 0, background: "var(--mantine-color-gray-0)" }}>
        <Text size="xs" fw={500} c="dimmed">{k}</Text>
      </Box>
      <Box px="sm" py={8} style={{ flex: 1, display: "flex", alignItems: "center" }}>
        {typeof v === "string" ? <Text size="sm">{v}</Text> : v}
      </Box>
    </Group>
  );
  const Metric = ({ label, value, unit, sub, accent }:
    { label: string; value: string; unit?: string; sub?: string; accent?: string }) => (
    <Paper withBorder radius="md" p="md" ta="center">
      <Text size="xs" c="dimmed">{label}</Text>
      <Group justify="center" align="baseline" gap={4} mt={4}>
        <Text fw={700} fz="xl" style={{ color: accent || "#0f172a", letterSpacing: "-0.01em" }}>{value}</Text>
        {unit && <Text size="xs" c="dimmed">{unit}</Text>}
      </Group>
      <Text size="xs" c="dimmed" mt={2} h={16}>{sub || ""}</Text>
    </Paper>
  );

  return (
    <Paper withBorder radius="lg" style={{ overflow: "hidden" }}>
      {/* 헤더 밴드 — 네이비 */}
      <Box px="lg" py="md" style={{ background: "linear-gradient(120deg, var(--mantine-color-kw-8), var(--mantine-color-kw-6))" }}>
        <Group justify="space-between" align="center" wrap="nowrap">
          <Box style={{ minWidth: 0 }}>
            <Text fw={800} fz="lg" c="#fff" style={{ letterSpacing: "-0.01em" }}>폭염 안전관리 일일 보고서</Text>
            <Text fz={10} fw={500} mt={2} style={{ color: "rgba(255,255,255,0.72)", textTransform: "uppercase", letterSpacing: "0.18em" }}>
              Heat Stress Daily Management Report
            </Text>
          </Box>
          <Box ta="right" style={{ flexShrink: 0 }}>
            <Text fz={10} style={{ color: "rgba(255,255,255,0.7)" }}>대상 일자</Text>
            <Text fw={700} c="#fff">{report.date}</Text>
          </Box>
        </Group>
      </Box>

      {/* 요약 히어로 스트립 */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing={0} style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
        <HeroCell label="최고 체감온도" value={report.max_feels_like != null ? `${report.max_feels_like}` : "–"} unit="℃"
          sub={report.max_feels_like_time ? `${report.max_feels_like_time} 발생` : "측정 기준"} accent={lv.color} />
        <HeroCell label="위험단계 노출 (38℃↑)" value={fmtMin(report.minutes_over_38)}
          sub={report.minutes_over_38 > 0 ? "온열질환 고위험" : "미발생"} accent={report.minutes_over_38 > 0 ? "#dc2626" : "#16a34a"} divider />
        <HeroCell label="최고 위험단계" node={<HeatBadge level={lv} size="lg" />} sub="기간 내 최고 단계" divider />
      </SimpleGrid>

      {/* 문서 정보 */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={0}
        style={{ borderBottom: "1px solid var(--mantine-color-gray-2)" }}>
        <Box style={{ borderRight: "1px solid var(--mantine-color-gray-2)" }}>
          <Info k="사업장" v={report.company_name || "-"} />
          <Info k="설치 위치" v={report.location_name || "-"} />
        </Box>
        <Box>
          <Info k="대상 일자" v={report.date} />
          <Info k="측정기기" v={`SN ${deviceSn}`} />
        </Box>
      </SimpleGrid>

      <Stack gap="md" p="lg">
        {/* 측정 결과 요약 */}
        <Box>
          <SectionTitle n={1}>측정 결과 요약</SectionTitle>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
            <Metric label="최고 체감온도" value={`${report.max_feels_like ?? "-"}`} unit="℃"
              accent={lv.color} sub={report.max_feels_like_time ? `${report.max_feels_like_time} 발생` : ""} />
            <Metric label="최고 온도" value={`${report.max_temperature ?? "-"}`} unit="℃" />
            <Metric label="위험단계 노출 (38℃↑)" value={fmtMin(report.minutes_over_38)}
              accent={report.minutes_over_38 > 0 ? "#dc2626" : undefined}
              sub={report.minutes_over_38 > 0 ? "온열질환 고위험" : "미발생"} />
          </SimpleGrid>
        </Box>

        {/* 위험단계별 노출시간 — 관심/주의/경고/위험 4단계 */}
        <Box>
          <SectionTitle n={2}>폭염 위험단계별 노출시간</SectionTitle>
          <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
            <Table ta="center" verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr style={{ background: "var(--mantine-color-gray-0)" }}>
                  <Table.Th ta="center" fz="xs" fw={500} c="dimmed">관심 (31℃↑)</Table.Th>
                  <Table.Th ta="center" fz="xs" fw={500} c="dimmed">주의 (33℃↑)</Table.Th>
                  <Table.Th ta="center" fz="xs" fw={500} c="dimmed">경고 (35℃↑)</Table.Th>
                  <Table.Th ta="center" fz="xs" fw={500} c="dimmed">위험 (38℃↑)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td ta="center" fw={700} style={{ color: "#84cc16" }}>{fmtMin(report.minutes_over_31)}</Table.Td>
                  <Table.Td ta="center" fw={700} style={{ color: "#eab308" }}>{fmtMin(report.minutes_over_33)}</Table.Td>
                  <Table.Td ta="center" fw={700} style={{ color: "#f97316" }}>{fmtMin(report.minutes_over_35)}</Table.Td>
                  <Table.Td ta="center" fw={700} style={{ color: "#dc2626" }}>{fmtMin(report.minutes_over_38)}</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </Paper>
        </Box>

        {/* 시간별 체감온도 변화 — 표 + 그래프 */}
        <Box>
          <SectionTitle n={3}>시간별 체감온도 변화</SectionTitle>
          <HourlyTable hours={report.hours} />
          <HourlyChart hours={report.hours} />
        </Box>

        {/* 법정 휴식 의무 (산업안전보건규칙) */}
        <Box>
          <SectionTitle n={4} extra="(산업안전보건규칙 — 체감 33℃↑ 작업 시 2시간마다 20분 이상)">법정 휴식 의무</SectionTitle>
          {report.work_hot_minutes > 0 ? (
            <Alert color="yellow" variant="light" radius="md">
              <Text size="sm">
                근무시간(09:00~18:00) 중 체감온도 <b>33℃ 이상 작업</b>이
                <Text span c="yellow.8" fw={700}> {fmtMin(report.work_hot_minutes)}</Text> 발생 →
                <Text span c="yellow.8" fw={700}> 최소 {report.legal_rest_count}회 · 총 {fmtMin(report.legal_rest_minutes)}</Text>의
                휴식을 부여해야 합니다.
              </Text>
              <Text size="xs" c="dimmed" mt={6}>
                ※ 본 수치는 측정 체감온도 기반 <b>법정 최소 의무량</b>입니다. 실제 부여한 휴식 기록과 대조하여 준수 여부를 확인하세요.
              </Text>
            </Alert>
          ) : (
            <Paper withBorder radius="md" p="md" bg="gray.0">
              <Text size="sm" c="dimmed">
                근무시간 중 체감온도 33℃ 이상 작업이 없어 추가 의무 휴식 대상이 아닙니다(통상 안전보건 관리 유지).
              </Text>
            </Paper>
          )}
        </Box>

        {/* 안전조치 가이드 */}
        <Box>
          <SectionTitle n={5}>안전조치 이행 가이드</SectionTitle>
          <List spacing={6} size="sm" center
            icon={<Text span c="kw" fz={10} lh={1}>○</Text>}>
            {report.guidance.map((g, i) => (
              <List.Item key={i}>{g}</List.Item>
            ))}
          </List>
        </Box>

        <Text size="xs" c="dimmed" pt="sm" style={{ borderTop: "1px solid var(--mantine-color-gray-1)", lineHeight: 1.6 }}>
          측정기기: 케이웨더(주) 체감온도계 (기기: {deviceSn}) · 모든 측정 데이터는 케이웨더(주) 체감온도계 장비로
          측정·수집되었으며, 외부 기상자료를 포함한 출처는 케이웨더(주)입니다.
        </Text>
      </Stack>
    </Paper>
  );
}

// 24시간 고정으로 정렬(없는 시간은 빈 칸)
function fill24(hours: DailyHourPoint[]): (DailyHourPoint | null)[] {
  const map = new Map(hours.map((h) => [h.hour, h]));
  return Array.from({ length: 24 }, (_, h) => map.get(h) ?? null);
}

/** 시간별 체감온도 색상 표(24시간). */
function HourlyTable({ hours }: { hours: DailyHourPoint[] }) {
  const cells = fill24(hours);
  if (!hours.length) return <Text size="sm" c="dimmed">시간별 데이터가 없습니다.</Text>;
  return (
    <Paper withBorder radius="md" style={{ overflow: "hidden" }}>
      <Table.ScrollContainer minWidth={720}>
        <Table layout="fixed" ta="center" withRowBorders={false} horizontalSpacing={2} verticalSpacing={4}>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td w={48} fz={10} fw={500} c="dimmed" style={{ background: "var(--mantine-color-gray-0)" }}>시각</Table.Td>
              {cells.map((_, h) => (
                <Table.Td key={h} fz={10} fw={500} c="dimmed" style={{ background: "var(--mantine-color-gray-0)" }}>
                  {String(h).padStart(2, "0")}
                </Table.Td>
              ))}
            </Table.Tr>
            <Table.Tr>
              <Table.Td w={48} fz={10} fw={500} c="dimmed" style={{ background: "var(--mantine-color-gray-0)" }}>체감</Table.Td>
              {cells.map((c, h) => (
                <Table.Td key={h} fz={10} fw={700}
                  style={{ background: c?.feels != null ? c.color : "#f1f5f9", color: c?.feels != null ? "#fff" : "#cbd5e1" }}>
                  {c?.feels != null ? c.feels.toFixed(1) : "-"}
                </Table.Td>
              ))}
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

/** 시간별 체감온도 변화 그래프(단계 임계선 포함). */
export function HourlyChart({ hours }: { hours: DailyHourPoint[] }) {
  if (!hours.length) return null;
  const data = fill24(hours).map((c, h) => ({ time: `${String(h).padStart(2, "0")}시`, 체감온도: c?.feels ?? null }));
  const valid = data.filter((d): d is { time: string; 체감온도: number } => d.체감온도 != null);
  const peak = valid.length ? valid.reduce((a, b) => (b.체감온도 > a.체감온도 ? b : a)) : null;
  const tline = (v: number, label: string, stroke: string, fill: string) => (
    <ReferenceLine y={v} stroke={stroke} strokeDasharray="5 4"
      label={{ value: label, fontSize: 10, fontWeight: 600, fill, position: "insideRight", dy: -7 }} />
  );
  return (
    <Box mt="sm">
      <ResponsiveContainer width="100%" height={250}>
        <ComposedChart data={data} margin={{ top: 24, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#94a3b8" }} minTickGap={20} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} unit="℃" domain={["auto", "auto"]} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip units={{ 체감온도: "℃" }} />} />
          {tline(31, "관심 31", "#84cc16", "#65a30d")}
          {tline(33, "주의 33", "#eab308", "#a16207")}
          {tline(35, "경고 35", "#f97316", "#c2410c")}
          {tline(38, "위험 38", "#dc2626", "#b91c1c")}
          <Line type="monotone" dataKey="체감온도" stroke="#dc2626" strokeWidth={2.4} dot={false} connectNulls />
          {peak && (
            <ReferenceDot x={peak.time} y={peak.체감온도} r={4.5} fill="#dc2626" stroke="#fff" strokeWidth={2}
              label={{ value: `${peak.체감온도}℃`, position: "top", fontSize: 12, fontWeight: 700, fill: "#dc2626", dy: -2 }} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Box>
  );
}
