import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

let API_KEYS = [];
if (process.env.GEMINI_API_KEYS) {
  API_KEYS = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(k => k);
} else if (process.env.GEMINI_API_KEY) {
  API_KEYS = [process.env.GEMINI_API_KEY];
}

const OUTPUT_DIR = path.join(__dirname, 'uploads', 'pregenerated');
const DEMO_DIR = path.join(__dirname, '..', 'demo_data', 'anchors');

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const HEIGHTS = [
  { display: "5'2\"", code: '52' }, { display: "5'4\"", code: '54' },
  { display: "5'6\"", code: '56' }, { display: "5'8\"", code: '58' },
  { display: "5'10\"", code: '510' }, { display: "6'0\"", code: '60' },
];
const VIEWS = ['front', 'back', 'side', 'closeup', 'full'];
const BODY_DESC = {
  'XS': 'slim petite build', 'S': 'slim build', 'M': 'average regular build',
  'L': 'slightly fuller average-to-plus build', 'XL': 'plus-size curvy build', 'XXL': 'plus-size very curvy build',
};

// CRITICAL FIX: Pass the anchor image file name so we can attach it to the prompt!
const PRODUCTS = [
  {
    name: 'T-Shirt', hash: 'f675857461f4', anchorFile: 'tshirt_front.jpeg',
    desc: (size, height, body) =>
      `Professional Myntra e-commerce catalog photo. A single wide image containing exactly 5 vertical panels arranged horizontally side-by-side.
The panels show the SAME Indian female model (height ${height}, ${body}, size ${size}) wearing the EXACT same garment as shown in the provided reference image. You MUST perfectly preserve the graphic print, color, fabric, and sleeve length of the reference image.
Size ${size} fitting: ${SIZE_FIT[size]}
Height ${height} proportions: ${HEIGHT_PROP[height]}
Panel 1 (Left): Front view, full body, arms at sides.
Panel 2: Back view, turned 180 degrees.
Panel 3: Side profile view, turned 90 degrees.
Panel 4: Close-up detail of neck, fabric texture, and print pattern.
Panel 5 (Right): Full body editorial shot, natural confident pose.
White studio background, professional e-commerce lighting. All panels show identical model and garment.`
  },
  {
    name: 'Kurti', hash: '915e18ae47fb', anchorFile: 'kurti_front.jpeg',
    desc: (size, height, body) =>
      `Professional Myntra e-commerce catalog photo. A single wide image containing exactly 5 vertical panels arranged horizontally side-by-side.
The panels show the SAME Indian female model (height ${height}, ${body}, size ${size}) wearing the EXACT same garment as shown in the provided reference image. You MUST perfectly preserve the exact print pattern, colors, neck style, and fabric of the reference image.
Size ${size} fitting: ${SIZE_FIT[size]}
Height ${height} proportions: ${HEIGHT_PROP[height]}
Panel 1 (Left): Front view, full body, arms at sides.
Panel 2: Back view, turned 180 degrees.
Panel 3: Side profile view, turned 90 degrees.
Panel 4: Close-up detail of V-neck, printed pattern, and cotton fabric texture.
Panel 5 (Right): Full body editorial shot, natural confident pose.
White studio background, professional e-commerce lighting. All panels show identical model and garment.`
  },
  {
    name: 'Jeans', hash: '9a7f2aba0dab', anchorFile: 'jeans_front.jpeg',
    desc: (size, height, body) =>
      `Professional Myntra e-commerce catalog photo. A single wide image containing exactly 5 vertical panels arranged horizontally side-by-side.
The panels show the SAME Indian MALE model (height ${height}, ${body}, size ${size}) wearing the EXACT same garment as shown in the provided reference image. You MUST perfectly preserve the wash, color, distressing/rips, and denim texture of the reference image. Model is wearing a plain white t-shirt on top.
Size ${size} fitting: ${SIZE_FIT[size]}
Height ${height} proportions: ${HEIGHT_PROP[height]}
Panel 1 (Left): Front view, full body, showing full jeans from waist to ankle.
Panel 2: Back view, turned 180 degrees, back pockets visible.
Panel 3: Side profile view, showing slim fit silhouette.
Panel 4: Close-up detail of distressed/ripped sections and denim fabric texture.
Panel 5 (Right): Full body editorial shot, natural confident pose.
White studio background, professional e-commerce lighting. All panels show identical model and garment.`
  },
];

