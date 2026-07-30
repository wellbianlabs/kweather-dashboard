// 이식: Mantine UI "Stats grid" (ui.mantine.dev, MIT) — 콘텐츠=폭염 KPI, 색=안전 의미(상승=red)
import {
  IconActivity, IconArrowDownRight, IconArrowUpRight, IconClockHour4, IconDroplet, IconTemperature,
} from "@tabler/icons-react";
import { Group, Paper, SimpleGrid, Text } from "@mantine/core";
import classes from "./StatsGrid.module.css";

const data = [
  { title: "최고 체감온도", icon: IconTemperature, value: "38.6℃", diff: 4 },
  { title: "최고 온도", icon: IconActivity, value: "36.2℃", diff: 3 },
  { title: "33℃↑ 누적", icon: IconClockHour4, value: "210분", diff: 22 },
  { title: "평균 습도", icon: IconDroplet, value: "68%", diff: -5 },
] as const;

export function StatsGrid() {
  const stats = data.map((stat) => {
    const Icon = stat.icon;
    // 폭염: 값 상승(diff>0)이 '나쁨' → red, 하락은 teal
    const DiffIcon = stat.diff > 0 ? IconArrowUpRight : IconArrowDownRight;
    return (
      <Paper withBorder p="md" radius="md" key={stat.title}>
        <Group justify="space-between">
          <Text size="xs" c="dimmed" className={classes.title}>{stat.title}</Text>
          <Icon className={classes.icon} size={22} stroke={1.5} />
        </Group>
        <Group align="flex-end" gap="xs" mt={25}>
          <Text className={classes.value}>{stat.value}</Text>
          <Text c={stat.diff > 0 ? "red" : "teal"} fz="sm" fw={500} className={classes.diff}>
            <span>{stat.diff}%</span>
            <DiffIcon size={16} stroke={1.5} />
          </Text>
        </Group>
        <Text fz="xs" c="dimmed" mt={7}>전일 대비</Text>
      </Paper>
    );
  });
  return <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>{stats}</SimpleGrid>;
}
