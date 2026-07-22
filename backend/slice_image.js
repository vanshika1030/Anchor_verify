import sharp from 'sharp';
import path from 'path';

const [inputFile, hash, size, heightCode] = process.argv.slice(2);
const OUTPUT_DIR = 'C:/Users/vansh/.gemini/antigravity/scratch/anchor/backend/uploads/pregenerated';
const VIEWS = ['front', 'back', 'side', 'closeup', 'full'];

async function slice() {
  console.log(`Slicing ${inputFile} into 5 panels for ${hash}_${size}_${heightCode}...`);
  const metadata = await sharp(inputFile).metadata();
  const panelWidth = Math.floor(metadata.width / 5);
  for (let i = 0; i < 5; i++) {
    const view = VIEWS[i];
    const outputPath = path.join(OUTPUT_DIR, `${hash}_${size}_${heightCode}_${view}.png`);
    await sharp(inputFile)
      .extract({ left: i * panelWidth, top: 0, width: panelWidth, height: metadata.height })
      .png()
      .toFile(outputPath);
    console.log(`Saved ${outputPath}`);
  }
}

slice().catch(err => {
  console.error("Slice failed:", err);
  process.exit(1);
});
