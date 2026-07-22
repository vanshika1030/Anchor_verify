const fs = require('fs');
let lines = fs.readFileSync('backend/demo_registry.js', 'utf8').split('\n');
lines.splice(32, 73, `// EXPECTED DECLARED ATTRS
const DEMO_DECLARED_ATTRS = {
  // Product 1: Pink Ribbed Crop Top -> PASS
  croptop: {
    garment_type: 'T-Shirt',
    primary_color: 'Pink',
    secondary_color: 'None',
    pattern_type: 'Solid',
    neck_type: 'Round Neck',
    sleeve_length: 'Short Sleeve',
    fit: 'Slim',
    fabric_composition: 'Polyester Blend',
    occasion_style: 'Casual',
    overall_length: 'Crop',
    hemline: 'Straight',
    brand: 'StyleUp',
    model_size: 'S',
    model_height: '5\\'8',
  },

  // Product 2: Blue Cotton T-Shirt -> WARNING (fabric mismatch)
  tshirt: {
    garment_type: 'T-Shirt',
    primary_color: 'Turquoise',
    secondary_color: 'None',
    pattern_type: 'Graphic',
    neck_type: 'Round Neck',
    sleeve_length: 'Short Sleeve',
    fit: 'Relaxed',
    fabric_composition: '100% Cotton',
    occasion_style: 'Casual',
    overall_length: 'Hip Length',
    hemline: 'Straight',
    brand: 'Roadster',
    model_size: 'M',
    model_height: '6\\'0',
  },

  // Product 3: Blue Printed Kurti -> FAIL (visual mismatch + length + model)
  kurti: {
    garment_type: 'Kurti',
    primary_color: 'Blue',
    secondary_color: 'White',
    pattern_type: 'Printed',
    neck_type: 'V-Neck',
    sleeve_length: 'Three-Quarter',
    fit: 'Regular',
    fabric_composition: 'Cotton',
    occasion_style: 'Festive',
    overall_length: 'Knee Length',
    hemline: 'Curved',
    brand: 'Libas',
    model_size: 'S',
    model_height: '5\\'6',
  },

  // Product 4: Jeans -> PASS (cross-category)
  jeans: {
    garment_type: 'Jeans',
    primary_color: 'Blue',
    secondary_color: '',
    pattern_type: 'Solid',
    fit: 'Regular',
    fabric_composition: 'Denim',
    occasion_style: 'Casual',
    overall_length: 'Ankle Length',
    brand: 'Wrangler',
    model_size: '32',
    model_height: '6\\'1',
  }
};`);
fs.writeFileSync('backend/demo_registry.js', lines.join('\n'));
console.log('Fixed registry');
