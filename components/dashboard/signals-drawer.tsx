"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface CommitItem {
  sha: string;
  html_url: string;
  message: string;
}
interface PrItem {
  number: number;
  html_url: string;
  merged_at: string;
}

/** The audit-trail drawer: every counted signal links to its GitHub page. */
export function SignalsDrawer({
  username,
  commits,
  prs,
}: {
  username: string;
  commits: CommitItem[];
  prs: PrItem[];
}) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="sm">Signals</Button>} />
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>@{username} · counted signals</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-8">
          <div>
            <h3 className="mb-1 text-sm font-semibold">Commits ({commits.length})</h3>
            {commits.length === 0 && <p className="text-muted-foreground text-xs">None in window</p>}
            <ul className="space-y-1">
              {commits.map((c) => (
                <li key={c.sha} className="text-xs">
                  <a href={c.html_url} target="_blank" rel="noreferrer" className="text-(--fg-accent) hover:underline">
                    <code>{c.sha.slice(0, 8)}</code>
                  </a>{" "}
                  {c.message.split("\n")[0].slice(0, 60)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-sm font-semibold">Merged PRs ({prs.length})</h3>
            {prs.length === 0 && <p className="text-muted-foreground text-xs">None in window</p>}
            <ul className="space-y-1">
              {prs.map((p) => (
                <li key={p.number} className="text-xs">
                  <a href={p.html_url} target="_blank" rel="noreferrer" className="text-(--fg-accent) hover:underline">
                    #{p.number}
                  </a>{" "}
                  merged {new Date(p.merged_at).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
