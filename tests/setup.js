import fs from 'fs';
import path from 'path';

// Read index.html
const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf-8');

// Parse and set the entire document
if (typeof DOMParser !== 'undefined') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  document.documentElement.innerHTML = doc.documentElement.innerHTML;

  // We need to polyfill fetch
  global.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ articles: [] }) });

  // Provide process.env to the window so test exports activate
  window.process = { env: { NODE_ENV: 'test' } };
}