const SIZE_FIT = {
  'XS': 'Very snug fit, garment hugs body closely, minimal fabric excess',
  'S': 'Slightly fitted, natural body-skimming silhouette',
  'M': 'Standard regular fit, comfortable drape',
  'L': 'Slightly relaxed fit, gentle fabric ease',
  'XL': 'Noticeably relaxed fit, visible fabric ease around torso',
  'XXL': 'Very relaxed/oversized appearance, significant fabric excess',
};

const HEIGHT_PROP = {};
HEIGHTS.forEach(h => {
  if (h.code === '52') HEIGHT_PROP[h.display] = 'Shorter model, garment appears proportionally longer on body';
  if (h.code === '54') HEIGHT_PROP[h.display] = 'Petite-average model';
  if (h.code === '56') HEIGHT_PROP[h.display] = 'Average model height (standard)';
  if (h.code === '58') HEIGHT_PROP[h.display] = 'Slightly taller, garment sits higher relative to body';
  if (h.code === '510') HEIGHT_PROP[h.display] = 'Tall model, garment appears proportionally shorter';
  if (h.code === '60') HEIGHT_PROP[h.display] = 'Very tall model, significant length difference visible';
});

let keyIndex = 0;
function getNextKey() {
  const key = API_KEYS[keyIndex % API_KEYS.length];
  keyIndex++;
  return key;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
}

async function generateComposite(prompt, anchorPath, retries = 3) {
  const imagePart = fileToGenerativePart(anchorPath, "image/jpeg");
  
  for (let attempt = 0; attempt < retries; attempt++) {
    const apiKey = getNextKey();
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: [{ role: 'user', parts: [imagePart, { text: prompt }] }],
        config: { responseModalities: ['IMAGE', 'TEXT'] },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
          return Buffer.from(part.inlineData.data, 'base64');
        }
      }
      console.log('  No image in response, retrying...');
    } catch (err) {
      if (err.message?.includes('429') || err.message?.includes('rate')) {
        console.log(`  Rate limited (attempt ${attempt + 1}), waiting 30s...`);
        await sleep(30000);
      } else {
        console.log(`  Error (attempt ${attempt + 1}): ${err.message}`);
        await sleep(5000);
      }
    }
  }
  return null;
}

async function sliceComposite(compositeBuffer, hash, size, heightCode) {
  const metadata = await sharp(compositeBuffer).metadata();
  const panelWidth = Math.floor(metadata.width / 5);
  const results = [];
  for (let i = 0; i < 5; i++) {
    const view = VIEWS[i];
    const outputPath = path.join(OUTPUT_DIR, `${hash}_${size}_${heightCode}_${view}.png`);
    await sharp(compositeBuffer)
      .extract({ left: i * panelWidth, top: 0, width: panelWidth, height: metadata.height })
      .png()
      .toFile(outputPath);
    results.push(outputPath);
  }
  return results;
}

async function main() {
  for (const product of PRODUCTS) {
    console.log(`\nProcessing: ${product.name}`);
    const anchorPath = path.join(DEMO_DIR, product.anchorFile);
    
    for (const size of SIZES) {
      for (const height of HEIGHTS) {
        const tag = `${product.hash}_${size}_${height.code}`;
        if (fs.existsSync(path.join(OUTPUT_DIR, `${tag}_front.png`))) continue;
        
        console.log(`  [GEN] ${product.name} ${size}/${height.display}...`);
        const prompt = product.desc(size, height.display, BODY_DESC[size]);
        const compositeBuffer = await generateComposite(prompt, anchorPath);
        if (!compositeBuffer) continue;
        
        try {
          await sliceComposite(compositeBuffer, product.hash, size, height.code);
          console.log(`  [OK] Saved`);
        } catch (err) {
          console.log(`  [FAIL] Slice failed: ${err.message}`);
        }
        await sleep(2000);
      }
    }
  }
}
main().catch(console.error);
