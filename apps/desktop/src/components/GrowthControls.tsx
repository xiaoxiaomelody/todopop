import { useTaskStore } from '../store/taskStore';
import type { Side } from '@todopop/shared';
export function GrowthControls() {
  const s = useTaskStore();
  return (
    <div className="growth-controls">
      <div className="field-line">
        <span className="eyebrow">Growth</span>
        <div className="segmented" aria-label="Growth mode">
          {(['real', 'demo'] as const).map((mode) => (
            <button
              key={mode}
              aria-pressed={s.growthMode === mode}
              onClick={() => void s.run(() => window.todopop.growthMode(mode))}
            >
              {mode === 'real' ? 'Real speed' : 'Demo · 60×'}
            </button>
          ))}
        </div>
      </div>
      <p className="hint">
        {s.full
          ? '95% covered · growth stopped'
          : s.growthMode === 'demo'
            ? 'Preview growth only. Task actions are real.'
            : 'Now! grows 1 logical cm every 2 minutes.'}
      </p>
      <div className="side-buttons">
        <button
          aria-label="Shuffle bubbles"
          onClick={() => void s.run(() => window.todopop.arrange('shuffle'))}
        >
          ⤨
        </button>
        {(['any', 'left', 'top', 'bottom', 'right'] as Side[]).map((side) => (
          <button
            key={side}
            aria-label={`Line up ${side}`}
            aria-pressed={s.settings.layoutSide === side}
            onClick={() => void s.run(() => window.todopop.arrange(side))}
          >
            {{ any: '·', left: '←', top: '↑', bottom: '↓', right: '→' }[side]}
          </button>
        ))}
      </div>
    </div>
  );
}
