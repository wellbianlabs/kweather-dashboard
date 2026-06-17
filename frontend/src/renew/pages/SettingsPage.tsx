// 설정 페이지 — 테마(라이트/다크) · 폭염 임계값(표시) · 회원정보 수정.
import { useState } from "react";
import {
  Badge, Button, Collapse, Divider, Group, Paper, PasswordInput, SimpleGrid,
  Stack, Switch, Text, TextInput, Title,
  useMantineColorScheme, useComputedColorScheme,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useDashboard } from "../DashboardProvider";
import { api } from "../../api";

const THRESHOLD_LABEL: Record<string, { label: string; color: string }> = {
  caution: { label: "관심", color: "#84cc16" },
  warning: { label: "주의", color: "#eab308" },
  danger: { label: "경고", color: "#f97316" },
  emergency: { label: "위험", color: "#dc2626" },
};

export function SettingsPage() {
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme("light");
  const { kpi, auth, onAuthed } = useDashboard();
  const thresholds = kpi?.thresholds ?? {};

  const [pwOpen, setPwOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const form = useForm({
    initialValues: {
      email: auth?.email ?? "",
      company_name: auth?.company_name ?? "",
      current_password: "",
      new_password: "",
      confirm_password: "",
    },
    validate: {
      company_name: (v) => (v.trim().length ? null : "사업장명을 입력해 주세요."),
      new_password: (v) =>
        pwOpen && v.length > 0 && v.length < 6 ? "새 비밀번호는 6자 이상이어야 합니다." : null,
      confirm_password: (v, values) =>
        pwOpen && values.new_password ? (v === values.new_password ? null : "비밀번호가 일치하지 않습니다.") : null,
      current_password: (v, values) =>
        pwOpen && values.new_password && !v ? "현재 비밀번호를 입력해 주세요." : null,
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    const payload: {
      email?: string; company_name?: string;
      current_password?: string; new_password?: string;
    } = {
      email: values.email.trim(),
      company_name: values.company_name.trim(),
    };
    if (pwOpen && values.new_password) {
      payload.current_password = values.current_password;
      payload.new_password = values.new_password;
    }
    setSaving(true);
    try {
      const updated = await api.updateProfile(payload);
      onAuthed(updated);
      form.setValues({
        email: updated.email ?? "",
        company_name: updated.company_name,
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setPwOpen(false);
      notifications.show({
        color: "teal", title: "저장 완료", message: "회원정보가 수정되었습니다.",
      });
    } catch (e) {
      notifications.show({
        color: "red", title: "저장 실패", message: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  });

  return (
    <Stack gap="md" maw={720}>
      <Paper withBorder radius="lg" p="lg" shadow="xs">
        <Title order={3} fz="md" mb="sm">표시 설정</Title>
        <Group justify="space-between">
          <div>
            <Text fw={600} size="sm">다크 모드</Text>
            <Text size="xs" c="dimmed">사무실(라이트) · 현장(다크) 환경에 맞춰 전환</Text>
          </div>
          <Switch
            size="md"
            checked={computed === "dark"}
            onChange={(e) => setColorScheme(e.currentTarget.checked ? "dark" : "light")}
            aria-label="dark mode"
          />
        </Group>
      </Paper>

      <Paper withBorder radius="lg" p="lg" shadow="xs">
        <Title order={3} fz="md" mb="sm">폭염 위험단계 임계값 (℃)</Title>
        {Object.keys(thresholds).length ? (
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            {Object.entries(thresholds).map(([k, v]) => {
              const meta = THRESHOLD_LABEL[k] ?? { label: k, color: "#64748b" };
              return (
                <Paper key={k} withBorder radius="md" p="md" ta="center">
                  <Badge styles={{ root: { background: meta.color, color: "#fff" } }}>{meta.label}</Badge>
                  <Text fw={700} fz="xl" mt={6}>{v}℃↑</Text>
                </Paper>
              );
            })}
          </SimpleGrid>
        ) : (
          <Text size="sm" c="dimmed">데이터를 불러오면 임계값이 표시됩니다.</Text>
        )}
        <Text size="xs" c="dimmed" mt="sm">※ 임계값은 산업안전보건 기준에 따른 고정값입니다(편집은 추후 제공).</Text>
      </Paper>

      <Paper withBorder radius="lg" p="lg" shadow="xs">
        <Group justify="space-between" mb="sm">
          <Title order={3} fz="md">회원정보 수정</Title>
          {auth?.is_admin && <Badge color="kw" variant="light">관리자 계정</Badge>}
        </Group>
        <form onSubmit={handleSubmit}>
          <Stack gap="sm">
            <TextInput
              label="이메일"
              placeholder="name@example.com"
              {...form.getInputProps("email")}
            />
            <TextInput
              label="사업장명"
              placeholder="사업장명을 입력하세요"
              {...form.getInputProps("company_name")}
            />

            <Divider my={4} />

            <Group justify="space-between">
              <Text fw={600} size="sm">비밀번호 변경</Text>
              <Switch
                size="sm"
                checked={pwOpen}
                onChange={(e) => {
                  const open = e.currentTarget.checked;
                  setPwOpen(open);
                  if (!open) {
                    form.setFieldValue("current_password", "");
                    form.setFieldValue("new_password", "");
                    form.setFieldValue("confirm_password", "");
                  }
                }}
                aria-label="비밀번호 변경"
              />
            </Group>

            <Collapse expanded={pwOpen}>
              <Stack gap="sm">
                <PasswordInput
                  label="현재 비밀번호"
                  {...form.getInputProps("current_password")}
                />
                <PasswordInput
                  label="새 비밀번호"
                  description="6자 이상"
                  {...form.getInputProps("new_password")}
                />
                <PasswordInput
                  label="새 비밀번호 확인"
                  {...form.getInputProps("confirm_password")}
                />
              </Stack>
            </Collapse>

            <Group justify="flex-end" mt="xs">
              <Button type="submit" color="kw" loading={saving}>저장</Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
