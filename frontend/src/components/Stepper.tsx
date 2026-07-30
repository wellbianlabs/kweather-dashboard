import { Stepper as MantineStepper } from "@mantine/core";

export type Step = 1 | 2 | 3 | 4;

const STEPS: { label: string; desc: string }[] = [
  { label: "계정", desc: "회원가입 / 로그인" },
  { label: "사업장·기기 등록", desc: "회사 · 장소 · 기기명" },
  { label: "데이터 업로드", desc: "TXT 파일" },
  { label: "대시보드", desc: "분석 · 리포트" },
];

export function Stepper({
  current,
  onJump,
  canDashboard,
}: {
  current: Step;
  onJump: (s: Step) => void;
  canDashboard: boolean;
}) {
  return (
    <MantineStepper
      active={current - 1}
      onStepClick={(i) => onJump((i + 1) as Step)}
      size="sm"
      iconSize={28}
    >
      {STEPS.map((s, i) => {
        const n = (i + 1) as Step;
        // 로그인 이후 2·3단계는 자유 이동, 4단계(대시보드)는 데이터가 있을 때만, 1단계(계정)는 선택 불가
        const allow = n === 2 || n === 3 || (n === 4 && canDashboard);
        return (
          <MantineStepper.Step
            key={s.label}
            label={s.label}
            description={s.desc}
            allowStepSelect={allow}
          />
        );
      })}
    </MantineStepper>
  );
}
