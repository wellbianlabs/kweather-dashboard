import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Container, Stack, Group, Title, Text, Button, SegmentedControl, Alert, Paper,
  SimpleGrid, Table, Badge, Divider, ThemeIcon, Select, PasswordInput, TextInput,
} from "@mantine/core";
import {
  IconRefresh, IconActivity, IconClipboardList, IconDatabaseImport, IconKey, IconDeviceFloppy,
  IconServer2,
} from "@tabler/icons-react";
import { api } from "../api";
import type { AdminOverview, AdminSettings, AdminSystem } from "../types";

const KEY_META: { name: string; label: string; secret: boolean; hint: string }[] = [
  { name: "KW_API_KEY", label: "케이웨더 Open API 키", secret: true, hint: "WEATHER_PROVIDER=kweather 일 때 사용" },
  { name: "KMA_API_KEY", label: "기상청 API허브 인증키", secret: true, hint: "야외 체감온도 시간 매칭(ASOS)" },
  { name: "KAKAO_REST_KEY", label: "카카오 REST 키", secret: true, hint: "주소→좌표·행정동 변환(없으면 OSM 폴백)" },
  { name: "KW_BASE_URL", label: "케이웨더 API BASE URL", secret: false, hint: "" },
  { name: "KW_PAST_BASE_URL", label: "케이웨더 과거자료 BASE URL", secret: false, hint: "" },
];

// 접근 로그 구분(kind) 라벨/색 — recent 이벤트 배지에 사용.
const KIND_LABEL: Record<string, string> = {
  visit: "방문/인증", upload: "업로드", report: "리포트", api: "조회",
};
const KIND_COLOR: Record<string, string> = {
  visit: "blue", upload: "teal", report: "grape", api: "gray",
};

// 브랜드 토큰(theme.ts kw 네이비/sky)을 recharts 인라인 색으로 이식.
const KW_NAVY = "#0f499e";   // kw-6 (브랜드 기본)
const KW_NAVY_FILL = "#dbe7f7"; // kw-1 (바 채움)
const TEAL_FILL = "#a7f3d0";
const ACCENT_ORANGE = "#f97316";

function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <Paper radius="lg" p="md" withBorder shadow="xs">
      <Text fz="xs" c="dimmed" fw={500}>{label}</Text>
      <Text fz="xl" fw={700} c={accent} mt={4}>{value}</Text>
      {sub && <Text fz="xs" c="dimmed" mt={2}>{sub}</Text>}
    </Paper>
  );
}

// 섹션 헤더 — 통합 대시보드의 각 블록(추이/로그/적재)을 시각적으로 구분.
function SectionHead({ icon, title, desc }: { icon: React.ReactNode; title: string; desc?: string }) {
  return (
    <Group gap="sm" mb="md" wrap="nowrap" align="center">
      <ThemeIcon variant="light" color="kw" radius="md" size={34}>{icon}</ThemeIcon>
      <div>
        <Title order={3} fz="md" c="#0f172a">{title}</Title>
        {desc && <Text fz="xs" c="dimmed">{desc}</Text>}
      </div>
    </Group>
  );
}

