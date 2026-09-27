import { writeFileSync } from "node:fs";
import { DEFAULT_SIM, METHODS, simulate } from "../src/engine/simulate";

const slopes = [0.5, 0.7, 1.0];
const rows: Record<string, unknown>[] = [];
for (const trueSlope of slopes) {
  for (const [key, make] of Object.entries(METHODS)) {
    const s = simulate(make, { ...DEFAULT_SIM, trueSlope });
    rows.push({ key, method: s.method, trueSlope, rmse: s.rmse, bias: s.bias, meanTrials: s.meanTrials, coverage90: s.coverage90, retestSd: s.retestSd });
    console.log(
      `${s.method.padEnd(22)} slope=${trueSlope} RMSE=${s.rmse.toFixed(2)} dB bias=${s.bias.toFixed(2)} trials=${s.meanTrials.toFixed(1)} cover90=${(s.coverage90 * 100).toFixed(0)}% retestSD=${s.retestSd.toFixed(2)}`,
    );
  }
}
writeFileSync("docs/validation.json", JSON.stringify({ config: DEFAULT_SIM, slopes, rows }, null, 2) + "\n");
