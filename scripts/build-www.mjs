// Builds www/ from pilot-acronyms.html, the published chart page: wraps it in a full HTML document,
// swaps Google Fonts for bundled font files, and lets links open in the system browser.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "pilot-acronyms.html");
const www = join(root, "www");
rmSync(join(www, "fonts"), { recursive: true, force: true });
mkdirSync(join(www, "fonts"), { recursive: true });

const fonts = [
  ["Barlow Condensed", "barlow-condensed", [700]],
  ["Public Sans", "public-sans", [400, 600]],
  ["IBM Plex Mono", "ibm-plex-mono", [400, 500]],
];
let fontCss = "";
for (const [family, pkg, weights] of fonts) {
  for (const w of weights) {
    const file = `${pkg}-latin-${w}-normal.woff2`;
    copyFileSync(join(root, "node_modules", "@fontsource", pkg, "files", file), join(www, "fonts", file));
    fontCss += `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${file}) format("woff2")}\n`;
  }
}

let page = readFileSync(src, "utf8");
page = page.replace(/<link rel="preconnect"[^>]*>\n/g, "");
page = page.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\n/, `<style>\n${fontCss}</style>\n`);
// Plain links navigate away from the app, which Capacitor hands to the system browser.
page = page.replace(/ target="_blank" rel="noopener"/g, "");
if (page.includes("fonts.googleapis.com")) throw new Error("Google Fonts link was not replaced");

// Same base the artifact viewer adds around a published page.
const reset = `<style>
:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px system-ui,sans-serif}
img{max-width:100%}
[hidden]{display:none!important}
</style>`;

writeFileSync(join(www, "index.html"), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=contain">
<script>
// On iPhone, draw behind the status bar and home indicator; the page pads itself with env(safe-area-inset-*)
// and paints the status bar band in its own colors. Android keeps the system's padding.
if (window.Capacitor && Capacitor.getPlatform && Capacitor.getPlatform() === "ios")
  document.querySelector('meta[name="viewport"]').content = "width=device-width, initial-scale=1, viewport-fit=cover";
</script>
${reset}
${page.replace(/<div class="app">/, "</head>\n<body>\n<div class=\"app\">")}
</body>
</html>
`);
console.log("www/index.html written");

// Public pages for the store listings, served by GitHub Pages from the repository root.
const REPO = "https://github.com/kmkoehn/pilot-acronyms";
const publicPage = (file, title, body) => {
  writeFileSync(join(root, file), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} | Pilot Acronyms</title>
<style>
:root{color-scheme:light dark}
body{margin:0 auto;max-width:68ch;padding:32px 16px 64px;font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
h1{font-size:1.75rem;line-height:1.2;margin:0 0 4px}
h2{font-size:1.05rem;margin:24px 0 4px}
p,ul{margin:0 0 10px}
</style>
</head>
<body>
${body}
</body>
</html>
`);
  console.log(`${file} written`);
};

// The in-app privacy policy, for the stores' privacy policy URL.
const privacySrc = page.match(/const PRIVACY = (\{[\s\S]*?\n\});/);
if (!privacySrc) throw new Error("PRIVACY block not found");
const privacy = new Function(`return ${privacySrc[1]}`)();
publicPage("privacy-policy.html", "Privacy Policy", `<h1>Privacy Policy</h1>
<p>Pilot Acronyms for iPhone, iPad, and Android. Effective ${privacy.effective}.</p>
<p>${privacy.intro}</p>
${privacy.sections.map(([h, p]) => `<h2>${h}</h2>\n<p>${p}</p>`).join("\n")}`);

// The stores' support URL.
publicPage("support.html", "Support", `<h1>Pilot Acronyms support</h1>
<p>Pilot Acronyms is a study aid for private pilot students, for iPhone, iPad, and Android. It explains the acronyms, mnemonics, and key numbers that come up in ground school and on the oral exam.</p>
<h2>Report an error or ask a question</h2>
<p>Open an issue at <a href="${REPO}/issues">${REPO}/issues</a>. Please include the section and card name, what it says, and where the correct information comes from, such as a 14 CFR section or an AIM paragraph.</p>
<h2>Common questions</h2>
<ul>
<li><strong>Does it need an internet connection?</strong> No. Everything works offline. Links to official websites open in your browser.</li>
<li><strong>Do I need an account?</strong> No. The app has no accounts, ads, or tracking.</li>
<li><strong>How do I hide the answers to quiz myself?</strong> Turn on Quiz in the header, then tap a line to reveal its answer.</li>
<li><strong>How do I find something fast?</strong> Use the search box. It searches every section and the abbreviation decoder.</li>
</ul>
<h2>Disclaimer</h2>
<p>Pilot Acronyms is an independent study aid. It is not affiliated with or endorsed by the FAA or any other government agency. It does not replace your flight instructor, your aircraft's POH or AFM, or an official weather briefing, and it must not be used for flight planning or in flight.</p>
<p><a href="privacy-policy.html">Privacy policy</a></p>`);
