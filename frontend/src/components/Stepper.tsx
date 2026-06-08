export type Step = 1 | 2 | 3;

const STEPS: { n: Step; label: string; desc: string }[] = [
  { n: 1, label: "계정", desc: "회원가입 / 로그인" },
  { n: 2, label: "데이터 업로드", desc: "기기정보 · CSV 업로드" },
  { n: 3, label: "대시보드", desc: "분석 · 리포트" },
];

export function Stepper({
  current, onJump, canDashboard,
}: { current: Step; onJump: (s: Step) => void; canDashboard: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        const clickable = s.n === 2 || (s.n === 3 && canDashboard);
        return (
          <div key={s.n} className="flex items-center">
            <button
              disabled={!clickable}
              onClick={() => clickable && onJump(s.n)}
              className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition ${
                clickable ? "hover:bg-slate-100" : "cursor-default"
              }`}
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                done ? "bg-emerald-500 text-white"
                : active ? "bg-blue-600 text-white"
                : "bg-slate-200 text-slate-500"
              }`}>
                {done ? "✓" : s.n}
              </span>
              <span className="hidden sm:block">
                <span className={`block text-xs font-semibold ${active ? "text-slate-900" : "text-slate-500"}`}>{s.label}</span>
                <span className="block text-[10px] text-slate-400">{s.desc}</span>
              </span>
            </button>
            {i < STEPS.length - 1 && <div className="mx-1 h-px w-4 bg-slate-300 sm:w-8" />}
          </div>
        );
      })}
    </div>
  );
}
