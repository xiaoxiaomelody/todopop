import { designerPresets, designerInk } from '@todopop/shared';
import { useTaskStore } from '../store/taskStore';
import { RingColorPicker } from './RingColorPicker';
import { GroupEditor } from './GroupEditor';
export function Appearance() {
  const s = useTaskStore();
  return (
    <div className="appearance-content prototype-appearance">
      <span className="eyebrow">Tint</span>
      <div className="theme-swatches">
        {designerPresets.map(([h, sat], i) => (
          <button
            key={i}
            aria-label={`Tint ${['Ink Blue', 'Berry', 'Teal', 'Moss', 'Lilac', 'Amber', 'Graphite'][i]}`}
            title={designerInk(h, sat)}
            style={{ background: designerInk(h, sat) }}
            onClick={() =>
              void s.run(() => window.todopop.setSettings({ tintWheel: { h, s: sat } }))
            }
          />
        ))}
      </div>
      <RingColorPicker
        label="Tint"
        value={s.settings.tint}
        wheel={s.settings.tintWheel}
        onChange={(tint) => void s.run(() => window.todopop.setSettings({ tint }))}
        onWheelChange={(tintWheel) => s.run(() => window.todopop.setSettings({ tintWheel }))}
      />
      <GroupEditor initialEdit />
    </div>
  );
}
