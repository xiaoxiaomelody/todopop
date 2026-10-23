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
    <fieldset className="urgency prototype-urgency">
      <legend className="sr-only">Urgency</legend>
      <div className="field-line">
        <span className="eyebrow">Urgency</span>
        <span>{['Just a reminder', 'Soon', 'Today', 'Super urgent'][value - 1]}</span>
      </div>
      <div className="real-slider">
        <div className="real-track" />
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className="real-tick" style={{ left: `${(i / 3) * 100}%` }} />
        ))}
        <span
          className="real-knob"
          style={{
            left: `${((value - 1) / 3) * 100}%`,
            width: dimensions[value],
            height: dimensions[value],
          }}
        />
        <input
          aria-label="Urgency, 1 to 4"
          type="range"
          min="1"
          max="4"
          step="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) as Urgency)}
        />
      </div>
      <div className="real-stops" role="radiogroup" aria-label="Urgency">
        {([1, 2, 3, 4] as Urgency[]).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-label={URGENCY_LABEL[n]}
            aria-checked={value === n}
            onClick={() => onChange(n)}
          >
            {URGENCY_LABEL[n]}
          </button>
        ))}
      </div>
      <p className="urgency-description">
        {value === 1
          ? 'Stays small. A little reminder.'
          : `Grows about 1 logical cm every ${value === 4 ? 2 : value === 3 ? 4 : 8} minutes.`}
      </p>
    </fieldset>
  );
}
