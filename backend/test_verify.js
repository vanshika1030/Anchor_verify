import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const formData = new FormData();
  formData.append('anchorImages', fs.createReadStream(path.join(__dirname, '..', 'uploads', 'croptop_temp.jpeg')));
  formData.append('mode', 'generate');
  formData.append('attributes', JSON.stringify({size: 'XL', modelHeight: "5'4\""}));
  formData.append('category', 'Topwear');

  console.log("Sending request to /api/verify...");
  try {
    const res = await fetch('http://localhost:3001/api/verify', {
      method: 'POST',
      body: formData
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
run();
