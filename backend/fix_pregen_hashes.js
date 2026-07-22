// fix_pregen_hashes.js — Fix content hash mismatches between PNG copies and JPEG originals
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PREGEN_DIR = path.join(__dirname, 'uploads', 'pregenerated');
const DEMO_DIR = path.join(__dirname, '..', 'demo_data', 'anchors');

// Map: old hash (PNG-derived) -> product anchor
const HASH_MAP = {
  'b4c30d47a338': { anchor: 'croptop_front.jpeg', product: 'Crop Top' },
  '45fc92fe31f0': { anchor: 'kurti_front.jpeg', product: 'Kurti' },
  '9a7f2aba0dab': { anchor: 'jeans_front.jpeg', product: 'Jeans' },
  'f675857461f4': { anchor: 'tshirt_front.jpeg', product: 'T-Shirt' },
};

function computeHash(filePath) {
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(bytes.slice(0, 10240)).digest('hex').substring(0, 12);
}

const files = fs.readdirSync(PREGEN_DIR).filter(f => f.endsWith('.png'));
let copied = 0;

for (const [oldHash, info] of Object.entries(HASH_MAP)) {
  const anchorPath = path.join(DEMO_DIR, info.anchor);
  if (!fs.existsSync(anchorPath)) {
    console.log(`[SKIP] ${info.product}: anchor not found at ${anchorPath}`);
    continue;
  }
  const newHash = computeHash(anchorPath);
  console.log(`\n${info.product}: oldHash=${oldHash} newHash=${newHash}`);
  if (oldHash === newHash) { console.log('  Match'); continue; }
  const oldFiles = files.filter(f => f.startsWith(oldHash + '_'));
  for (const oldFile of oldFiles) {
    const newFile = oldFile.replace(oldHash, newHash);
    const newPath = path.join(PREGEN_DIR, newFile);
    if (!fs.existsSync(newPath)) { fs.copyFileSync(path.join(PREGEN_DIR, oldFile), newPath); copied++; }
  }
  console.log(`  Copied ${oldFiles.length} files`);
}

// Map 281f01f349dc matrix to real crop top hash
const cropTopHash = computeHash(path.join(DEMO_DIR, 'croptop_front.jpeg'));
const matrixFiles = files.filter(f => f.startsWith('281f01f349dc_'));
console.log(`\nMatrix 281f01f349dc -> ${cropTopHash}: ${matrixFiles.length} files`);
for (const oldFile of matrixFiles) {
  const newFile = oldFile.replace('281f01f349dc', cropTopHash);
  const newPath = path.join(PREGEN_DIR, newFile);
  if (!fs.existsSync(newPath)) { fs.copyFileSync(path.join(PREGEN_DIR, oldFile), newPath); copied++; }
}

console.log(`\nDone! Created ${copied} copies.`);
