import { useMemo, useState } from "react";
import {
  ActionIcon, Badge, Box, Button, Code, createTheme, Group, MantineProvider,
  type MantineColorsTuple, NavLink, NumberInput, Paper, ScrollArea, SegmentedControl,
  Select, Stack, Switch, Text, TextInput, Title,
} from "@mantine/core";
import { IconCopy, IconMoon, IconSun } from "@tabler/icons-react";
import { STORIES, type Knob, type Story } from "./stories";

// ── 리브랜딩 프리셋 (기획서 §4) — 'kw' 팔레트를 통째로 스왑해 라이브 프리뷰 ──
const SKY: MantineColorsTuple = ["#e7f5fc", "#cfe9f7", "#9fd2ef", "#6bbae8", "#43a7e1", "#2a9bdd", "#1790cd", "#0a7fb8", "#0070a4", "#005c88"];
const PRESETS: Record<string, { label: string; kw: MantineColorsTuple }> = {
  kw: { label: "현재 (KW 네이비)", kw: ["#eef4fb", "#dbe7f7", "#b3cbe9", "#88abd8", "#6790ca", "#517fc1", "#0f499e", "#0d4290", "#0c3d85", "#082f68"] },
  signal: { label: "A · Signal (Azure)", kw: ["#eaf2fb", "#cfe2f5", "#a4c8ec", "#78aee3", "#5598da", "#3a86d2", "#0e6fb8", "#0c5fa0", "#0a4e84", "#073354"] },
  clearSky: { label: "B · Clear Sky", kw: ["#e6f6fd", "#c8ebfa", "#97d8f3", "#63c3eb", "#38b0e3", "#1aa3de", "#0fa0dc", "#0a86bb", "#0a6f9b", "#064f70"] },
  controlRoom: { label: "C · Control Room", kw: ["#e4f7fa", "#c4ecf1", "#94dde6", "#5fccd9", "#38bccc", "#20b0c2", "#0e9db3", "#0a8499", "#0a6b7c", "#064a57"] },
};
const FONT = '"Pretendard Variable", Pretendard, -apple-system, sans-serif';

const GROUPS = Array.from(new Set(STORIES.map((s) => s.group)));

