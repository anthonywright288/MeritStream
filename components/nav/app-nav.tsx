"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

/**
 * App nav — sticky glass bar for the functional area (create, dashboard,
 * history). Mounted once in the (app) route-group layout; reads the current
 * team id from route params (works at layout level via useParams). The team
 * id renders as a mono chip (design §2: identifiers always in IBM Plex Mono).
 *
 * On the public /t/[teamId] transparency page it renders nothing: that page
 * is shareable and must not surface admin navigation (PRD 4.4).
 */
export function AppNav() {
  const params = useParams<{ id?: string; teamId?: string }>();
  const pathname = usePathname();

  // Public read-only view stays chrome-free.
  if (pathname.startsWith("/t/")) return null;

  // /team/[id]/... exposes `id`; /t/[teamId] exposes `teamId` (handled above).
  const teamId = typeof params.id === "string" ? params.id : undefined;

  return (
    <header className="sticky top-0 z-40 border-b border-(--border-subtle) bg-(--surface-strong) shadow-[inset_0_1px_0_#ffffffe6] backdrop-blur-xl backdrop-saturate-125">
      <nav
        aria-label="App"
        className="mx-auto flex h-14 w-full max-w-[1180px] items-center gap-5 px-4"
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-(--fg-primary)"
        >
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full bg-indigo-500 shadow-[0_0_14px_var(--accent-glow)]"
          />
          MeritStream
          <span className="rounded-full border border-(--pill-border) bg-(--pill-bg) px-2 py-0.5 font-mono text-[10px] font-semibold tracking-[0.12em] text-(--pill-fg) uppercase">
            app
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1 text-sm font-medium">
          {teamId && (
            <div className="hidden items-center gap-1 sm:flex">
              <Link
                href={`/team/${teamId}`}
                className="rounded-(--radius-control) px-3 py-1.5 text-(--fg-secondary) transition-colors duration-(--dur-fast) hover:bg-(--surface-hover) hover:text-(--fg-primary)"
              >
                Dashboard
              </Link>
              <Link
                href={`/team/${teamId}/history`}
                className="rounded-(--radius-control) px-3 py-1.5 text-(--fg-secondary) transition-colors duration-(--dur-fast) hover:bg-(--surface-hover) hover:text-(--fg-primary)"
              >
                History
              </Link>
              <Link
                href={`/t/${teamId}`}
                className="rounded-(--radius-control) px-3 py-1.5 text-(--fg-secondary) transition-colors duration-(--dur-fast) hover:bg-(--surface-hover) hover:text-(--fg-primary)"
              >
                Public view
              </Link>
              <span className="mx-2 hidden font-mono text-xs text-(--fg-tertiary) lg:inline">
                {teamId}
              </span>
            </div>
          )}
          <Link
            href="/create"
            className="inline-flex h-8 items-center rounded-(--radius-control) border border-black/10 bg-primary px-3 text-sm font-semibold text-primary-foreground shadow-[0_18px_34px_-24px_rgba(50,56,159,.9),inset_0_1px_0_rgba(255,255,255,.2)] transition-[translate,background-color] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-indigo-500 active:translate-y-0"
          >
            New team
          </Link>
        </div>
      </nav>
    </header>
  );
}
