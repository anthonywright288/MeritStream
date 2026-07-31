"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * [RT-H4] Admin token lives in sessionStorage (cleared when the tab closes),
 * NEVER localStorage — limits the XSS-to-token-theft blast radius (v1 risk
 * accepted; v2 = server-side sessions). Disabling while running is UX only;
 * the server-side claim [RT-C3] is the real double-settle guard.
 */
export function SettleNowButton({
  teamId,
  onSettled,
}: {
  teamId: string;
  onSettled: () => void;
}) {
  const [token, setToken] = useState(
    () => (typeof window !== "undefined" ? sessionStorage.getItem("ms-admin-token") ?? "" : ""),
  );
  const [askToken, setAskToken] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const settle = async () => {
    if (!token) return setAskToken(true);
    setRunning(true);
    setMessage(null);
    try {
      sessionStorage.setItem("ms-admin-token", token);
      const res = await fetch(`/api/teams/${teamId}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ force: true }),
      });
      const json = await res.json();
      if (res.status === 401) setMessage("Unauthorized: wrong admin token");
      else if (json.status === "insufficient_funds")
        setMessage(`Insufficient funds: short by ${json.shortfallBaseUnits} base units. Nothing was paid.`);
      else if (json.status === "paid") setMessage(`Settled ✓ paid ${json.result?.paid} member(s)`);
      else setMessage(`${json.status}: ${json.detail ?? JSON.stringify(json.result ?? "")}`);
      onSettled();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "settle failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {askToken && (
          <Input
            type="password"
            placeholder="admin token"
            className="w-56 font-mono text-xs"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        )}
        <Button size="lg" className="px-5" onClick={settle} disabled={running}>
          {running ? "Settling…" : "Settle now"}
        </Button>
      </div>
      {message && <p className="font-mono text-xs">{message}</p>}
    </div>
  );
}
