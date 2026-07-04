const sharp = require("sharp");
const fs = require("fs");

const inputFile = "public/logo.png";
const outDir = "public/icons";

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

async function run() {
  // Regular icons: pad to square on white/transparent bg, then resize
  for (const size of [192, 512]) {
    await sharp(inputFile)
      .resize(size, size, {
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 0 }, // transparent bg
      })
      .toFile(`${outDir}/icon-${size}.png`);
  }

  // Maskable icon: needs ~20% padding so Android's crop doesn't cut off your logo
  const maskableSize = 512;
  const logoSize = Math.round(maskableSize * 0.6); // logo takes 60% of canvas
  await sharp(inputFile)
    .resize(logoSize, logoSize, { fit: "contain" })
    .extend({
      top: Math.round((maskableSize - logoSize) / 2),
      bottom: Math.round((maskableSize - logoSize) / 2),
      left: Math.round((maskableSize - logoSize) / 2),
      right: Math.round((maskableSize - logoSize) / 2),
      background: { r: 22, g: 163, b: 74, alpha: 1 }, // your theme green, adjust as needed
    })
    .toFile(`${outDir}/icon-maskable-512.png`);

  console.log("Icons generated in public/icons/");
}

run();