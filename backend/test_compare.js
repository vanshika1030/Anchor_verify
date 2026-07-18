import { compareAttributesDeterministic, generateCorrections } from './services/gemini.js'

const anchorAttrs = {
  overall_length: { value: 'Knee Length / Midi', confidence: 'HIGH' },
  cv_overall_length: { value: 'Short / Hip Length', confidence: 'HIGH', ratio: '1.14' }
}

const catalogAttrs = {
  overall_length: { value: 'Not determinable', confidence: 'LOW' }
}

const declaredAttrs = {
  overall_length: 'Short / Hip Length'
}

const comparison = compareAttributesDeterministic(anchorAttrs, catalogAttrs, declaredAttrs)
console.log("Comparison result for overall_length:")
console.log(JSON.stringify(comparison.find(c => c.key === 'overall_length'), null, 2))

const corrections = generateCorrections(comparison, [])
console.log("\nCorrections suggested:")
console.log(JSON.stringify(corrections, null, 2))
