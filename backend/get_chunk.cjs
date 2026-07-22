const fs = require('fs');
const chunkIndex = parseInt(process.argv[2], 10);
const CHUNK_SIZE = 6;
const tasks = JSON.parse(fs.readFileSync('tasks.json', 'utf8'));
const chunk = tasks.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE);
console.log(JSON.stringify(chunk, null, 2));
