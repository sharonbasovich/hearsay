import "./style.css";
import { AudioEngine } from "./audio/player";
import { AUDIOGRAM_FREQS, PROFILES } from "./audio/hearloss";
import { BayesianDin } from "./engine/bayes";
import { compareGroup, type Member } from "./engine/family";
import { HEADPHONE_TRIALS, headphonePassed, makeHeadphoneTrial } from "./engine/headphones";
import { pCorrect } from "./engine/psychometric";
import { mulberry32 } from "./engine/rng";
import { DEFAULT_SIM, METHODS, simulate, type MethodStats } from "./engine/simulate";
import { makeTriplet, scoreTriplet, type Triplet } from "./engine/triplets";
import type { Estimate, Trial } from "./engine/types";
import { esc, familyChart, histogram, posteriorChart, profileChart, trackChart } from "./ui/charts";
import { demoFamily, loadMembers, saveMembers } from "./storage";
import { ICONS } from "./ui/icons";

const app = document.getElementById("app")!;
let audio: AudioEngine | null = null;
const engine = () => (audio ??= new AudioEngine());
const rng = mulberry32((Date.now() ^ 0x5eed) >>> 0);

const DISCLAIMER =
  "Hearsay is an educational self-check, not a medical device. It cannot diagnose hearing loss or any condition. If you are worried about your hearing, see an audiologist or doctor.";

function shell(active: string, body: string): string {
  const link = (href: string, label: string) => `<a href="#/${href}" class="${active === href ? "active" : ""}">${label}</a>`;
  return `<header class="top"><a class="brand" href="#/">${ICONS.ear} Hearsay</a><nav>${link("check", "Take the check")}${link("family", "Family board")}${link("simulator", "Hear-through")}${link("lab", "Lab")}${link("about", "Honesty")}</nav></header>
  <main>${body}</main>
  <footer><p>${DISCLAIMER}</p><p>Speech synthesized with <a href="https://elevenlabs.io" target="_blank" rel="noopener">ElevenLabs</a>. No data leaves your browser.</p></footer>`;
}

