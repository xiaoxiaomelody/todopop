import { SideGlyph } from './GroupEditor';
import { useTaskStore } from '../store/taskStore';
import type { Side } from '@todopop/shared';
export function GrowthControls() {
  const s = useTaskStore();
  return (
    <div className="growth-controls">
      <div className="side-buttons">
        <button
          type="button"
          aria-label="Shuffle bubbles"
          onClick={() => void s.run(() => window.todopop.arrange('shuffle'))}
        >
          ⤨
        </button>
        {(['any', 'left', 'top', 'bottom', 'right'] as Side[]).map((side) => (
          <button
            type="button"
            key={side}
            aria-label={side === 'any' ? 'Arrange by group' : `Line up all ${side}`}
            title={side === 'any' ? 'By group' : `All bubbles: ${side}`}
            aria-pressed={s.settings.layoutSide === side}
            onClick={() => void s.run(() => window.todopop.arrange(side))}
          >
            <SideGlyph side={side} />
          </button>
        ))}
      </div>
      <p className="arrange-scope">
        {s.full
          ? '95% covered · growth stopped'
          : s.settings.layoutSide === 'any'
            ? 'By group'
            : `All bubbles · ${s.settings.layoutSide}`}
      </p>
      <details className="growth-mode-details">
        <summary>Growth · {s.growthMode === 'real' ? 'Real' : 'Demo 60×'}</summary>
        <div className="segmented" aria-label="Growth mode">
          {(['real', 'demo'] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              aria-pressed={s.growthMode === mode}
              onClick={() => void s.run(() => window.todopop.growthMode(mode))}
            >
              {mode === 'real' ? 'Real speed' : 'Demo · 60×'}
            </button>
          ))}
        </div>
        <p className="hint">Demo previews growth; task actions are real.</p>
      </details>
    </div>
  );
}
