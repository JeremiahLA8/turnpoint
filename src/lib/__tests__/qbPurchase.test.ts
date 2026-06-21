import { describe, it, expect } from "vitest";
import {
  buildPurchasePayload,
  mapMethodToPaymentType,
  qbEscape,
  type PayoutForBooking,
  type PurchaseRefs,
} from "../../../supabase/functions/_shared/qb";

const refs: PurchaseRefs = {
  paymentAccountRef: { value: "35", name: "Initiate Business Checking" },
  expenseAccountRef: { value: "92", name: "Cleaning - Crew" },
  classRef: { value: "7", name: "Cleaning Ops" },
  vendorRef: { value: "12", name: "Cleans By Maria" },
  customerRef: { value: "44", name: "Birch Street House LLC" },
};

const payout: PayoutForBooking = {
  jobId: "job-abc",
  amountCents: 33000,
  method: "zelle",
  paidAtISO: "2026-06-18T19:00:00.000Z",
  cleanerName: "Cleans By Maria",
  propertyLabel: "Birch Street House",
  cleanDateISO: "2026-06-16T17:00:00.000Z",
};

describe("mapMethodToPaymentType", () => {
  it("maps check to Check", () => {
    expect(mapMethodToPaymentType("check")).toBe("Check");
  });
  it("maps card-ish methods to CreditCard", () => {
    expect(mapMethodToPaymentType("creditcard")).toBe("CreditCard");
    expect(mapMethodToPaymentType("card")).toBe("CreditCard");
  });
  it("defaults electronic + unknown methods to Cash", () => {
    for (const m of ["zelle", "venmo", "quickbooks", "cash", "other", "", null, undefined]) {
      expect(mapMethodToPaymentType(m)).toBe("Cash");
    }
  });
  it("is case-insensitive", () => {
    expect(mapMethodToPaymentType("Check")).toBe("Check");
  });
});

describe("qbEscape", () => {
  it("escapes single quotes for QB query literals", () => {
    expect(qbEscape("O'Brien's")).toBe("O\\'Brien\\'s");
  });
});

describe("buildPurchasePayload", () => {
  it("books the amount in dollars to the expense account with class + customer", () => {
    const p = buildPurchasePayload(payout, refs) as any;
    expect(p.PaymentType).toBe("Cash"); // zelle -> Cash
    expect(p.AccountRef).toEqual(refs.paymentAccountRef);
    expect(p.TotalAmt).toBe(330);
    expect(p.TxnDate).toBe("2026-06-18"); // date paid, not the clean date
    expect(p.Line).toHaveLength(1);
    const detail = p.Line[0].AccountBasedExpenseLineDetail;
    expect(p.Line[0].Amount).toBe(330);
    expect(detail.AccountRef).toEqual(refs.expenseAccountRef);
    expect(detail.ClassRef).toEqual(refs.classRef);
    expect(detail.CustomerRef).toEqual(refs.customerRef);
    expect(detail.BillableStatus).toBe("NotBillable"); // reimbursement handled separately
  });

  it("sets the vendor (payee) via EntityRef", () => {
    const p = buildPurchasePayload(payout, refs) as any;
    expect(p.EntityRef).toEqual({ value: "12", name: "Cleans By Maria", type: "Vendor" });
  });

  it("stamps the cleanos job id into the private note for traceability", () => {
    const p = buildPurchasePayload(payout, refs) as any;
    expect(p.PrivateNote).toContain("[cleanos job job-abc]");
    expect(p.PrivateNote).toContain("Cleans By Maria");
  });

  it("omits ClassRef when class tracking is off (classRef null)", () => {
    const p = buildPurchasePayload(payout, { ...refs, classRef: null }) as any;
    expect(p.Line[0].AccountBasedExpenseLineDetail.ClassRef).toBeUndefined();
  });

  it("omits customer + vendor refs when not resolved", () => {
    const p = buildPurchasePayload(payout, {
      ...refs,
      customerRef: null,
      vendorRef: null,
    }) as any;
    expect(p.Line[0].AccountBasedExpenseLineDetail.CustomerRef).toBeUndefined();
    expect(p.Line[0].AccountBasedExpenseLineDetail.BillableStatus).toBeUndefined();
    expect(p.EntityRef).toBeUndefined();
  });

  it("rounds half-cent amounts to the nearest cent before dollar conversion", () => {
    const p = buildPurchasePayload({ ...payout, amountCents: 12345 }, refs) as any;
    expect(p.TotalAmt).toBe(123.45);
  });
});
