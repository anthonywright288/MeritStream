import { AppearObserver } from "@/components/marketing/appear-observer";
import { MarketingNav } from "@/components/nav/marketing-nav";

/**
 * (marketing) route group — public landing area. Floating glass nav, no app
 * chrome, no wallet-related code. URL space is unchanged (groups are
 * invisible in URLs).
 */
export default function MarketingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AppearObserver />
      <MarketingNav />
      {children}
    </>
  );
}
