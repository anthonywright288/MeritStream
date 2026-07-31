"use client";

import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CreateResult {
  teamId: string;
  poolAddress: string;
  adminToken: string;
}

/** Shown once after create — the admin token never appears again. */
export function CreateSuccess({ result }: { result: CreateResult }) {
  const [copied, setCopied] = useState<"token" | "address" | null>(null);

  const copy = async (what: "token" | "address", text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Team created 🎉</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium">Fund the pool — send test USDC (Arc) to:</p>
          <div className="flex items-center gap-4">
            <QRCodeSVG value={result.poolAddress} size={112} />
            <div className="space-y-2">
              <code className="block break-all text-xs">{result.poolAddress}</code>
              <Button size="sm" variant="outline" onClick={() => copy("address", result.poolAddress)}>
                {copied === "address" ? "Copied ✓" : "Copy address"}
              </Button>
            </div>
          </div>
        </div>
        <div className="rounded-(--radius-control) border border-(--border-warning) bg-(--surface-warning) p-4">
          <p className="mb-2 text-sm font-semibold">
            ⚠️ Admin token — save it NOW. It is shown only this once and cannot be recovered.
          </p>
          <code className="block break-all text-xs">{result.adminToken}</code>
          <Button size="sm" className="mt-2" onClick={() => copy("token", result.adminToken)}>
            {copied === "token" ? "Copied ✓" : "Copy token"}
          </Button>
        </div>
        <Link
          href={`/team/${result.teamId}`}
          className={cn(buttonVariants({ variant: "default" }), "w-full")}
        >
          Go to dashboard →
        </Link>
      </CardContent>
    </Card>
  );
}
