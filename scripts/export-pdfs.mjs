// Regenerates docs/hearsay-one-pager.pdf and docs/hearsay-source-code.pdf with headless Chrome.
// Usage: node scripts/export-pdfs.mjs   (set CHROME=/path/to/chrome if not on PATH as google-chrome)
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const chrome = process.env.CHROME ?? "google-chrome";

function printPdf(htmlPath, outPath) {
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--allow-file-access-from-files",
    `--print-to-pdf=${outPath}`,
    `file://${htmlPath}`,
  ], { stdio: "ignore" });
  console.log("wrote", outPath);
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sources = execFileSync("git", [
  "ls-files", "src", "scripts", "tests", "index.html", "package.json", "vite.config.ts", "tsconfig.json", ".github/workflows/pages.yml", "public/video/index.html",
], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
const text = Object.fromEntries(sources.map((f) => [f, readFileSync(join(root, f), "utf8")]));
const toc = sources.map((f) => `<li>${f} (${text[f].split("\n").length} lines)</li>`).join("");
const body = sources.map((f) => `<h2>${f}</h2><pre>${esc(text[f])}</pre>`).join("");
const codeHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
@page{size:Letter;margin:.5in}body{font:10px "DejaVu Sans",sans-serif}h1{font-size:20px}
h2{font-size:12px;background:#eee;padding:3px;page-break-after:avoid}
pre{font:7.5px/1.25 "DejaVu Sans Mono",monospace;white-space:pre-wrap;word-break:break-all}
</style></head><body>
<h1>Hearsay: source code</h1>
<p>Sharon Basovich, UnivaBio 2026. Repository: https://github.com/sharonbasovich/hearsay · Live: https://sharonbasovich.github.io/hearsay/</p>
<p>AI-assisted: code, tests and docs were generated with the Devin AI coding agent (Cognition). Binary assets are omitted: WAV stimuli in public/stimuli/ (ElevenLabs TTS, generated offline by scripts/make-stimuli.ts) and the demo MP4.</p>
<ol>${toc}</ol>${body}</body></html>`;
const tmp = mkdtempSync(join(tmpdir(), "hearsay-pdf-"));
const codePath = join(tmp, "source-code.html");
writeFileSync(codePath, codeHtml);

printPdf(join(root, "docs/one-pager.html"), join(root, "docs/hearsay-one-pager.pdf"));
printPdf(codePath, join(root, "docs/hearsay-source-code.pdf"));
