import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, 'demo_registry.js');
let content = fs.readFileSync(filePath, 'utf8');

// Replace keys
content = content.replace(/ anchor: /g, ' anchor_value: ');
content = content.replace(/ catalog: /g, ' catalog_value: ');
content = content.replace(/ declared: /g, ' declared_value: ');
content = content.replace(/ confidence: /g, ' anchor_confidence: ');

// Add catalog_confidence based on anchor_confidence
content = content.replace(/anchor_confidence: '([^']+)'/g, "anchor_confidence: '$1', catalog_confidence: '$1'");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed demo_registry.js');
