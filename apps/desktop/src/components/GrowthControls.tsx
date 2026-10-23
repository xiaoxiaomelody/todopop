import { Button } from '@todopop/ui';
import { useTaskStore } from '../store/taskStore';
import type { PauseChoice, Side } from '@todopop/shared';
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
              onClick={() => {
                void s.run(() => window.todopop.growthMode(mode));
              }}
            >
              {mode === 'real' ? 'Real speed' : 'Demo · 60×'}
            </button>
          ))}
        </div>
      </div>
      <p className="hint">
        {s.growthMode === 'demo'
          ? 'Preview only. Leave Demo to restore real sizes.'
          : 'Now! grows about 1 logical cm every 2 minutes.'}
      </p>
      <div className="field-line">
        <span className="eyebrow">
          {s.paused ? 'Growth paused' : s.full ? 'Screen full · growth stopped' : 'Pause growing'}
        </span>
        {s.paused && (
          <button
            className="text-button"
            onClick={() => {
              void s.run(() => window.todopop.pause('resume'));
            }}
          >
            Resume
          </button>
        )}
      </div>
      {s.paused ? (
        <p className="hint">
          {s.settings.pauseIndefinite
            ? 'Until you resume'
            : `Until ${new Date(s.settings.pauseUntil!).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}`}
        </p>
      ) : (
        <div className="chips pause-chips">
          {(
            [
              ['30m', '30 min'],
              ['1h', '1 hour'],
              ['tomorrow', 'Till tomorrow'],
              ['manual', 'Until I resume'],
            ] as [PauseChoice, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => {
                void s.run(() => window.todopop.pause(id));
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {s.full && <p className="hint">Pop a bubble to make room. Your controls stay accessible.</p>}
      <div className="arrange">
        <span className="eyebrow">Arrange</span>
        <button
          className="text-button"
          onClick={() => {
            void s.run(() => window.todopop.arrange('shuffle'));
          }}
        >
          Shuffle
        </button>
        <div className="side-buttons">
          {(
            [
              ['any', '·'],
              ['left', '←'],
              ['top', '↑'],
              ['bottom', '↓'],
              ['right', '→'],
            ] as [Side, string][]
          ).map(([side, label]) => (
            <button
              key={side}
              aria-label={`Line up ${side}`}
              title={side === 'any' ? 'Use group positions' : `Line up ${side}`}
              aria-pressed={s.settings.layoutSide === side}
              onClick={() => {
                void s.run(() => window.todopop.arrange(side));
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
