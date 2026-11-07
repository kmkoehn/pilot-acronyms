// Takes App Store screenshots of www/index.html in headless Chrome at Apple's required sizes:
// 6.3-inch iPhone (1206 x 2622), the size App Store Connect asks for first, and 13-inch iPad (2064 x 2752). Run `npm run web` first.
// Usage: node scripts/store-shots.mjs
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "store/screenshots");
const page = pathToFileURL(join(root, "www/index.html")).href;
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9337;
const wait = ms => new Promise(r => setTimeout(r, ms));

const DEVICES = [
  { name: "iphone", width: 402, height: 874, scale: 3 },
  { name: "ipad", width: 1032, height: 1376, scale: 2 },
];

// Each shot opens a section and one card, scrolled to sit under the header. `also` opens more cards per device.
const SHOTS = [
  { theme: "light", section: "aircraft", card: "ARROW", top: true },
  { theme: "dark", section: "weather", card: "Flight categories", also: { iphone: ["METAR & TAF decode"], ipad: ["Weather products"] }, top: true },
  { theme: "light", section: "airspace", card: "MCPRAWN" },
  { theme: "light", section: "human", card: "ICEFLAGS", quiz: true },
  { theme: "dark", search: "night" },
];

const act = (s, device) => `(async () => {
  try { localStorage.clear(); } catch (e) {}
  const settle = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (${JSON.stringify(!!s.search)}) {
    const q = document.getElementById("q");
    q.value = ${JSON.stringify(s.search || "")};
    q.dispatchEvent(new Event("input", { bubbles: true }));
    await settle(); window.scrollTo(0, 0); return;
  }
  document.querySelector('[data-go="${s.section}"]').click();
  await settle();
  const card = [...document.querySelectorAll(".sec:not([hidden]) details.card")]
    .find(d => d.querySelector(".k").textContent === ${JSON.stringify(s.card || "")});
  card.open = true;
  for (const d of document.querySelectorAll(".sec:not([hidden]) details.card"))
    if (${JSON.stringify(s.also?.[device] || [])}.includes(d.querySelector(".k").textContent)) d.open = true;
  if (${JSON.stringify(!!s.quiz)}) {
    document.getElementById("quiz").click();
    await settle();
    card.querySelector(".qrow")?.click();
  }
  await settle();
  const bar = document.querySelector(".bar");
  const offset = bar && getComputedStyle(bar).position === "sticky" ? bar.offsetHeight : 0;
  window.scrollTo(0, ${JSON.stringify(!!s.top)} ? 0 : card.getBoundingClientRect().top + scrollY - offset - 14);
})()`;

const profile = join(tmpdir(), "pilot-acronyms-shots");
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let target;
for (let i = 0; i < 50 && !target; i++) {
  await wait(200);
  try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find(t => t.type === "page"); } catch {}
}
if (!target) throw new Error("Chrome did not start");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (!pending.has(m.id)) return;
  if (m.error) console.error(m.error.message);
  pending.get(m.id)(m.result);
  pending.delete(m.id);
};
const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
await send("Page.enable");
for (const d of DEVICES) {
  await send("Emulation.setDeviceMetricsOverride", { width: d.width, height: d.height, deviceScaleFactor: d.scale, mobile: true });
  for (const [i, s] of SHOTS.entries()) {
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: s.theme }] });
    // Leave the page first so each shot loads fresh (a hash-only change would keep quiz mode and search),
    // and pick the starting section with the hash instead of the one the previous shot saved.
    await send("Page.navigate", { url: "about:blank" });
    await wait(200);
    await send("Page.navigate", { url: `${page}#${s.section || "aircraft"}` });
    await wait(1500);
    await send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => 1)", awaitPromise: true });
    const r = await send("Runtime.evaluate", { expression: act(s, d.name), awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(`shot ${i + 1} on ${d.name}: ${r.exceptionDetails.exception?.description}`);
    await wait(500);
    const file = join(out, `${d.name}-${i + 1}.png`);
    writeFileSync(file, Buffer.from((await send("Page.captureScreenshot", { format: "png" })).data, "base64"));
    console.log(`${d.name}-${i + 1}.png`);
  }
}
ws.close();
chrome.kill();
