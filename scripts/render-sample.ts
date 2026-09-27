/** Renders a sample antiphasic triplet to a stereo WAV (used for the demo video). Usage: vite-node scripts/render-sample.ts out.wav 5 2 8 -2 */
import { readFileSync, writeFileSync } from "node:fs";
import { mixTriplet } from "../src/audio/mix";

function readWav(path: string): Float32Array {
  const b = readFileSync(path);
  const n = b.readUInt32LE(40) / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(44 + i * 2) / 32768;
  return out;
}

const [out, a, b, c, snr] = process.argv.slice(2);
const sr = 24000;
const m = mixTriplet([a, b, c].map((d) => readWav(`public/stimuli/digit-${d}.wav`)), readWav("public/stimuli/noise.wav"), { sampleRate: sr, snr: Number(snr), antiphasic: true });
const buf = Buffer.alloc(44 + m.left.length * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + m.left.length * 4, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(sr, 24);
buf.writeUInt32LE(sr * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(m.left.length * 4, 40);
for (let i = 0; i < m.left.length; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, m.left[i])) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, m.right[i])) * 32767), 46 + i * 4);
}
writeFileSync(out, buf);
