export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">MeritStream</h1>
      <p className="text-muted-foreground">
        GitHub signals in, weighted USDC splits out, one batch settlement.
      </p>
      <a
        href="/create"
        className="bg-primary text-primary-foreground rounded-md px-6 py-2 text-sm font-medium"
      >
        Create a team →
      </a>
    </main>
  );
}
