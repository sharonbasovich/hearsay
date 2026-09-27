# Data provenance, safety framing and limitations

## Provenance

| Asset | Source | How it was made | Licence / terms |
| --- | --- | --- | --- |
| `public/stimuli/digit-*.wav` (9 files) | ElevenLabs text-to-speech API, premade voice "Alice" (`Xb7hH8MSUJpSbSDYk0k2`), model `eleven_multilingual_v2` | `scripts/make-stimuli.ts`: one request per digit word, 24 kHz PCM, silence-trimmed, RMS-normalized | Generated on an ElevenLabs free-tier account; attributed in the app footer and README; used non-commercially for a student hackathon. Check ElevenLabs' current terms before any other use. |
| `public/stimuli/sentence.wav` | Same as above | Same pipeline; the sentence text is in `manifest.json` | Same as above |
| `public/stimuli/noise.wav` | Computed locally | Average power spectrum of the nine digit tokens, random phase (seed 20261006), inverse FFT, RMS-normalized | Original work, MIT |
| Validation numbers (`docs/validation.json`, Lab page) | Simulation | Virtual listeners from a logistic psychometric function (`src/engine/simulate.ts`), seed 7 | Original work, MIT |
| Demo family (Family board) | Invented | Hard-coded in `src/storage.ts`, every name suffixed "(synthetic)" | Original work, MIT |
| Hear-through profiles | Hand-made teaching curves | `src/audio/hearloss.ts` | Original work, MIT |

**No human-subject data was collected or used.** No third-party datasets, recordings or audiograms are included. The app has no server, analytics or tracking; user results are stored only in the browser's `localStorage`.

## AI use disclosure

- **Coding assistant:** the code, tests, docs, screenshots and demo video were produced with the Devin AI coding agent (Cognition), directed and reviewed by Sharon Basovich. UnivaBio explicitly encourages AI assistants.
- **ElevenLabs:** used once, offline, via `scripts/make-stimuli.ts` (model `eleven_multilingual_v2`, premade voice `Xb7hH8MSUJpSbSDYk0k2`; see `public/stimuli/manifest.json`), for the digits, the hear-through sentence, and the demo-video narration. The deployed site does **not** call ElevenLabs or any other API.
- **Sponsors:** no sponsor API or product (Momen, CodeCrafters, InterviewBuddy, Protoflow, Adaption Labs, Tin Computer) is used, and the rules do not require one.
- **"AI" in the app:** Bayesian active-learning inference (grid posterior + expected-entropy stimulus choice), fully client-side. No trained ML model and no LLM at runtime.

## Safety framing

- Hearsay is an **educational self-check**, not a medical device, screening test or diagnosis. It says so on every page.
- The only suggestion it ever makes is soft and relative: someone who did noticeably worse than their family on the same device may want to "mention it to a doctor or get a professional hearing test".
- It never outputs a hearing-loss category, degree, or "pass/fail".

## Limitations (known and unfixed)

1. **Not clinically validated.** All accuracy numbers are from simulated listeners, who don't get tired, distracted, or learn the task.
2. **Uncalibrated audio.** Absolute thresholds depend on the device, headphones and volume. Hearsay therefore only compares people on the same set-up, and assumes nobody changes the volume.
3. **Model assumptions.** The engine assumes a logistic psychometric function, 3% lapses, and marginalizes over three slopes (0.4, 0.7, 1.1 /dB). The Lab shows accuracy drops when the true slope is shallower (RMSE 1.41 dB at 0.5 /dB).
4. **Synthetic speech.** The digits are TTS, RMS-equalized but not individually balanced for intelligibility in noise the way clinical digit sets are. Some digits may be easier than others.
5. **Headphone check** (antiphase-tone method) reduces but does not eliminate loudspeaker use; users can skip it, and results are then labelled "headphones not verified".
6. **Hear-through simulator** uses peaking filters only. Real hearing loss also changes loudness growth, frequency resolution and timing.
7. **Population.** Not designed for children, and not suitable for anyone for whom sound exposure is uncomfortable.
8. **Language.** English digits only.

## What would come next (not built)

- A small, ethics-approved pilot comparing Hearsay against a calibrated clinical digits-in-noise test.
- Per-digit intelligibility balancing using listener data.
- Optional export of a result summary to bring to an appointment.
