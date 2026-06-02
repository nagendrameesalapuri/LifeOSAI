import sharp from '../node_modules/sharp/lib/index.js';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'icons');
mkdirSync(OUT, { recursive: true });

// LIFEOS AI — dark gradient background + lightning bolt icon
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f0f1a"/>
      <stop offset="100%" stop-color="#1e1e36"/>
    </linearGradient>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="45%" stop-color="#c084fc"/>
      <stop offset="100%" stop-color="#22d3ee"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="115" fill="url(#bg)"/>
  <rect width="512" height="512" rx="115" fill="none" stroke="url(#grad)" stroke-width="4" opacity="0.35"/>
  <path d="M294 64 L162 280 L244 280 L218 448 L350 232 L268 232 L294 64Z" fill="url(#grad)"/>
  <circle cx="372" cy="148" r="14" fill="url(#grad)" opacity="0.55"/>
  <circle cx="148" cy="372" r="9" fill="url(#grad)" opacity="0.38"/>
</svg>`;

const buf = Buffer.from(SVG);

const sizes = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-maskable-192.png', size: 192, pad: true },
  { file: 'icon-maskable-512.png', size: 512, pad: true },
];

for (const { file, size, pad } of sizes) {
  const iconSize = pad ? Math.round(size * 0.8) : size;
  const offset = pad ? Math.round(size * 0.1) : 0;

  let pipeline = sharp(buf).resize(iconSize, iconSize);

  if (pad) {
    pipeline = pipeline.extend({
      top: offset, bottom: offset, left: offset, right: offset,
      background: { r: 15, g: 15, b: 26, alpha: 1 },
    });
  }

  await pipeline.png().toFile(path.join(OUT, file));
  console.log(`✓ ${file} (${size}px${pad ? ' maskable' : ''})`);
}

// Also copy icon.svg for browsers that support SVG favicons
writeFileSync(path.join(OUT, 'icon.svg'), SVG);
console.log('✓ icon.svg');
console.log('Icons generated successfully!');
