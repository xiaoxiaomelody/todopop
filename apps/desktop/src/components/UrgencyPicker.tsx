import { URGENCY_LABEL, type Urgency } from '@todopop/shared';
import tick from '../assets/23a8a.svg';
import knob1 from '../assets/d0b4a.svg';
import knob2 from '../assets/27b9e.svg';
import knob3 from '../assets/50a37.svg';
import knob4 from '../assets/ac4c8.svg';
const knobs = { 1: knob1, 2: knob2, 3: knob3, 4: knob4 };
const dimensions = { 1: 14, 2: 18, 3: 23, 4: 29 };
const descriptions = [
  'Stays small. A little bubble that sits on screen to remind you.',
  'A gentle nudge for something you should do soon.',
  'Keep it in sight. Make some progress today.',
  'Your biggest bubble. Give this one your attention.',
];
export function UrgencyPicker({ value, onChange }: { value: Urgency; onChange(v: Urgency): void }) {
  return (
    <fieldset className="urgency">
      <legend className="sr-only">Urgency</legend>
      <div className="field-line">
        <span className="eyebrow">Urgency</span>
        <span>{['Just a reminder', 'Soon', 'Today', 'Super urgent'][value - 1]}</span>
      </div>
      <div className="urgency-track" role="radiogroup" aria-label="Urgency">
        {([1, 2, 3, 4] as Urgency[]).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === value}
            aria-label={URGENCY_LABEL[n]}
            onClick={() => onChange(n)}
            className={n === value ? 'selected' : ''}
          >
            <span className="stop-slot">
              <img
                src={n === value ? knobs[n] : tick}
                width={n === value ? dimensions[n] : 4.8}
                height={n === value ? dimensions[n] : 4.8}
                alt=""
              />
            </span>
            <span>{URGENCY_LABEL[n]}</span>
          </button>
        ))}
      </div>
      <p className="hint">{descriptions[value - 1]}</p>
    </fieldset>
  );
}
