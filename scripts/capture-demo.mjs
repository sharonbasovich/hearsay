import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = 'demo-capture';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: out, size: { width: 1920, height: 1080 } },
  locale: 'en-US', timezoneId: 'UTC',
});
// Fresh synthetic-only browser context; no microphone/camera permissions,
// credentials, network mocks, injected answers, or product DOM/state changes.
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push({ type: 'pageerror', message: error.message }));
page.on('requestfailed', request => errors.push({ type: 'requestfailed', url: request.url(), failure: request.failure() }));
const started = performance.now();
const marks = [];
let status = { status: 'running' };
const mark = async (name, hold = 0) => {
  marks.push({ name, seconds: (performance.now() - started) / 1000 });
  await page.screenshot({ path: `${out}/${name}.png` });
  if (hold) await page.waitForTimeout(hold * 1000);
};
const body = () => page.locator('#app').innerText();
try {
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  assert.match(await body(), /educational prototype has not been clinically validated/i);
  await mark('01-home', 8);
  await page.getByRole('link', { name: 'Lab', exact: true }).click();
  await page.getByRole('link', { name: 'Watch a virtual listener take the check', exact: true }).waitFor();
  await mark('02-lab-entry', 6);
  await page.getByRole('link', { name: 'Watch a virtual listener take the check', exact: true }).click();
  assert.match(await body(), /Results are simulated/);
  assert.equal(await page.locator('#name').inputValue(), 'Virtual listener');
  assert.equal(await page.locator('#device').inputValue(), 'Simulated');
  await mark('03-virtual-setup', 6);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('.keypad').waitFor();
  assert.match(await body(), /Synthetic demo: responses and this result are simulated/);
  await mark('04-virtual-start');
  const seen = new Set();
  const deadline = Date.now() + 150_000;
  while (true) {
    const current = await body();
    if (!current.includes('Type the three digits you heard')) break;
    assert.ok(Date.now() < deadline, 'Virtual run did not finish within 150 seconds');
    const trial = current.match(/triplet\s+(\d+)/i)?.[0] || '';
    assert.ok(trial, 'Active trial label missing');
    if (!seen.has(trial)) {
      seen.add(trial);
      const number = trial.match(/triplet\s+(\d+)/i)?.[1];
      await mark(`trial-${String(number).padStart(2, '0')}`);
    }
    await page.waitForTimeout(120);
  }
  assert.match(await body(), /model-estimated task threshold/);
  assert.match(await body(), /Synthetic demo: responses and this result are simulated/);
  await mark('05-virtual-result', 18);
  await writeFile(`${out}/virtual-result.txt`, await body());
  // No result is saved to a family board. Only the built-in simulation follows.
  await page.getByRole('link', { name: 'Lab', exact: true }).click();
  assert.equal(await page.locator('#n').inputValue(), '400');
  assert.equal(await page.locator('#slope').inputValue(), '0.7');
  await mark('06-lab-settings', 6);
  await page.getByRole('button', { name: 'Run simulation', exact: true }).click();
  await page.locator('table.results tbody tr').nth(2).waitFor();
  const rows = await page.locator('table.results tbody tr').allTextContents();
  assert.match(rows[0], /0\.79/);
  assert.match(rows[1], /1\.53/);
  assert.match(rows[2], /11\.8/);
  assert.match(rows[2], /1\.01/);
  await mark('07-lab-results', 32);
  await writeFile(`${out}/lab-result.txt`, await body());
  await page.getByRole('link', { name: 'Honesty', exact: true }).click();
  await mark('08-honesty', 5);
  assert.deepEqual(errors, [], 'Unexpected browser errors');
  await writeFile(`${out}/ui-verification.txt`, 'Verified corrected copy; built-in virtual-listener entry; automatic genuine response/posterior/track updates; synthetic result; default400/slope0.7 simulation and expected RMSE cells. No human responses, saved result, permissions or product state injection. App audio must be omitted from the narrated final edit.\n');
  status = { status: 'passed' };
} catch (error) {
  status = { status: 'failed', error: String(error), stack: error?.stack || null };
  throw error;
} finally {
  await writeFile(`${out}/capture-status.json`, JSON.stringify(status, null, 2));
  await writeFile(`${out}/browser-errors.json`, JSON.stringify(errors, null, 2));
  await writeFile(`${out}/marks.json`, JSON.stringify({ sourceCommit: process.env.GITHUB_SHA || null, viewport: { width:1920, height:1080 }, marks }, null, 2));
  const video = page.video();
  await context.close();
  if (video) await video.saveAs(`${out}/hearsay-current-build.webm`);
  await browser.close();
}
