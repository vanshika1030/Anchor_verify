import { useState, useEffect, useCallback } from 'react'
import { Check, Loader2, Anchor } from 'lucide-react'

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
    <div className="proc-overlay" style={{ background: 'linear-gradient(135deg, rgba(40, 44, 63, 0.8) 0%, rgba(26, 29, 38, 0.9) 100%)', backdropFilter: 'blur(12px)' }}>
      <div className="proc-card" style={{ 
        background: 'rgba(255, 255, 255, 0.05)', 
        border: '1px solid rgba(255, 255, 255, 0.1)', 
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        color: 'white',
        padding: '40px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
          <Anchor size={28} color="var(--accent)" />
          <div style={{ fontSize: '22px', fontWeight: 700 }}>Anchor <span style={{ color: 'var(--accent)' }}>Verify</span></div>
        </div>
        <div className="proc-title" style={{ color: 'rgba(255,255,255,0.9)' }}>Verifying listing integrity...</div>
        <ul className="proc-steps">
          {STEPS.map((s, i) => {
            const isDone = i < done
            const isActive = i === done - 1 && done < STEPS.length
            const isVisible = i < done + 1
            return (
              <li key={s} className={`proc-step ${isVisible ? 'visible' : ''} ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`} style={{ 
                color: isDone ? 'var(--success)' : isActive ? 'white' : 'rgba(255,255,255,0.4)',
                fontWeight: isActive ? 600 : 400
              }}>
                <span style={{ width: 18, textAlign: 'center' }}>
                  {isDone ? <Check size={14} /> : isActive ? <span className="spinner" /> : '\u00B7'}
                </span>
                {s}
              </li>
            )
          })}
        </ul>
        <div className="prog-bar" style={{ background: 'rgba(255,255,255,0.1)' }}><div className="prog-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #FF3F6C, #F77062)', boxShadow: '0 0 10px rgba(255,63,108,0.5)' }} /></div>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          Processing — approx 8 seconds
        </div>
      </div>
    </div>
  )
}
