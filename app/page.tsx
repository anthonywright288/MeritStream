const DEMO_TEAM_ID = "75pw8g1f";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-4">
      <h1 className="text-4xl font-bold">MeritStream</h1>
      <p className="text-muted-foreground max-w-md text-center">
        GitHub signals in, weighted USDC splits out, one automated settlement
        on Arc. Every payout links back to the exact commits that earned it.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <a
          href="/create"
          className="bg-primary text-primary-foreground rounded-md px-6 py-2 text-sm font-medium"
        >
          Create a team →
        </a>
        <a
          href={`/team/${DEMO_TEAM_ID}`}
          className="rounded-md border px-6 py-2 text-sm font-medium"
        >
          Live demo team
        </a>
        <a
          href={`/t/${DEMO_TEAM_ID}`}
          className="rounded-md border px-6 py-2 text-sm font-medium"
        >
          Public view
        </a>
      </div>
      <p className="text-muted-foreground text-xs">
        Zero LLM. Deterministic formula. Auditable by anyone.
      </p>
    </main>
  );
}
