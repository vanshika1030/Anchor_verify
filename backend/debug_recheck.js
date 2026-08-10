// Debug script to see actual recheck response
import { createEvidenceBinding, getEvidenceProfileById } from './evidence_profile.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const kurtiProfile = getEvidenceProfileById('kurti');
console.log('Profile found:', !!kurtiProfile);
console.log('Profile ID:', kurtiProfile?.productId);

const kurtiAnchors = [
  path.resolve(__dirname, 'demo_data/anchors/kurti_front.jpeg'),
  path.resolve(__dirname, 'demo_data/anchors/kurti_back.jpeg'),
  path.resolve(__dirname, 'demo_data/anchors/kurti_closeup.jpeg'),
];

const binding = createEvidenceBinding(kurtiProfile, kurtiAnchors);
console.log('Binding created:', binding.substring(0, 40) + '...');

const body = JSON.stringify({
  editedClaims: { articleType: 'Kurti', primaryColour: 'Blue', pattern: 'Printed', sleeveLength: 'Three-Quarter', garmentLength: 'Knee Length', neckType: 'V-Neck', fit: 'Regular', fabric: 'Cotton' },
  profileId: 'kurti',
  evidenceBinding: binding
});

const resp = await fetch('http://localhost:3001/api/verify/recheck', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body
});

console.log('Status:', resp.status);
const data = await resp.json();
console.log('Response keys:', Object.keys(data));
console.log('Full response (first 3000 chars):', JSON.stringify(data, null, 2).substring(0, 3000));
