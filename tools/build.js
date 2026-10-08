#!/usr/bin/env node
/* Bundles WebOS into one self-contained HTML file: dist/webos.html
 * Usage: node tools/build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) =>
  `<style>\n${fs.readFileSync(path.join(root, href), 'utf8')}\n</style>`);

html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script>/* ${src} */\n${code}\n</script>`;
});

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'webos.html');
fs.writeFileSync(out, html);
console.log(`Built ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
