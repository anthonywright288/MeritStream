import { AppNav } from "@/components/nav/app-nav";

/**
 * (app) route group — functional area (create, team dashboard, history,
 * public team view). AppNav reads the team id from route params and hides
 * itself on the public /t/[teamId] page. URL space is unchanged (groups are
 * invisible in URLs).
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
