import { describe, expect, it } from "vitest";
import { applyReview, deriveStage, newRequest } from "./workflow";

const base = () =>
  newRequest({ vendorName: "XYZ", useCase: "x", team: "Investment pod", portfolioCompany: "", dataSources: "", phiPii: "no" });

describe("vendor review workflow", () => {
  it("new requests start pending with all four leads", () => {
    const r = base();
    expect(deriveStage(r)).toBe("in_review");
    expect(Object.values(r.reviews).every((v) => v.status === "pending")).toBe(true);
  });

  it("status update notifies the group with lead and vendor name", () => {
    const { notices } = applyReview(base(), "finance", "approved");
    expect(notices[0]?.text).toBe("Finance lead approved the XYZ vendor contract");
  });

  it("sends to Ops for execution only once all four leads approve", () => {
    let r = base();
    for (const l of ["compliance", "finance", "it"] as const) r = applyReview(r, l, "approved").request;
    expect(deriveStage(r)).toBe("in_review");
    const out = applyReview(r, "ops", "approved");
    expect(deriveStage(out.request)).toBe("awaiting_execution");
    expect(out.notices.some((n) => n.text.includes("sent to Ops lead for execution"))).toBe(true);
  });

  it("any rejection marks the request rejected", () => {
    const r = applyReview(base(), "it", "rejected").request;
    expect(deriveStage(r)).toBe("rejected");
  });
});
