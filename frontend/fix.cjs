const fs = require('fs');
let code = fs.readFileSync('C:/Users/vansh/.gemini/antigravity/scratch/anchor/frontend/src/pages/Verify.jsx', 'utf8');

// Fix the line where we messed up c.reason
code = code.replace(
  '<span style={{ fontWeight: 600 }}>{typeof c.val === \'object\' && c.val !== null ? c.val.value : c.reason}</span>',
  '<span style={{ marginLeft: 4 }}>{c.reason}</span>'
);

// Fix the actual bug with catalogExtracted val rendering
code = code.replace(
  '<span style={{ fontWeight: 600 }}>{val.value || val}</span>',
  '<span style={{ fontWeight: 600 }}>{typeof val === \'object\' && val !== null ? (val.value || \'\') : val}</span>'
);

fs.writeFileSync('C:/Users/vansh/.gemini/antigravity/scratch/anchor/frontend/src/pages/Verify.jsx', code);
console.log('Fixed Verify.jsx');
