import path from 'node:path';
import fs from 'node:fs/promises';
import sharp from 'sharp';

const svgSource = path.resolve('resources/icons/icon.svg');
const outputDir = path.resolve('resources/icons');
const sizes = [32, 192, 512];

async function ensureSourceExists() {
  try {
    await fs.access(svgSource);
  } catch {
    throw new Error(`Icon source not found at ${svgSource}`);
  }
}

async function generatePng(size: number) {
  const target = path.join(outputDir, `${size}x${size}.png`);
  await sharp(svgSource)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(target);
  return target;
}

async function main() {
  await ensureSourceExists();
  const results = await Promise.all(sizes.map(generatePng));
  results.forEach((file) => console.log(`Generated ${file}`));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