function route(): void {
  engine().stop();
  const [path, query] = location.hash.replace(/^#\/?/, "").split("?");
  const params = new URLSearchParams(query ?? "");
  window.scrollTo(0, 0);
  switch (path) {
    case "check":
      return checkView(params);
    case "family":
      return familyView();
    case "simulator":
      return simulatorView();
    case "lab":
      return labView();
    case "about":
      return aboutView();
    default:
      return homeView();
  }
}

function homeView(): void {
  app.innerHTML = shell(
    "",
    `<section class="hero">
      <p class="eyebrow">AI for Human Health · UnivaBio 2026</p>
      <h1>“What?” is the most expensive word at dinner.</h1>
      <p class="lead">Hearsay helps families explore <b>hearing spoken digits in noise</b> through a short, adaptive headphone task. See how the noise level changes with your answers, then compare task results collected on the same setup. <b>This educational prototype has not been clinically validated.</b></p>
      <div class="cta"><a class="btn primary" href="#/check">Start the 3-minute check</a><a class="btn" href="#/family">See the family board</a></div>
      <p class="fine">${DISCLAIMER}</p>
    </section>
    <section class="grid3">
      <article class="card"><h3>${ICONS.target} Adaptive, not a quiz</h3><p>A Bayesian engine picks every next noise level to learn the most about you. In simulation it reaches a <b>~34% lower error than a classic staircase of the same length</b> and stops in about 12 triplets.</p></article>
      <article class="card"><h3>${ICONS.headphones} Honest about your headphones</h3><p>The comparison uses the <b>same device, headphones and volume</b> to reduce a shared device-offset problem under the model. Fit, attention, language and the listening environment can still differ. This does not calibrate the headphones or establish clinical validity.</p></article>
      <article class="card"><h3>${ICONS.ear} Hear through their ears</h3><p>An illustrative simulator lets the rest of the family hear why “just listen harder” doesn't work — and why speaking clearly beats speaking loudly.</p></article>
    </section>
    <section class="how">
      <h2>How the check works</h2>
      <ol class="steps"><li><b>Volume</b><span>Set a comfortable level once.</span></li><li><b>Headphone check</b><span>A brief tone task checks the headphone setup; it cannot verify equipment or calibrate listening levels.</span></li><li><b>Digits in noise</b><span>Hear three digits in noise, type them. The noise adapts to you.</span></li><li><b>Compare</b><span>Save and compare task results from the same setup, with uncertainty shown.</span></li></ol>
    </section>`,
  );
}

interface CheckState {
  name: string;
  device: string;
  virtualSrt: number | null;
}

function checkView(params: URLSearchParams): void {
  const virtual = params.get("virtual");
  const st: CheckState = { name: "", device: "", virtualSrt: virtual !== null && virtual !== "" ? Number(virtual) : null };
  const lastDevice = loadMembers().at(-1)?.device ?? "";
  app.innerHTML = shell(
    "check",
    `<section class="panel narrow">
      <p class="eyebrow">Step 1 of 4 · Who's listening?</p>
      <h2>Let's get you set up</h2>
      ${st.virtualSrt !== null ? `<p class="notice">Demo mode: a <b>virtual listener</b> (true SRT ${st.virtualSrt} dB) will answer automatically. Results are simulated.</p>` : ""}
      <label>Your name (stays on this device)<input id="name" autocomplete="off" placeholder="e.g. Grandpa" value="${st.virtualSrt !== null ? "Virtual listener" : ""}"/></label>
      <label>Device + headphones<input id="device" placeholder="e.g. Mom's laptop + white earbuds" value="${esc(lastDevice || (st.virtualSrt !== null ? "Simulated" : ""))}"/></label>
      <p class="fine">Family comparisons only make sense when everyone uses the same device, headphones and volume.</p>
      <button class="btn primary" id="go">Continue</button>
    </section>`,
  );
  document.getElementById("go")!.onclick = () => {
    st.name = (document.getElementById("name") as HTMLInputElement).value.trim() || "Listener";
    st.device = (document.getElementById("device") as HTMLInputElement).value.trim() || "Unnamed device";
    engine().load().catch(() => undefined);
    if (st.virtualSrt !== null) return runTest(st);
    volumeStep(st);
  };
}

function volumeStep(st: CheckState): void {
  const main = app.querySelector("main")!;
  main.innerHTML = `<section class="panel narrow">
    <p class="eyebrow">Step 2 of 4 · Volume</p>
    <h2>Put on headphones and set a comfortable level</h2>
    <p>Press play. You'll hear three digits clearly over soft noise. Adjust until it's comfortable — not loud. <b>Don't change it again</b> during the check.</p>
    <div class="row"><button class="btn" id="play">▶ Play sample</button><input type="range" id="vol" min="0.05" max="1" step="0.01" value="0.5" aria-label="Volume"/></div>
    <button class="btn primary" id="next">It's comfortable →</button>
  </section>`;
  const vol = document.getElementById("vol") as HTMLInputElement;
  vol.oninput = () => engine().setVolume(Number(vol.value));
  document.getElementById("play")!.onclick = async () => {
    await engine().load();
    await engine().playTriplet(makeTriplet(rng), 6);
  };
  document.getElementById("next")!.onclick = () => headphoneStep(st);
}

function headphoneStep(st: CheckState): void {
  let i = 0;
  let correct = 0;
  const main = app.querySelector("main")!;
  const trial = () => {
    const t = makeHeadphoneTrial(rng);
    main.innerHTML = `<section class="panel narrow">
      <p class="eyebrow">Step 3 of 4 · Headphone check (${i + 1}/${HEADPHONE_TRIALS})</p>
      <h2>Which tone was the quietest?</h2>
      <p>Three low hums will play. One is softer. Over headphones this is easy; over speakers a phase trick fools you.</p>
      <button class="btn" id="play">▶ Play the three tones</button>
      <div class="choices">${[1, 2, 3].map((n) => `<button class="btn choice" data-c="${n - 1}" disabled>${n}</button>`).join("")}</div>
      <button class="link" id="skip">Skip (results will be marked "headphones not verified")</button>
    </section>`;
    const choices = [...main.querySelectorAll<HTMLButtonElement>(".choice")];
    document.getElementById("play")!.onclick = async () => {
      await engine().playHeadphoneTrial(t.quiet, t.antiphase);
      choices.forEach((c) => (c.disabled = false));
    };
    choices.forEach(
      (c) =>
        (c.onclick = () => {
          if (Number(c.dataset.c) === t.quiet) correct++;
          i++;
          if (i < HEADPHONE_TRIALS) return trial();
          if (headphonePassed(correct)) return runTest(st, true);
          main.innerHTML = `<section class="panel narrow"><h2>Hmm — that sounded like speakers</h2><p>You got ${correct}/${HEADPHONE_TRIALS}. The check relies on each ear hearing its own signal. Try wired headphones, then retry.</p>
          <div class="row"><button class="btn primary" id="retry">Retry</button><button class="btn" id="anyway">Continue anyway (not verified)</button></div></section>`;
          document.getElementById("retry")!.onclick = () => headphoneStep(st);
          document.getElementById("anyway")!.onclick = () => runTest(st, false);
        }),
    );
    document.getElementById("skip")!.onclick = () => runTest(st, false);
  };
  trial();
}

function runTest(st: CheckState, verified = false): void {
  const proc = new BayesianDin();
  const trials: Trial[] = [];
  const main = app.querySelector("main")!;
  const vrng = mulberry32(42);
  let target: Triplet = makeTriplet(rng);
  let snr = proc.nextSnr();
  let typed = "";

  const render = () => {
    const est = proc.estimate();
    main.innerHTML = `<section class="panel test">
      <div class="testhead"><p class="eyebrow">Step 4 of 4 · Digits in noise · triplet ${trials.length + 1}</p><div class="meter"><span style="width:${Math.min(100, (trials.length / 14) * 100)}%"></span></div></div>
      <div class="testgrid">
        <div>
          <h2>Type the three digits you heard</h2>
          <p class="fine">Guess if unsure. Every answer teaches the engine something.</p>
          <div class="display" aria-live="polite">${[0, 1, 2].map((k) => `<span class="${typed[k] ? "filled" : ""}">${typed[k] ?? "·"}</span>`).join("")}</div>
          <div class="keypad">${[1, 2, 3, 4, 5, 6, 8, 9, 0].map((d) => `<button class="key" data-d="${d}">${d}</button>`).join("")}<button class="key alt" data-d="back">⌫</button><button class="key alt" id="replay">↻</button><button class="key submit" id="submit" ${typed.length === 3 ? "" : "disabled"}>OK</button></div>
        </div>
        <aside class="belief">
          <h3>What Hearsay believes right now</h3>
          ${posteriorChart(proc.marginal(), est)}
          <p class="fine">Shaded band = 90% credible interval for your speech reception threshold (the noise level where you get half the triplets right). Current: <b>${est.srt.toFixed(1)} dB</b> ± ${est.sd.toFixed(1)}. Stops once the uncertainty is ±1.25 dB or less.</p>
          ${trials.length ? trackChart(trials) : ""}
        </aside>
      </div>
    </section>`;
    main.querySelectorAll<HTMLButtonElement>(".key[data-d]").forEach(
      (k) =>
        (k.onclick = () => {
          if (k.dataset.d === "back") typed = typed.slice(0, -1);
          else if (typed.length < 3) typed += k.dataset.d;
          render();
        }),
    );
    document.getElementById("replay")!.onclick = () => play();
    document.getElementById("submit")!.onclick = () => submit();
  };

  const play = async () => {
    await engine().load();
    await engine().playTriplet(target, snr);
  };

  const submit = () => {
    const { correct } = scoreTriplet(target, typed);
    const trial = { snr, correct };
    trials.push(trial);
    proc.update(trial);
    typed = "";
    if (proc.done()) return finish(st, proc.estimate(), trials, verified || st.virtualSrt !== null);
    target = makeTriplet(rng);
    snr = proc.nextSnr();
    render();
    void next();
  };

  const onKey = (e: KeyboardEvent) => {
    if (!document.querySelector(".keypad")) return window.removeEventListener("keydown", onKey);
    if (/^[0-9]$/.test(e.key) && e.key !== "7" && typed.length < 3) typed += e.key;
    else if (e.key === "Backspace") typed = typed.slice(0, -1);
    else if (e.key === "Enter" && typed.length === 3) return submit();
    else return;
    render();
  };
  window.addEventListener("keydown", onKey);

  const next = async () => {
    const played = play().catch(() => undefined);
    if (st.virtualSrt === null) return;
    await Promise.race([played, new Promise((r) => setTimeout(r, 1400))]);
    const ok = vrng() < pCorrect(snr, st.virtualSrt, 0.7, 0.02);
    const answer = ok ? target.join("") : target.map((d, k) => (k === 1 ? (d === 9 ? 8 : 9) : d)).join("");
    for (const ch of answer) {
      await new Promise((r) => setTimeout(r, 160));
      typed += ch;
      render();
    }
    await new Promise((r) => setTimeout(r, 250));
    if (document.getElementById("submit")) submit();
  };

  render();
  void next();
}

function finish(st: CheckState, est: Estimate, trials: Trial[], verified: boolean): void {
  const members = loadMembers();
  const member: Member = { id: `m-${Date.now()}`, name: st.name, estimate: est, takenAt: new Date().toISOString(), device: st.device + (verified ? "" : " (headphones not verified)") };
  const main = app.querySelector("main")!;
  const sameDevice = members.filter((m) => m.device.replace(" (headphones not verified)", "") === st.device);
  main.innerHTML = `<section class="panel">
    <p class="eyebrow">Done in ${trials.length} triplets</p>
    <h2>${esc(st.name)}, your speech-in-noise threshold is <span class="big">${est.srt.toFixed(1)} dB SNR</span></h2>
    <p class="lead">That's the noise level where you'd catch about half of the digit triplets. <b>Lower (more negative) = better at hearing in noise.</b> 90% credible interval: ${est.lo90.toFixed(1)} to ${est.hi90.toFixed(1)} dB.</p>
    <div class="grid2"><div>${trackChart(trials)}<p class="fine">Green = got all three digits, red = missed. The engine moved the noise to where your answers were most informative.</p></div>
    <div class="card"><h3>What does this mean?</h3><p>On its own, not much yet — and we won't pretend otherwise. Your earbuds and volume shift this number by an unknown amount, so Hearsay has <b>no fake “normal range”</b>.</p><p>You can explore differences between results collected on <b>this same setup</b> (${sameDevice.length} saved so far). Changes in fit, attention, language or environment can affect scores; these comparisons have not been clinically validated.</p>
    ${verified ? "" : `<p class="notice">Headphones were not verified — treat this result with extra caution.</p>`}</div></div>
    <div class="row"><button class="btn primary" id="save">Save to family board</button><a class="btn" href="#/check">Next person</a><button class="link" id="discard">Discard</button></div>
    <p class="fine">${DISCLAIMER}</p>
  </section>`;
  document.getElementById("save")!.onclick = () => {
    saveMembers([...members, member]);
    location.hash = "#/family";
  };
  document.getElementById("discard")!.onclick = () => (location.hash = "#/");
}

function familyView(): void {
  const members = loadMembers();
  const devices = [...new Set(members.map((m) => m.device.replace(" (headphones not verified)", "")))];
  const groups = devices.map((d) => ({ device: d, rows: compareGroup(members.filter((m) => m.device.replace(" (headphones not verified)", "") === d)) }));
  const verdictText: Record<string, string> = {
    harder: "Found it noticeably harder than others on this device. Worth mentioning to a doctor or getting a professional hearing test.",
    easier: "Did noticeably better than others on this device.",
    similar: "Similar to the others on this device.",
    "too-few": "Add at least one more person on this device to compare.",
  };
  app.innerHTML = shell(
    "family",
    `<section class="panel">
      <p class="eyebrow">Same device, same headphones, same volume</p>
      <h2>Family board</h2>
      <p class="lead">Results collected on the same setup are compared with the <b>median of everyone else</b>. Under the model, this reduces a shared device-offset problem; fit, attention, language and environment can still affect the comparison. The prototype flags a gap above <b>3 dB</b> and its estimated uncertainty. This rule is an educational design choice, not a clinically validated threshold.</p>
      ${
        members.length
          ? groups
              .map(
                (g) => `<div class="group"><h3>${ICONS.headphones} ${esc(g.device)}</h3>${familyChart(g.rows)}
              <ul class="verdicts">${g.rows
                .map(
                  (r) => `<li class="${r.verdict}"><b>${esc(r.member.name)}</b> — ${r.member.estimate.srt.toFixed(1)} dB${Number.isFinite(r.delta) ? ` (${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(1)} vs. others)` : ""}. ${verdictText[r.verdict]}<button class="link del" data-id="${r.member.id}">remove</button></li>`,
                )
                .join("")}</ul></div>`,
              )
              .join("")
          : `<div class="empty"><p>No one yet. Take the check, pass the headphones to the next person, repeat.</p></div>`
      }
      <div class="row"><a class="btn primary" href="#/check">Add a person</a><button class="btn" id="demo">Load synthetic demo family</button>${members.length ? `<button class="link" id="clear">Clear board</button>` : ""}</div>
      <p class="fine">The demo family is invented for illustration and labelled “(synthetic)”. ${DISCLAIMER}</p>
    </section>`,
  );
  document.getElementById("demo")!.onclick = () => {
    saveMembers([...loadMembers().filter((m) => !m.id.startsWith("demo-")), ...demoFamily()]);
    familyView();
  };
  document.getElementById("clear")?.addEventListener("click", () => {
    saveMembers([]);
    familyView();
  });
  app.querySelectorAll<HTMLButtonElement>(".del").forEach(
    (b) =>
      (b.onclick = () => {
        saveMembers(loadMembers().filter((m) => m.id !== b.dataset.id));
        familyView();
      }),
  );
}

function simulatorView(): void {
  let current = PROFILES[1];
  const render = () => {
    app.innerHTML = shell(
      "simulator",
      `<section class="panel">
        <p class="eyebrow">Empathy mode · illustrative only</p>
        <h2>Hear through their ears</h2>
        <p class="lead">Most hearing loss doesn't make the world quieter — it makes it <b>blurrier</b>. High pitches fade first, taking consonants with them. Play the same message both ways.</p>
        <div class="profiles">${PROFILES.slice(1)
          .map((p) => `<button class="chip ${p.id === current.id ? "on" : ""}" data-p="${p.id}">${p.label}</button>`)
          .join("")}</div>
        <div class="grid2"><div>${profileChart(current.loss, AUDIOGRAM_FREQS)}<p class="fine">${current.description} These curves are hand-made teaching examples, not anyone's real audiogram. Filtering is an approximation: real hearing loss also affects loudness growth and timing, which this does not model.</p></div>
        <div class="card"><h3>“Hi Grandpa! I'm picking you up at 4:15 on Thursday…”</h3>
          <div class="row"><button class="btn" id="orig">▶ Original</button><button class="btn primary" id="sim">▶ Through “${current.label}”</button></div>
          <div class="row"><button class="btn" id="trip">▶ Digits in noise, through “${current.label}”</button></div>
          <p class="fine">Tip for families: face the person, reduce background noise, and slow down. Shouting mostly makes vowels louder — the part they already hear.</p></div></div>
      </section>`,
    );
    app.querySelectorAll<HTMLButtonElement>(".chip").forEach(
      (c) =>
        (c.onclick = () => {
          current = PROFILES.find((p) => p.id === c.dataset.p)!;
          render();
        }),
    );
    document.getElementById("orig")!.onclick = async () => {
      await engine().load();
      await engine().playSentence(null);
    };
    document.getElementById("sim")!.onclick = async () => {
      await engine().load();
      await engine().playSentence(current);
    };
    document.getElementById("trip")!.onclick = async () => {
      await engine().load();
      await engine().playTripletThrough(current, makeTriplet(rng), 0);
    };
  };
  render();
}

function labView(): void {
  app.innerHTML = shell(
    "lab",
    `<section class="panel">
      <p class="eyebrow">Measurable, reproducible, in your browser</p>
      <h2>The Lab: does the AI actually help?</h2>
      <p class="lead">We simulate hundreds of virtual listeners with known thresholds, run each test procedure on them twice, and measure the error. Seeded, so you get the same numbers every time.</p>
      <div class="row"><label class="inline">Virtual listeners <select id="n"><option>100</option><option selected>400</option><option>1000</option></select></label>
      <label class="inline">True slope (/dB) <select id="slope"><option>0.5</option><option selected>0.7</option><option>1.0</option></select></label>
      <button class="btn primary" id="run">Run simulation</button><a class="btn" href="#/check?virtual=-4">Watch a virtual listener take the check</a></div>
      <div id="out"><p class="fine">Press run (takes a couple of seconds).</p></div>
    </section>`,
  );
  const run = () => {
    const out = document.getElementById("out")!;
    out.innerHTML = `<p class="fine">Simulating…</p>`;
    setTimeout(() => {
      const listeners = Number((document.getElementById("n") as HTMLSelectElement).value);
      const trueSlope = Number((document.getElementById("slope") as HTMLSelectElement).value);
      const res: MethodStats[] = Object.values(METHODS).map((m) => simulate(m, { ...DEFAULT_SIM, listeners, trueSlope }));
      const [s24, s12, bayes] = res;
      out.innerHTML = `<table class="results"><thead><tr><th>Procedure</th><th>Avg. triplets</th><th>RMSE (dB)</th><th>Bias (dB)</th><th>Test–retest SD (dB)</th><th>90% interval really contains truth</th></tr></thead><tbody>
        ${res.map((r) => `<tr class="${r === bayes ? "hl" : ""}"><td>${r.method}</td><td>${r.meanTrials.toFixed(1)}</td><td>${r.rmse.toFixed(2)}</td><td>${r.bias >= 0 ? "+" : ""}${r.bias.toFixed(2)}</td><td>${r.retestSd.toFixed(2)}</td><td>${(r.coverage90 * 100).toFixed(0)}%</td></tr>`).join("")}
      </tbody></table>
      <div class="grid3 stats"><div class="stat"><b>${((1 - bayes.rmse / s12.rmse) * 100).toFixed(0)}%</b><span>lower error than a staircase of the same length</span></div>
      <div class="stat"><b>${((1 - bayes.meanTrials / s24.meanTrials) * 100).toFixed(0)}%</b><span>fewer triplets than the classic 24-trial track</span></div>
      <div class="stat"><b>${(bayes.coverage90 * 100).toFixed(0)}%</b><span>of Hearsay's “90%” intervals contained the truth (staircase: ${(s24.coverage90 * 100).toFixed(0)}%)</span></div></div>
      <div class="grid2"><div><h3>Error distribution — Hearsay</h3>${histogram(bayes.errors, -5, 5, 20, "bar b")}</div><div><h3>Error distribution — 12-trial staircase</h3>${histogram(s12.errors, -5, 5, 20, "bar s")}</div></div>
      <p class="fine">Trade-off, stated plainly: the full 24-trial staircase is still slightly more precise (RMSE ${s24.rmse.toFixed(2)} vs ${bayes.rmse.toFixed(2)} dB) — it just takes twice as long and its error bars are over-confident. Simulated listeners follow a logistic psychometric function with 2% lapses; real people also get tired, distracted and learn, which this does not capture.</p>`;
    }, 30);
  };
  document.getElementById("run")!.onclick = run;
}

function aboutView(): void {
  app.innerHTML = shell(
    "about",
    `<section class="panel prose">
      <p class="eyebrow">Honesty page</p>
      <h2>What's real, what's synthetic, what's missing</h2>
      <h3>What Hearsay is</h3><p>A browser-based educational self-check of <b>speech understanding in noise</b>, using a digits-in-noise design (three spoken digits in speech-shaped noise, antiphasic presentation), a Bayesian adaptive procedure, and same-device family comparison.</p>
      <h3>What it is not</h3><ul><li>Not a diagnosis, screening device, or substitute for an audiologist. It has <b>not been clinically validated</b>.</li><li>Not calibrated: without a calibrated headphone and level, absolute scores are not comparable across devices. That's why there's no “normal range” on the results page.</li><li>Not suitable for children, people with tinnitus flare-ups from sound, or anyone for whom sound exposure is uncomfortable.</li></ul>
      <h3>Data provenance</h3><ul><li><b>Speech:</b> nine digit words and one sentence synthesized with the ElevenLabs text-to-speech API (premade voice “Alice”). Generated by <code>scripts/make-stimuli.ts</code>.</li><li><b>Noise:</b> stationary noise computed locally from the digits' long-term spectrum (random phase, seeded). No third-party audio.</li><li><b>Validation data:</b> 100% synthetic — virtual listeners simulated in <code>src/engine/simulate.ts</code>. No human-subject data was collected.</li><li><b>Demo family:</b> invented names and numbers, labelled “(synthetic)”.</li><li><b>Your results:</b> stored only in this browser's localStorage. No analytics, no server.</li></ul>
      <h3>Known limitations</h3><ul><li>Psychometric slope and lapse rate are assumptions; the engine marginalizes over three slopes to be robust, and the Lab shows how accuracy changes when the true slope differs.</li><li>Synthetic speech is not the same as recorded clinical stimuli; digits were RMS-equalized but not individually intelligibility-balanced in noise.</li><li>The hear-through simulator is a filter-based teaching approximation.</li><li>Family comparison assumes everyone keeps the same device, headphones and volume.</li></ul>
      <h3>Built with</h3><p>TypeScript, Vite, Web Audio API, Vitest. Solo student project for the UnivaBio 2026 hackathon.</p>
      <h3>AI use</h3><p>Code, tests and docs were generated with the Devin AI coding agent (Cognition) for Sharon Basovich's UnivaBio entry. The only external AI service is ElevenLabs text-to-speech, called once offline to make the digit recordings; the live site makes no AI or network calls beyond loading its own files. The adaptive engine is ordinary Bayesian statistics running in your browser, not a machine-learning model.</p>
    </section>`,
  );
}

window.addEventListener("hashchange", route);
route();
