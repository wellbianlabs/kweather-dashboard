import { Badge } from "@mantine/core";
import type { HeatLevel } from "../types";

export function HeatBadge({ level, size = "md" }: { level: HeatLevel; size?: "sm" | "md" | "lg" }) {
  return (
    <Badge
      size={size}
      radius="xl"
      styles={{
        root: {
          backgroundColor: level.color,
          color: "#fff",
          fontWeight: 700,
          fontSize: size === "lg" ? "1rem" : undefined,
        },
      }}
    >
      {level.label}
    </Badge>
  );
}
