import { describe, expect, it } from "vitest";
import { getScheduleForCreditTier } from "../../src/services/payment_schedule_entry_service.js";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const serviceStart = new Date("2026-01-05T00:00:00.000Z");

describe("payment schedule entry service", () => {
  it("creates one rental payment and a licence deadline for Normal", () => {
    const entries = getScheduleForCreditTier({
      creditTier: "Normal",
      rentalAmount: 100,
      addonAmount: 25,
      createdAt,
      serviceStart,
    });

    expect(entries).toHaveLength(2);
    expect(entries.find((entry) => entry.type === "PAYMENT")).toMatchObject({
      paymentPart: "FULL_PAYMENT",
      amount: 125,
      dueAt: new Date("2026-01-02T00:00:00.000Z"),
    });
  });

  it("keeps add-ons out of the Caution deposit", () => {
    const entries = getScheduleForCreditTier({
      creditTier: "Caution",
      rentalAmount: 100,
      addonAmount: 25,
      createdAt,
      serviceStart,
    });

    expect(entries.filter((entry) => entry.type === "PAYMENT").map((entry) => entry.amount))
      .toEqual([30, 95]);
  });

  it("requires immediate full payment for High Risk", () => {
    const entries = getScheduleForCreditTier({
      creditTier: "High Risk",
      rentalAmount: 100,
      addonAmount: 25,
      createdAt,
      serviceStart,
    });

    expect(entries.find((entry) => entry.paymentPart === "FULL_PAYMENT")).toMatchObject({
      amount: 125,
      dueAt: createdAt,
    });
  });
});