export function CatalogApp() {
  const [activeId, setActiveId] = useState(STORIES[0].id);
  const [knobs, setKnobs] = useState<Record<string, Record<string, any>>>({});
  const [preset, setPreset] = useState("kw");
  const [radius, setRadius] = useState("md");
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  const [copied, setCopied] = useState<string | null>(null);

  const story = STORIES.find((s) => s.id === activeId)!;
  const k = useMemo(() => {
    const base: Record<string, any> = {};
    (story.knobs ?? []).forEach((kb) => (base[kb.key] = knobs[story.id]?.[kb.key] ?? kb.default));
    return base;
  }, [story, knobs]);

  // 프리뷰 테마: 'kw' 팔레트를 프리셋으로 교체 → 컴포넌트가 즉시 리브랜드됨
  const previewTheme = useMemo(() => createTheme({
    primaryColor: "kw",
    primaryShade: { light: 6, dark: 6 },
    colors: { kw: PRESETS[preset].kw, sky: SKY },
    fontFamily: FONT,
    headings: { fontFamily: FONT, fontWeight: "700" },
    defaultRadius: radius,
    radius: { xs: "0.375rem", sm: "0.5rem", md: "0.75rem", lg: "1rem", xl: "1.25rem" },
    shadows: { xs: "0 1px 2px rgba(15,23,42,.04)", sm: "0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.04)", md: "0 2px 4px rgba(15,23,42,.05), 0 12px 32px rgba(15,23,42,.08)" },
  }), [preset, radius]);

  const setKnob = (key: string, val: any) =>
    setKnobs((prev) => ({ ...prev, [story.id]: { ...prev[story.id], [key]: val } }));

  const copy = (text: string, tag: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(tag);
    setTimeout(() => setCopied((c) => (c === tag ? null : c)), 1600);
  };

  const themeInstruction = () =>
    `[테마 변경 지시] frontend/src/theme.ts 에 적용해줘:\n` +
    `- primaryColor 'kw' 팔레트(10단계)를 아래로 교체 (프리셋: ${PRESETS[preset].label}):\n` +
    `  kw = ${JSON.stringify(PRESETS[preset].kw)}\n` +
    `- defaultRadius = '${radius}'\n` +
    `- (다크모드 기준이면 다크 토큰도 함께 보정)`;

  const componentInstruction = () =>
    `[컴포넌트 변경 지시] ${story.title}\n` +
    `- 대상 파일: ${story.file ?? "src/components/…"}\n` +
    `- 현재 카탈로그 설정: ${JSON.stringify(k)}\n` +
    `- 원하는 변경: <여기에 작성 — 예) 기본 size를 lg로, 헤더 색을 sky로, 여백을 키워줘>\n` +
    `반영 후 카탈로그(/catalog.html)에서 HMR로 즉시 확인.`;

  return (
    <Group align="stretch" gap={0} wrap="nowrap" style={{ height: "100vh" }}>
      {/* ── 좌측 모듈 네비 ── */}
      <Box w={248} style={{ borderRight: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}>
        <Group p="md" gap="xs">
          <img src="/kweather-logo.png" alt="KW" style={{ height: 18 }} />
          <Text fw={700} fz="sm">컴포넌트 카탈로그</Text>
        </Group>
        <ScrollArea h="calc(100vh - 56px)" px="sm">
          {GROUPS.map((g) => (
            <Box key={g} mb="sm">
              <Text fz={11} fw={700} c="dimmed" tt="uppercase" px="xs" mb={4}>{g}</Text>
              {STORIES.filter((s) => s.group === g).map((s) => (
                <NavLink key={s.id} label={s.title} active={s.id === activeId}
                  onClick={() => setActiveId(s.id)} variant="filled" />
              ))}
            </Box>
          ))}
        </ScrollArea>
      </Box>

      {/* ── 우측 작업 영역 ── */}
      <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
        {/* 글로벌 테마 컨트롤 바 */}
        <Group p="sm" justify="space-between" wrap="wrap"
          style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
          <Group gap="sm" wrap="wrap">
            <Select size="xs" w={180} label={undefined} value={preset} onChange={(v) => v && setPreset(v)}
              allowDeselect={false} leftSection={<Box w={12} h={12} style={{ borderRadius: 3, background: PRESETS[preset].kw[6] }} />}
              data={Object.entries(PRESETS).map(([v, p]) => ({ value: v, label: p.label }))} />
            <SegmentedControl size="xs" value={radius} onChange={setRadius}
              data={[{ label: "각짐 sm", value: "sm" }, { label: "기본 md", value: "md" }, { label: "둥글 lg", value: "lg" }]} />
            <ActionIcon variant="default" onClick={() => setScheme((s) => (s === "light" ? "dark" : "light"))} aria-label="scheme">
              {scheme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
            </ActionIcon>
            <Badge variant="dot" color="teal" size="sm">HMR 동기화 · 코드 변경 즉시 반영</Badge>
          </Group>
          <Button size="xs" variant="light" leftSection={<IconCopy size={14} />}
            onClick={() => copy(themeInstruction(), "theme")}>
            {copied === "theme" ? "복사됨!" : "테마 지시문 복사"}
          </Button>
        </Group>

        <ScrollArea style={{ flex: 1 }}>
          <Box p="lg" maw={1100} mx="auto">
            <Group justify="space-between" align="flex-start" mb="xs">
              <div>
                <Title order={2} fz="xl">{story.title}</Title>
                {story.file && <Code>{story.file}</Code>}
              </div>
              <Button size="xs" variant="light" leftSection={<IconCopy size={14} />}
                onClick={() => copy(componentInstruction(), "comp")}>
                {copied === "comp" ? "복사됨!" : "이 컴포넌트 지시문 복사"}
              </Button>
            </Group>
            {story.desc && <Text size="sm" c="dimmed" mb="md">{story.desc}</Text>}

            {/* 노브 컨트롤 */}
            {story.knobs && story.knobs.length > 0 && (
              <Paper withBorder radius="md" p="sm" mb="md" bg="var(--mantine-color-default-hover)">
                <Group gap="lg">
                  {story.knobs.map((kb) => <KnobControl key={kb.key} knob={kb} value={k[kb.key]} onChange={(v) => setKnob(kb.key, v)} />)}
                </Group>
              </Paper>
            )}

            {/* 라이브 프리뷰 캔버스 (프리셋/라운드/스킴 적용된 프리뷰 테마) */}
            <Box style={{ border: "1px solid var(--mantine-color-default-border)", borderRadius: 12, overflow: "hidden" }}>
              <MantineProvider theme={previewTheme} forceColorScheme={scheme} cssVariablesSelector=".catalog-canvas" classNamesPrefix="kw-dash">
                <Box className="catalog-canvas" p="lg"
                  style={{ background: "var(--mantine-color-body)", minHeight: 200 }}>
                  {story.render(k)}
                </Box>
              </MantineProvider>
            </Box>
          </Box>
        </ScrollArea>
      </Stack>
    </Group>
  );
}

function KnobControl({ knob, value, onChange }: { knob: Knob; value: any; onChange: (v: any) => void }) {
  if (knob.type === "select")
    return <Select size="xs" w={160} label={knob.label} value={String(value)} onChange={(v) => v && onChange(v)} allowDeselect={false} data={knob.options} />;
  if (knob.type === "boolean")
    return <Switch size="sm" label={knob.label} checked={!!value} onChange={(e) => onChange(e.currentTarget.checked)} />;
  if (knob.type === "number")
    return <NumberInput size="xs" w={120} label={knob.label} value={value} onChange={(v) => onChange(Number(v))} min={knob.min} max={knob.max} step={knob.step} />;
  return <TextInput size="xs" w={200} label={knob.label} value={value} onChange={(e) => onChange(e.currentTarget.value)} />;
}