export function AdminPage({ onClose }: { onClose: () => void }) {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"overview" | "system" | "keys">("overview");

  // 기존 관리자 데이터 그대로 사용: api.adminOverview(days) → AdminOverview.
  const load = useCallback(() => {
    setLoading(true); setErr(null);
    api.adminOverview(days)
      .then(setData)
      .catch((e) => setErr(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const n = (v: number) => v.toLocaleString();

  // daily(추이) 데이터에서 적재 현황 요약을 파생 — 새 엔드포인트 없이 기존 필드 재사용.
  const uploadSummary = useMemo(() => {
    if (!data) return null;
    const totalUploads = data.daily.reduce((s, d) => s + d.uploads, 0);
    const totalRows = data.daily.reduce((s, d) => s + d.rows, 0);
    const activeDays = data.daily.filter((d) => d.uploads > 0).length;
    const peak = data.daily.reduce<typeof data.daily[number] | null>(
      (best, d) => (best === null || d.rows > best.rows ? d : best), null,
    );
    return { totalUploads, totalRows, activeDays, peak };
  }, [data]);

  return (
    <Container size="xl" py="lg">
      <Stack gap="lg">
        {/* 헤더 — 사이트 전체 관리자 콘솔 (일반 이용자 화면과 별개) */}
        <Group justify="space-between" wrap="wrap" gap="sm">
          <div>
            <Title order={2} fz="lg">사이트 관리자 콘솔</Title>
            <Text fz="xs" c="dimmed">
              사이트 전체 운영 — 접속 현황 및 외부 연동 키 설정{" "}
              {view === "overview" && data && `· 기준 ${data.generated_at} (KST)`}
            </Text>
          </div>
          <Button onClick={onClose}>이용자 화면으로</Button>
        </Group>

        {/* 콘솔 탭 + (현황일 때) 기간/새로고침 */}
        <Group justify="space-between" wrap="wrap" gap="sm">
          <SegmentedControl
            value={view}
            onChange={(v) => setView(v as "overview" | "system" | "keys")}
            data={[
              { label: "접속 현황", value: "overview" },
              { label: "서버·유지보수", value: "system" },
              { label: "외부 연동 키", value: "keys" },
            ]}
          />
          {view === "overview" && (
            <Group gap="xs">
              <SegmentedControl
                value={String(days)}
                onChange={(v) => setDays(Number(v))}
                data={[{ label: "7일", value: "7" }, { label: "14일", value: "14" }, { label: "30일", value: "30" }]}
                size="xs"
              />
              <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={load}>새로고침</Button>
            </Group>
          )}
        </Group>

        {view === "system" && <SystemPanel />}

        {view === "keys" && <ApiKeysCard />}

        {view === "overview" && err && <Alert color="red" variant="light">{err}</Alert>}
        {view === "overview" && loading && !data && <Text c="dimmed" ta="center" py="xl">불러오는 중...</Text>}

        {view === "overview" && data && (
          <>
            {/* 오늘 현황 KPI — 통합 요약 (방문·트래픽·업로드·가입·누적) */}
            <SimpleGrid cols={{ base: 2, md: 5 }} spacing="sm">
              <Kpi label="오늘 방문(고유)" value={n(data.today.visits)} accent="kw" />
              <Kpi label="오늘 요청(트래픽)" value={n(data.today.requests)} />
              <Kpi label="오늘 업로드" value={`${n(data.today.uploads)}건`} sub={`${n(data.today.rows)}행 반영`} accent="teal.7" />
              <Kpi label="오늘 신규가입" value={n(data.today.signups)} />
              <Kpi label="누적 측정행" value={n(data.totals.rows)} sub={`회원 ${n(data.totals.members)} · 기기 ${n(data.totals.devices)}`} />
            </SimpleGrid>

            {/* (a) 트래픽/방문 추이 — 시계열 차트 */}
            <Paper radius="lg" p="lg" withBorder shadow="xs">
              <SectionHead
                icon={<IconActivity size={19} />}
                title="트래픽 · 방문 추이"
                desc={`최근 ${days}일 일자별 요청 · 업로드 · 방문 · 신규가입`}
              />
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={data.daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={20}
                         tickFormatter={(d) => String(d).slice(5)} />
                  <YAxis yAxisId="l" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="l" dataKey="requests" name="요청수" fill={KW_NAVY_FILL} radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="l" dataKey="uploads" name="업로드" fill={TEAL_FILL} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="r" type="monotone" dataKey="visits" name="방문(고유)" stroke={KW_NAVY} strokeWidth={2.2} dot={false} />
                  <Line yAxisId="r" type="monotone" dataKey="signups" name="신규가입" stroke={ACCENT_ORANGE} strokeWidth={1.6} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </Paper>

            {/* (b) 접근 로그 — 최근 이벤트 테이블 */}
            <Paper radius="lg" p="lg" withBorder shadow="xs">
              <SectionHead
                icon={<IconClipboardList size={19} />}
                title="접근 로그"
                desc="최근 접속 · 인증 · 업로드 · 조회 이벤트"
              />
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="xs" fz="sm" highlightOnHover stickyHeader>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>시각</Table.Th>
                      <Table.Th>구분</Table.Th>
                      <Table.Th>회사</Table.Th>
                      <Table.Th>요청</Table.Th>
                      <Table.Th ta="right">상태</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.recent.map((e, i) => (
                      <Table.Tr key={i}>
                        <Table.Td ff="monospace" fz="xs" c="dimmed">{e.ts}</Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light" color={KIND_COLOR[e.kind] ?? KIND_COLOR.api}>
                            {KIND_LABEL[e.kind] ?? e.kind}
                          </Badge>
                        </Table.Td>
                        <Table.Td c="#475569">{e.company ?? (e.email ?? "익명")}</Table.Td>
                        <Table.Td ff="monospace" fz="xs" c="dimmed">{e.method} {e.path}</Table.Td>
                        <Table.Td ta="right" c={e.status >= 400 ? "red" : "dimmed"}>{e.status}</Table.Td>
                      </Table.Tr>
                    ))}
                    {data.recent.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={5} ta="center" c="dimmed" py="md">기록이 없습니다.</Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>

            {/* (c) 업로드 / 데이터 적재 현황 — 기간 요약 + 사업장별 적재 테이블 */}
            <Paper radius="lg" p="lg" withBorder shadow="xs">
              <SectionHead
                icon={<IconDatabaseImport size={19} />}
                title="업로드 · 데이터 적재 현황"
                desc={`최근 ${days}일 적재 요약 및 사업장(회원)별 누적 데이터`}
              />

              {uploadSummary && (
                <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm" mb="lg">
                  <Kpi label={`${days}일 업로드`} value={`${n(uploadSummary.totalUploads)}건`} accent="teal.7" />
                  <Kpi label={`${days}일 반영 행`} value={`${n(uploadSummary.totalRows)}행`} />
                  <Kpi label="적재 발생일" value={`${n(uploadSummary.activeDays)}/${days}일`} />
                  <Kpi
                    label="최다 적재일"
                    value={uploadSummary.peak && uploadSummary.peak.rows > 0 ? uploadSummary.peak.date.slice(5) : "—"}
                    sub={uploadSummary.peak && uploadSummary.peak.rows > 0 ? `${n(uploadSummary.peak.rows)}행` : undefined}
                  />
                </SimpleGrid>
              )}

              <Divider mb="md" label="사업장(회원)별 데이터 현황" labelPosition="left" />

              <Table.ScrollContainer minWidth={720}>
                <Table verticalSpacing="xs" fz="sm" highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>회사</Table.Th>
                      <Table.Th>이메일</Table.Th>
                      <Table.Th ta="right">기기</Table.Th>
                      <Table.Th ta="right">측정행</Table.Th>
                      <Table.Th>데이터 기간</Table.Th>
                      <Table.Th>가입일</Table.Th>
                      <Table.Th>최근 활동</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data.tenants.map((t) => (
                      <Table.Tr key={t.id}>
                        <Table.Td fw={500} c="#1e293b">
                          {t.company}
                          {t.is_demo && <Badge size="xs" variant="light" color="gray" ml={6}>데모</Badge>}
                        </Table.Td>
                        <Table.Td c="dimmed">{t.email ?? "—"}</Table.Td>
                        <Table.Td ta="right">{n(t.devices)}</Table.Td>
                        <Table.Td ta="right">{n(t.rows)}</Table.Td>
                        <Table.Td fz="xs" c="dimmed">
                          {t.first_date ? `${t.first_date} ~ ${t.last_date}` : "—"}
                        </Table.Td>
                        <Table.Td fz="xs" c="dimmed">{t.created_at ?? "—"}</Table.Td>
                        <Table.Td fz="xs" c="dimmed">{t.last_active ?? "—"}</Table.Td>
                      </Table.Tr>
                    ))}
                    {data.tenants.length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={7} ta="center" c="dimmed" py="md">회원이 없습니다.</Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}

function fmtBytes(n?: number): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}
function fmtUptime(sec?: number): string {
  if (!sec) return "—";
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d > 0 ? `${d}일 ${h}시간` : (h > 0 ? `${h}시간 ${m}분` : `${m}분`);
}

/** 서버·유지보수 — 자원(디스크/메모리/부하)·DB·기상청 호출·백업·로그 현황. 사이트 관리자 전용. */
function SystemPanel() {
  const [sys, setSys] = useState<AdminSystem | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true); setErr(null);
    api.adminSystem().then(setSys).catch((e) => setErr(String(e.message || e))).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const n = (v?: number | null) => (v == null ? "—" : v.toLocaleString());

  if (err) return <Alert color="red" variant="light">{err}</Alert>;
  if (!sys) return <Text c="dimmed" ta="center" py="xl">불러오는 중...</Text>;

  const { db, server, external, logs, backup } = sys;
  const rc = db.row_counts || {};
  const tableRows = (db.tables || []).map((t) => ({ name: t.name, bytes: t.bytes, rows: rc[t.name] ?? null }));

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Text fz="xs" c="dimmed">기준 {sys.generated_at} (KST)</Text>
        <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} onClick={load} loading={loading}>새로고침</Button>
      </Group>

      {/* 서버 자원 KPI */}
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <Kpi label="디스크 사용" value={server.disk ? `${server.disk.pct}%` : "—"}
          sub={server.disk ? `${fmtBytes(server.disk.used)} / ${fmtBytes(server.disk.total)} · 여유 ${fmtBytes(server.disk.free)}` : undefined}
          accent={server.disk && server.disk.pct >= 85 ? "red" : "kw"} />
        <Kpi label="메모리 사용" value={server.memory?.pct != null ? `${server.memory.pct}%` : "—"}
          sub={server.memory ? `${fmtBytes(server.memory.used)} / ${fmtBytes(server.memory.total)}` : undefined}
          accent={server.memory?.pct != null && server.memory.pct >= 85 ? "red" : undefined} />
        <Kpi label="시스템 부하(1·5·15분)" value={server.load ? server.load.join(" · ") : "—"}
          sub={server.cpu_count ? `CPU ${server.cpu_count}코어 · 업타임 ${fmtUptime(server.uptime_sec)}` : undefined} />
        <Kpi label="DB 크기" value={fmtBytes(db.size_bytes)}
          sub={`${db.engine_label} · 연결 ${n(db.connections)}/${n(db.max_connections)}`} accent="teal.7" />
      </SimpleGrid>

      {/* 기상청 외부연동 호출 */}
      <Paper radius="lg" p="lg" withBorder shadow="xs">
        <SectionHead icon={<IconActivity size={19} />} title="기상청 외부연동 호출"
          desc="외부 기상청(ASOS) 데이터 연동 현황 — data.go.kr" />
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
          <Kpi label="제공자(provider)" value={external.provider || "—"} />
          <Kpi label="오늘 외부요청" value={`${n(external.api_requests_today)}건`} sub={`누적 ${n(external.api_requests_total)}건`} accent="kw" />
          <Kpi label="캐시된 외부 데이터" value={`${n(external.cached_days)}건`} sub="(기기·일자) 1회 호출 후 캐시" />
          <Kpi label="일일 호출 한도" value={n(external.daily_quota)} sub="data.go.kr ASOS 시간자료" accent="teal.7" />
        </SimpleGrid>
      </Paper>

      {/* 백업 + 로그 */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper radius="lg" p="lg" withBorder shadow="xs">
          <SectionHead icon={<IconDatabaseImport size={19} />} title="DB 백업" desc="매일 02:00 자동 백업 · 최근 14개 보존" />
          <Stack gap={6}>
            <Group justify="space-between"><Text fz="sm" c="dimmed">최신 백업 시각</Text><Text fz="sm" fw={600}>{backup.latest_at ?? "—"}</Text></Group>
            <Group justify="space-between"><Text fz="sm" c="dimmed">최신 파일</Text><Text fz="xs" ff="monospace">{backup.latest ?? "—"} ({fmtBytes(backup.latest_bytes)})</Text></Group>
            <Group justify="space-between"><Text fz="sm" c="dimmed">보관 개수 · 총용량</Text><Text fz="sm">{n(backup.count)}개 · {fmtBytes(backup.total_bytes)}</Text></Group>
            <Text fz="xs" c="dimmed">{backup.dir}</Text>
          </Stack>
        </Paper>
        <Paper radius="lg" p="lg" withBorder shadow="xs">
          <SectionHead icon={<IconClipboardList size={19} />} title="접근 로그 · 보존" desc="매일 03:30 90일 경과분 자동 정리" />
          <Stack gap={6}>
            <Group justify="space-between"><Text fz="sm" c="dimmed">로그 행수</Text><Text fz="sm" fw={600}>{n(logs.access_rows)}행</Text></Group>
            <Group justify="space-between"><Text fz="sm" c="dimmed">가장 오래된 기록</Text><Text fz="sm">{logs.oldest ?? "—"}</Text></Group>
            <Group justify="space-between"><Text fz="sm" c="dimmed">보존 정책</Text><Text fz="sm">{logs.retention_days}일</Text></Group>
          </Stack>
        </Paper>
      </SimpleGrid>

      {/* DB 테이블별 용량/행수 */}
      <Paper radius="lg" p="lg" withBorder shadow="xs">
        <SectionHead icon={<IconServer2 size={19} />} title="DB 테이블 현황" desc={`${db.engine_label} · 총 ${fmtBytes(db.size_bytes)}`} />
        <Table.ScrollContainer minWidth={420}>
          <Table verticalSpacing="xs" fz="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr><Table.Th>테이블</Table.Th><Table.Th ta="right">크기</Table.Th><Table.Th ta="right">행수</Table.Th></Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {tableRows.map((t) => (
                <Table.Tr key={t.name}>
                  <Table.Td ff="monospace" fz="xs">{t.name}</Table.Td>
                  <Table.Td ta="right">{fmtBytes(t.bytes)}</Table.Td>
                  <Table.Td ta="right">{n(t.rows)}</Table.Td>
                </Table.Tr>
              ))}
              {tableRows.length === 0 && (
                <Table.Tr><Table.Td colSpan={3} ta="center" c="dimmed" py="md">정보 없음</Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>
    </Stack>
  );
}

/** 외부 연동 키 설정 — 저장 시 서버 재시작 없이 반영(런타임 설정). 사이트 관리자 전용. */
function ApiKeysCard() {
  const [st, setSt] = useState<AdminSettings | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    api.adminSettings().then((s) => {
      setSt(s);
      setVals({
        WEATHER_PROVIDER: s.status.WEATHER_PROVIDER?.value || "mock",
        KW_BASE_URL: s.status.KW_BASE_URL?.value || "",
        KW_PAST_BASE_URL: s.status.KW_PAST_BASE_URL?.value || "",
        KW_API_KEY: "", KMA_API_KEY: "", KAKAO_REST_KEY: "",
      });
    }).catch((e) => setMsg({ ok: false, text: String(e.message || e) }));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const updates: Record<string, string> = {
        WEATHER_PROVIDER: vals.WEATHER_PROVIDER ?? "mock",
        KW_BASE_URL: vals.KW_BASE_URL ?? "",
        KW_PAST_BASE_URL: vals.KW_PAST_BASE_URL ?? "",
      };
      for (const k of ["KW_API_KEY", "KMA_API_KEY", "KAKAO_REST_KEY"]) {
        if (vals[k]) updates[k] = vals[k];
      }
      const r = await api.saveAdminSettings(updates);
      setSt((prev) => (prev ? { ...prev, status: r.status } : prev));
      setVals((v) => ({ ...v, KW_API_KEY: "", KMA_API_KEY: "", KAKAO_REST_KEY: "" }));
      setMsg({ ok: true, text: "저장되었습니다. 최대 15초 내 전체 워커에 반영됩니다." });
    } catch (e: any) {
      setMsg({ ok: false, text: "저장 실패: " + String(e.message || e) });
    } finally {
      setSaving(false);
    }
  }

  const srcLabel = (s?: { source?: string }) =>
    s?.source === "db" ? "저장됨" : s?.source === "env" ? "환경변수" : "미설정";

  return (
    <Paper radius="lg" p="lg" withBorder shadow="xs">
      <Group gap="xs" mb="xs">
        <ThemeIcon variant="light" color="kw" radius="md" size={34}><IconKey size={19} /></ThemeIcon>
        <div>
          <Title order={3} fz="md" c="#0f172a">외부 연동 키 설정</Title>
          <Text fz="xs" c="dimmed">기상청·케이웨더·카카오 키를 입력하면 서버 재시작 없이 적용됩니다</Text>
        </div>
      </Group>

      <Stack gap="md" mt="md">
        <Select
          label="날씨 데이터 제공자 (WEATHER_PROVIDER)"
          description="mock=데모 시뮬레이션 · kweather=케이웨더 Open API · kma=기상청"
          data={[
            { value: "mock", label: "mock (데모/시뮬레이션)" },
            { value: "kweather", label: "kweather (케이웨더 Open API)" },
            { value: "kma", label: "kma (기상청)" },
          ]}
          value={vals.WEATHER_PROVIDER || "mock"}
          onChange={(v) => setVals((p) => ({ ...p, WEATHER_PROVIDER: v || "mock" }))}
          allowDeselect={false}
          maw={420}
        />

        {KEY_META.map((k) => {
          const cur = st?.status?.[k.name];
          const status = `현재: ${srcLabel(cur)}${cur?.set && k.secret && cur.masked ? ` (${cur.masked})` : ""}`;
          return k.secret ? (
            <PasswordInput
              key={k.name}
              label={`${k.label} (${k.name})`}
              description={`${k.hint}${k.hint ? " · " : ""}${status}`}
              placeholder={cur?.set ? "변경 시에만 입력 (비우면 기존 유지)" : "키 입력"}
              value={vals[k.name] ?? ""}
              onChange={(e) => setVals((p) => ({ ...p, [k.name]: e.currentTarget.value }))}
            />
          ) : (
            <TextInput
              key={k.name}
              label={`${k.label} (${k.name})`}
              description={status}
              value={vals[k.name] ?? ""}
              onChange={(e) => setVals((p) => ({ ...p, [k.name]: e.currentTarget.value }))}
            />
          );
        })}

        {msg && <Alert color={msg.ok ? "teal" : "red"} variant="light">{msg.text}</Alert>}

        <Group justify="flex-end">
          <Button variant="default" onClick={load} disabled={saving}>되돌리기</Button>
          <Button color="kw" leftSection={<IconDeviceFloppy size={16} />} onClick={save} loading={saving}>키 저장</Button>
        </Group>
      </Stack>
    </Paper>
  );
}
