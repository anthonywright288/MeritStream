import { describe, expect, it } from "vitest";
import { generateToken, hashToken, verifyToken } from "./admin-token";

describe("admin token", () => {
  it("round-trips: generated token verifies against its own hash", () => {
    const token = generateToken();
    expect(token).toHaveLength(64); // 32 bytes hex
    expect(verifyToken(token, hashToken(token))).toBe(true);
  });

  it("rejects a wrong token", () => {
    const hash = hashToken(generateToken());
    expect(verifyToken(generateToken(), hash)).toBe(false);
    expect(verifyToken("", hash)).toBe(false);
  });

  it("two generated tokens differ", () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});
