import type { Member } from "./engine/family";

const KEY = "hearsay.members.v1";

export function loadMembers(): Member[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Member[]) : [];
  } catch {
    return [];
  }
}

export function saveMembers(members: Member[]): void {
  localStorage.setItem(KEY, JSON.stringify(members));
}

/** Clearly labelled synthetic demo family, generated from the simulator — not real people. */
export function demoFamily(): Member[] {
  const now = new Date().toISOString();
  const mk = (id: string, name: string, srt: number, sd: number, trials: number): Member => ({
    id,
    name,
    estimate: { srt, sd, lo90: srt - 1.645 * sd, hi90: srt + 1.645 * sd, trials },
    takenAt: now,
    device: "Demo laptop + wired earbuds (synthetic)",
  });
  return [
    mk("demo-sharon", "Sharon (synthetic)", -11.2, 1.1, 12),
    mk("demo-mom", "Mom (synthetic)", -10.4, 1.2, 11),
    mk("demo-dad", "Dad (synthetic)", -9.6, 1.2, 12),
    mk("demo-grandpa", "Grandpa (synthetic)", -3.1, 1.3, 13),
  ];
}
