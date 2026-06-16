import { useState } from "react";
import { api, setToken } from "../api";
import type { AuthData } from "../types";
import { SiteFooter } from "./SiteFooter";
import {
  Alert,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconAlertTriangle } from "@tabler/icons-react";

export function AuthScreen({ onAuthed }: { onAuthed: (a: AuthData) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: { email: "", password: "", company: "" },
    validate: {
      // email/password 는 mode 와 무관 → 안정적 클로저로 검증
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "올바른 이메일 형식을 입력하세요."),
      password: (v) => (v.length >= 4 ? null : "비밀번호는 4자 이상이어야 합니다."),
    },
  });

  // mode 의존 검증(회사명)은 최신 mode 를 캡처하도록 제출 핸들러에서 처리
  const handleSubmit = form.onSubmit(async (values) => {
    if (mode === "signup" && !values.company.trim()) {
      form.setFieldError("company", "회사명 / 사업장명을 입력하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const auth =
        mode === "login"
          ? await api.login(values.email, values.password)
          : await api.signup(values.email, values.password, values.company);
      setToken(auth.token);
      onAuthed(auth);
    } catch (err: any) {
      setError(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  });

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      setToken("demo-key");
      onAuthed(await api.me());
    } catch (err: any) {
      setError("데모 로그인 실패: " + String(err?.message || err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f7f8fa" }}>
      <Center style={{ flex: 1 }} px="md" py={40}>
        <Box w="100%" maw={420}>
          <Stack gap={6} align="center" mb="xl">
            <img src="/kweather-logo.png" alt="KWEATHER" style={{ height: 36 }} />
            <Title order={1} ta="center" mt="sm" fz={21} fw={700} c="#0f172a">
              체감온도계 데이터 분석 프로그램
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              폭염·체감온도 데이터 분석 및 안전관리
            </Text>
            <Badge color="teal" variant="light" size="lg" radius="xl" mt={6}>
              케이웨더 단말기 이용자 전용 · 평생 무료
            </Badge>
          </Stack>

          <Paper radius="xl" p="xl" shadow="md" withBorder>
            <SegmentedControl
              fullWidth
              radius="md"
              mb="lg"
              value={mode}
              onChange={(v) => {
                setMode(v as "login" | "signup");
                setError(null);
              }}
              data={[
                { label: "로그인", value: "login" },
                { label: "회원가입", value: "signup" },
              ]}
            />

            <form onSubmit={handleSubmit}>
              <Stack gap="sm">
                {mode === "signup" && (
                  <TextInput
                    label="회사명 / 사업장명"
                    placeholder="(주)한국제강"
                    withAsterisk
                    {...form.getInputProps("company")}
                  />
                )}
                <TextInput
                  label="이메일"
                  type="email"
                  placeholder="safety@company.com"
                  withAsterisk
                  {...form.getInputProps("email")}
                />
                <PasswordInput
                  label="비밀번호"
                  placeholder="••••••••"
                  withAsterisk
                  {...form.getInputProps("password")}
                />

                {error && (
                  <Alert color="red" variant="light" p="sm" icon={<IconAlertTriangle size={16} />}>
                    {error}
                  </Alert>
                )}

                <Button type="submit" fullWidth size="md" mt={4} loading={busy}>
                  {mode === "login" ? "로그인" : "회원가입하고 시작하기"}
                </Button>
              </Stack>
            </form>

            <Divider my="md" label="또는" labelPosition="center" />

            <Button variant="default" fullWidth size="md" onClick={demo} disabled={busy}>
              데모 계정으로 둘러보기
            </Button>
          </Paper>

          <Text size="xs" c="dimmed" ta="center" mt="md">
            케이웨더 폭염온도계(체감온도계) 단말기 이용자 전용 서비스입니다.
            <br />
            회사별로 격리된 안전한 공간에서 데이터를 관리하며, 단말기 이용자는{" "}
            <Text span fw={700} c="dark.4">
              평생 무료
            </Text>
            로 사용합니다.
          </Text>
        </Box>
      </Center>
      <SiteFooter />
    </Box>
  );
}
