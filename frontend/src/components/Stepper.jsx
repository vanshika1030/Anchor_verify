import { Check } from 'lucide-react'

export default function Stepper({ steps, current }) {
  return (
    <div className="stepper">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
            {i > 0 && <div className={`step-line ${i <= current ? 'done' : ''}`} />}
            <div className={`step ${done ? 'done' : active ? 'active' : ''}`}>
              <div className="step-dot">
                {done ? <Check size={14} /> : i + 1}
              </div>
              <span className="step-text">{label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
