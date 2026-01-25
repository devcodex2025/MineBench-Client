const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico');

const input = path.join(__dirname, '..', 'public', 'MineBench.png');
const outDir = path.join(__dirname, '..', 'build');
const out = path.join(outDir, 'icon.ico');

(async () => {
  try {
    if (!fs.existsSync(input)) {
      console.error('Input PNG not found:', input);
      process.exit(1);
    }
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    const buf = await pngToIco(input);
    fs.writeFileSync(out, buf);
    console.log('Icon written to', out);
  } catch (err) {
    console.error('Failed to create icon:', err);
    process.exit(1);
  }
})();