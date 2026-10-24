import { ActionGlyph } from '@todopop/ui';
import appPackage from '../../package.json';
export function Tutorial({ onDone }: { onDone(): void }) {
  const shortcuts = [
    ['Click', 'Focus or open link'],
    ['Hold · 0.85s', 'Pop the bubble'],
    ['Right-click', 'Edit the bubble'],
    ['Drag', 'Move bubble or Dock'],
    ['Esc', 'Close panel / leave Focus'],
    ['⌘ ⇧ Space', 'Show TODOPOP'],
  ];
  return (
    <section className="tutorial shortcut-sheet" aria-label="TODOPOP shortcuts">
      <div className="shortcut-heading">
        <h2>Shortcuts</h2>
        <button
          type="button"
          className="shortcut-close"
          aria-label="Close shortcuts"
          onClick={onDone}
        >
          <ActionGlyph name="close" />
        </button>
      </div>
      <dl className="shortcut-list">
        {shortcuts.map(([gesture, description]) => (
          <div key={gesture}>
            <dt>{gesture}</dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
      <div className="shortcut-footer">
        <span>TODOPOP</span>
        <span>v{appPackage.version}</span>
      </div>
    </section>
  );
}
