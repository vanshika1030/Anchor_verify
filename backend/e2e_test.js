import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

async function runTests() {
  const BASE_URL = 'http://localhost:3001/api/verify';
  const b1 = path.join(process.cwd(), 'uploads', '1784328513254-b1.jpeg');
  const b2 = path.join(process.cwd(), 'uploads', '1784328513262-b2.jpeg');
  const mismatched = path.join(process.cwd(), 'uploads', '1784328993251-b1.jpeg');

  console.log("=========================================");
  console.log("TEST 1: Generate Mode (Single Anchor Image)");
  console.log("=========================================");
  try {
    const form = new FormData();
    form.append('mode', 'generate');
    form.append('anchorImages', fs.createReadStream(b1));
    form.append('anchorExtracted', JSON.stringify({ garment_type: { value: 'Kurti' }}));
    form.append('declaredAttrs', JSON.stringify({ model_height: "5'5", model_size: 'S' }));

    const res = await axios.post(BASE_URL, form, { headers: form.getHeaders() });
    console.log("STATUS:", res.status);
    console.log("VERDICT:", res.data.verdict?.status);
    console.log("GENERATED IMAGE URL:", res.data.generatedMetadata?.generated_image_url);
    console.log("GENERATED TITLE:", res.data.generatedMetadata?.title);
  } catch (err) {
    console.error("Test 1 Failed:", err.response?.data || err.message);
  }

  console.log("\n=========================================");
  console.log("TEST 2: Verify Mode (Matching Pair)");
  console.log("=========================================");
  try {
    const form = new FormData();
    form.append('mode', 'verify');
    form.append('anchorImages', fs.createReadStream(b1));
    form.append('catalogImages', fs.createReadStream(b2));
    form.append('anchorExtracted', JSON.stringify({ 
      garment_type: { value: 'Kurti' },
      pattern_type: { value: 'Floral' },
      primary_color: { value: 'Red' }
    }));
    form.append('declaredAttrs', JSON.stringify({}));

    const res = await axios.post(BASE_URL, form, { headers: form.getHeaders() });
    console.log("STATUS:", res.status);
    console.log("CLIP MATCH:", res.data.fabricResult?.fabric_matches_anchor, `(Score: ${res.data.fabricResult?.similarity_score})`);
    console.log("VERDICT:", res.data.verdict?.status);
  } catch (err) {
    console.error("Test 2 Failed:", err.response?.data || err.message);
  }
}

runTests();
