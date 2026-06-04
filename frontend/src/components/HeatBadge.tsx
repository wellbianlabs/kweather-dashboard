import type { HeatLevel } from "../types";

export function HeatBadge({ level, size = "md" }: { level: HeatLevel; size?: "sm" | "md" | "lg" }) {
  const pad = size === "lg" ? "px-4 py-1.5 text-base" : size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold text-white ${pad}`}
      style={{ backgroundColor: level.color }}
    >
      {level.label}
    </span>
  );
}
