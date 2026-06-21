import { describe, it, expect } from "vitest";
import {
  amountToDecimalString,
  transferIdempotencyKey,
  transferTopicToStatus,
  signWebhookBody,
  verifyWebhookSignature,
} from "../../../supabase/functions/_shared/dwolla";

describe("amountToDecimalString", () => {
  it("converts cents to a 2-decimal dollar string", () => {
    expect(amountToDecimalString(20000)).toBe("200.00");
    expect(amountToDecimalString(12345)).toBe("123.45");
    expect(amountToDecimalString(5)).toBe("0.05");
    expect(amountToDecimalString(0)).toBe("0.00");
  });
  it("rounds half-cents to the nearest cent", () => {
    expect(amountToDecimalString(12345.6)).toBe("123.46");
  });
  it("rejects negative or non-finite amounts", () => {
    expect(() => amountToDecimalString(-1)).toThrow();
    expect(() => amountToDecimalString(NaN)).toThrow();
  });
});

describe("transferIdempotencyKey", () => {
  it("is stable per payout so retries never double-send", () => {
    expect(transferIdempotencyKey("abc")).toBe("payout-abc");
    expect(transferIdempotencyKey("abc")).toBe(transferIdempotencyKey("abc"));
    expect(transferIdempotencyKey("abc")).not.toBe(transferIdempotencyKey("def"));
  });
});

describe("transferTopicToStatus", () => {
  it("maps the common transfer topics", () => {
    expect(transferTopicToStatus("transfer_completed")).toBe("processed");
    expect(transferTopicToStatus("transfer_failed")).toBe("failed");
    expect(transferTopicToStatus("transfer_cancelled")).toBe("cancelled");
    expect(transferTopicToStatus("transfer_returned")).toBe("returned");
    expect(transferTopicToStatus("transfer_created")).toBe("pending");
  });
  it("handles customer_* transfer variants", () => {
    expect(transferTopicToStatus("customer_transfer_completed")).toBe("processed");
    expect(transferTopicToStatus("customer_bank_transfer_failed")).toBe("failed");
  });
  it("ignores non-transfer topics", () => {
    expect(transferTopicToStatus("customer_created")).toBeNull();
    expect(transferTopicToStatus("funding_source_added")).toBeNull();
  });
});

describe("webhook signature", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ topic: "transfer_completed", resourceId: "xyz" });

  it("verifies a correctly signed body", async () => {
    const sig = await signWebhookBody(secret, body);
    expect(await verifyWebhookSignature(secret, body, sig)).toBe(true);
  });
  it("rejects a tampered body", async () => {
    const sig = await signWebhookBody(secret, body);
    expect(await verifyWebhookSignature(secret, body + " ", sig)).toBe(false);
  });
  it("rejects a wrong secret", async () => {
    const sig = await signWebhookBody(secret, body);
    expect(await verifyWebhookSignature("whsec_other", body, sig)).toBe(false);
  });
  it("rejects a missing signature header", async () => {
    expect(await verifyWebhookSignature(secret, body, null)).toBe(false);
  });
});
