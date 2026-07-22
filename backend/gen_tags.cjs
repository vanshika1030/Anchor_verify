require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function run() {
  const products = [
    { name: 'croptop', meta: {garment_type: 'Crop Top', primary_color: 'Pink', pattern_type: 'Ribbed', fit: 'Slim', brand: 'StyleUp', hemline: 'Straight', neck_type: 'Round Neck'} },
    { name: 'tshirt', meta: {garment_type: 'T-Shirt', primary_color: 'Turquoise', pattern_type: 'Graphic', fit: 'Relaxed', brand: 'Roadster', neck_type: 'Round Neck'} },
    { name: 'kurti', meta: {garment_type: 'Kurti', primary_color: 'Blue', secondary_color: 'White', pattern_type: 'Printed', fit: 'Regular', brand: 'Libas', occasion_style: 'Festive'} },
    { name: 'jeans', meta: {garment_type: 'Jeans', primary_color: 'Blue', pattern_type: 'Solid', fit: 'Regular', brand: 'Wrangler', occasion_style: 'Casual'} }
  ];

  for (const p of products) {
    const prompt = `Act as an expert Gen-Z fashion trend analyst and SEO copywriter for Myntra.
Analyze this garment's aesthetic. Classify it into modern trends/subcultures (e.g. Y2K, Dark Academia, Streetwear, Old Money, Cottagecore, Indie, Grunge, Coquette, etc.).
Here is the current or base metadata: ${JSON.stringify(p.meta)}

Your task is to generate an ENHANCED version of the metadata. You must return valid JSON with these exact keys:
{
  "title": "A highly optimized, trendy product title (max 60 chars). Include a style keyword if relevant.",
  "description": "A 2-3 sentence product description that captures the vibe, aesthetic, and key details.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"]
}
Tags MUST include relevant Gen-Z trend names, aesthetic styles, regional/festival keywords, and functional descriptors.
Return ONLY valid JSON.`;

    try {
      const res = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }]
      });
      let out = res.choices[0].message.content;
      if (out.startsWith('```')) {
          out = out.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
      }
      console.log('Result for', p.name, ':', out);
    } catch (e) {
      console.log('Error for', p.name, ':', e.message);
    }
  }
}
run();
