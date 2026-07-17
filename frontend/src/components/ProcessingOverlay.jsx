import { useState, useEffect, useCallback } from 'react'
import { Check, Loader2 } from 'lucide-react'

const STEPS = [
  'Garment segmented',
  'Attributes extracted from anchor',
  'Catalog images analyzed',
  'Three-way attribute comparison',
  'Fabric texture verification',
  'Computing visual similarity',
  'Generating verdict',
]

export default function ProcessingOverlay({ onComplete }) {
  const [done, setDone] = useState(0)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setDone(i + 1), 500 + i * 500)
    )
    const prog = setInterval(() => setPct(p => Math.min(p + 2.5, 100)), 90)
    const end = setTimeout(onComplete, 4200)
    return () => { timers.forEach(clearTimeout); clearTimeout(end); clearInterval(prog) }
  }, [onComplete])

  return (
    <div className="proc-overlay">
      <div className="proc-card">
        <div className="proc-title">Verifying listing integrity</div>
        <ul className="proc-steps">
          {STEPS.map((s, i) => {
            const isDone = i < done
            const isActive = i === done - 1 && done < STEPS.length
            const isVisible = i < done + 1
            return (
              <li key={s} className={`proc-step ${isVisible ? 'visible' : ''} ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                <span style={{ width: 18, textAlign: 'center' }}>
                  {isDone ? <Check size={14} /> : isActive ? <span className="spinner" /> : '\u00B7'}
                </span>
                {s}
              </li>
            )
          })}
        </ul>
        <div className="prog-bar"><div className="prog-fill" style={{ width: `${pct}%` }} /></div>
        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--text-tertiary)' }}>
          Processing — approx 8 seconds
        </div>
      </div>
    </div>
  )
}
