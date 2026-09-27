/**
 * Generates the digit tokens, demo sentence and speech-shaped noise in public/stimuli.
 * Speech is synthesized with the ElevenLabs text-to-speech API (requires ELEVENLABS_API_KEY);
 * the noise is derived locally from the digit tokens' long-term spectrum.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeRms, speechShapedNoise, trimSilence } from "../src/dsp/stimuli";
import { encodeWav } from "./wav";

const SR = 24000;
const VOICE_ID = process.env.HEARSAY_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
const MODEL = "eleven_multilingual_v2";
const OUT = join(process.cwd(), "public", "stimuli");
export const DIGIT_WORDS: Record<number, string> = { 0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 8: "eight", 9: "nine" };
const SENTENCE =
  "Hi Grandpa! I'm picking you up at four fifteen on Thursday. Bring your blue jacket, and don't forget the pharmacy slip for Doctor Patel.";

async function tts(text: string): Promise<Float32Array> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not set");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=pcm_24000`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.8, similarity_boost: 0.7 } }),
  });
  if (!res.ok) throw new Error(`TTS failed for "${text}": ${res.status} ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const out = new Float32Array(buf.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2) / 32768;
  return out;
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const tokens: Float32Array[] = [];
  const manifest: Record<string, number> = {};
  for (const [digit, word] of Object.entries(DIGIT_WORDS)) {
    const raw = await tts(`${word}.`);
    const tok = normalizeRms(trimSilence(raw, SR));
    tokens.push(tok);
    manifest[digit] = tok.length / SR;
    writeFileSync(join(OUT, `digit-${digit}.wav`), encodeWav(tok, SR));
    console.log(`digit ${digit}: ${(tok.length / SR).toFixed(3)} s`);
  }
  const noise = speechShapedNoise(tokens, 1 << 17, 20261006);
  writeFileSync(join(OUT, "noise.wav"), encodeWav(noise, SR));
  const sentence = normalizeRms(trimSilence(await tts(SENTENCE), SR, -45, 60));
  writeFileSync(join(OUT, "sentence.wav"), encodeWav(sentence, SR));
  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify({ sampleRate: SR, voiceId: VOICE_ID, model: MODEL, generatedAt: new Date().toISOString(), digitDurations: manifest, sentence: SENTENCE }, null, 2) + "\n",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
