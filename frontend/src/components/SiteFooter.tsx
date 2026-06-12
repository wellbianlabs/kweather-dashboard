const MALL_URL = "https://www.kweathermall.co.kr/586";

/** 케이웨더몰 유도 배너 — 사이트 하단, 푸터 바로 위. */
export function MallBanner() {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-2">
      <a
        href={MALL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block overflow-hidden rounded-2xl bg-gradient-to-r from-kw to-kw-sky p-6 text-white shadow-lift transition hover:shadow-xl sm:p-7"
      >
        {/* 장식 웨이브 */}
        <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -right-24 top-6 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/70">KWEATHER MALL</p>
            <p className="mt-1 text-lg font-bold leading-snug sm:text-xl">
              폭염온도계 · 공기측정기 등 더 다양한 케이웨더 제품을 만나보세요
            </p>
            <p className="mt-1 text-sm text-white/80">
              사업장 환경에 맞는 측정·환기 솔루션을 케이웨더몰에서 구매할 수 있습니다.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-kw transition group-hover:translate-x-0.5">
            케이웨더몰 바로가기
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10h12M11 5l5 5-5 5" />
            </svg>
          </span>
        </div>
      </a>
    </div>
  );
}

/** 회사 정보 푸터 — 사업자등록증 기준. */
export function SiteFooter({ withBanner = false }: { withBanner?: boolean }) {
  return (
    <>
      {withBanner && <MallBanner />}
      <footer className="mt-4 border-t border-slate-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <img src="/kweather-logo.png" alt="KWEATHER" className="h-5 opacity-70" />
              <p className="mt-3 text-xs leading-relaxed text-slate-500">
                케이웨더 주식회사 · 대표이사 김동식 · 사업자등록번호 110-81-37628
                <br />
                서울특별시 구로구 디지털로26길 5, 4층 401호 (구로동, 에이스하이엔드타워)
              </p>
            </div>
            <div className="text-xs leading-relaxed text-slate-500 sm:text-right">
              <a href="https://www.kweather.com" target="_blank" rel="noopener noreferrer"
                 className="font-medium text-slate-600 hover:text-kw">
                www.kweather.com
              </a>
              <br />
              <a href={MALL_URL} target="_blank" rel="noopener noreferrer" className="hover:text-kw">
                케이웨더몰 — 제품 구매
              </a>
            </div>
          </div>
          <p className="mt-6 border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-400">
            체감온도계 안전보건 대시보드 · 위험단계 기준(체감온도): 관심 31℃ / 주의 33℃ / 경고 35℃ / 위험 38℃
            <br />
            측정 데이터는 케이웨더 체감온도계 장비로 측정되며, 외부 기상자료 출처는 케이웨더(주)입니다.
            © {new Date().getFullYear()} KWeather Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </>
  );
}
