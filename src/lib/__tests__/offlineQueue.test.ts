import { describe, it, expect, afterEach, vi } from "vitest";
import { isNetworkError } from "@/lib/offlineQueue";

afterEach(() => vi.unstubAllGlobals());

describe("isNetworkError", () => {
  it("treats the browser being offline as a network error regardless of err", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(isNetworkError(new Error("anything"))).toBe(true);
    expect(isNetworkError(null)).toBe(true);
  });

  it("recognizes fetch/network failure messages when online", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkError(new Error("NetworkError when attempting to fetch resource"))).toBe(true);
    expect(isNetworkError(new Error("Load failed"))).toBe(true);
    expect(isNetworkError(new Error("request timeout"))).toBe(true);
  });

  it("does NOT treat real server rejections as network errors when online", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(isNetworkError(new Error("new row violates row-level security policy"))).toBe(false);
    expect(isNetworkError(new Error("duplicate key value violates unique constraint"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});
