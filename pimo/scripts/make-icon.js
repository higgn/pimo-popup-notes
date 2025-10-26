const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

const root = path.resolve(__dirname, '..');
// Prefer the user-provided 256 PNG; fall back to icon.png for compatibility
const preferred = path.join(root, 'icon-256x256.png');
const fallback = path.join(root, 'icon.png');
const pngPath = fs.existsSync(preferred) ? preferred : fallback;
const icoPath = path.join(root, 'icon.ico');

if (!pngPath || !fs.existsSync(pngPath)) {
  console.error('No source PNG found. Please add `icon-256x256.png` or `icon.png` to the project root and run `npm run make-icon`.');
  process.exit(1);
}

(async () => {
  try {
    const buf = await pngToIco(pngPath);
    fs.writeFileSync(icoPath, buf);
    console.log('icon.ico created at', icoPath);
  } catch (err) {
    console.error('Failed to create ico:', err);
    process.exit(1);
  }
})();
