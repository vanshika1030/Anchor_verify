import { extractAnchorAttributes } from './services/gemini.js'

async function run() {
  const result = await extractAnchorAttributes(['uploads/1784333294976-b1.jpeg'])
  console.log(JSON.stringify(result, null, 2))
}

run().catch(console.error)
