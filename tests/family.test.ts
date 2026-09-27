import { describe, expect, it } from "vitest";
import { compareGroup, median, type Member } from "../src/engine/family";
import { demoFamily } from "../src/storage";

const mk = (id: string, srt: number, sd = 1): Member => ({
  id,
  name: id,
  estimate: { srt, sd, lo90: srt - 1.645 * sd, hi90: srt + 1.645 * sd, trials: 12 },
  takenAt: "2026-01-01T00:00:00Z",
  device: "d",
});

describe("family comparison", () => {
  it("computes medians", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  it("needs at least two people", () => {
    expect(compareGroup([mk("a", -10)])[0].verdict).toBe("too-few");
  });
  it("flags only the clear outlier", () => {
    const rows = compareGroup([mk("a", -11), mk("b", -10), mk("c", -9.5), mk("grandpa", -3)]);
    expect(rows.map((r) => r.verdict)).toEqual(["similar", "similar", "similar", "harder"]);
    expect(rows[3].delta).toBeCloseTo(7);
  });
  it("does not flag small gaps even with tight intervals", () => {
    const rows = compareGroup([mk("a", -10, 0.2), mk("b", -8, 0.2)]);
    expect(rows.every((r) => r.verdict === "similar")).toBe(true);
  });
  it("does not flag larger gaps when both measurements are too uncertain", () => {
    const rows = compareGroup([mk("a", -10, 3), mk("b", -5, 3)]);
    expect(rows.every((r) => r.verdict === "similar")).toBe(true);
  });
  it("is invariant to a shared device offset", () => {
    const base = [mk("a", -11), mk("b", -10), mk("c", -3)];
    const shifted = base.map((m) => mk(m.id, m.estimate.srt + 6.5));
    expect(compareGroup(shifted).map((r) => r.verdict)).toEqual(compareGroup(base).map((r) => r.verdict));
  });
  it("flags Grandpa in the synthetic demo family", () => {
    const rows = compareGroup(demoFamily());
    expect(rows.filter((r) => r.verdict === "harder").map((r) => r.member.name)).toEqual(["Grandpa (synthetic)"]);
  });
});
