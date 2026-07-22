const fs = require('fs');

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const HEIGHTS = [
  { display: "5'2\"", code: '52' },
  { display: "5'4\"", code: '54' },
  { display: "5'6\"", code: '56' },
  { display: "5'8\"", code: '58' },
  { display: "5'10\"", code: '510' },
  { display: "6'0\"", code: '60' },
];

const BODY_DESC = {
  'XS': 'slim petite build',
  'S': 'slim build',
  'M': 'average regular build',
  'L': 'slightly fuller average-to-plus build',
  'XL': 'plus-size curvy build',
  'XXL': 'plus-size very curvy build',
};

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

const PRODUCTS = [
  {
    name: 'T-Shirt',
    hash: 'f675857461f4',
    gender: 'Indian female',
    desc: (size, height, body) =>
      `Professional Myntra e-commerce catalog photo. A single wide image containing exactly 5 vertical panels arranged horizontally side-by-side.
The panels show the SAME Indian female model (height ${height}, ${body}, size ${size}) wearing the EXACT same garment: Blue/Turquoise Graphic Print Cotton Blend T-Shirt with Round Neck, Short Sleeves, Regular fit, Straight hemline.
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
    name: 'Kurti',
    hash: '915e18ae47fb',
    gender: 'Indian female',
    desc: (size, height, body) =>
      `Professional Myntra e-commerce catalog photo. A single wide image containing exactly 5 vertical panels arranged horizontally side-by-side.
The panels show the SAME Indian female model (height ${height}, ${body}, size ${size}) wearing the EXACT same garment: Blue Printed Cotton Kurti with White accents, V-Neck, Three-Quarter sleeves, Knee Length, Regular fit, Curved hemline.
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
    name: 'Jeans',
    hash: '9a7f2aba0dab',
    gender: 'Indian male',
    desc: (size, height, body) =>
      `Professional Myntra e-commerce catalog photo. A single wide image containing exactly 5 vertical panels arranged horizontally side-by-side.
The panels show the SAME Indian MALE model (height ${height}, ${body}, size ${size}) wearing the EXACT same garment: Dark Blue Distressed Denim Jeans, Slim Fit, Full Length, Straight hemline. Model is wearing a plain white t-shirt on top.
Size ${size} fitting: ${SIZE_FIT[size]}
Height ${height} proportions: ${HEIGHT_PROP[height]}
Panel 1 (Left): Front view, full body, showing full jeans from waist to ankle.
Panel 2: Back view, turned 180 degrees, back pockets visible.
Panel 3: Side profile view, showing slim fit silhouette.
Panel 4: Close-up detail of distressed/ripped sections and denim fabric texture.
Panel 5 (Right): Full body editorial shot, natural confident pose.
White studio background, professional e-commerce lighting. All panels show identical model and garment.`
  }
];

const tasks = [];
for (const p of PRODUCTS) {
  for (const s of SIZES) {
    for (const h of HEIGHTS) {
      tasks.push({
        hash: p.hash,
        size: s,
        heightCode: h.code,
        prompt: p.desc(s, h.display, BODY_DESC[s])
      });
    }
  }
}

fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));
console.log('Generated tasks.json with ' + tasks.length + ' tasks.');
