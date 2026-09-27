import { mixTriplet } from "./mix";
import { AUDIOGRAM_FREQS, type Profile } from "./hearloss";
import type { Digit } from "../engine/triplets";

export class AudioEngine {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  private tokens = new Map<number, Float32Array>();
  private noise = new Float32Array(0);
  private sentence: AudioBuffer | null = null;
  private current: AudioBufferSourceNode | null = null;
  private loaded: Promise<void> | null = null;
  private noiseOffset = 0;

  constructor() {
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }

  load(base = "./stimuli/"): Promise<void> {
    this.loaded ??= (async () => {
      const get = async (name: string) => {
        const res = await fetch(base + name);
        if (!res.ok) throw new Error(`Could not load ${name}`);
        return this.ctx.decodeAudioData(await res.arrayBuffer());
      };
      const digits: Digit[] = [0, 1, 2, 3, 4, 5, 6, 8, 9];
      await Promise.all(digits.map(async (d) => this.tokens.set(d, (await get(`digit-${d}.wav`)).getChannelData(0))));
      this.noise = (await get("noise.wav")).getChannelData(0);
      this.sentence = await get("sentence.wav");
    })();
    return this.loaded;
  }

  setVolume(v: number): void {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  stop(): void {
    try {
      this.current?.stop();
    } catch {
      /* already stopped */
    }
    this.current = null;
  }

  private play(buf: AudioBuffer, dest: AudioNode = this.master): Promise<void> {
    this.stop();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(dest);
    this.current = src;
    return new Promise((resolve) => {
      src.onended = () => resolve();
      src.start();
    });
  }

  async playTriplet(digits: readonly Digit[], snr: number, antiphasic = true, dest?: AudioNode): Promise<void> {
    await this.ctx.resume();
    const mix = mixTriplet(
      digits.map((d) => this.tokens.get(d)!),
      this.noise,
      { sampleRate: this.ctx.sampleRate, snr, antiphasic, noiseOffset: this.noiseOffset },
    );
    this.noiseOffset = (this.noiseOffset + 9973) % Math.max(1, this.noise.length);
    const buf = this.ctx.createBuffer(2, mix.left.length, this.ctx.sampleRate);
    buf.copyToChannel(mix.left, 0);
    buf.copyToChannel(mix.right, 1);
    return this.play(buf, dest);
  }

  /** Three 200 Hz tones; `quiet` is 6 dB softer, `antiphase` is phase-inverted in the right ear. */
  async playHeadphoneTrial(quiet: number, antiphase: number): Promise<void> {
    await this.ctx.resume();
    const sr = this.ctx.sampleRate;
    const toneLen = Math.round(sr * 0.8);
    const gapLen = Math.round(sr * 0.5);
    const len = toneLen * 3 + gapLen * 2;
    const buf = this.ctx.createBuffer(2, len, sr);
    const l = buf.getChannelData(0);
    const r = buf.getChannelData(1);
    for (let t = 0; t < 3; t++) {
      const amp = 0.3 * (t === quiet ? 0.5 : 1);
      const start = t * (toneLen + gapLen);
      for (let i = 0; i < toneLen; i++) {
        const env = Math.min(1, i / (0.05 * sr), (toneLen - i) / (0.05 * sr));
        const v = amp * env * Math.sin((2 * Math.PI * 200 * i) / sr);
        l[start + i] = v;
        r[start + i] = t === antiphase ? -v : v;
      }
    }
    return this.play(buf);
  }

  /** Chain of peaking filters approximating an illustrative attenuation profile. */
  lossChain(profile: Profile): AudioNode {
    let head: AudioNode = this.master;
    const nodes = [...AUDIOGRAM_FREQS].reverse().map((f, idx) => {
      const i = AUDIOGRAM_FREQS.length - 1 - idx;
      const bq = this.ctx.createBiquadFilter();
      if (i === AUDIOGRAM_FREQS.length - 1) {
        bq.type = "highshelf";
        bq.frequency.value = f * 0.75;
      } else {
        bq.type = "peaking";
        bq.frequency.value = f;
        bq.Q.value = 1.0;
      }
      bq.gain.value = -profile.loss[i];
      return bq;
    });
    for (const n of nodes) {
      n.connect(head);
      head = n;
    }
    return head;
  }

  async playSentence(profile: Profile | null): Promise<void> {
    await this.ctx.resume();
    if (!this.sentence) return;
    return this.play(this.sentence, profile ? this.lossChain(profile) : this.master);
  }

  async playTripletThrough(profile: Profile, digits: readonly Digit[], snr: number): Promise<void> {
    return this.playTriplet(digits, snr, false, this.lossChain(profile));
  }
}
