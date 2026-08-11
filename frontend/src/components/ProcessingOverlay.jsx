import { useState, useEffect, useCallback } from 'react'
import { Check, Loader2, Anchor } from 'lucide-react'

const STEPS = [
  'Visual identity gate (CLIP + pHash)',
  'ViT attribute extraction (19 attributes)',
  'Garment segmentation & isolation',
  'Fabric texture verification',
  'Size chart cross-validation',
  'Bayesian three-source fusion',
  'Trust verdict & corrections',
]

export default function ProcessingOverlay({ onComplete }) {
  const [done, setDone] = useState(0)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const timers = STEPS.map((_, i) =>
      setTimeout(() => setDone(i + 1), 500 + i * 550)
    )
    const prog = setInterval(() => setPct(p => Math.min(p + 2, 100)), 85)
    const end = setTimeout(onComplete, 4600)
    return () => { timers.forEach(clearTimeout); clearTimeout(end); clearInterval(prog) }
  }, [onComplete])

  return (
    <div className="proc-overlay" style={{
      background: 'radial-gradient(circle at 30% 20%, rgba(168, 70, 108, 0.15), transparent 50%), radial-gradient(circle at 70% 80%, rgba(210, 119, 98, 0.12), transparent 50%), linear-gradient(135deg, rgba(33, 24, 32, 0.92) 0%, rgba(26, 21, 26, 0.96) 100%)',
      backdropFilter: 'blur(16px)',
    }}>
      <div className="proc-card" style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        color: 'white',
        padding: '44px',
        borderRadius: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '14px',
            background: 'linear-gradient(145deg, rgba(168,70,108,0.3), rgba(210,119,98,0.2))',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'grid', placeItems: 'center',
          }}>
            <Anchor size={22} color="rgba(255,255,255,0.9)" />
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Anchor <span style={{ color: '#e7a3b8' }}>Verify</span>
          </div>
        </div>
        <div className="proc-title" style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', fontWeight: 500 }}>
          Running 7-layer verification pipeline...
        </div>
        <ul className="proc-steps" style={{ marginTop: '20px' }}>
          {STEPS.map((s, i) => {
            const isDone = i < done
            const isActive = i === done - 1 && done < STEPS.length
            const isVisible = i < done + 1
            return (
              <li key={s} className={`proc-step ${isVisible ? 'visible' : ''} ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`} style={{
                color: isDone ? '#4ade80' : isActive ? 'white' : 'rgba(255,255,255,0.25)',
                fontWeight: isActive ? 600 : 400,
                padding: '7px 0',
                transition: 'all 0.4s ease',
              }}>
                <span style={{ width: 20, textAlign: 'center', display: 'inline-flex', justifyContent: 'center' }}>
                  {isDone ? <Check size={14} /> : isActive ? <span className="spinner" /> : <span style={{ opacity: 0.3 }}>·</span>}
                </span>
                <span style={{ fontSize: '13px' }}>{s}</span>
              </li>
            )
          })}
        </ul>
        <div className="prog-bar" style={{ background: 'rgba(255,255,255,0.06)', marginTop: '28px', height: '5px', borderRadius: '999px' }}>
          <div className="prog-fill" style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #a8466c, #d27762, #c99553)',
            boxShadow: '0 0 16px rgba(168,70,108,0.4)',
            borderRadius: '999px',
            transition: 'width 0.3s ease',
          }} />
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
          {pct < 100 ? 'Analyzing product evidence...' : 'Finalizing verdict...'}
        </div>
      </div>
    </div>
  )
}

