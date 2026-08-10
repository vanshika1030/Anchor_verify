// Quick test of the /api/verify/recheck endpoint. Start `npm start` first.
import { createEvidenceBinding, findEvidenceProfile } from './evidence_profile.js'

const anchorPaths = [
  '../demo_data/anchors/kurti_front.jpeg',
  '../demo_data/anchors/kurti_back.jpeg',
  '../demo_data/anchors/kurti_closeup.jpeg',
]
const profileMatch = findEvidenceProfile(anchorPaths)
if (!profileMatch) throw new Error('Exact Kurti fixture was not found')

const body = JSON.stringify({
  editedClaims: {
    articleType: 'Kurti',
    primaryColour: 'Red',
    pattern: 'Solid',
    sleeveLength: 'Full Sleeve',
    garmentLength: 'Knee Length',
    fabric: 'Cotton',
    neckType: 'V-Neck',
    fit: 'Regular'
  },
  profileId: 'kurti',
  evidenceBinding: createEvidenceBinding(profileMatch.profile, anchorPaths),
});

fetch('http://localhost:3001/api/verify/recheck', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body
})
.then(r => r.json())
.then(data => {
  console.log('Success:', data.success);
  console.log('Overall:', data.summary?.overallVerdict);
  console.log('Claims:');
  (data.claims || []).forEach(c => {
    console.log('  ' + c.label + ': ' + c.verdict + ' | seller=' + c.sellerValue + ' | evidence=' + c.anchorObservation);
  });
  console.log('Tags - Verified:', data.tags?.verifiedDescriptors?.length || 0);
  console.log('Tags - Aesthetic:', data.tags?.aestheticSuggestions?.map(t => t.tag).join(', '));
})
.catch(err => console.error('Error:', err));
