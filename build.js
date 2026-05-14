// Renders content/copy.md into index.html and writes the result to dist/.
// Placeholder syntax: {{key}} = inline (no <p> wrap), {{{key}}} = block.
const fs = require('node:fs');
const path = require('node:path');
const { marked } = require('marked');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const COPY_MD = path.join(ROOT, 'content', 'copy.md');
const TEMPLATE = path.join(ROOT, 'index.html');

const EXCLUDE = new Set([
  'build.js', 'package.json', 'package-lock.json', 'node_modules',
  'netlify.toml', 'dist', 'content', 'index.html', 'README.md',
  'FigGrotesk_Web.zip',
]);
const shouldSkip = (name) => EXCLUDE.has(name) || name.startsWith('.');

function parseCopy(text) {
  const map = {};
  let key = null;
  let buf = [];
  const flush = () => { if (key) map[key] = buf.join('\n').trim(); };
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^##\s+(.+)$/);
    if (m) { flush(); key = m[1].trim(); buf = []; }
    else if (key) buf.push(line);
  }
  flush();
  return map;
}

function render(html, copy) {
  const missing = new Set();
  const get = (key, fn) => {
    if (!(key in copy)) { missing.add(key); return null; }
    return fn(copy[key]).trim();
  };
  html = html.replace(/\{\{\{([\w.]+)\}\}\}/g, (m, key) => get(key, marked.parse) ?? m);
  html = html.replace(/\{\{([\w.]+)\}\}/g, (m, key) => get(key, marked.parseInline) ?? m);
  if (missing.size) {
    console.error('Missing copy keys:', [...missing].join(', '));
    process.exit(1);
  }
  return html;
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

const copy = parseCopy(fs.readFileSync(COPY_MD, 'utf8'));
const built = render(fs.readFileSync(TEMPLATE, 'utf8'), copy);
fs.writeFileSync(path.join(DIST, 'index.html'), built);

for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (shouldSkip(entry.name)) continue;
  fs.cpSync(path.join(ROOT, entry.name), path.join(DIST, entry.name), { recursive: true });
}

console.log(`Built ${Object.keys(copy).length} copy blocks into dist/index.html`);
