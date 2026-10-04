const path = require('path');
const fs = require('fs');

async function generatePngs() {
  const sharp = require('sharp');
  const svgPath = path.resolve(__dirname, '../apps/web/public/icons/icon.svg');
  const out192 = path.resolve(__dirname, '../apps/web/public/icons/icon-192.png');
  const out512 = path.resolve(__dirname, '../apps/web/public/icons/icon-512.png');

  const svgBuffer = fs.readFileSync(svgPath);

  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(out192);

  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(out512);

  console.log('Successfully generated icon-192.png and icon-512.png!');
}

generatePngs().catch(console.error);
