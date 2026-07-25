import { describe, expect, it } from "vitest";
import {
  WrongAppError,
  probeApp,
  resolveMeritStreamBase,
} from "./detect-meritstream-base";

const jsonRes = (body: unknown, status = 404) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const htmlRes = () =>
  new Response("<!DOCTYPE html><html><title>TokenGate</title></html>", {
    status: 404,
    headers: { "content-type": "text/html" },
  });

describe("probeApp identity check (regression: 2026-07-25 wrong-app-on-3000)", () => {
  it("recognizes MeritStream by its JSON not-found shape", async () => {
    const r = await probeApp("http://x", async () => jsonRes({ error: "team not found" }));
    expect(r).toBe("meritstream");
  });

  it("flags a foreign app serving HTML instead of JSON", async () => {
    expect(await probeApp("http://x", async () => htmlRes())).toBe("wrong-app");
  });

  it("flags unreachable server as down, not wrong-app", async () => {
    const r = await probeApp("http://x", async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(r).toBe("down");
  });
});

describe("resolveMeritStreamBase fail-fast", () => {
  it("explicit base hitting a foreign app -> WrongAppError with clear message", async () => {
    await expect(
      resolveMeritStreamBase("http://localhost:3000", async () => htmlRes()),
    ).rejects.toThrow(WrongAppError);
    await expect(
      resolveMeritStreamBase("http://localhost:3000", async () => htmlRes()),
    ).rejects.toThrow(/found a different app.*another dev server/is);
  });

  it("no explicit base -> scans candidates and returns the genuine one", async () => {
    // 3000 = foreign app (the TokenGate scenario), 3002 = MeritStream
    const fake = async (url: string) =>
      url.startsWith("http://localhost:3002")
        ? jsonRes({ error: "team not found" })
        : htmlRes();
    const base = await resolveMeritStreamBase(undefined, fake, [
      "http://localhost:3000",
      "http://localhost:3002",
    ]);
    expect(base).toBe("http://localhost:3002");
  });

  it("nothing found -> error names the foreign apps it saw", async () => {
    await expect(
      resolveMeritStreamBase(undefined, async () => htmlRes(), [
        "http://localhost:3000",
      ]),
    ).rejects.toThrow(/Found OTHER apps at: http:\/\/localhost:3000/);
  });
});
